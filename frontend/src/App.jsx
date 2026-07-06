import { useEffect, useState, useCallback } from "react";
import PipelineSection from "./components/PipelineSection.jsx";
import DealPanel from "./components/DealPanel.jsx";
import { fetchPipelineSummary, triggerRefresh, fetchDealsForStage } from "./api.js";

const POLL_INTERVAL_MS = 60_000;

export default function App() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [selection, setSelection] = useState(null); // { stage, period, pipelineId, pipelineLabel } | null
  const [panelDeals, setPanelDeals] = useState([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState(null);

  const handleSelectStage = useCallback(async (stage, period, pipelineId, pipelineLabel) => {
    setSelection({ stage, period, pipelineId, pipelineLabel });
    setPanelLoading(true);
    setPanelError(null);
    try {
      const data = await fetchDealsForStage(stage, period, pipelineId);
      setPanelDeals(data.deals);
    } catch (err) {
      setPanelError(err.message);
    } finally {
      setPanelLoading(false);
    }
  }, []);

  const closePanel = useCallback(() => setSelection(null), []);

  const load = useCallback(async () => {
    try {
      const data = await fetchPipelineSummary();
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await triggerRefresh();
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div className="dashboard__brand">
          <div className="dashboard__badge">EH</div>
          <div>
            <h1>Admissions Pipeline</h1>
            <p className="dashboard__subtitle">Live from HubSpot — one section per campus</p>
          </div>
        </div>
        <div className="dashboard__sync">
          {summary && (
            <span className="dashboard__sync-status">
              <i className="dashboard__pulse" />
              Synced {new Date(summary.generatedAt).toLocaleTimeString()}
            </span>
          )}
          <button onClick={handleRefresh} disabled={refreshing}>
            <span className={refreshing ? "dashboard__spinner" : undefined}>⟳</span>
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      </div>

      {error && <div className="dashboard__error">Couldn't load data: {error}</div>}

      {!summary && !error && (
        <div className="metric-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="metric-card metric-card--skeleton" key={i}>
              <div className="skeleton skeleton--label" />
              <div className="skeleton skeleton--value" />
            </div>
          ))}
        </div>
      )}

      {summary?.pipelines.map((pipeline) => (
        <PipelineSection key={pipeline.id} pipeline={pipeline} onSelectStage={handleSelectStage} />
      ))}

      <DealPanel
        selection={selection}
        deals={panelDeals}
        loading={panelLoading}
        error={panelError}
        onClose={closePanel}
      />
    </div>
  );
}
