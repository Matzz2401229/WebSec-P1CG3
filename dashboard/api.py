from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
import os
import subprocess
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

app = FastAPI(title="WAFGuard API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'database'),
    'user': os.getenv('DB_USER', 'wafguard'),
    'password': os.getenv('DB_PASSWORD', 'wafguard123'),
    'database': os.getenv('DB_NAME', 'wafguard')
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

@app.get("/")
def read_root():
    return {"status": "WAFGuard API is running"}

@app.get("/api/events")
def get_events(limit: int = 50, offset: int = 0):
    """Get recent security events"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT id, src_ip, rule_id, payload, uri, action, timestamp 
            FROM events 
            ORDER BY timestamp DESC 
            LIMIT %s OFFSET %s
        """, (limit, offset))
        
        events = cursor.fetchall()
        
        # Convert datetime to string for JSON serialization
        for event in events:
            if 'timestamp' in event and event['timestamp']:
                event['timestamp'] = event['timestamp'].isoformat()
        
        cursor.close()
        conn.close()
        
        return {"events": events, "count": len(events)}
    except Exception as e:
        return {"error": str(e), "events": []}

@app.get("/api/stats")
def get_stats():
    """Get dashboard statistics"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Total events
        cursor.execute("SELECT COUNT(*) as total FROM events")
        total = cursor.fetchone()['total']
        
        # Events in last hour
        cursor.execute("""
            SELECT COUNT(*) as recent 
            FROM events 
            WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        """)
        recent = cursor.fetchone()['recent']
        
        # Top attacking IPs
        cursor.execute("""
            SELECT src_ip, COUNT(*) as count 
            FROM events 
            GROUP BY src_ip 
            ORDER BY count DESC 
            LIMIT 5
        """)
        top_ips = cursor.fetchall()
        
        # Top triggered rules
        cursor.execute("""
            SELECT rule_id, payload, COUNT(*) as count 
            FROM events 
            GROUP BY rule_id, payload
            ORDER BY count DESC 
            LIMIT 5
        """)
        top_rules = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return {
            "total_events": total,
            "recent_events": recent,
            "top_ips": top_ips,
            "top_rules": top_rules
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/events/{event_id}/action")
def update_event_action(event_id: int, action: str):
    """Update event action (allow/block/challenge)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE events 
            SET action = %s 
            WHERE id = %s
        """, (action, event_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": f"Event {event_id} updated to {action}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    
# --- LOG MANAGER ENDPOINT ---
class ClearEventsRequest(BaseModel):
    rule_id: Optional[str] = None
    filter_date: Optional[str] = None
    filter_time: Optional[str] = None
    event_ids: Optional[List[int]] = None  # UPDATED: Now takes a list of IDs for checkboxes

@app.post("/api/events/clear")
def clear_events(req: ClearEventsRequest):
    """Clear events based on rule ID, specific date, specific time, or multiple selected IDs"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "DELETE FROM events WHERE 1=1"
        params = []
        
        # If specific event IDs are provided from the checkboxes, ONLY delete those
        if req.event_ids and len(req.event_ids) > 0:
            format_strings = ','.join(['%s'] * len(req.event_ids))
            query += f" AND id IN ({format_strings})"
            params.extend(req.event_ids)
        else:
            # Otherwise, use the bulk text filters
            if req.rule_id:
                query += " AND rule_id = %s"
                params.append(req.rule_id)
                
            if req.filter_date:
                query += " AND DATE(timestamp) = %s"
                params.append(req.filter_date)
                
            if req.filter_time:
                query += " AND TIME(timestamp) LIKE %s"
                params.append(f"{req.filter_time}%")
            
        # If NO filters are provided at all, wipe the whole table instantly
        if not req.rule_id and not req.filter_date and not req.filter_time and not req.event_ids:
            cursor.execute("DELETE FROM events")
            deleted_count = cursor.rowcount
        else:
            cursor.execute(query, tuple(params))
            deleted_count = cursor.rowcount
            
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": f"Deleted {deleted_count} events."}

    except Exception as e:
        return {"success": False, "error": str(e)}
    
# --- DYNAMIC RULES (UNIVERSAL CONTROL) ---

DYNAMIC_RULES_PATH = "/etc/nginx/conf.d/dynamic-rules.conf"

def write_dynamic_rules(cursor):
    """
    Rewrite dynamic-rules.conf from the current ip_rules table.

    Rule ordering:
      1. ALLOW rules always come first so explicit whitelists take precedence.
      2. BLOCK rules come after.

    Combinations supported:
      allow + ip only       → ctl:ruleEngine=Off for that IP (full whitelist)
      allow + ip + rule     → ctl:ruleRemoveById for that IP only (targeted false positive)
      allow + rule only     → SecRuleRemoveById globally (skipped if rule is enforced)
      block + ip only       → deny ALL traffic from this IP (full blacklist)
      block + ip + rule     → comment only; ModSec default blocking applies for that rule
      block + rule only     → marks rule as enforced; prevents global suppression
    """
    cursor.execute("SELECT * FROM ip_rules ORDER BY created_at ASC")
    rules = cursor.fetchall()

    allow_rules = [r for r in rules if r['type'] == 'allow']
    block_rules  = [r for r in rules if r['type'] == 'block']

    # Collect rules explicitly marked as enforced (block + rule only, no IP)
    # These prevent a corresponding allow/suppress entry from writing SecRuleRemoveById
    enforced_rules = set(
        str(r['rule_id_ref']) for r in block_rules
        if r['ip_address'] is None and r['rule_id_ref'] is not None
    )

    lines = ["# Dynamic WAFGuard rules — managed by dashboard\n\n"]
    rule_id_counter = 30001

    # --- ALLOW rules first ---
    for rule in allow_rules:
        ip  = rule.get('ip_address')
        rid = str(rule.get('rule_id_ref')) if rule.get('rule_id_ref') else None

        if ip and rid:
            # Suppress specific rule for this IP only (targeted false positive fix)
            lines.append(
                f'SecRule REMOTE_ADDR "@ipMatch {ip}" '
                f'"id:{rule_id_counter},phase:1,pass,nolog,ctl:ruleRemoveById={rid}"\n'
            )
            rule_id_counter += 1
        elif ip and not rid:
            # Full IP whitelist — bypass all WAF rules for this IP
            lines.append(
                f'SecRule REMOTE_ADDR "@ipMatch {ip}" '
                f'"id:{rule_id_counter},phase:1,pass,nolog,ctl:ruleEngine=Off"\n'
            )
            rule_id_counter += 1
        elif not ip and rid:
            # Global rule suppression — skip if this rule is marked as enforced
            if rid not in enforced_rules:
                lines.append(f'SecRuleRemoveById {rid}\n')

    # --- BLOCK rules after ---
    for rule in block_rules:
        ip  = rule.get('ip_address')
        rid = str(rule.get('rule_id_ref')) if rule.get('rule_id_ref') else None

        if ip and not rid:
            # Full IP blacklist — deny ALL traffic from this IP regardless of rule
            lines.append(
                f'SecRule REMOTE_ADDR "@ipMatch {ip}" '
                f'"id:{rule_id_counter},phase:1,deny,status:403,msg:\'WAFGuard Blocked IP\'"\n'
            )
            rule_id_counter += 1
        elif ip and rid:
            # Scoped block — this IP is flagged for a specific rule only
            # ModSecurity's default blocking already handles this (rules block on match)
            # No deny directive needed — adding one would incorrectly block ALL traffic from this IP
            lines.append(f'# IP {ip} flagged for rule {rid} — ModSecurity default blocking applies\n')
        elif not ip and rid:
            # Enforce rule for all IPs — no directive needed (ModSec blocks by default)
            # Presence in enforced_rules set prevents global suppression above
            lines.append(f'# Rule {rid} enforced for all IPs — global suppression blocked\n')

    with open(DYNAMIC_RULES_PATH, 'w') as f:
        f.writelines(lines)

def reload_modsecurity():
    """Trigger nginx reload inside the modsecurity container"""
    subprocess.run(["docker", "exec", "wafguard-modsecurity", "nginx", "-s", "reload"])

@app.get("/api/rules")
def get_rules():
    """Get all dynamic IP/rule entries"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM ip_rules ORDER BY created_at DESC")
        rules = cursor.fetchall()
        for rule in rules:
            if 'created_at' in rule and rule['created_at']:
                rule['created_at'] = rule['created_at'].isoformat()
        cursor.close()
        conn.close()
        return {"rules": rules}
    except Exception as e:
        return {"error": str(e), "rules": []}

class IpRuleRequest(BaseModel):
    type: str                      # 'allow' or 'block'
    ip_address: Optional[str] = None  # IP address (null = applies to all IPs)
    rule_id_ref: Optional[str] = None # Rule ID reference (null = applies to all rules)
    reason: Optional[str] = None

@app.post("/api/rules")
def add_rule(req: IpRuleRequest):
    """Add a new dynamic rule. At least one of ip_address or rule_id_ref must be provided."""
    try:
        # Validate that at least one target is specified
        if not req.ip_address and not req.rule_id_ref:
            return {"success": False, "error": "At least one of IP Address or Rule ID must be provided."}

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            INSERT INTO ip_rules (type, ip_address, rule_id_ref, reason)
            VALUES (%s, %s, %s, %s)
        """, (req.type, req.ip_address or None, req.rule_id_ref or None, req.reason))
        conn.commit()
        write_dynamic_rules(cursor)
        cursor.close()
        conn.close()
        reload_modsecurity()
        label = req.ip_address or f"Rule {req.rule_id_ref}"
        return {"success": True, "message": f"Rule added for {label}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.delete("/api/rules/{rule_id}")
def delete_rule(rule_id: int):
    """Delete a dynamic rule"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("DELETE FROM ip_rules WHERE id = %s", (rule_id,))
        conn.commit()
        write_dynamic_rules(cursor)
        cursor.close()
        conn.close()
        reload_modsecurity()
        return {"success": True, "message": f"Rule {rule_id} deleted"}
    except Exception as e:
        return {"success": False, "error": str(e)}

