import { Router } from "express";
import { getCachedSummary, getCachedDeals, getLastError, refreshCache } from "../cache.js";
import { filterDeals } from "../aggregate.js";

const router = Router();

const VALID_PERIODS = ["weekly", "monthly", "quarterly"];

// GET /api/deals?stage=Tour+Scheduled&period=weekly&pipeline=default — the deals behind one bar of a chart.
// pipeline is required because two pipelines can use the same stage label (e.g. both call a stage "New").
router.get("/deals", (req, res) => {
  const { stage, period, pipeline } = req.query;

  if (!stage || !period || !pipeline) {
    return res.status(400).json({ error: "'stage', 'period', and 'pipeline' query params are all required." });
  }
  if (!VALID_PERIODS.includes(period)) {
    return res.status(400).json({ error: `'period' must be one of: ${VALID_PERIODS.join(", ")}` });
  }

  const deals = filterDeals(getCachedDeals(), { stage, period, pipelineId: pipeline });
  res.json({ stage, period, pipeline, deals });
});

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
