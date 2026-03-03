# WAFGuard - Educational Web Application Firewall Platform

## Team P1CG3
**ICT2214 Web Security Project**

WAFGuard is an educational WAF platform that addresses transparency and usability gaps in traditional WAF deployments. Built on ModSecurity with OWASP Core Rule Set, it focuses on providing real-time security monitoring, attack visualization, and educational context for security events.

---

## 🏗️ Architecture

```
User Request → ModSecurity (Port 8080) → OWASP Juice Shop (Port 3000)
                    ↓
              Audit Logs (JSON)
                    ↓
              Log Parser → MySQL Database
                    ↓
           FastAPI Backend (Port 3001)
                    ↓
           React Dashboard (Port 3002)
```

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed
- Git installed
- Ports 3000, 3001, 3002, 3306, and 8080 available

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Matzz2401229/WebSec-P1CG3.git
   cd WebSec-P1CG3-wafguard
   ```

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Wait for services to initialize** (1-2 minutes for npm install)

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| **WAF-Protected App** | http://localhost:8080 | Juice Shop protected by ModSecurity |
| **Direct App Access** | http://localhost:3000 | Juice Shop without WAF (for comparison) |
| **API Backend** | http://localhost:3001/api/events | FastAPI security events API |
| **Dashboard** | http://localhost:3002 | Real-time security monitoring dashboard |
| **Database** | localhost:3306 | MySQL (user: wafguard, pass: wafguard123) |

---

## 🧪 Testing Attack Detection

### SQL Injection Test
```bash
curl "http://localhost:8080/?id=1' OR 1=1--"
```
Expected: **403 Forbidden** + Event appears in dashboard

### XSS Test
```bash
curl "http://localhost:8080/search?q=<script>alert('XSS')</script>"
```
Expected: **403 Forbidden** + Event logged

### Path Traversal Test
```bash
curl "http://localhost:8080/ftp/../../etc/passwd"
```
Expected: **403 Forbidden** + Rule 930100 triggered

### View Results
- Check dashboard: http://localhost:3002
- Check API: http://localhost:3001/api/events
- Check logs: `docker logs -f wafguard-dashboard`

---

## 📊 Dashboard Features

### Real-Time Monitoring
- **Auto-refresh every 3 seconds** - Live attack feed
- **Statistics cards** - Total events, recent activity, top attackers
- **Color-coded alerts** - Red (XSS), Orange (SQLi), Yellow (LFI)

### Interactive Controls
- **Allow/Block actions** - Override WAF decisions
- **Event filtering** - View by IP, rule ID, or time range
- **Attack details** - Full payload and URI information

### Educational Context
- **Rule explanations** - Human-readable descriptions of triggered rules
- **OWASP CRS mapping** - Links rules to OWASP Top 10 categories
- **Attack pattern analysis** - Groups related alerts into incidents

---

## 🗂️ Project Structure

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

## 🔧 Configuration

### ModSecurity Settings
Edit `nginx/modsecurity-override.conf.template`:
```nginx
SecAuditEngine On
SecAuditLogType Serial
SecAuditLogFormat JSON
SecAuditLog /var/log/nginx/modsec_audit.log
SecAuditLogParts ABCFHZ

# Adjust paranoia level (1-4, higher = stricter)
SecAction "id:900110,phase:1,nolog,pass,t:none,setvar:tx.inbound_anomaly_score_threshold=5"
```

### Database Schema
Default schema in `init.sql`:
```sql
CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    src_ip VARCHAR(45) NOT NULL,
    rule_id VARCHAR(50) NOT NULL,
    payload TEXT,
    uri VARCHAR(500),
    action VARCHAR(20) DEFAULT 'block',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp),
    INDEX idx_src_ip (src_ip)
);
```

---

## 🐛 Troubleshooting

### Dashboard shows "Loading..." forever
```bash
# Check backend API is running
curl http://localhost:3001/api/events

# Check database connection
docker exec -it wafguard-database mysql -uwafguard -pwafguard123 wafguard -e "SELECT COUNT(*) FROM events;"
```

### No attacks appearing in dashboard
```bash
# Check ModSecurity is blocking
curl -v "http://localhost:8080/?id=1' OR 1=1--"  # Should return 403

# Check logs are being generated
docker exec wafguard-modsecurity ls -lah /var/log/nginx/

# Check parser is running
docker logs -f wafguard-dashboard
```

### Frontend ERR_EMPTY_RESPONSE
```bash
# Check frontend logs
docker logs -f wafguard-frontend

# Wait for "Compiled successfully!" message
# Should take 2-5 minutes on first build
```

### Database connection errors
```bash
# Verify database is up
docker ps | grep database

# Test connection
docker exec -it wafguard-database mysql -uroot -prootpass123 -e "SHOW DATABASES;"
```

---

## 📈 API Endpoints

### GET /api/events
Returns recent security events
```bash
curl http://localhost:3001/api/events?limit=10
```

### GET /api/stats
Returns dashboard statistics
```bash
curl http://localhost:3001/api/stats
```

### POST /api/events/{id}/action
Update event action (allow/block)
```bash
curl -X POST "http://localhost:3001/api/events/1/action?action=allow"
```

---

## 🛑 Stopping Services

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (reset database)
docker-compose down -v

# Remove all containers and images
docker-compose down --rmi all -v
```

---

## 🎯 Educational Goals

WAFGuard demonstrates:
1. **ModSecurity Integration** - Industry-standard WAF engine with OWASP CRS
2. **Log Parsing & Analysis** - Real-time audit log processing
3. **API Development** - FastAPI backend with MySQL integration
4. **Frontend Development** - React dashboard with real-time polling
5. **Containerization** - Multi-service Docker deployment
6. **Security Monitoring** - Attack detection and visualization

---

## 📝 Development Notes

### Adding Custom Rules
Edit `nginx/modsecurity-override.conf.template`:
```nginx
# Block specific user agents
SecRule REQUEST_HEADERS:User-Agent "@contains bot" \
    "id:999001,phase:1,deny,status:403,msg:'Bot detected'"
```

### Extending the Database
```sql
ALTER TABLE events ADD COLUMN severity VARCHAR(20);
ALTER TABLE events ADD COLUMN country VARCHAR(50);
```

### Customizing the Dashboard
Edit `frontend/src/App.js` to add new features like:
- Real-time charts with attack trends
- IP geolocation mapping
- Custom filtering and search

---

## 👥 Team Members

- **Person 1**: Infrastructure Lead (Docker, Networking)
- **Person 2**: Security Specialist (ModSecurity, CRS Configuration)
- **Person 3**: Data Architect (Log Parser, Database)
- **Person 4**: Backend Developer (FastAPI, API Design)
- **Person 5**: Frontend Developer (React, Dashboard UI)

---

## 📚 References

- [OWASP ModSecurity Core Rule Set](https://owasp.org/www-project-modsecurity-core-rule-set/)
- [ModSecurity Documentation](https://github.com/SpiderLabs/ModSecurity)
- [OWASP Juice Shop](https://owasp.org/www-project-juice-shop/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)

---

## 📄 License

Educational project for ICT2214 Web Security Course

---

## 🔗 Repository

https://github.com/Matzz2401229/WebSec-P1CG3
