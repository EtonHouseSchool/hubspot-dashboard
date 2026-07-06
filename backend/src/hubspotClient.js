const HUBSPOT_BASE = "https://api.hubapi.com";

function authHeaders() {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    throw new Error("HUBSPOT_TOKEN is not set. Copy .env.example to .env and add your private app token.");
  }
  return { Authorization: `Bearer ${token}` };
}

/**
 * Fetches every deal from HubSpot, following pagination.
 * Only requests the properties we actually need to keep payloads small.
 */
export async function fetchAllDeals() {
  const properties = ["dealname", "dealstage", "pipeline", "createdate", "closedate", "hs_lastmodifieddate"];
  const deals = [];
  let after = undefined;

  do {
    const url = new URL(`${HUBSPOT_BASE}/crm/v3/objects/deals`);
    url.searchParams.set("properties", properties.join(","));
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HubSpot deals request failed (${res.status}): ${body}`);
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
 * Builds a lookup of stageId -> { label, pipelineId, pipelineLabel }
 */
export function buildStageLookup(pipelines) {
  const lookup = {};
  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages) {
      lookup[stage.id] = {
        label: stage.label,
        pipelineId: pipeline.id,
        pipelineLabel: pipeline.label,
      };
    }
  }
  return lookup;
}
