import React, { useMemo } from 'react';
import './InsightsPanel.css';

function classifyDisposition(disposition) {
  const d = String(disposition || '').toLowerCase();
  if (d.includes('escalate')) return 'Escalate';
  if (d.includes('investigate')) return 'Investigate';
  if (d.includes('monitor')) return 'Monitor';
  if (d.includes('clear')) return 'Clear';
  return 'Other';
}

function expectedRiskBandByDisposition(dispositionClass) {
  if (dispositionClass === 'Escalate' || dispositionClass === 'Investigate') return 'High';
  if (dispositionClass === 'Monitor') return 'Medium';
  if (dispositionClass === 'Clear') return 'Low';
  return 'Unknown';
}

function riskBandByScore(score) {
  if (score < 0.33) return 'Low';
  if (score < 0.67) return 'Medium';
  return 'High';
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = (sortedValues.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedValues[lower];
  const weight = idx - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function stdDev(values, mean) {
  if (!values.length) return 0;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function InsightsPanel({ journeyData = [] }) {
  const insights = useMemo(() => {
    const journeys = Array.isArray(journeyData) ? journeyData : [];
    const totalCases = journeys.length;

    const priorityCases = journeys.filter(j => {
      const d = classifyDisposition(j?.final_disposition);
      return d === 'Investigate' || d === 'Escalate';
    }).length;

    const escalationRate = totalCases > 0 ? (priorityCases / totalCases) * 100 : 0;

    const riskScores = journeys
      .map(j => Number(j?.decision_inputs?.composite_fraud_risk_score ?? j?.composite_fraud_risk_score ?? 0))
      .filter(v => Number.isFinite(v));

    const avgRisk = riskScores.length
      ? riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length
      : 0;

    const sortedRiskScores = [...riskScores].sort((a, b) => a - b);
    const minRisk = sortedRiskScores.length ? sortedRiskScores[0] : 0;
    const maxRisk = sortedRiskScores.length ? sortedRiskScores[sortedRiskScores.length - 1] : 0;
    const q1Risk = percentile(sortedRiskScores, 0.25);
    const medianRisk = percentile(sortedRiskScores, 0.5);
    const q3Risk = percentile(sortedRiskScores, 0.75);
    const riskStdDev = stdDev(riskScores, avgRisk);

    const dispositionMap = { Clear: 0, Monitor: 0, Investigate: 0, Escalate: 0, Other: 0 };
    journeys.forEach(j => {
      const bucket = classifyDisposition(j?.final_disposition);
      dispositionMap[bucket] += 1;
    });

    const dispositionData = [
      { name: 'Clear', count: dispositionMap.Clear, color: '#4fdbc8' },
      { name: 'Monitor', count: dispositionMap.Monitor, color: '#7ba4d1' },
      { name: 'Investigate', count: dispositionMap.Investigate, color: '#9699b0' },
      { name: 'Escalate', count: dispositionMap.Escalate, color: '#d1707a' }
    ];

    const riskRanges = { low: 0, medium: 0, high: 0 };
    riskScores.forEach(score => {
      if (score < 0.33) riskRanges.low += 1;
      else if (score < 0.67) riskRanges.medium += 1;
      else riskRanges.high += 1;
    });

    const componentMetrics = [
      { key: 'customer_context_risk_score', name: 'Customer Context', color: '#4fdbc8' },
      { key: 'behavioral_anomaly_risk_score', name: 'Behavioral Anomaly', color: '#7ba4d1' },
      { key: 'financial_anomaly_risk_score', name: 'Financial Anomaly', color: '#ffb347' },
      { key: 'evidence_consistency_risk_score', name: 'Evidence Consistency', color: '#d1707a' }
    ].map(metric => {
      const values = journeys
        .map(j => Number(j?.decision_inputs?.[metric.key]))
        .filter(v => Number.isFinite(v));

      const avg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

      const highSignalCases = journeys.filter(j => {
        const value = Number(j?.decision_inputs?.[metric.key] ?? 0);
        return Number.isFinite(value) && value >= 0.6;
      });

      const highSignalPriorityCases = highSignalCases.filter(j => {
        const bucket = classifyDisposition(j?.final_disposition);
        return bucket === 'Investigate' || bucket === 'Escalate';
      });

      return {
        ...metric,
        avg,
        highSignalCount: highSignalCases.length,
        highSignalPriorityRate: highSignalCases.length
          ? (highSignalPriorityCases.length / highSignalCases.length) * 100
          : 0
      };
    });

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
        if (!agentStatus[name]) return;
        const s = String(status || '').toLowerCase();
        if (s === 'executed' || s === 'completed') agentStatus[name].executed += 1;
        else if (s === 'skipped') agentStatus[name].skipped += 1;
        else if (s === 'error' || s === 'failed') agentStatus[name].error += 1;
      });
    });

    const alignmentRows = journeys.map((j, idx) => {
      const customer = j?.customer_name || 'Unknown';
      const dispositionClass = classifyDisposition(j?.final_disposition);
      const expectedBand = expectedRiskBandByDisposition(dispositionClass);
      const score = Number(j?.decision_inputs?.composite_fraud_risk_score ?? j?.composite_fraud_risk_score ?? 0);
      const actualBand = riskBandByScore(score);
      const mismatch =
        expectedBand !== 'Unknown' &&
        ((expectedBand === 'High' && actualBand !== 'High') ||
          (expectedBand === 'Medium' && actualBand === 'Low') ||
          (expectedBand === 'Low' && actualBand !== 'Low'));

      return {
        id: `${customer}-${idx}`,
        customer,
        score,
        dispositionClass,
        expectedBand,
        actualBand,
        mismatch
      };
    });

    const mismatchCount = alignmentRows.filter(r => r.mismatch).length;

    return {
      totalCases,
      priorityCases,
      escalationRate,
      avgRisk,
      minRisk,
      q1Risk,
      medianRisk,
      q3Risk,
      maxRisk,
      riskStdDev,
      dispositionData,
      riskRanges,
      componentMetrics,
      agentStatus,
      alignmentRows,
      mismatchCount
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
      <div className="insights-row metrics-row">
        <div className="metric-card">
          <div className="metric-value">{insights.totalCases}</div>
          <div className="metric-label">Cases Reviewed</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-value">{insights.priorityCases}</div>
          <div className="metric-label">High Priority Cases</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{insights.avgRisk.toFixed(3)}</div>
          <div className="metric-label">Average Risk Index</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{insights.escalationRate.toFixed(1)}%</div>
          <div className="metric-label">Escalation Rate</div>
        </div>
      </div>

      <div className="insights-row charts-row">
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

        <div className="insights-chart">
          <h3>Risk Distribution</h3>
          <div className="risk-distribution">
            <div className="risk-item low">
              <div className="risk-bar-container">
                <div
                  className="risk-bar"
                  style={{ width: insights.totalCases > 0 ? `${(insights.riskRanges.low / insights.totalCases) * 100}%` : '0%' }}
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
                  style={{ width: insights.totalCases > 0 ? `${(insights.riskRanges.medium / insights.totalCases) * 100}%` : '0%' }}
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
                  style={{ width: insights.totalCases > 0 ? `${(insights.riskRanges.high / insights.totalCases) * 100}%` : '0%' }}
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

      <div className="insights-row analytics-row">
        <div className="insights-chart">
          <h3>Component Score Analytics</h3>
          <div className="component-metrics">
            {insights.componentMetrics.map(metric => (
              <div key={metric.key} className="component-item">
                <div className="component-header">
                  <span>{metric.name}</span>
                  <span className="component-avg">Avg {metric.avg.toFixed(3)}</span>
                </div>
                <div className="component-bar-track">
                  <div
                    className="component-bar-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, metric.avg * 100))}%`,
                      backgroundColor: metric.color
                    }}
                  />
                </div>
                <div className="component-footnote">
                  High-signal cases ({'>='} 0.60): {metric.highSignalCount} | Priority conversion: {metric.highSignalPriorityRate.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="insights-chart">
          <h3>Risk Statistics</h3>
          <div className="stats-grid">
            <div className="stat-cell"><span>Min</span><strong>{insights.minRisk.toFixed(3)}</strong></div>
            <div className="stat-cell"><span>Q1</span><strong>{insights.q1Risk.toFixed(3)}</strong></div>
            <div className="stat-cell"><span>Median</span><strong>{insights.medianRisk.toFixed(3)}</strong></div>
            <div className="stat-cell"><span>Q3</span><strong>{insights.q3Risk.toFixed(3)}</strong></div>
            <div className="stat-cell"><span>Max</span><strong>{insights.maxRisk.toFixed(3)}</strong></div>
            <div className="stat-cell"><span>Std Dev</span><strong>{insights.riskStdDev.toFixed(3)}</strong></div>
          </div>
        </div>
      </div>

      <div className="insights-row alignment-row">
        <div className="insights-chart full-width-chart">
          <h3>Risk vs Disposition Alignment</h3>
          <div className="alignment-summary">Mismatches: {insights.mismatchCount} / {insights.totalCases}</div>
          <div className="alignment-table">
            <div className="alignment-table-head">
              <span>Customer</span>
              <span>Score</span>
              <span>Disposition</span>
              <span>Expected</span>
              <span>Actual</span>
              <span>Status</span>
            </div>
            {insights.alignmentRows.map(row => (
              <div key={row.id} className={`alignment-table-row ${row.mismatch ? 'mismatch' : 'match'}`}>
                <span>{row.customer}</span>
                <span>{row.score.toFixed(3)}</span>
                <span>{row.dispositionClass}</span>
                <span>{row.expectedBand}</span>
                <span>{row.actualBand}</span>
                <span>{row.mismatch ? 'Mismatch' : 'Aligned'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="insights-row agent-row">
        <h3>Agent Execution Status</h3>
        <div className="agent-status-list">
          {Object.entries(insights.agentStatus).map(([agentName, stats]) => {
            const totalRuns = stats.executed + stats.skipped + stats.error;
            const executedPct = totalRuns > 0 ? (stats.executed / totalRuns) * 100 : 0;
            const skippedPct = totalRuns > 0 ? (stats.skipped / totalRuns) * 100 : 0;
            const errorPct = totalRuns > 0 ? (stats.error / totalRuns) * 100 : 0;
            return (
              <div key={agentName} className="agent-status-row">
                <div className="agent-status-header">
                  <span className="agent-name">{agentName}</span>
                  <span className="agent-total">Total Runs: {totalRuns}</span>
                </div>
                <div className="agent-composite-bar" role="img" aria-label={`${agentName} execution status`}>
                  <div className="agent-segment executed" style={{ width: `${executedPct}%` }} title={`Executed: ${stats.executed} (${executedPct.toFixed(1)}%)`} />
                  <div className="agent-segment skipped" style={{ width: `${skippedPct}%` }} title={`Skipped: ${stats.skipped} (${skippedPct.toFixed(1)}%)`} />
                  <div className="agent-segment error" style={{ width: `${errorPct}%` }} title={`Error: ${stats.error} (${errorPct.toFixed(1)}%)`} />
                </div>
                <div className="agent-metrics">
                  <div className="agent-metric executed">
                    <span>Executed</span>
                    <strong>{stats.executed}</strong>
                    <em>{executedPct.toFixed(1)}%</em>
                  </div>
                  <div className="agent-metric skipped">
                    <span>Skipped</span>
                    <strong>{stats.skipped}</strong>
                    <em>{skippedPct.toFixed(1)}%</em>
                  </div>
                  <div className="agent-metric error">
                    <span>Error</span>
                    <strong>{stats.error}</strong>
                    <em>{errorPct.toFixed(1)}%</em>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="agent-legend">
          <div className="legend-item"><div className="legend-color executed" /><span>Executed</span></div>
          <div className="legend-item"><div className="legend-color skipped" /><span>Skipped</span></div>
          <div className="legend-item"><div className="legend-color error" /><span>Error</span></div>
        </div>
      </div>
    </div>
  );
}

export default InsightsPanel;
