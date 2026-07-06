import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

const STAGE_COLORS = [
  { match: /schedul/i, color: "#2a78d6" },
  { match: /complet/i, color: "#1baf7a" },
  { match: /pending/i, color: "#fab219" },
  { match: /enrol/i, color: "#0ca30c" },
  { match: /lost/i, color: "#d03b3b" },
];

// Stages outside the known set (any pipeline can define its own) get
// assigned one of these in first-seen order, so no two stages in the same
// dashboard ever end up sharing a color.
const FALLBACK_PALETTE = [
  "#6c5ce7", "#e67e22", "#16a3b8", "#c2185b", "#7f8c8d",
  "#8e44ad", "#0097a7", "#f39c12", "#5d6d7e", "#2874a6",
];

// Builds a stageLabel -> color map covering every stage that appears
// anywhere in the dashboard, so the same stage always renders the same
// color across the weekly/monthly/quarterly charts and the legend.
export function buildStageColorMap(stageLabels) {
  const map = new Map();
  let fallbackIndex = 0;
  for (const label of stageLabels) {
    if (map.has(label)) continue;
    const known = STAGE_COLORS.find((entry) => entry.match.test(label));
    if (known) {
      map.set(label, known.color);
    } else {
      map.set(label, FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length]);
      fallbackIndex += 1;
    }
  }
  return map;
}

// Draws the count at the end of each bar so the numbers read at a glance
// without needing to hover for the tooltip.
const valueLabelsPlugin = {
  id: "valueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.font = "600 12.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#3f3e3a";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    meta.data.forEach((bar, index) => {
      const value = chart.data.datasets[0].data[index];
      const { x, y } = bar.tooltipPosition();
      ctx.fillText(String(value), x + 8, y);
    });
    ctx.restore();
  },
};

export default function StageChart({ title, data, colorMap, period, onSelectStage }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const labels = data.map((d) => d.stage);
    const counts = data.map((d) => d.count);

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: counts,
            backgroundColor: labels.map((label) => colorMap.get(label) ?? "#898781"),
            borderRadius: 6,
            maxBarThickness: 26,
            categoryPercentage: 0.7,
            barPercentage: 0.9,
          },
        ],
      },
      plugins: [valueLabelsPlugin],
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 28 } },
        onClick: (_event, elements) => {
          if (!elements.length || !onSelectStage) return;
          onSelectStage(labels[elements[0].index], period);
        },
        onHover: (event, elements) => {
          event.native.target.style.cursor = elements.length ? "pointer" : "default";
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1c1c1a",
            padding: 10,
            cornerRadius: 8,
            titleFont: { weight: "600" },
            callbacks: { label: (ctx) => `${ctx.parsed.x} deals — click for names` },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grace: "12%",
            ticks: { precision: 0, color: "#898781", font: { size: 11 } },
            grid: { color: "rgba(137,135,129,0.15)" },
            border: { display: false },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: "#3f3e3a", font: { size: 12.5, weight: "500" } },
          },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data, colorMap, period, onSelectStage]);

  const height = Math.max(data.length * 40 + 80, 160);

  return (
    <div className="stage-chart">
      <div className="stage-chart__title">{title}</div>
      {data.length === 0 ? (
        <div className="stage-chart__empty">No deals in this period.</div>
      ) : (
        <div style={{ position: "relative", height }}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`${title}: ${data.map((d) => `${d.stage} ${d.count}`).join(", ")}`}
          />
        </div>
      )}
    </div>
  );
}
