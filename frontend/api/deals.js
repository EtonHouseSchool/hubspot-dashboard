import { fetchRecentDeals, fetchDealPipelines, buildStageLookup } from "./_lib/hubspotClient.js";
import { resolveDeals, filterDeals, getPeriodStarts } from "./_lib/aggregate.js";

const VALID_PERIODS = ["weekly", "monthly", "quarterly"];

// GET /api/deals?stage=Tour+Scheduled&period=weekly&pipeline=default — the deals behind one bar of a chart.
// pipeline is required because two pipelines can use the same stage label (e.g. both call a stage "New").
export default async function handler(req, res) {
  const { stage, period, pipeline } = req.query;

  if (!stage || !period || !pipeline) {
    return res.status(400).json({ error: "'stage', 'period', and 'pipeline' query params are all required." });
  }
  if (!VALID_PERIODS.includes(period)) {
    return res.status(400).json({ error: `'period' must be one of: ${VALID_PERIODS.join(", ")}` });
  }

  try {
    const { startOfWeek, startOfMonth, startOfQuarter } = getPeriodStarts();
    const periodStart = { weekly: startOfWeek, monthly: startOfMonth, quarterly: startOfQuarter }[period];

    const [deals, pipelines] = await Promise.all([fetchRecentDeals(periodStart), fetchDealPipelines()]);
    const stageLookup = buildStageLookup(pipelines);
    const resolved = resolveDeals(deals, stageLookup);
    const filtered = filterDeals(resolved, { stage, period, pipelineId: pipeline });

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
    res.status(200).json({ stage, period, pipeline, deals: filtered });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
