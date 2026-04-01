import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ChatInterface from './components/ChatInterface';
import JourneyPanel from './components/JourneyPanel';
import AgentMapPanel from './components/AgentMapPanel';
import './App.css';

const API_BASE = '/api';

function App() {
  // Initialize activeTab from localStorage, default to 'query' for PNC
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('pncActiveTab');
      return saved || 'query';
    } catch (error) {
      return 'query';
    }
  });
  const [journeyData, setJourneyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [showIntel, setShowIntel] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('pncTheme');
      return saved === 'light' ? 'light' : 'dark';
    } catch (error) {
      return 'dark';
    }
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const intelStats = useMemo(() => {
    const journeys = Array.isArray(journeyData) ? journeyData : [];
    const totalCases = journeys.length;
    const escalated = journeys.filter(j => {
      const d = (j?.final_disposition || '').toLowerCase();
      return d.includes('investigate') || d.includes('escalate');
    }).length;
    const avgRisk = journeys.length
      ? journeys.reduce((sum, j) => {
          const score =
            j?.decision_inputs?.composite_fraud_risk_score ??
            j?.composite_fraud_risk_score ??
            0;
          return sum + Number(score || 0);
        }, 0) / journeys.length
      : 0;

    return {
      totalCases,
      escalated,
      avgRisk,
      lastUpdated: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  }, [journeyData, now]);

  // Persist activeTab to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('pncActiveTab', activeTab);
    } catch (error) {
      console.warn('Failed to save active tab:', error);
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem('pncTheme', theme);
    } catch (error) {
      console.warn('Failed to save theme:', error);
    }
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load journey data from backend on mount
  useEffect(() => {
    const fetchJourneys = async () => {
      try {
        const response = await axios.get(`${API_BASE}/journeys`);
        setJourneyData(response.data);
      } catch (error) {
        console.error('Failed to load journeys:', error);
        setJourneyData([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchJourneys();
  }, []);

  // Function to refresh journey data (called when new journey is added)
  const refreshJourneys = async () => {
    try {
      const response = await axios.get(`${API_BASE}/journeys`);
      setJourneyData(response.data);
    } catch (error) {
      console.error('Failed to refresh journeys:', error);
    }
  };

  const deleteJourney = async (journeyIndex) => {
    await axios.delete(`${API_BASE}/journeys/${journeyIndex}`);
    await refreshJourneys();
  };

  return (
    <div className={`app-container theme-${theme}`}>
      <aside className="left-nav">
        <div className="left-nav-brand">PNC</div>
        <button
          className={`left-nav-item ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => setActiveTab('query')}
          type="button"
        >
          <span className="left-nav-title">Live Analysis</span>
          <span className="left-nav-sub">Real-time run</span>
        </button>
        <button
          className={`left-nav-item ${activeTab === 'journey' ? 'active' : ''}`}
          onClick={() => setActiveTab('journey')}
          type="button"
        >
          <span className="left-nav-title">Case History</span>
          <span className="left-nav-sub">Past decisions</span>
        </button>
        <button
          className={`left-nav-item ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
          type="button"
        >
          <span className="left-nav-title">Agent Map</span>
          <span className="left-nav-sub">Connection flow</span>
        </button>
        <button
          className={`left-nav-item ${showIntel ? 'active' : ''}`}
          onClick={() => setShowIntel(prev => !prev)}
          type="button"
        >
          <span className="left-nav-title">Insights</span>
          <span className="left-nav-sub">{showIntel ? 'Visible' : 'Hidden'}</span>
        </button>
      </aside>

      <div className="tabs-container">
        <div className="main-header">
          <img
            src="/nnt_logo.png"
            alt="NNT Logo"
            className="header-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="header-content">
            <h1>PNC Fraud Intelligence Console</h1>
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="4.2" fill="currentColor" />
                <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="12" y1="2.2" x2="12" y2="5.2" />
                  <line x1="12" y1="18.8" x2="12" y2="21.8" />
                  <line x1="2.2" y1="12" x2="5.2" y2="12" />
                  <line x1="18.8" y1="12" x2="21.8" y2="12" />
                  <line x1="5.2" y1="5.2" x2="7.3" y2="7.3" />
                  <line x1="16.7" y1="16.7" x2="18.8" y2="18.8" />
                  <line x1="16.7" y1="7.3" x2="18.8" y2="5.2" />
                  <line x1="5.2" y1="18.8" x2="7.3" y2="16.7" />
                </g>
              </svg>
            ) : (
              <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M14.6 3.3c-1 1.1-1.6 2.6-1.6 4.2 0 3.5 2.8 6.3 6.3 6.3 0.5 0 1-0.1 1.5-0.2-1 4-4.6 6.9-8.9 6.9-5 0-9.1-4.1-9.1-9.1 0-4.3 2.9-8 6.9-9 0.4-0.1 0.8 0.3 0.6 0.9-0.1 0.1-0.3 0.1-0.4 0z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        </div>

        {showIntel && (
          <div className="intel-strip">
            <div className="intel-card">
              <span className="intel-label">Cases Reviewed</span>
              <span className="intel-value">{intelStats.totalCases}</span>
            </div>
            <div className="intel-card alert">
              <span className="intel-label">High Priority Cases</span>
              <span className="intel-value">{intelStats.escalated}</span>
            </div>
            <div className="intel-card">
              <span className="intel-label">Average Risk Index</span>
              <span className="intel-value">{intelStats.avgRisk.toFixed(3)}</span>
            </div>
            <div className="intel-card info">
              <span className="intel-label">Last Refresh</span>
              <span className="intel-value">{intelStats.lastUpdated}</span>
            </div>
          </div>
        )}
        
        <div className="tabs-content">
          <div className={`tab-panel ${activeTab === 'query' ? 'active' : 'hidden'}`}>
            <ChatInterface onJourneyUpdate={refreshJourneys} />
          </div>
          <div className={`tab-panel ${activeTab === 'journey' ? 'active' : 'hidden'}`}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>Loading analysis history...</div>
            ) : (
              <JourneyPanel journeyData={journeyData} onDeleteJourney={deleteJourney} />
            )}
          </div>
          <div className={`tab-panel ${activeTab === 'map' ? 'active' : 'hidden'}`}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>Loading journey map...</div>
            ) : (
              <AgentMapPanel journeyData={journeyData} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
