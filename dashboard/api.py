from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
import os
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

app = FastAPI(title="WAFGuard API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3002", "http://localhost:3000"],
    allow_credentials=True,
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