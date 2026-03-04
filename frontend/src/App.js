import React, { useState, useEffect, useRef } from 'react';
import './App.css';

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';

import { Line } from 'react-chartjs-2';

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);


// IMPORTANT: Use the correct API URL
//const API_BASE = 'http://localhost:3001/api';
const API_BASE = window.location.origin + '/api';

function App() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollingRef = useRef(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null); // Tracks which row is expanded (stores event.id, null = all collapsed)
  const [attackHistory, setAttackHistory] = useState([]);

  // Fetch events from API
  const fetchEvents = async () => {
    try {
      console.log('Fetching events from:', `${API_BASE}/events`); // Debug log
      const response = await fetch(`${API_BASE}/events?limit=50`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received data:', data); // Debug log
      
      setEvents(data.events || []);

  const now = new Date().toLocaleTimeString();

  const severitySnapshot = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  data.events.forEach(event => {
    const severity = getSeverity(event.rule_id);
    if (severitySnapshot[severity] !== undefined) {
      severitySnapshot[severity]++;
    }
  });

  setAttackHistory(prev => {
   const updated = [
    ...prev,
    {
      time: now,
      ...severitySnapshot,
    },
    ];

  if (updated.length > 10) {
    updated.shift();
  }

   return updated;
  });

      setError(null);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received stats:', data); // Debug log
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Real-time polling with useEffect and useRef
  useEffect(() => {
    console.log('Component mounted, starting data fetch...'); // Debug log
    
    // Initial fetch
    fetchEvents();
    fetchStats();

    // Start polling every 3 seconds
    pollingRef.current = setInterval(() => {
      fetchEvents();
      fetchStats();
    }, 3000);

    // Cleanup on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Handle action buttons
  const handleAction = async (eventId, action) => {
    try {
      await fetch(`${API_BASE}/events/${eventId}/action?action=${action}`, {
        method: 'POST',
      });
      // Refresh events after action
      fetchEvents();
    } catch (error) {
      console.error('Error updating action:', error);
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // ===== Severity Classification =====
  const getSeverity = (ruleId) => {
    const id = ruleId?.toString() || "";
    
    if (id.startsWith("941")) return "CRITICAL";
    if (id.startsWith("942")) return "HIGH";
    if (id.startsWith("930")) return "MEDIUM";
    if (id.startsWith("950")) return "LOW";
    
    return "LOW";
  };

  const calculateThreatLevel = () => {
  if (!events.length) return "NORMAL";

  const severities = events.map(e => getSeverity(e.rule_id));

  if (severities.includes("CRITICAL")) return "CRITICAL";

  const highCount = severities.filter(s => s === "HIGH").length;
  if (highCount > 3) return "ELEVATED";

  return "NORMAL";
};
  const threatLevel = calculateThreatLevel();

  const displayedEvents = criticalOnly
  ? events.filter(e => getSeverity(e.rule_id) === "CRITICAL")
  : events;

  const severityCounts = {
  CRITICAL: 0,
  HIGH: 0,
  MEDIUM: 0,
  LOW: 0,
};

  events.forEach(event => {
    const severity = getSeverity(event.rule_id);
    if (severityCounts[severity] !== undefined) {
      severityCounts[severity]++;
    }
  });

  if (loading) {
    return (
      <div className="loading">
        <p>Loading WAFGuard Dashboard...</p>
        {error && <p style={{color: 'red'}}>Error: {error}</p>}
      </div>
    );
  }
  
  const chartData = {
    labels: attackHistory.map(item => item.time),
    datasets: [
      {
        label: "Critical",
        data: attackHistory.map(item => item.CRITICAL),
        borderColor: "#dc3545",
        backgroundColor: "rgba(220,53,69,0.2)",
        tension: 0.3,
        fill: false,
      },
      {
        label: "High",
        data: attackHistory.map(item => item.HIGH),
        borderColor: "#fd7e14",
        backgroundColor: "rgba(253,126,20,0.2)",
        tension: 0.3,
        fill: false,
      },
      {
        label: "Medium",
        data: attackHistory.map(item => item.MEDIUM),
        borderColor: "#ffc107",
        backgroundColor: "rgba(255,193,7,0.2)",
        tension: 0.3,
        fill: false,
      },
      {
        label: "Low",
        data: attackHistory.map(item => item.LOW),
        borderColor: "#28a745",
        backgroundColor: "rgba(40,167,69,0.2)",
        tension: 0.3,
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="App">
      <header className="header">
        <h1>🛡️ WAFGuard Security Dashboard</h1>
        <p>Real-time Web Application Firewall Monitoring</p>
      </header>

      <div className={`threat-banner ${threatLevel}`}>
        {threatLevel === "CRITICAL" && "🔴 SYSTEM UNDER ATTACK"}
        {threatLevel === "ELEVATED" && "🟠 Elevated Threat Activity"}
        {threatLevel === "NORMAL" && "🟢 System Operating Normally"}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#fee',
          color: '#c00',
          padding: '10px',
          margin: '20px',
          borderRadius: '5px'
        }}>
          ⚠️ Error: {error}
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-container">
          <div className="stat-card">
            <h3>Total Events</h3>
            <p className="stat-number">{stats.total_events || 0}</p>
          </div>
          <div className="stat-card">   
            <h3>Last Hour</h3>
            <p className="stat-number">{stats.recent_events || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Top Attacker</h3>
            <p className="stat-ip">
              {stats.top_ips && stats.top_ips.length > 0 
                ? stats.top_ips[0].src_ip 
                : 'N/A'}
            </p>
          </div>
          <div className="severity-summary">
            <div className="severity-item critical">
              CRITICAL: {severityCounts.CRITICAL}
            </div>
            <div className="severity-item high">
              HIGH: {severityCounts.HIGH}
            </div>
            <div className="severity-item medium">
              MEDIUM: {severityCounts.MEDIUM}
            </div>
            <div className="severity-item low">
              LOW: {severityCounts.LOW}
            </div>
          </div>
          <div className="stat-card">
            <h3>Most Triggered</h3>
            <p className="stat-rule">
              {stats.top_rules && stats.top_rules.length > 0 
                ? `Rule ${stats.top_rules[0].rule_id}` 
                : 'N/A'}
            </p>
          </div>
        </div>
      )}
      
      <div style={{ marginBottom: "15px" }}>
        <button
        className={`btn ${criticalOnly ? "btn-block" : "btn-expand"}`}
        onClick={() => setCriticalOnly(!criticalOnly)}
        >
          Critical Only: {criticalOnly ? "ON" : "OFF"}
          </button>
        </div>
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "10px",
            marginBottom: "25px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ marginBottom: "15px" }}>Real-Time Attack Trend</h3>
          <div style={{ height: "150px" }}>
          <Line data={chartData} options={chartOptions} />
          </div>
        </div>

      {/* Events Table */}
      <div className="events-section">
        <h2>Security Events ({events.length})</h2>
        
        {events.length === 0 ? (
          <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
            <p>No security events detected yet.</p>
            <p>Try generating some attacks:</p>
            <code>curl "http://localhost:8080/?id=1' OR 1=1--"</code>
          </div>
        ) : (
          <div className="table-container">
            <table className="events-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source IP</th>
                  <th>Rule ID</th>
                  <th>Severity</th>
                  <th>Attack Type</th>
                  <th>Target URI</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedEvents.map((event) => (              
                  <> 
                  {/* Fragment needed to return two <tr> elements per row without invalid HTML wrapper */}
                  {/* Clicking the button toggles the expanded detail view below it */}

                  <tr key={event.id} style={{cursor: 'default'}}>
                    <td>{formatTime(event.timestamp)}</td>
                    <td className="ip-cell">{event.src_ip}</td>

                    {<td>
                      <span className="badge badge-gray">
                        {event.rule_id}
                      </span>
                      </td> }

                    <td>
                      <span className={`severity-badge ${getSeverity(event.rule_id)}`}>
                        {getSeverity(event.rule_id)}
                        </span>
                      </td>

                    <td className="payload-cell">{event.payload}</td>
                    <td className="uri-cell">{event.uri}</td>
                    <td>
                      <span className={`status-${event.action}`}>
                        {event.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn btn-expand"
                        onClick={() => setExpandedRow(expandedRow === event.id ? null : event.id)}
                      >
                        {expandedRow === event.id ? 'Collapse ▲' : 'Expand ▼'}
                      </button>
                      <button 
                        className="btn btn-allow"
                        onClick={() => handleAction(event.id, 'allow')}
                      >
                        Allow
                      </button>
                      <button 
                        className="btn btn-block"
                        onClick={() => handleAction(event.id, 'block')}
                      >
                        Block
                      </button>
                    </td>
                  </tr>

                  {/* Conditionally renders a detail row beneath the clicked event row */}
                  {expandedRow === event.id && (
                      <tr className="expanded-row">
                        <td colSpan={8}>
                          <div className="expanded-details">
                            <p><strong>Full Payload:</strong> {event.payload}</p>
                            <p><strong>Full URI:</strong> {event.uri}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
