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

const API_BASE = window.location.origin + '/api';

function App() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollingRef = useRef(null);

  const [expandedRow, setExpandedRow] = useState(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [attackHistory, setAttackHistory] = useState([]);

  const [ipRules, setIpRules] = useState([]);
  const [newRuleType, setNewRuleType] = useState('block');
  const [newRuleIP, setNewRuleIP] = useState('');
  const [newRuleRuleId, setNewRuleRuleId] = useState('');
  const [newRuleReason, setNewRuleReason] = useState('');

  // Tab State & Independent Filter States
  const [activeTab, setActiveTab] = useState('events');
  const [deleteRuleId, setDeleteRuleId] = useState('');
  const [deleteDate, setDeleteDate] = useState('');
  const [deleteTime, setDeleteTime] = useState('');

  // Checkbox state for multiple deletions
  const [selectedLogs, setSelectedLogs] = useState([]);

  // ===== Severity Classification =====
  const getSeverity = (ruleId) => {
    const id = ruleId?.toString() || "";
    if (id.startsWith("941")) return "CRITICAL";
    if (id.startsWith("942")) return "HIGH";
    if (id.startsWith("930")) return "MEDIUM";
    if (id.startsWith("950")) return "LOW";
    return "LOW";
  };

  const getSeverityColor = (ruleId) => {
    if (ruleId.startsWith('941')) return 'badge-red';
    if (ruleId.startsWith('942')) return 'badge-orange';
    if (ruleId.startsWith('930')) return 'badge-yellow';
    return 'badge-gray';
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_BASE}/events?limit=1000`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setEvents(data.events || []);

      // Build severity snapshot for Real-Time Attack Trend chart
      const now = new Date().toLocaleTimeString();
      const severitySnapshot = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      data.events.forEach(event => {
        const severity = getSeverity(event.rule_id);
        if (severitySnapshot[severity] !== undefined) {
          severitySnapshot[severity]++;
        }
      });
      setAttackHistory(prev => {
        const updated = [...prev, { time: now, ...severitySnapshot }];
        if (updated.length > 10) updated.shift();
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

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/stats`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRules = async () => {
    try {
      const response = await fetch(`${API_BASE}/rules`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setIpRules(data.rules || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchStats();
    fetchRules();
    pollingRef.current = setInterval(() => {
      fetchEvents();
      fetchStats();
      fetchRules();
    }, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const handleAction = async (eventId, action) => {
    try {
      await fetch(`${API_BASE}/events/${eventId}/action?action=${action}`, { method: 'POST' });
      fetchEvents();
      fetchRules();
    } catch (error) {
      console.error('Error updating action:', error);
    }
  };

  // Dynamically filter events by Date AND/OR Time AND/OR Rule ID
  const filteredEvents = events.filter(event => {
    let match = true;
    if (deleteRuleId && event.rule_id !== deleteRuleId) match = false;
    if (deleteDate) {
      const d = new Date(event.timestamp);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      if (`${yyyy}-${mm}-${dd}` !== deleteDate) match = false;
    }
    if (deleteTime) {
      const d = new Date(event.timestamp);
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      if (`${hh}:${min}` !== deleteTime) match = false;
    }
    return match;
  });

  // Extract unique Rule IDs from current events for dropdown
  const uniqueRuleIds = [...new Set(events.map(event => event.rule_id))].sort();

  // Checkbox Handlers
  const toggleSelection = (id) => {
    setSelectedLogs(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleAll = (e) => {
    if (e.target.checked) {
      setSelectedLogs(filteredEvents.map(evt => evt.id));
    } else {
      setSelectedLogs([]);
    }
  };

  // DELETION HANDLERS
  const handleBulkClearLogs = async () => {
    if (!window.confirm(`Delete ALL ${filteredEvents.length} filtered logs? This cannot be undone.`)) return;
    try {
      await fetch(`${API_BASE}/events/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_id: deleteRuleId || null,
          filter_date: deleteDate || null,
          filter_time: deleteTime || null
        })
      });
      setDeleteRuleId('');
      setDeleteDate('');
      setDeleteTime('');
      setSelectedLogs([]);
      fetchEvents();
      fetchStats();
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  };

  const handleDeleteSingle = async (eventId) => {
    if (!window.confirm("Delete this specific log?")) return;
    try {
      await fetch(`${API_BASE}/events/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_ids: [eventId] })
      });
      setSelectedLogs(prev => prev.filter(id => id !== eventId));
      fetchEvents();
      fetchStats();
    } catch (error) {
      console.error('Error deleting log:', error);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLogs.length === 0) return;
    if (!window.confirm(`Delete the ${selectedLogs.length} checked logs?`)) return;
    try {
      await fetch(`${API_BASE}/events/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_ids: selectedLogs })
      });
      setSelectedLogs([]);
      fetchEvents();
      fetchStats();
    } catch (error) {
      console.error('Error deleting logs:', error);
    }
  };

  // HANDLERS FOR DYNAMIC RULES
  const handleAddRule = async () => {
    if (!newRuleIP && !newRuleRuleId) {
      alert('Please provide at least an IP Address or a Rule ID.');
      return;
    }
    try {
      await fetch(`${API_BASE}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newRuleType,
          ip_address: newRuleIP || null,
          rule_id_ref: newRuleRuleId || null,
          reason: newRuleReason || null
        })
      });
      setNewRuleIP('');
      setNewRuleRuleId('');
      setNewRuleReason('');
      fetchRules();
    } catch (error) {
      console.error('Error adding rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm("Remove this rule?")) return;
    try {
      await fetch(`${API_BASE}/rules/${ruleId}`, { method: 'DELETE' });
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const formatTime = (timestamp) => new Date(timestamp).toLocaleString();

  // Threat level calculation
  const calculateThreatLevel = () => {
    if (!events.length) return "NORMAL";
    const severities = events.map(e => getSeverity(e.rule_id));
    if (severities.includes("CRITICAL")) return "CRITICAL";
    const highCount = severities.filter(s => s === "HIGH").length;
    if (highCount > 3) return "ELEVATED";
    return "NORMAL";
  };
  const threatLevel = calculateThreatLevel();

  // Severity counts for summary card
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  events.forEach(event => {
    const severity = getSeverity(event.rule_id);
    if (severityCounts[severity] !== undefined) severityCounts[severity]++;
  });

  // Critical Only filter for Security Events tab
  const displayedEvents = criticalOnly
    ? events.filter(e => getSeverity(e.rule_id) === "CRITICAL")
    : events;

  // Chart data
  const chartData = {
    labels: attackHistory.map(item => item.time),
    datasets: [
      { label: "Critical", data: attackHistory.map(item => item.CRITICAL), borderColor: "#dc3545", backgroundColor: "rgba(220,53,69,0.2)", tension: 0.3, fill: false },
      { label: "High",     data: attackHistory.map(item => item.HIGH),     borderColor: "#fd7e14", backgroundColor: "rgba(253,126,20,0.2)", tension: 0.3, fill: false },
      { label: "Medium",   data: attackHistory.map(item => item.MEDIUM),   borderColor: "#ffc107", backgroundColor: "rgba(255,193,7,0.2)",  tension: 0.3, fill: false },
      { label: "Low",      data: attackHistory.map(item => item.LOW),      borderColor: "#28a745", backgroundColor: "rgba(40,167,69,0.2)",  tension: 0.3, fill: false },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  if (loading) return <div className="loading"><p>Loading WAFGuard Dashboard...</p>{error && <p style={{color: 'red'}}>Error: {error}</p>}</div>;

  return (
    <div className="App">
      <header className="header">
        <h1>🛡️ WAFGuard Security Dashboard</h1>
        <p>Real-time Web Application Firewall Monitoring</p>
      </header>

      {/* Threat Banner */}
      <div className={`threat-banner ${threatLevel}`}>
        {threatLevel === "CRITICAL" && "🔴 SYSTEM UNDER ATTACK"}
        {threatLevel === "ELEVATED" && "🟠 Elevated Threat Activity"}
        {threatLevel === "NORMAL"   && "🟢 System Operating Normally"}
      </div>

      {error && (
        <div style={{ background: '#fee', color: '#c00', padding: '10px', margin: '20px', borderRadius: '5px' }}>
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
            <p className="stat-ip">{stats.top_ips?.length ? stats.top_ips[0].src_ip : 'N/A'}</p>
          </div>
          <div className="severity-summary">
            <div className="severity-item critical">CRITICAL: {severityCounts.CRITICAL}</div>
            <div className="severity-item high">HIGH: {severityCounts.HIGH}</div>
            <div className="severity-item medium">MEDIUM: {severityCounts.MEDIUM}</div>
            <div className="severity-item low">LOW: {severityCounts.LOW}</div>
          </div>
          <div className="stat-card">
            <h3>Most Triggered</h3>
            <p className="stat-rule">{stats.top_rules?.length ? `Rule ${stats.top_rules[0].rule_id}` : 'N/A'}</p>
          </div>
        </div>
      )}

      {/* Critical Only Toggle */}
      <div style={{ marginBottom: "15px" }}>
        <button
          className={`btn ${criticalOnly ? "btn-block" : "btn-expand"}`}
          onClick={() => setCriticalOnly(!criticalOnly)}
        >
          Critical Only: {criticalOnly ? "ON" : "OFF"}
        </button>
      </div>

      {/* Real-Time Attack Trend Chart */}
      <div style={{ background: "white", padding: "20px", borderRadius: "10px", marginBottom: "25px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginBottom: "15px" }}>Real-Time Attack Trend</h3>
        <div style={{ height: "150px" }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      <div className="events-section">

        {/* TAB HEADER */}
        <div className="tabs-header">
          <h2
            className={`tab-title ${activeTab === 'events' ? 'active-tab' : 'inactive-tab'}`}
            onClick={() => { setActiveTab('events'); setSelectedLogs([]); }}
          >
            Security Events ({events.length})
          </h2>
          <span className="tab-divider">|</span>
          <h2
            className={`tab-title ${activeTab === 'manager' ? 'active-tab' : 'inactive-tab'}`}
            onClick={() => setActiveTab('manager')}
          >
            Log Manager
          </h2>
          <span className="tab-divider">|</span>
          <h2
            className={`tab-title ${activeTab === 'control' ? 'active-tab' : 'inactive-tab'}`}
            onClick={() => setActiveTab('control')}
          >
            Universal Control
            {ipRules.length > 0 && (
              <span className="tab-badge">{ipRules.length}</span>
            )}
          </h2>
        </div>

        {/* --- VIEW 1: SECURITY EVENTS --- */}
        {activeTab === 'events' && (
          <div className="table-container">
            {events.length === 0 ? (
              <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
                <p>No security events detected yet.</p>
                <p>Try generating some attacks:</p>
                <code>curl "http://localhost:8080/?id=1' OR 1=1--"</code>
              </div>
            ) : (
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
                    <React.Fragment key={`evt-${event.id}`}>
                      <tr style={{cursor: 'default'}}>
                        <td>{formatTime(event.timestamp)}</td>
                        <td className="ip-cell">{event.src_ip}</td>
                        <td><span className={`badge ${getSeverityColor(event.rule_id)}`}>{event.rule_id}</span></td>
                        <td>
                          <span className={`severity-badge ${getSeverity(event.rule_id)}`}>
                            {getSeverity(event.rule_id)}
                          </span>
                        </td>
                        <td className="payload-cell">{event.payload}</td>
                        <td className="uri-cell">{event.uri}</td>
                        <td><span className={`status-${event.action}`}>{event.action.toUpperCase()}</span></td>
                        <td className="actions-cell">
                          <button className="btn btn-expand" onClick={() => setExpandedRow(expandedRow === event.id ? null : event.id)}>
                            {expandedRow === event.id ? 'Collapse ▲' : 'Expand ▼'}
                          </button>
                          <button className="btn btn-allow" onClick={() => handleAction(event.id, 'allow')}>Allow</button>
                          <button className="btn btn-block" onClick={() => handleAction(event.id, 'block')}>Block</button>
                        </td>
                      </tr>
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
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* --- VIEW 2: LOG MANAGER --- */}
        {activeTab === 'manager' && (
          <div className="log-manager-view">
            <div className="log-manager-panel">
              <h3>Bulk Delete Logs</h3>
              <div className="filter-group">
                <select
                  value={deleteRuleId}
                  onChange={(e) => setDeleteRuleId(e.target.value)}
                  className="standard-input"
                  style={{cursor: 'pointer'}}
                >
                  <option value="">All Rule IDs</option>
                  {uniqueRuleIds.map(ruleId => (
                    <option key={ruleId} value={ruleId}>Rule {ruleId}</option>
                  ))}
                </select>
                <div className="labeled-input">
                  <label>Date:</label>
                  <input type="date" value={deleteDate} onChange={(e) => setDeleteDate(e.target.value)} />
                </div>
                <div className="labeled-input">
                  <label>Time:</label>
                  <input type="time" value={deleteTime} onChange={(e) => setDeleteTime(e.target.value)} />
                </div>
                <button className="btn btn-delete-bulk" onClick={handleBulkClearLogs}>
                  Delete Filtered ({filteredEvents.length})
                </button>
                <button
                  className="btn btn-delete-selected"
                  onClick={handleDeleteSelected}
                  disabled={selectedLogs.length === 0}
                >
                  Delete Checked ({selectedLogs.length})
                </button>
              </div>
              <small className="help-text">Filters isolate exact matches. Check boxes to pick specific rows, or use filters to bulk wipe.</small>
            </div>

            <div className="table-container">
              <table className="events-table">
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                      <input
                        type="checkbox"
                        onChange={toggleAll}
                        checked={filteredEvents.length > 0 && selectedLogs.length === filteredEvents.length}
                        title="Select All"
                      />
                    </th>
                    <th>Time</th>
                    <th>Source IP</th>
                    <th>Rule ID</th>
                    <th>Attack Type</th>
                    <th>Target URI</th>
                    <th>Cleanup Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <React.Fragment key={`mgr-${event.id}`}>
                      <tr>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            checked={selectedLogs.includes(event.id)}
                            onChange={() => toggleSelection(event.id)}
                          />
                        </td>
                        <td>{formatTime(event.timestamp)}</td>
                        <td className="ip-cell">{event.src_ip}</td>
                        <td><span className={`badge ${getSeverityColor(event.rule_id)}`}>{event.rule_id}</span></td>
                        <td className="payload-cell">{event.payload}</td>
                        <td className="uri-cell">{event.uri}</td>
                        <td className="actions-cell">
                          <button className="btn btn-expand" onClick={() => setExpandedRow(expandedRow === event.id ? null : event.id)}>
                            {expandedRow === event.id ? 'Collapse ▲' : 'Expand ▼'}
                          </button>
                          <button className="btn btn-delete-single" onClick={() => handleDeleteSingle(event.id)}>
                            Delete Row
                          </button>
                        </td>
                      </tr>
                      {expandedRow === event.id && (
                        <tr className="expanded-row">
                          <td colSpan={7}>
                            <div className="expanded-details">
                              <p><strong>Full Payload:</strong> {event.payload}</p>
                              <p><strong>Full URI:</strong> {event.uri}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {filteredEvents.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{textAlign: 'center', padding: '20px', color: '#666'}}>
                        No logs match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- VIEW 3: UNIVERSAL CONTROL --- */}
        {activeTab === 'control' && (
          <div className="control-view">
            <div className="log-manager-panel" style={{borderLeftColor: '#667eea'}}>
              <h3>Add IP / Rule Control</h3>
              <div className="filter-group">
                <select value={newRuleType} onChange={(e) => setNewRuleType(e.target.value)}>
                  <option value="block">Block</option>
                  <option value="allow">Allow</option>
                </select>
                <input
                  type="text"
                  placeholder="IP Address (optional)"
                  value={newRuleIP}
                  onChange={(e) => setNewRuleIP(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Rule ID (optional)"
                  value={newRuleRuleId}
                  onChange={(e) => setNewRuleRuleId(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={newRuleReason}
                  onChange={(e) => setNewRuleReason(e.target.value)}
                />
                <button className="btn btn-allow" onClick={handleAddRule}>Add Rule</button>
              </div>
              <small className="help-text">
                Fill IP only = full IP block/whitelist. Fill Rule ID only = global rule block/suppress.
                Fill both = rule scoped to that IP. At least one field required.
              </small>
            </div>

            <div className="table-container">
              <table className="events-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>IP Address</th>
                    <th>Rule ID</th>
                    <th>Reason</th>
                    <th>Added</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ipRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{textAlign: 'center', padding: '20px', color: '#666'}}>
                        No rules added yet. Use the form above to block or allow an IP or Rule ID.
                      </td>
                    </tr>
                  ) : (
                    ipRules.map((rule) => (
                      <tr key={rule.id}>
                        <td>
                          <span className={`badge ${rule.type === 'block' ? 'badge-red' : 'badge-gray'}`}>
                            {rule.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="ip-cell">{rule.ip_address || <em style={{color:'#999'}}>Any</em>}</td>
                        <td>{rule.rule_id_ref || <em style={{color:'#999'}}>Any</em>}</td>
                        <td>{rule.reason || '—'}</td>
                        <td>{new Date(rule.created_at).toLocaleString()}</td>
                        <td>
                          <button className="btn btn-delete-single" onClick={() => handleDeleteRule(rule.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
