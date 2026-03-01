import time
import json
import mysql.connector
import os

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'database'),
    'user': os.getenv('DB_USER', 'wafguard'),
    'password': os.getenv('DB_PASSWORD', 'wafguard123'),
    'database': os.getenv('DB_NAME', 'wafguard')
}

LOG_FILE = '/var/log/nginx/modsec_audit.log'

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

def process_log_entry(log_entry):
    """Extract and insert event into database"""
    try:
        transaction = log_entry.get('transaction', {})
        src_ip = transaction.get('client_ip', 'unknown')
        request_info = transaction.get('request', {})
        uri = request_info.get('uri', '/')
        
        # Extract messages/alerts
        messages = transaction.get('messages', [])
        
        if not messages:
            # Only warn for non-localhost traffic
            if src_ip != '127.0.0.1':
                print(f"⚠️  No messages in log entry from {src_ip} for {uri}", flush=True)
            return
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        for msg in messages:
            # FIX: ruleId is inside 'details', not at top level
            details = msg.get('details', {})
            rule_id = details.get('ruleId', 'unknown')
            payload = msg.get('message', 'No message')
            
            query = """
                INSERT INTO events (src_ip, rule_id, payload, uri, action)
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(query, (src_ip, rule_id, payload, uri, 'block'))
            print(f"✅ Inserted event: {src_ip} -> Rule {rule_id} -> {uri}", flush=True)
        
        conn.commit()
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error processing log entry: {e}", flush=True)

def tail_log():
    """Continuously tail the log file"""
    print(f"📖 Tailing log file: {LOG_FILE}", flush=True)
    
    if not os.path.exists(LOG_FILE):
        print(f"Creating empty log file: {LOG_FILE}", flush=True)
        open(LOG_FILE, 'a').close()
    
    last_position = os.path.getsize(LOG_FILE)
    print(f"Starting from position: {last_position}", flush=True)
    partial_line = ""
    
    while True:
        try:
            current_size = os.path.getsize(LOG_FILE)
            if current_size > last_position:
                with open(LOG_FILE, 'r', encoding='utf-8', errors='ignore') as f:
                    f.seek(last_position)
                    content = f.read()
                    last_position = f.tell()
                
                content = partial_line + content
                lines = content.split('\n')
                partial_line = lines[-1]
                
                for line in lines[:-1]:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        log_entry = json.loads(line)
                        process_log_entry(log_entry)
                    except json.JSONDecodeError as e:
                        print(f"⚠️  JSON decode error: {e}", flush=True)
                        continue
            
            time.sleep(0.5)
            
        except Exception as e:
            print(f"❌ Error in tail_log: {e}", flush=True)
            time.sleep(1)

if __name__ == "__main__":
    print("=== WAFGuard Log Parser v2 started ===", flush=True)
    print(f"DB_HOST: {DB_CONFIG['host']}", flush=True)
    print(f"Looking for log at: {LOG_FILE}", flush=True)
    
    while not os.path.exists(LOG_FILE):
        print(f"⏳ Waiting for {LOG_FILE}...", flush=True)
        time.sleep(2)
    
    print(f"✅ Log file found: {LOG_FILE}", flush=True)
    tail_log()
