# WAFGuard — Web Application Firewall Dashboard
ICT2214 Web Security | Group P1CG3

WAFGuard is a reverse-proxy Web Application Firewall built on ModSecurity and the OWASP Core Rule Set (CRS). It provides real-time attack detection, a live security dashboard, and dynamic rule management — making WAF decisions visible and actionable rather than hidden in raw logs.

---

## Current Branch
The most up-to-date branch is: `Working`

---

## Architecture Overview

```
User Request → Nginx Admin Proxy (Port 80, Basic Auth)
                        ↓
            ModSecurity Engine (Port 8080)
                        ↓
            OWASP Juice Shop (Port 3000)
                        ↓
            Log Parser → MySQL Database
                        ↓
            FastAPI Backend (Port 3001)
                        ↓
            React Dashboard (Port 3002)
```

All external access to Ports 3000–3002 is closed. All traffic is routed strictly through the Nginx proxy and ModSecurity inspection engine.

---

## Prerequisites

- Docker Desktop installed
- Git installed
- Ubuntu VM with Bridged network adapter configured to the correct physical Wi-Fi card

---

## VM Setup

1. Import the OVF file and configure the virtual disk
2. Set the network adapter to **Bridged** and select the correct physical Wi-Fi card — this exposes authentic source IPs to ModSecurity rather than the Docker gateway IP

---

## VM Credentials

| Field | Value |
|-------|-------|
| Username | `waf` |
| Password | `wafguard123` |

---

## Pulling Latest Code on the Ubuntu VM

```bash
cd ~/WebSec-P1CG3-wafguard/
git fetch origin
git checkout Working
git pull origin Working
```

---

## Running the Project

Start all containers (rebuilds to pick up latest code):
```bash
docker compose up -d --build
```

Stop all containers and clear event data:
```bash
docker compose down -v
```

---

## Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | `http://localhost/frontend/` | Real-time security monitoring dashboard |
| WAF-Protected App | `http://localhost` | Juice Shop protected by ModSecurity |
| API Backend | `http://localhost:3001/api/events` | FastAPI security events API |
| Database | `localhost:3306` | MySQL (user: `wafguard`, pass: `wafguard123`) |

**Dashboard Login:** `userwaf` / `wafguard123`

---

## Dashboard Features

**Security Events Tab**
- Real-time table of WAF-detected attacks, auto-refreshes every 3 seconds
- Allow / Block buttons per event trigger instant updates to `dynamic-rules.conf` and auto-reload ModSecurity
- Intelligent conflict resolution prevents contradictory rules from being written
- Events automatically revert to Blocked status when their control rule is removed
- Rule-level descriptions and OWASP CRS context provided for every detected event

**Log Manager Tab**
- View, filter, and bulk delete logged events
- Supports deletion by rule ID, date, time, or selected event IDs
- Useful for clearing false positives and maintaining log hygiene
- Supports up to 1000 events in history

**Universal Control Tab**
- View and manage all active dynamic rules
- Real-time badge showing active rule count at a glance
- Supports 6 rule combinations: IP-only, Rule-only, and IP+Rule for both Allow and Block
- Removing a rule automatically reverts all associated events to Blocked

**Dashboard Overview**
- Adaptive threat banner: 🔴 SYSTEM UNDER ATTACK / 🟠 Elevated Threat / 🟢 Normal
- Real-Time Attack Trend chart tracking CRITICAL, HIGH, MEDIUM, and LOW severity events over time
- Statistics cards showing total events, last issue, top attacker, and most triggered rule

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | Fetch events with limit/offset |
| GET | `/api/stats` | Dashboard statistics |
| POST | `/api/events/{id}/action` | Update event action (allow/block) |
| POST | `/api/events/clear` | Bulk delete by rule_id, date, time, or event_ids |
| GET | `/api/rules` | Fetch all active dynamic rules |
| POST | `/api/rules` | Add a new dynamic rule |
| DELETE | `/api/rules/{id}` | Remove a rule and revert associated events to Blocked |

---

## Project Structure

```
WebSec-P1CG3-wafguard/
├── dashboard/
│   ├── api.py                    # FastAPI backend
│   ├── log_parser.py             # ModSecurity log parser
│   ├── requirements.txt          # Python dependencies
│   ├── Dockerfile                # Dashboard container
│   └── start.sh                  # Startup script
├── frontend/
│   ├── src/
│   │   ├── App.js               # React dashboard component
│   │   ├── App.css              # Dashboard styling
│   │   ├── index.js             # React entry point
│   │   └── index.css            # Global styles
│   ├── public/
│   │   └── index.html           # HTML template
│   ├── package.json             # Node dependencies
│   └── .env                     # React environment config
├── nginx/
│   └── modsecurity-override.conf.template  # ModSecurity custom config
├── logs/
│   └── nginx/                   # ModSecurity audit logs
├── init.sql                     # Database schema
├── docker-compose.yaml          # Multi-container orchestration
└── README.md                    # This file
```

---

## References

- [OWASP ModSecurity Core Rule Set](https://owasp.org/www-project-modsecurity-core-rule-set/)
- [ModSecurity Documentation](https://github.com/owasp-modsecurity/ModSecurity)
- [OWASP Juice Shop](https://owasp.org/www-project-juice-shop/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)

---

*Educational project for ICT2214 Web Security, Singapore Institute of Technology (AY25/26 Tri 2)*
