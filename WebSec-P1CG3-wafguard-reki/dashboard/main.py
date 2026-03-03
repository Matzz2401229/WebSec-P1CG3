from fastapi import FastAPI
import mysql.connector
import os

app = FastAPI()

def get_db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=3306,
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )

@app.get("/")
def read_root():
    return {"message": "WAFGuard Dashboard is running"}

@app.get("/events")
def list_events():
    cnx = get_db()
    cur = cnx.cursor(dictionary=True)
    cur.execute("SELECT * FROM events ORDER BY timestamp DESC LIMIT 100")
    events = cur.fetchall()
    cnx.close()
    return events

@app.get("/incidents")
def list_incidents():
    cnx = get_db()
    cur = cnx.cursor(dictionary=True)
    cur.execute("SELECT * FROM incidents ORDER BY last_seen DESC LIMIT 100")
    incidents = cur.fetchall()
    cnx.close()
    return incidents

@app.get("/stats/attack_types")
def attack_types():
    cnx = get_db()
    cur = cnx.cursor(dictionary=True)
    cur.execute("""
        SELECT
            category,
            COUNT(*) AS count
        FROM incidents
        GROUP BY category
    """)
    stats = cur.fetchall()
    cnx.close()
    return stats
