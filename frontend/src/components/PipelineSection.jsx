import { useMemo } from "react";
import MetricCard from "./MetricCard.jsx";
import StageChart, { buildStageColorMap } from "./StageChart.jsx";

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

// One full report (KPIs + legend + weekly/monthly/quarterly charts) for a
// single HubSpot pipeline. The dashboard renders one of these per pipeline,
// since two pipelines can share stage labels (e.g. both call a stage "New")
// but represent entirely different campuses/programs.
export default function PipelineSection({ pipeline, onSelectStage }) {
  const kpis = useMemo(() => {
    const current = summarize(pipeline.quarterly);
    const previous = summarize(pipeline.previous?.quarterly ?? []);
    return {
      ...current,
      trends: {
        total: computeCountTrend(current.total, previous.total),
        enrolledRate: computeRateTrend(current.enrolledRate, previous.enrolledRate),
        lostRate: computeRateTrend(current.lostRate, previous.lostRate),
        completed: computeCountTrend(current.completed, previous.completed),
      },
    };
  }, [pipeline]);

  const legendStages = useMemo(() => {
    const seen = new Set();
    for (const period of [pipeline.quarterly, pipeline.monthly, pipeline.lastMonth, pipeline.weekly]) {
      for (const entry of period) seen.add(entry.stage);
    }
    return [...seen];
  }, [pipeline]);

  const stageColorMap = useMemo(() => buildStageColorMap(legendStages), [legendStages]);

  const handleSelect = (stage, period) => onSelectStage(stage, period, pipeline.id, pipeline.label);

  return (
    <section className="pipeline-section">
      <h2 className="pipeline-section__title">{pipeline.label}</h2>

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

      <StageChart
        title="This week so far"
        data={pipeline.weekly}
        colorMap={stageColorMap}
        period="weekly"
        onSelectStage={handleSelect}
      />
      <StageChart
        title="This month so far"
        data={pipeline.monthly}
        colorMap={stageColorMap}
        period="monthly"
        onSelectStage={handleSelect}
      />
      <StageChart
        title="Last month"
        data={pipeline.lastMonth}
        colorMap={stageColorMap}
        period="lastMonth"
        onSelectStage={handleSelect}
      />
      <StageChart
        title="This quarter so far"
        data={pipeline.quarterly}
        colorMap={stageColorMap}
        period="quarterly"
        onSelectStage={handleSelect}
      />
    </section>
  );
}
