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
