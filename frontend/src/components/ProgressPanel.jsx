import React, { useEffect, useState } from 'react';
import './ProgressPanel.css';

function ProgressPanel({ status }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  if (!status) {
    return (
      <div className="progress-panel">
        <div className="status-item current">
          <div className="status-dot"></div>
          <span className="status-text">Initializing...</span>
        </div>
      </div>
    );
  }

  const stages = [
    { name: 'Initializing', icon: 'IN' },
    { name: 'Customer Context', icon: 'CC' },
    { name: 'Claim Timeline', icon: 'CT' },
    { name: 'Financial Anomaly', icon: 'FA' },
    { name: 'Evidence Review', icon: 'ER' },
    { name: 'Final Disposition', icon: 'FD' }
  ];

  const getProgressStage = () => {
    const progress = status.progress || '';
    if (progress.includes('Initializing')) return 0;
    if (progress.includes('Customer Context') || progress.includes('Customer')) return 1;
    if (progress.includes('Claim Timeline') || progress.includes('Timeline')) return 2;
    if (progress.includes('Financial') || progress.includes('Anomaly')) return 3;
    if (progress.includes('Evidence') || progress.includes('Consistency')) return 4;
    if (progress.includes('Final') || progress.includes('Finalizing')) return 5;
    return 0;
  };

  const currentStage = getProgressStage();
  let elapsedSeconds = null;
  if (typeof status.executionTime === 'number') {
    elapsedSeconds = status.executionTime / 1000;
  } else if (typeof status.startTime === 'number') {
    elapsedSeconds = Math.max(0, (now - status.startTime) / 1000);
  }

  return (
    <div className="progress-panel">
      <div className="progress-header">
        <h3>Analysis Progress</h3>
        <p className="status-message">{status.progress || 'Processing...'}</p>
      </div>
      <div className="progress-stages">
        {stages.map((stage, index) => (
          <div 
            key={index}
            className={`stage-item ${index < currentStage ? 'completed' : index === currentStage ? 'current' : 'pending'}`}
          >
            <div className="stage-circle">
              <span className="stage-icon">{stage.icon}</span>
            </div>
            <p className="stage-name">{stage.name}</p>
          </div>
        ))}
      </div>
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${((currentStage + 1) / stages.length) * 100}%` }}></div>
      </div>
      <div className="execution-time">
        {elapsedSeconds !== null && (
          <p>Elapsed time: {elapsedSeconds.toFixed(1)}s</p>
        )}
      </div>
    </div>
  );
}

export default ProgressPanel;
