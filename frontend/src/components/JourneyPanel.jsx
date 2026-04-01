import React, { useState, useEffect } from 'react';
import './JourneyPanel.css';

function JourneyPanel({ journeyData = [], onDeleteJourney = async () => {} }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedJourney =
    selectedIndex !== null && selectedIndex < journeyData.length
      ? journeyData[selectedIndex]
      : null;

  useEffect(() => {
    if (selectedIndex === null) return;
    if (selectedIndex >= journeyData.length) {
      setSelectedIndex(null);
    }
  }, [journeyData, selectedIndex]);

  if (!journeyData || journeyData.length === 0) {
    return (
      <div className="journey-panel">
        <div className="empty-state">
          <p>No analysis history yet</p>
          <p className="subtitle">Analysis results will appear here</p>
        </div>
      </div>
    );
  }

  const handleSelectJourney = (index) => {
    setSelectedIndex(selectedIndex === index ? null : index);
    setExpandedSection(null);
  };

  const handleDeleteSelected = async () => {
    if (selectedIndex === null || !selectedJourney) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      await onDeleteJourney(selectedIndex);
      setSelectedIndex(null);
      setExpandedSection(null);
    } catch (error) {
      console.error('Failed to delete journey:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getDispositionColor = (disposition) => {
    if (!disposition) return 'rgba(186, 199, 227, 0.5)';
    const d = disposition.toLowerCase();
    if (d.includes('clear')) return '#4fdbc8'; // Teal - matches secondary accent
    if (d.includes('monitor')) return '#7ba4d1'; // Muted blue - warning
    if (d.includes('investigate')) return '#9699b0'; // Soft gray-blue - caution
    if (d.includes('escalate')) return '#d1707a'; // Muted salmon - critical
    return 'rgba(186, 199, 227, 0.5)';
  };

  const journeyStageOrder = [
    { key: 'Customer Context', code: 'CC' },
    { key: 'Claim Timeline', code: 'CT' },
    { key: 'Financial Anomaly', code: 'FA' },
    { key: 'Evidence Consistency', code: 'EC' },
    { key: 'Final Disposition', code: 'FD' }
  ];

  const getStationStatus = (stations = {}, stationKey) => {
    if (stations[stationKey]) return stations[stationKey];

    const matchKey = Object.keys(stations).find(
      key => key.toLowerCase() === stationKey.toLowerCase()
    );
    return matchKey ? stations[matchKey] : 'pending';
  };

  const getStageState = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'executed' || normalized === 'completed') return 'done';
    if (normalized === 'skipped') return 'skipped';
    if (normalized === 'error' || normalized === 'failed') return 'error';
    return 'pending';
  };

  const journeyMapStages = selectedJourney
    ? journeyStageOrder.map(stage => {
        const rawStatus = getStationStatus(selectedJourney.stations || {}, stage.key);
        return {
          ...stage,
          rawStatus,
          state: getStageState(rawStatus)
        };
      })
    : [];

  return (
    <div className="journey-panel">
      <div className="journey-list">
        <h2>Analysis History</h2>
        <div className="journey-items">
          {journeyData.map((journey, idx) => (
            <div 
              key={idx} 
              className={`journey-item ${selectedIndex === idx ? 'selected' : ''}`}
              onClick={() => handleSelectJourney(idx)}
            >
              <div className="journey-header">
                <div className="journey-title">
                  <h3>{journey.customer_name || 'Unknown'}</h3>
                  <span className="journey-date">
                    {journey.timestamp ? new Date(journey.timestamp).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div 
                  className="disposition-badge"
                  style={{ backgroundColor: getDispositionColor(journey.final_disposition) }}
                >
                  {journey.final_disposition || 'N/A'}
                </div>
              </div>
              {selectedIndex === idx && (
                <div className="journey-preview">
                  <p><strong>Risk Score:</strong> {(journey.decision_inputs?.composite_fraud_risk_score ?? journey.composite_fraud_risk_score)?.toFixed(3) || 'N/A'}</p>
                  <p><strong>Claims:</strong> {journey.decision_inputs?.claim_count || 'N/A'}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedJourney && (
        <div className="journey-details">
          <div className="journey-details-header">
            <h2>Analysis Details</h2>
            <button
              type="button"
              className="delete-journey-btn"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              title="Delete selected journey"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
          <div className="details-content">
            <section className="detail-section">
              <h4>Customer Information</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Customer Name:</label>
                  <value>{selectedJourney.customer_name || 'N/A'}</value>
                </div>
                <div className="detail-item">
                  <label>Claim Count:</label>
                  <value>{selectedJourney.decision_inputs?.claim_count || 'N/A'}</value>
                </div>
                <div className="detail-item">
                  <label>Total Payout:</label>
                  <value>${(selectedJourney.decision_inputs?.total_payout || 0).toFixed(2)}</value>
                </div>
              </div>
            </section>

            <section className="detail-section">
              <h4>Risk Scores</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Customer Context Risk:</label>
                  <value className="score">{selectedJourney.decision_inputs?.customer_context_risk_score?.toFixed(3) || 'N/A'}</value>
                </div>
                <div className="detail-item">
                  <label>Behavioral Anomaly Risk:</label>
                  <value className="score">{selectedJourney.decision_inputs?.behavioral_anomaly_risk_score?.toFixed(3) || 'N/A'}</value>
                </div>
                <div className="detail-item">
                  <label>Financial Anomaly Risk:</label>
                  <value className="score">{selectedJourney.decision_inputs?.financial_anomaly_risk_score?.toFixed(3) || 'N/A'}</value>
                </div>
                <div className="detail-item">
                  <label>Evidence Consistency Risk:</label>
                  <value className="score">{selectedJourney.decision_inputs?.evidence_consistency_risk_score?.toFixed(3) || 'N/A'}</value>
                </div>
                <div className="detail-item composite">
                  <label>Composite Fraud Risk:</label>
                  <value className="score-composite">{selectedJourney.decision_inputs?.composite_fraud_risk_score?.toFixed(3) || 'N/A'}</value>
                </div>
              </div>
            </section>

            <section className="detail-section">
              <h4>Final Disposition</h4>
              <div className="disposition-box">
                <span 
                  className="disposition-badge-large"
                  style={{ backgroundColor: getDispositionColor(selectedJourney.final_disposition) }}
                >
                  {selectedJourney.final_disposition || 'N/A'}
                </span>
              </div>
            </section>

            {selectedJourney.stations && (
              <section className="detail-section">
                <h4>Execution Status</h4>
                <div className="stations-list">
                  {Object.entries(selectedJourney.stations).map(([station, status]) => (
                    <div key={station} className="station-item">
                      <span className={`status-indicator ${status}`}></span>
                      <span>{station}</span>
                      <span className="status-text">{status}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {selectedJourney.stations && (
              <section className="detail-section">
                <h4>Journey Map</h4>
                <div className="journey-map" role="list" aria-label="Journey map stages">
                  {journeyMapStages.map((stage, idx) => (
                    <React.Fragment key={stage.key}>
                      <div className={`journey-map-node ${stage.state}`} role="listitem" title={`${stage.key}: ${stage.rawStatus}`}>
                        <span className="journey-map-code">{stage.code}</span>
                        <span className="journey-map-label">{stage.key}</span>
                        <span className="journey-map-status">{stage.rawStatus}</span>
                      </div>
                      {idx < journeyMapStages.length - 1 && (
                        <div className={`journey-map-link ${stage.state === 'done' ? 'active' : ''}`} aria-hidden="true" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </section>
            )}

            {selectedJourney.risk_factors && (
              <section className="detail-section">
                <h4>Risk Factors</h4>
                <div className="risk-factors">
                  {Object.entries(selectedJourney.risk_factors).map(([key, value]) => (
                    <div key={key} className="risk-factor-item">
                      <label>{key}:</label>
                      <value>
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </value>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-dialog">
            <h3>Delete Journey?</h3>
            <p>
              Are you sure you want to delete the journey for <strong>{selectedJourney?.customer_name || 'Unknown customer'}</strong>? This action cannot be undone.
            </p>
            <div className="delete-confirm-actions">
              <button
                type="button"
                className="delete-confirm-cancel"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-confirm-confirm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JourneyPanel;
