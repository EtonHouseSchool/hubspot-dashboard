import { fetchAllDeals, fetchDealPipelines, buildStageLookup } from "./hubspotClient.js";
import { aggregateDeals } from "./aggregate.js";

let cachedSummary = null;
let lastError = null;

export function getCachedSummary() {
  return cachedSummary;
}

export function getLastError() {
  return lastError;
}

export async function refreshCache() {
  try {
    const pipelineIds = (process.env.HUBSPOT_PIPELINE_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const [deals, pipelines] = await Promise.all([fetchAllDeals(), fetchDealPipelines()]);
    const stageLookup = buildStageLookup(pipelines);

    cachedSummary = aggregateDeals(deals, stageLookup, pipelineIds);
    lastError = null;
    console.log(`[cache] refreshed at ${cachedSummary.generatedAt} (${deals.length} deals)`);
  } catch (err) {
    lastError = err.message;
    console.error("[cache] refresh failed:", err.message);
  }
  return cachedSummary;
}
