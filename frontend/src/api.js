const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function fetchPipelineSummary() {
  const res = await fetch(`${API_URL}/api/pipeline-summary`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchDealsForStage(stage, period, pipeline) {
  const params = new URLSearchParams({ stage, period, pipeline });
  const res = await fetch(`${API_URL}/api/deals?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function triggerRefresh() {
  const res = await fetch(`${API_URL}/api/pipeline-summary/refresh`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}
