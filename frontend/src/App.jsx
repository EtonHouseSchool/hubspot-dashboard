import { useEffect, useState, useCallback, useMemo } from "react";
import MetricCard from "./components/MetricCard.jsx";
import StageChart, { buildStageColorMap } from "./components/StageChart.jsx";
import DealPanel from "./components/DealPanel.jsx";
import { fetchPipelineSummary, triggerRefresh, fetchDealsForStage } from "./api.js";

const POLL_INTERVAL_MS = 60_000;

function sum(entries) {
  return entries.reduce((total, e) => total + e.count, 0);
}

function findByKeyword(entries, keyword) {
  const match = entries.find((e) => new RegExp(keyword, "i").test(e.stage));
  return match ? match.count : 0;
}

// Relative change for raw counts, e.g. "18 deals, up 12% vs last quarter".
function computeCountTrend(current, previous) {
  if (previous === 0) return current === 0 ? null : { isNew: true };
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 1) return { direction: "flat" };
  return { direction: change > 0 ? "up" : "down", percent: Math.abs(Math.round(change)) };
}

// Percentage-point change for rates, e.g. "32% enrolled, up 5pts" rather
// than a confusing "percent change of a percent".
function computeRateTrend(currentRate, previousRate) {
  const diff = currentRate - previousRate;
  if (Math.abs(diff) < 1) return { direction: "flat" };
  return { direction: diff > 0 ? "up" : "down", percent: Math.abs(Math.round(diff)), suffix: "pt" };
}

function summarize(entries) {
  const total = sum(entries);
  const enrolled = findByKeyword(entries, "enrol");
  const lost = findByKeyword(entries, "lost");
  const completed = findByKeyword(entries, "complet");
  return {
    total,
    enrolledRate: total ? Math.round((enrolled / total) * 100) : 0,
    lostRate: total ? Math.round((lost / total) * 100) : 0,
    completed,
  };
}

export default function App() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [selection, setSelection] = useState(null); // { stage, period } | null
  const [panelDeals, setPanelDeals] = useState([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState(null);

  const handleSelectStage = useCallback(async (stage, period) => {
    setSelection({ stage, period });
    setPanelLoading(true);
    setPanelError(null);
    try {
      const data = await fetchDealsForStage(stage, period);
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

  const kpis = useMemo(() => {
    if (!summary) return null;
    const current = summarize(summary.quarterly);
    const previous = summarize(summary.previous?.quarterly ?? []);
    return {
      ...current,
      trends: {
        total: computeCountTrend(current.total, previous.total),
        enrolledRate: computeRateTrend(current.enrolledRate, previous.enrolledRate),
        lostRate: computeRateTrend(current.lostRate, previous.lostRate),
        completed: computeCountTrend(current.completed, previous.completed),
      },
    };
  }, [summary]);

  const legendStages = useMemo(() => {
    if (!summary) return [];
    const seen = new Set();
    for (const period of [summary.quarterly, summary.monthly, summary.weekly]) {
      for (const entry of period) seen.add(entry.stage);
    }
    return [...seen];
  }, [summary]);

  const stageColorMap = useMemo(() => buildStageColorMap(legendStages), [legendStages]);

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div className="dashboard__brand">
          <div className="dashboard__badge">EH</div>
          <div>
            <h1>Admissions Pipeline</h1>
            <p className="dashboard__subtitle">Live from HubSpot — deal stage counts by period</p>
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

      {kpis && (
        <div className="metric-grid">
          <MetricCard label="Deals this quarter" value={kpis.total} trend={kpis.trends.total} />
          <MetricCard
            label="Enrolled rate"
            value={`${kpis.enrolledRate}%`}
            tone="success"
            trend={kpis.trends.enrolledRate}
          />
          <MetricCard
            label="Lost rate"
            value={`${kpis.lostRate}%`}
            tone="danger"
            trend={kpis.trends.lostRate}
            positiveDirection="down"
          />
          <MetricCard label="Tours completed" value={kpis.completed} trend={kpis.trends.completed} />
        </div>
      )}

      {legendStages.length > 0 && (
        <div className="legend">
          {legendStages.map((stage) => (
            <span key={stage}>
              <i style={{ background: stageColorMap.get(stage) }} />
              {stage}
            </span>
          ))}
        </div>
      )}

      {summary && (
        <>
          <StageChart
            title="This week so far"
            data={summary.weekly}
            colorMap={stageColorMap}
            period="weekly"
            onSelectStage={handleSelectStage}
          />
          <StageChart
            title="This month so far"
            data={summary.monthly}
            colorMap={stageColorMap}
            period="monthly"
            onSelectStage={handleSelectStage}
          />
          <StageChart
            title="This quarter so far"
            data={summary.quarterly}
            colorMap={stageColorMap}
            period="quarterly"
            onSelectStage={handleSelectStage}
          />
        </>
      )}

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
