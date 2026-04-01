import React, { useMemo } from 'react';
import './InsightsPanel.css';

function InsightsPanel({ journeyData = [] }) {
  const insights = useMemo(() => {
    const journeys = Array.isArray(journeyData) ? journeyData : [];
    
    // Basic metrics
    const totalCases = journeys.length;
    const escalated = journeys.filter(j => {
      const d = (j?.final_disposition || '').toLowerCase();
      return d.includes('investigate') || d.includes('escalate');
    }).length;
    
    const escalationRate = totalCases > 0 ? ((escalated / totalCases) * 100).toFixed(1) : 0;
    
    const avgRisk = journeys.length
      ? journeys.reduce((sum, j) => {
          const score = j?.decision_inputs?.composite_fraud_risk_score ?? 
                       j?.composite_fraud_risk_score ?? 0;
          return sum + Number(score || 0);
        }, 0) / journeys.length
      : 0;

    // Disposition breakdown
    const dispositionMap = {};
    journeys.forEach(j => {
      const disp = j?.final_disposition || 'Unknown';
      if (disp.toLowerCase().includes('clear')) {
        dispositionMap['Clear'] = (dispositionMap['Clear'] || 0) + 1;
      } else if (disp.toLowerCase().includes('monitor')) {
        dispositionMap['Monitor'] = (dispositionMap['Monitor'] || 0) + 1;
      } else if (disp.toLowerCase().includes('investigate')) {
        dispositionMap['Investigate'] = (dispositionMap['Investigate'] || 0) + 1;
      } else if (disp.toLowerCase().includes('escalate')) {
        dispositionMap['Escalate'] = (dispositionMap['Escalate'] || 0) + 1;
      } else {
        dispositionMap['Other'] = (dispositionMap['Other'] || 0) + 1;
      }
    });

    const dispositionData = [
      { name: 'Clear', count: dispositionMap['Clear'] || 0, color: '#4fdbc8' },
      { name: 'Monitor', count: dispositionMap['Monitor'] || 0, color: '#7ba4d1' },
      { name: 'Investigate', count: dispositionMap['Investigate'] || 0, color: '#9699b0' },
      { name: 'Escalate', count: dispositionMap['Escalate'] || 0, color: '#d1707a' }
    ];

    // Risk distribution
    const riskRanges = { low: 0, medium: 0, high: 0 };
    journeys.forEach(j => {
      const score = j?.decision_inputs?.composite_fraud_risk_score ?? 
                   j?.composite_fraud_risk_score ?? 0;
      const numScore = Number(score || 0);
      if (numScore < 0.33) riskRanges.low++;
      else if (numScore < 0.67) riskRanges.medium++;
      else riskRanges.high++;
    });

    // Agent execution status
    const agentStatus = {
      'Customer Context': { executed: 0, skipped: 0, error: 0 },
      'Claim Timeline': { executed: 0, skipped: 0, error: 0 },
      'Financial Anomaly': { executed: 0, skipped: 0, error: 0 },
      'Evidence Consistency': { executed: 0, skipped: 0, error: 0 },
      'Final Disposition': { executed: 0, skipped: 0, error: 0 }
    };

    journeys.forEach(j => {
      const stations = j?.stations || {};
      Object.entries(stations).forEach(([name, status]) => {
        if (agentStatus[name]) {
          const s = String(status || '').toLowerCase();
          if (s === 'executed' || s === 'completed') {
            agentStatus[name].executed++;
          } else if (s === 'skipped') {
            agentStatus[name].skipped++;
          } else if (s === 'error' || s === 'failed') {
            agentStatus[name].error++;
          }
        }
      });
    });

    return {
      totalCases,
      escalated,
      escalationRate,
      avgRisk,
      dispositionData,
      riskRanges,
      agentStatus
    };
  }, [journeyData]);

  if (!journeyData || journeyData.length === 0) {
    return (
      <div className="insights-panel">
        <div className="insights-empty">
          <h2>Insights Dashboard</h2>
          <p>No analysis data yet. Run an analysis to view insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-panel">
      {/* Top Row: Key Metrics */}
      <div className="insights-row metrics-row">
        <div className="metric-card">
          <div className="metric-value">{insights.totalCases}</div>
          <div className="metric-label">Cases Reviewed</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-value">{insights.escalated}</div>
          <div className="metric-label">High Priority Cases</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{insights.avgRisk.toFixed(3)}</div>
          <div className="metric-label">Average Risk Index</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{insights.escalationRate}%</div>
          <div className="metric-label">Escalation Rate</div>
        </div>
      </div>

      {/* Middle Row: Disposition & Risk Distribution */}
      <div className="insights-row charts-row">
        {/* Disposition Breakdown */}
        <div className="insights-chart">
          <h3>Disposition Breakdown</h3>
          <div className="disposition-bars">
            {insights.dispositionData.map(item => (
              <div key={item.name} className="bar-item">
                <div className="bar-label">{item.name}</div>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      width: insights.totalCases > 0 ? `${(item.count / insights.totalCases) * 100}%` : '0%',
                      backgroundColor: item.color
                    }}
                  >
                    <span className="bar-count">{item.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="insights-chart">
          <h3>Risk Distribution</h3>
          <div className="risk-distribution">
            <div className="risk-item low">
              <div className="risk-bar-container">
                <div
                  className="risk-bar"
                  style={{
                    width: insights.totalCases > 0 ? `${(insights.riskRanges.low / insights.totalCases) * 100}%` : '0%'
                  }}
                />
              </div>
              <div className="risk-label">
                <span>Low Risk (0-0.33)</span>
                <span className="risk-count">{insights.riskRanges.low}</span>
              </div>
            </div>
            <div className="risk-item medium">
              <div className="risk-bar-container">
                <div
                  className="risk-bar"
                  style={{
                    width: insights.totalCases > 0 ? `${(insights.riskRanges.medium / insights.totalCases) * 100}%` : '0%'
                  }}
                />
              </div>
              <div className="risk-label">
                <span>Medium Risk (0.33-0.67)</span>
                <span className="risk-count">{insights.riskRanges.medium}</span>
              </div>
            </div>
            <div className="risk-item high">
              <div className="risk-bar-container">
                <div
                  className="risk-bar"
                  style={{
                    width: insights.totalCases > 0 ? `${(insights.riskRanges.high / insights.totalCases) * 100}%` : '0%'
                  }}
                />
              </div>
              <div className="risk-label">
                <span>High Risk (0.67-1.0)</span>
                <span className="risk-count">{insights.riskRanges.high}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Agent Execution Status */}
      <div className="insights-row agent-row">
        <h3>Agent Execution Status</h3>
        <div className="agent-status-grid">
          {Object.entries(insights.agentStatus).map(([agentName, stats]) => {
            const totalRuns = stats.executed + stats.skipped + stats.error;
            return (
              <div key={agentName} className="agent-card">
                <div className="agent-name">{agentName}</div>
                <div className="agent-bars">
                  <div className="agent-bar-item executed" title={`Executed: ${stats.executed}`}>
                    <div
                      className="agent-bar"
                      style={{
                        width: totalRuns > 0 ? `${(stats.executed / totalRuns) * 100}%` : '0%'
                      }}
                    />
                    <span className="agent-count">{stats.executed}</span>
                  </div>
                  <div className="agent-bar-item skipped" title={`Skipped: ${stats.skipped}`}>
                    <div
                      className="agent-bar"
                      style={{
                        width: totalRuns > 0 ? `${(stats.skipped / totalRuns) * 100}%` : '0%'
                      }}
                    />
                    <span className="agent-count">{stats.skipped}</span>
                  </div>
                  <div className="agent-bar-item error" title={`Error: ${stats.error}`}>
                    <div
                      className="agent-bar"
                      style={{
                        width: totalRuns > 0 ? `${(stats.error / totalRuns) * 100}%` : '0%'
                      }}
                    />
                    <span className="agent-count">{stats.error}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="agent-legend">
          <div className="legend-item">
            <div className="legend-color executed" />
            <span>Executed</span>
          </div>
          <div className="legend-item">
            <div className="legend-color skipped" />
            <span>Skipped</span>
          </div>
          <div className="legend-item">
            <div className="legend-color error" />
            <span>Error</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InsightsPanel;
