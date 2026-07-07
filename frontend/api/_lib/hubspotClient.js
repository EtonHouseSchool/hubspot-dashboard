const HUBSPOT_BASE = "https://api.hubapi.com";

function authHeaders() {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    throw new Error("HUBSPOT_TOKEN is not set. Add it in Vercel's Project Settings → Environment Variables.");
  }
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const DEAL_PROPERTIES = ["dealname", "dealstage", "pipeline", "createdate", "closedate", "hs_lastmodifieddate"];

/**
 * Fetches deals created on or after `sinceDate`, following pagination.
 * There's no persistent server here to keep a full local copy of every deal,
 * so every request asks HubSpot only for what it actually needs (the
 * current + comparison period) instead of the whole account's history —
 * that's the difference between a ~1s response and a 20+s one.
 */
export async function fetchRecentDeals(sinceDate) {
  const deals = [];
  let after = undefined;

  do {
    const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        filterGroups: [
          { filters: [{ propertyName: "createdate", operator: "GTE", value: String(sinceDate.getTime()) }] },
        ],
        properties: DEAL_PROPERTIES,
        limit: 100,
        after,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HubSpot deals search failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    deals.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return deals;
}

/**
 * Fetches pipeline + stage definitions so we can translate internal stage IDs
 * (e.g. "closedwon") into human-readable labels (e.g. "Enrolled").
 */
export async function fetchDealPipelines() {
  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/pipelines/deals`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot pipelines request failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.results;
}

/**
 * Builds a lookup of stageId -> { label, pipelineId, pipelineLabel, pipelineIndex, sortOrder }.
 * sortOrder combines the pipeline's position with the stage's displayOrder so
 * charts can show stages in actual funnel order (New -> Tour -> Enrolled)
 * instead of sorting by count, matching how HubSpot's own reports order them.
 * Two pipelines can define stages with the same label (e.g. both call one
 * "New"), so pipelineId always identifies which pipeline a stage belongs to.
 */
export function buildStageLookup(pipelines) {
  const lookup = {};
  pipelines.forEach((pipeline, pipelineIndex) => {
    for (const stage of pipeline.stages) {
      lookup[stage.id] = {
        label: stage.label,
        pipelineId: pipeline.id,
        pipelineLabel: pipeline.label,
        pipelineIndex,
        sortOrder: pipelineIndex * 1000 + (stage.displayOrder ?? 0),
      };
    }
  });
  return lookup;
}
