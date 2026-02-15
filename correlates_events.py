import mysql.connector
from datetime import datetime, timedelta
import os

WINDOW_SECONDS = 60
MIN_HIGH = 5
MIN_MEDIUM = 2

def get_db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=3306,
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )

def get_attack_type(rule_id):
    prefix = rule_id[:3]
    return CRS_CATEGORIES.get(prefix, 'Generic')

def correlate_event(cur, event_id, src_ip, rule_id, timestamp):
    category = get_attack_type(rule_id)
    now = datetime.fromisoformat(timestamp)

    # Look for recent incident (same IP + category)
    cutoff = now - timedelta(seconds=WINDOW_SECONDS)

    cur.execute(
        """
        SELECT id, event_count, first_seen, last_seen
        FROM incidents
        WHERE src_ip = %s AND category = %s AND last_seen >= %s
        ORDER BY last_seen DESC
        LIMIT 1
        """,
        (src_ip, category, cutoff)
    )

    row = cur.fetchone()

    if row:
        incident_id, count, first_seen, last_seen = row
        new_count = count + 1
        severity = "Low"
        if new_count >= MIN_HIGH:
            severity = "High"
        elif new_count >= MIN_MEDIUM:
            severity = "Medium"

        cur.execute(
            """
            UPDATE incidents
            SET last_seen = %s, event_count = %s, severity = %s
            WHERE id = %s
            """,
            (now, new_count, severity, incident_id)
        )

        cur.execute(
            "INSERT INTO incident_events (incident_id, event_id) VALUES (%s, %s)",
            (incident_id, event_id)
        )
    else:
        severity = "Low"
        cur.execute(
            """
            INSERT INTO incidents (src_ip, category, severity, first_seen, last_seen, event_count)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (src_ip, category, severity, now, now, 1)
        )
        incident_id = cur.lastrowid
        cur.execute(
            "INSERT INTO incident_events (incident_id, event_id) VALUES (%s, %s)",
            (incident_id, event_id)
        )
