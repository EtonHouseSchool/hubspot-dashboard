export default function MetricCard({ label, value, tone = "default" }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className={`metric-value metric-value--${tone}`}>{value}</div>
    </div>
  );
}
