import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// IMPORTANT: Use the correct API URL
const API_BASE = 'http://localhost:3001/api';

function App() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollingRef = useRef(null);

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

  // Get severity badge color
  const getSeverityColor = (ruleId) => {
    if (ruleId.startsWith('941')) return 'badge-red';    // XSS
    if (ruleId.startsWith('942')) return 'badge-orange'; // SQLi
    if (ruleId.startsWith('930')) return 'badge-yellow'; // LFI
    return 'badge-gray';
  };

  if (loading) {
    return (
      <div className="loading">
        <p>Loading WAFGuard Dashboard...</p>
        {error && <p style={{color: 'red'}}>Error: {error}</p>}
      </div>
    );
  }

  return (
    <div className="App">
      <header className="header">
        <h1>🛡️ WAFGuard Security Dashboard</h1>
        <p>Real-time Web Application Firewall Monitoring</p>
      </header>

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
                  <th>Attack Type</th>
                  <th>Target URI</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatTime(event.timestamp)}</td>
                    <td className="ip-cell">{event.src_ip}</td>
                    <td>
                      <span className={`badge ${getSeverityColor(event.rule_id)}`}>
                        {event.rule_id}
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
