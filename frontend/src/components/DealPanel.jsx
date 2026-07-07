const PERIOD_LABELS = {
  weekly: "this week so far",
  monthly: "this month so far",
  lastMonth: "last month",
  quarterly: "this quarter so far",
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function DealPanel({ selection, deals, loading, error, onClose }) {
  const open = Boolean(selection);

  return (
    <>
      <div className={`deal-panel__backdrop ${open ? "deal-panel__backdrop--open" : ""}`} onClick={onClose} />
      <aside className={`deal-panel ${open ? "deal-panel--open" : ""}`} aria-hidden={!open}>
        {selection && (
          <>
            <div className="deal-panel__header">
              <div>
                <h2>{selection.stage}</h2>
                <p>
                  {PERIOD_LABELS[selection.period]} · {selection.pipelineLabel}
                </p>
              </div>
              <button onClick={onClose} aria-label="Close">✕</button>
            </div>

            {loading && <div className="deal-panel__status">Loading…</div>}
            {error && <div className="deal-panel__status deal-panel__status--error">Couldn't load deals: {error}</div>}

            {!loading && !error && (
              <>
                <p className="deal-panel__count">{deals.length} deal{deals.length === 1 ? "" : "s"}</p>
                <ul className="deal-panel__list">
                  {deals.map((deal) => (
                    <li key={deal.id}>
                      <span className="deal-panel__name">{deal.dealname}</span>
                      <span className="deal-panel__date">{formatDate(deal.createdate)}</span>
                    </li>
                  ))}
                  {deals.length === 0 && <li className="deal-panel__empty">No deals found.</li>}
                </ul>
              </>
            )}
          </>
        )}
      </aside>
    </>
  );
}
