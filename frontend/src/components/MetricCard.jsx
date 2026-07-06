function Trend({ trend, positiveDirection }) {
  if (!trend) return null;

  if (trend.isNew) {
    return <span className="metric-trend metric-trend--up">New</span>;
  }

  const { direction, percent } = trend;
  if (direction === "flat") {
    return <span className="metric-trend metric-trend--flat">– flat</span>;
  }

  const isGood = direction === positiveDirection;
  const arrow = direction === "up" ? "↑" : "↓";
  const suffix = trend.suffix ?? "%";

  return (
    <span className={`metric-trend ${isGood ? "metric-trend--up" : "metric-trend--down"}`}>
      {arrow} {percent}{suffix}
    </span>
  );
}

export default function MetricCard({ label, value, tone = "default", trend, positiveDirection = "up" }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-card__row">
        <div className={`metric-value metric-value--${tone}`}>{value}</div>
        <Trend trend={trend} positiveDirection={positiveDirection} />
      </div>
    </div>
  );
}
