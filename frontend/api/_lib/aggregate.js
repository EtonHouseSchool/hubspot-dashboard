/**
 * Returns the start of the current week (Monday), month, and "quarter".
 * "Quarter" here means a fixed 4-month block (Jan-Apr, May-Aug, Sep-Dec) per
 * this school's own usage, not the standard 3-month calendar quarter.
 */
export function getPeriodStarts(now = new Date()) {
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const termMonth = Math.floor(now.getMonth() / 4) * 4;
  const startOfQuarter = new Date(now.getFullYear(), termMonth, 1);

  return { startOfWeek, startOfMonth, startOfQuarter };
}

const PERIOD_KEYS = ["weekly", "monthly", "quarterly", "lastMonth"];

/**
 * Returns { start, end } for every chart period, plus a matching "previous"
 * window for each used in trend deltas. weekly/monthly/quarterly are
 * "so far" periods (start -> now), each compared against the immediately
 * preceding window of equal length. lastMonth is different in kind — a
 * complete, already-finished calendar month — so its comparison is simply
 * the calendar month before it, not an equal-elapsed-duration window.
 */
export function getPeriodRanges(now = new Date()) {
  const { startOfWeek, startOfMonth, startOfQuarter } = getPeriodStarts(now);

  const lastMonthStart = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - 1, 1);
  const twoMonthsAgoStart = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - 2, 1);

  const soFar = (start) => ({ start, end: now });
  const equalLengthBefore = (start) => ({ start: new Date(start.getTime() - (now.getTime() - start.getTime())), end: start });

  return {
    weekly: soFar(startOfWeek),
    monthly: soFar(startOfMonth),
    quarterly: soFar(startOfQuarter),
    lastMonth: { start: lastMonthStart, end: startOfMonth },
    previous: {
      weekly: equalLengthBefore(startOfWeek),
      monthly: equalLengthBefore(startOfMonth),
      quarterly: equalLengthBefore(startOfQuarter),
      lastMonth: { start: twoMonthsAgoStart, end: lastMonthStart },
    },
  };
}

/**
 * Turns raw HubSpot deal objects into the flat shape the rest of the app
 * works with, resolving stage IDs to human-readable labels (and their
 * funnel position). Two pipelines can use the same stage label, so every
 * deal carries its pipelineId/pipelineIndex to keep them from being mixed
 * together downstream.
 */
export function resolveDeals(deals, stageLookup) {
  const resolved = [];

  for (const deal of deals) {
    const props = deal.properties;
    const stageInfo = stageLookup[props.dealstage];

    resolved.push({
      id: deal.id,
      dealname: props.dealname || "(no name)",
      stage: stageInfo ? stageInfo.label : props.dealstage || "Unknown",
      stageOrder: stageInfo ? stageInfo.sortOrder : Number.MAX_SAFE_INTEGER,
      pipelineId: stageInfo ? stageInfo.pipelineId : props.pipeline || "unknown",
      pipelineLabel: stageInfo ? stageInfo.pipelineLabel : props.pipeline || "Unknown pipeline",
      pipelineIndex: stageInfo ? stageInfo.pipelineIndex : Number.MAX_SAFE_INTEGER,
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

function summarizePeriods(deals) {
  const ranges = getPeriodRanges();

  const summary = {};
  const previous = {};

  for (const key of PERIOD_KEYS) {
    const { counts, orders } = bucketCounts(deals, ranges[key].start, ranges[key].end);
    summary[key] = toSortedArray(counts, orders);

    const prevRange = ranges.previous[key];
    const { counts: prevCounts, orders: prevOrders } = bucketCounts(deals, prevRange.start, prevRange.end);
    previous[key] = toSortedArray(prevCounts, prevOrders);
  }

  summary.previous = previous;
  return summary;
}

/**
 * Groups resolved deals by pipeline (e.g. two different campuses can each
 * have their own pipeline in the same HubSpot account) and, within each
 * pipeline, into weekly/monthly/quarterly/lastMonth stage buckets. Each
 * period also gets a fair comparison window for trend deltas (see
 * getPeriodRanges).
 *
 * `knownPipelines` (from HubSpot's pipeline list, not from the deals
 * themselves) ensures a pipeline with zero matching deals in the fetched
 * window still renders as an empty section instead of silently vanishing.
 */
export function aggregateDeals(resolvedDeals, knownPipelines = []) {
  const groups = new Map(); // pipelineId -> { id, label, index, deals: [] }

  for (const { id, label, index } of knownPipelines) {
    groups.set(id, { id, label, index, deals: [] });
  }

  for (const deal of resolvedDeals) {
    if (!groups.has(deal.pipelineId)) {
      groups.set(deal.pipelineId, {
        id: deal.pipelineId,
        label: deal.pipelineLabel,
        index: deal.pipelineIndex,
        deals: [],
      });
    }
    groups.get(deal.pipelineId).deals.push(deal);
  }

  const pipelines = [...groups.values()]
    .sort((a, b) => a.index - b.index)
    .map((group) => ({
      id: group.id,
      label: group.label,
      ...summarizePeriods(group.deals),
    }));

  return { generatedAt: new Date().toISOString(), pipelines };
}

/**
 * Returns the individual deals behind one bar of a chart: a given stage
 * within a given period for a specific pipeline, newest first.
 */
export function filterDeals(resolvedDeals, { stage, period, pipelineId }) {
  const range = getPeriodRanges()[period];
  if (!range) return [];

  return resolvedDeals
    .filter(
      (deal) =>
        deal.stage === stage &&
        deal.pipelineId === pipelineId &&
        deal.createdate &&
        new Date(deal.createdate) >= range.start &&
        new Date(deal.createdate) < range.end
    )
    .sort((a, b) => new Date(b.createdate) - new Date(a.createdate));
}
