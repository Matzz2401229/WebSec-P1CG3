@"
# WAFGuard - Web Application Firewall

## Team P1CG3
ICT2214 Web Security Project

## Quick Start

1. Install Docker Desktop
2. Clone this repo: ``git clone https://github.com/Matzz2401229/WebSec-P1CG3.git``
3. Navigate: ``cd WebSec-P1CG3``
4. Start: ``docker-compose up``
5. Access Juice Shop (with WAF): http://localhost:8080
6. Access Juice Shop (no WAF): http://localhost:3000

## Test Attack Blocking

Try: ``http://localhost:8080/?q=<script>alert(1)</script>``

Should get 403 Forbidden!

## Stop

``docker-compose down``
"@ | Out-File -FilePath README.md -Encoding UTF8
