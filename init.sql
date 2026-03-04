-- init.sql
USE wafguard;

CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    src_ip VARCHAR(45) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rule_id VARCHAR(20) NOT NULL,
    payload TEXT,
    uri VARCHAR(1024),
    action ENUM('block', 'log', 'allow') DEFAULT 'log',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incidents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    src_ip VARCHAR(45) NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity ENUM('Low', 'Medium', 'High') NOT NULL,
    first_seen TIMESTAMP NOT NULL,
    last_seen TIMESTAMP NOT NULL,
    event_count INT DEFAULT 1,
    UNIQUE(src_ip, category, first_seen)
);

CREATE TABLE incident_events (
    incident_id INT NOT NULL,
    event_id INT NOT NULL,
    PRIMARY KEY (incident_id, event_id),
    FOREIGN KEY(incident_id) REFERENCES incidents(id),
    FOREIGN KEY(event_id) REFERENCES events(id)
);

-- TABLE FOR DYNAMIC RULES (WHITELIST/BLACKLISTS)
-- ip_address and rule_id_ref are both nullable to support flexible combinations:
--   block + ip only       = full IP blacklist (block all requests from this IP)
--   block + ip + rule     = block IP, tagged/annotated as caused by specific rule
--   block + rule only     = enforce rule for all IPs (prevents global suppression via dashboard)
--   allow + ip only       = full IP whitelist (bypass all WAF rules for this IP)
--   allow + ip + rule     = suppress rule for this IP only (targeted false positive fix)
--   allow + rule only     = suppress rule globally for all IPs
CREATE TABLE ip_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(10) NOT NULL,            -- 'allow' or 'block'
    ip_address VARCHAR(100) DEFAULT NULL, -- IP address (null = applies to all IPs)
    rule_id_ref VARCHAR(50) DEFAULT NULL, -- Rule ID reference (null = applies to all rules)
    reason VARCHAR(255),                  -- admin's note / audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_ip (ip_address)
);