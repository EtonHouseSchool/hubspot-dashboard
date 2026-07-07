// Same-origin: the frontend and the /api serverless functions are one
// Vercel project, so no base URL or CORS config is needed.

export async function fetchPipelineSummary() {
  const res = await fetch("/api/pipeline-summary");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchDealsForStage(stage, period, pipeline) {
  const params = new URLSearchParams({ stage, period, pipeline });
  const res = await fetch(`/api/deals?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// The "Refresh now" button bypasses the edge cache with a query param the
// serverless function treats as a signal to skip caching entirely, so the
// user actually gets newly-fetched data instead of the same cached response.
export async function triggerRefresh() {
  const res = await fetch(`/api/pipeline-summary?fresh=${Date.now()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}
