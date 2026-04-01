import React, { useMemo } from 'react';
import { Background, Controls, MarkerType, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './AgentMapPanel.css';

const stationOrder = [
  'Customer Context',
  'Claim Timeline',
  'Financial Anomaly',
  'Evidence Consistency',
  'Final Disposition'
];

const nodePositions = {
  'Customer Context': { x: 380, y: 40 },
  'Claim Timeline': { x: 140, y: 220 },
  'Financial Anomaly': { x: 380, y: 220 },
  'Evidence Consistency': { x: 620, y: 220 },
  'Final Disposition': { x: 380, y: 400 }
};

function normalizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'executed' || s === 'completed') return 'completed';
  if (s === 'skipped') return 'skipped';
  if (s === 'error' || s === 'failed') return 'error';
  return 'pending';
}

function getNodeTheme(status) {
  if (status === 'completed') {
    return {
      background: 'rgba(79, 219, 200, 0.16)',
      border: '2px solid rgba(79, 219, 200, 0.8)',
      color: '#d7fff9'
    };
  }

  if (status === 'skipped') {
    return {
      background: 'rgba(255, 179, 71, 0.16)',
      border: '2px solid rgba(255, 179, 71, 0.72)',
      color: '#ffe8c8'
    };
  }

  if (status === 'error') {
    return {
      background: 'rgba(179, 38, 30, 0.22)',
      border: '2px solid rgba(255, 138, 128, 0.76)',
      color: '#ffd7d3'
    };
  }

  return {
    background: 'rgba(38, 54, 74, 0.6)',
    border: '2px solid rgba(186, 199, 227, 0.3)',
    color: '#d3e4fe'
  };
}

function AgentMapPanel({ journeyData = [] }) {
  const [selectedJourneyIndex, setSelectedJourneyIndex] = React.useState(
    Array.isArray(journeyData) && journeyData.length > 0 ? journeyData.length - 1 : -1
  );

  const selectedJourney = journeyData[selectedJourneyIndex] || null;
  const stations = selectedJourney?.stations || {};

  const flow = useMemo(() => {
    const nodes = stationOrder.map((name) => {
      const rawStatus = stations[name] || Object.entries(stations).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] || 'pending';
      const status = normalizeStatus(rawStatus);
      const theme = getNodeTheme(status);

      return {
        id: name,
        position: nodePositions[name],
        data: {
          label: (
            <div className="map-node-content">
              <span className="map-node-title">{name}</span>
              <span className={`map-node-status ${status}`}>{String(rawStatus).toUpperCase()}</span>
            </div>
          )
        },
        style: {
          width: 210,
          borderRadius: 12,
          background: theme.background,
          border: theme.border,
          color: theme.color,
          boxShadow: '0 10px 22px rgba(0, 8, 18, 0.28)',
          padding: 10
        },
        draggable: false,
        selectable: false,
        connectable: false
      };
    });

    const edges = [
      ['Customer Context', 'Claim Timeline'],
      ['Customer Context', 'Financial Anomaly'],
      ['Customer Context', 'Evidence Consistency'],
      ['Claim Timeline', 'Final Disposition'],
      ['Financial Anomaly', 'Final Disposition'],
      ['Evidence Consistency', 'Final Disposition']
    ].map(([source, target], idx) => ({
      id: `e-${idx}`,
      source,
      target,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: {
        stroke: 'rgba(79, 219, 200, 0.65)',
        strokeWidth: 2
      }
    }));

    return { nodes, edges };
  }, [stations]);

  if (!journeyData || journeyData.length === 0) {
    return (
      <div className="agent-map-panel">
        <div className="agent-map-empty">
          <h2>Agent Map</h2>
          <p>No journey data yet. Run an analysis to view agent connections.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-map-panel">
      <div className="agent-map-header">
        <div className="agent-map-title-row">
          <h2>Agent Journey Map</h2>
          <select 
            value={selectedJourneyIndex} 
            onChange={(e) => setSelectedJourneyIndex(Number(e.target.value))}
            className="journey-selector"
          >
            {journeyData.map((journey, idx) => (
              <option key={idx} value={idx}>
                {journey.customer_name || 'Unknown'} (Run {idx + 1})
              </option>
            ))}
          </select>
        </div>
        <p>Case: {selectedJourney?.customer_name || 'Unknown customer'}</p>
      </div>
      <div className="agent-map-canvas">
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.6}
          maxZoom={1.4}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(186, 199, 227, 0.18)" gap={22} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default AgentMapPanel;
