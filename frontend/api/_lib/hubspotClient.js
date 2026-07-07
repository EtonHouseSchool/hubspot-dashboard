const HUBSPOT_BASE = "https://api.hubapi.com";

function authHeaders() {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    throw new Error("HUBSPOT_TOKEN is not set. Add it in Vercel's Project Settings → Environment Variables.");
  }
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const DEAL_PROPERTIES = ["dealname", "dealstage", "pipeline", "createdate", "closedate", "hs_lastmodifieddate"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchDealsPage(start, end, after) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: "createdate", operator: "GTE", value: String(start.getTime()) },
              { propertyName: "createdate", operator: "LT", value: String(end.getTime()) },
            ],
          },
        ],
        properties: DEAL_PROPERTIES,
        limit: 100,
        after,
      }),
    });

    if (res.status === 429 && attempt < 3) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 1;
      await sleep(retryAfter * 1000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HubSpot deals search failed (${res.status}): ${body}`);
    }
    return res.json();
  }
}

async function fetchDealsInRange(start, end) {
  const deals = [];
  let after = undefined;

  do {
    const data = await searchDealsPage(start, end, after);
    deals.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return deals;
}

// Runs `fn` over `items` with at most `limit` in flight at once — HubSpot's
// search endpoint enforces a low per-second rate limit, so firing every
// month slice at the same instant gets throttled with 429s instead of
// actually going faster.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const current = next++;
      results[current] = await fn(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Splits [sinceDate, now) into calendar-month slices so they can be fetched
// concurrently below — each slice only ever needs a couple of pages, versus
// one long sequential pagination loop across the whole window.
function monthSlices(sinceDate, now) {
  const slices = [];
  let cursor = new Date(sinceDate.getFullYear(), sinceDate.getMonth(), 1);

  while (cursor < now) {
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    slices.push({
      start: cursor < sinceDate ? sinceDate : cursor,
      end: nextMonth < now ? nextMonth : now,
    });
    cursor = nextMonth;
  }

  return slices;
}

/**
 * Fetches deals created on or after `sinceDate`. There's no persistent
 * server here to keep a full local copy of every deal, so every request
 * asks HubSpot only for what it actually needs (the current + comparison
 * period) instead of the whole account's history. For wider windows, the
 * range is split into monthly slices fetched a few at a time (limited
 * concurrency, since HubSpot's search endpoint rate-limits a full burst) —
 * a single sequential pagination loop across, say, an 8-month window took
 * 12+ seconds in testing.
 */
export async function fetchRecentDeals(sinceDate) {
  const now = new Date();
  const slices = monthSlices(sinceDate, now);
  const results = await mapWithConcurrency(slices, 3, ({ start, end }) => fetchDealsInRange(start, end));
  return results.flat();
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
