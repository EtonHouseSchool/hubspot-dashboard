import { fetchRecentDeals, fetchDealPipelines, buildStageLookup } from "./_lib/hubspotClient.js";
import { resolveDeals, aggregateDeals, getPeriodStarts } from "./_lib/aggregate.js";

// Widening the "quarter" to a 4-month term (and the growing comparison
// window as a term progresses) can mean several months of deals to
// paginate through. Extend past Vercel's default timeout as a safety
// margin — actual usage is dominated by the edge cache below anyway.
export const config = { maxDuration: 30 };

// GET /api/pipeline-summary — the frontend's only data call, no HubSpot token in sight.
// Cached at Vercel's edge for 5 minutes (serving stale for up to 2 more while
// refreshing in the background) since there's no persistent server here to
// hold a warm in-memory cache the way a long-running Node process would.
export default async function handler(req, res) {
  try {
    const { startOfQuarter } = getPeriodStarts();
    // Quarterly is always the widest window, so its "previous equal-length
    // period" boundary is the earliest createdate we need for any of the
    // three periods' trend comparisons.
    const durationMs = Date.now() - startOfQuarter.getTime();
    const earliestNeeded = new Date(startOfQuarter.getTime() - durationMs);

    const [deals, pipelines] = await Promise.all([fetchRecentDeals(earliestNeeded), fetchDealPipelines()]);
    const stageLookup = buildStageLookup(pipelines);
    const resolved = resolveDeals(deals, stageLookup);
    const knownPipelines = pipelines.map((p, index) => ({ id: p.id, label: p.label, index }));

    const summary = aggregateDeals(resolved, knownPipelines);

    const forceFresh = "fresh" in req.query;
    res.setHeader("Cache-Control", forceFresh ? "no-store" : "s-maxage=300, stale-while-revalidate=120");
    res.status(200).json(summary);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
