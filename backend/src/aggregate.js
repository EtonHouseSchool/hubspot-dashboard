/**
 * Returns the start of the current week (Monday), month, and quarter,
 * matching HubSpot's "this week/month/quarter so far" report semantics.
 */
function getPeriodStarts(now = new Date()) {
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

/**
 * Groups deals into weekly/monthly/quarterly buckets by stage, counting
 * a deal in a period if it was created on or after that period's start.
 * Swap `createdate` for `hs_lastmodifieddate` if you'd rather count deals
 * that moved into a stage recently, regardless of when they were created.
 */
export function aggregateDeals(deals, stageLookup, pipelineIds = []) {
  const { startOfWeek, startOfMonth, startOfQuarter } = getPeriodStarts();

  const buckets = {
    weekly: {},
    monthly: {},
    quarterly: {},
  };

  for (const deal of deals) {
    const props = deal.properties;
    if (pipelineIds.length && !pipelineIds.includes(props.pipeline)) continue;

    const stageInfo = stageLookup[props.dealstage];
    const stageLabel = stageInfo ? stageInfo.label : props.dealstage || "Unknown";

    const created = props.createdate ? new Date(props.createdate) : null;
    if (!created) continue;

    if (created >= startOfWeek) {
      buckets.weekly[stageLabel] = (buckets.weekly[stageLabel] || 0) + 1;
    }
    if (created >= startOfMonth) {
      buckets.monthly[stageLabel] = (buckets.monthly[stageLabel] || 0) + 1;
    }
    if (created >= startOfQuarter) {
      buckets.quarterly[stageLabel] = (buckets.quarterly[stageLabel] || 0) + 1;
    }
  }

  const toArray = (obj) =>
    Object.entries(obj)
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count);

  return {
    weekly: toArray(buckets.weekly),
    monthly: toArray(buckets.monthly),
    quarterly: toArray(buckets.quarterly),
    generatedAt: new Date().toISOString(),
  };
}
