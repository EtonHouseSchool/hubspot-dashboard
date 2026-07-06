import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

const STAGE_COLORS = [
  { match: /schedul/i, color: "#2a78d6" },
  { match: /complet/i, color: "#1baf7a" },
  { match: /pending/i, color: "#fab219" },
  { match: /enrol/i, color: "#0ca30c" },
  { match: /lost/i, color: "#d03b3b" },
];

function colorFor(stageLabel) {
  const match = STAGE_COLORS.find((entry) => entry.match.test(stageLabel));
  return match ? match.color : "#898781";
}

export default function StageChart({ title, data }) {
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
            backgroundColor: labels.map(colorFor),
            borderRadius: 4,
            maxBarThickness: 24,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.x} deals` } },
        },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(137,135,129,0.2)" } },
          y: { grid: { display: false } },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data]);

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
