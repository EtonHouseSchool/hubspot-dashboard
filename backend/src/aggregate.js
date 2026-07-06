/**
 * Returns the start of the current week (Monday), month, and quarter,
 * matching HubSpot's "this week/month/quarter so far" report semantics.
 */
export function getPeriodStarts(now = new Date()) {
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
  const startOfQuarter = new Date(now.getFullYear(), quarterMonth, 1);

  return { startOfWeek, startOfMonth, startOfQuarter };
}

const PERIOD_KEYS = ["weekly", "monthly", "quarterly"];

/**
 * Turns raw HubSpot deal objects into the flat shape the rest of the app
 * works with, resolving stage IDs to human-readable labels (and their
 * funnel position) and dropping deals outside the configured pipeline(s).
 */
export function resolveDeals(deals, stageLookup, pipelineIds = []) {
  const resolved = [];

  for (const deal of deals) {
    const props = deal.properties;
    if (pipelineIds.length && !pipelineIds.includes(props.pipeline)) continue;

    const stageInfo = stageLookup[props.dealstage];

    resolved.push({
      id: deal.id,
      dealname: props.dealname || "(no name)",
      stage: stageInfo ? stageInfo.label : props.dealstage || "Unknown",
      stageOrder: stageInfo ? stageInfo.sortOrder : Number.MAX_SAFE_INTEGER,
      pipeline: stageInfo ? stageInfo.pipelineLabel : props.pipeline || null,
      createdate: props.createdate || null,
      closedate: props.closedate || null,
      lastmodifieddate: props.hs_lastmodifieddate || null,
    });
  }

  return resolved;
}

function bucketCounts(resolvedDeals, start, end) {
  const counts = {};
  const orders = {};

  for (const deal of resolvedDeals) {
    if (!deal.createdate) continue;
    const created = new Date(deal.createdate);
    if (created >= start && created < end) {
      counts[deal.stage] = (counts[deal.stage] || 0) + 1;
      if (!(deal.stage in orders)) orders[deal.stage] = deal.stageOrder;
    }
  }

  return { counts, orders };
}

// Sorted by the stage's actual position in the HubSpot pipeline (funnel
// order), not by count, so charts read New -> Tour -> Enrolled left to right
// the way an admissions team actually thinks about the pipeline.
function toSortedArray(counts, orders) {
  return Object.entries(counts)
    .map(([stage, count]) => ({ stage, count, _order: orders[stage] ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a._order - b._order)
    .map(({ stage, count }) => ({ stage, count }));
}

/**
 * Groups resolved deals into weekly/monthly/quarterly buckets by stage.
 * For each period, also computes the same stage breakdown for the
 * immediately preceding window of equal length (e.g. "this week so far"
 * vs. "the same number of days last week"), so the frontend can show fair
 * like-for-like trend deltas instead of comparing a partial period to a
 * full one.
 */
export function aggregateDeals(resolvedDeals) {
  const { startOfWeek, startOfMonth, startOfQuarter } = getPeriodStarts();
  const now = new Date();
  const periodStarts = { weekly: startOfWeek, monthly: startOfMonth, quarterly: startOfQuarter };

  const result = { generatedAt: now.toISOString(), previous: {} };

  for (const key of PERIOD_KEYS) {
    const start = periodStarts[key];
    const { counts, orders } = bucketCounts(resolvedDeals, start, now);
    result[key] = toSortedArray(counts, orders);

    const durationMs = now.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - durationMs);
    const { counts: prevCounts, orders: prevOrders } = bucketCounts(resolvedDeals, previousStart, start);
    result.previous[key] = toSortedArray(prevCounts, prevOrders);
  }

  return result;
}

/**
 * Returns the individual deals behind one bar of a chart: a given stage
 * within a given period, newest first.
 */
export function filterDeals(resolvedDeals, { stage, period }) {
  const { startOfWeek, startOfMonth, startOfQuarter } = getPeriodStarts();
  const periodStart = { weekly: startOfWeek, monthly: startOfMonth, quarterly: startOfQuarter }[period];
  if (!periodStart) return [];

  return resolvedDeals
    .filter((deal) => deal.stage === stage && deal.createdate && new Date(deal.createdate) >= periodStart)
    .sort((a, b) => new Date(b.createdate) - new Date(a.createdate));
}
