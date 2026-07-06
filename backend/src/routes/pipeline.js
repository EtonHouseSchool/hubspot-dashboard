import { Router } from "express";
import { getCachedSummary, getLastError, refreshCache } from "../cache.js";

const router = Router();

// GET /api/pipeline-summary — the frontend's only call, no HubSpot token in sight.
router.get("/pipeline-summary", async (req, res) => {
  let summary = getCachedSummary();

  if (!summary) {
    // First request after boot: fetch synchronously instead of returning empty.
    summary = await refreshCache();
  }

  if (!summary) {
    return res.status(502).json({ error: getLastError() || "No data available yet." });
  }

  res.json(summary);
});

// POST /api/pipeline-summary/refresh — manual refresh trigger (e.g. a "refresh" button).
router.post("/pipeline-summary/refresh", async (req, res) => {
  const summary = await refreshCache();
  if (!summary) {
    return res.status(502).json({ error: getLastError() || "Refresh failed." });
  }
  res.json(summary);
});

export default router;
