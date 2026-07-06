import { useEffect, useState, useCallback, useMemo } from "react";
import MetricCard from "./components/MetricCard.jsx";
import StageChart from "./components/StageChart.jsx";
import { fetchPipelineSummary, triggerRefresh } from "./api.js";

const POLL_INTERVAL_MS = 60_000;

function sum(entries) {
  return entries.reduce((total, e) => total + e.count, 0);
}

function findByKeyword(entries, keyword) {
  const match = entries.find((e) => new RegExp(keyword, "i").test(e.stage));
  return match ? match.count : 0;
}

export default function App() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const kpis = useMemo(() => {
    if (!summary) return null;
    const quarterly = summary.quarterly;
    const total = sum(quarterly);
    const enrolled = findByKeyword(quarterly, "enrol");
    const lost = findByKeyword(quarterly, "lost");
    const completed = findByKeyword(quarterly, "complet");
    return {
      total,
      enrolledRate: total ? Math.round((enrolled / total) * 100) : 0,
      lostRate: total ? Math.round((lost / total) * 100) : 0,
      completed,
    };
  }, [summary]);

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h1>Nature pipeline</h1>
          <p className="dashboard__subtitle">Deal stage counts by period</p>
        </div>
        <div className="dashboard__sync">
          {summary && (
            <span>Synced {new Date(summary.generatedAt).toLocaleTimeString()}</span>
          )}
          <button onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      </div>

      {error && <div className="dashboard__error">Couldn't load data: {error}</div>}

      {kpis && (
        <div className="metric-grid">
          <MetricCard label="Deals this quarter" value={kpis.total} />
          <MetricCard label="Enrolled rate" value={`${kpis.enrolledRate}%`} tone="success" />
          <MetricCard label="Lost rate" value={`${kpis.lostRate}%`} tone="danger" />
          <MetricCard label="Tours completed" value={kpis.completed} />
        </div>
      )}

      <div className="legend">
        <span><i style={{ background: "#2a78d6" }} />Tour scheduled</span>
        <span><i style={{ background: "#1baf7a" }} />Tour completed</span>
        <span><i style={{ background: "#fab219" }} />Pending</span>
        <span><i style={{ background: "#0ca30c" }} />Enrolled</span>
        <span><i style={{ background: "#d03b3b" }} />Lost</span>
      </div>

      {summary && (
        <>
          <StageChart title="This week so far" data={summary.weekly} />
          <StageChart title="This month so far" data={summary.monthly} />
          <StageChart title="This quarter so far" data={summary.quarterly} />
        </>
      )}
    </div>
  );
}
