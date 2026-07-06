import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import pipelineRoutes from "./routes/pipeline.js";
import webhookRoutes from "./webhooks/hubspot.js";
import { refreshCache } from "./cache.js";

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(cors({ origin: allowedOrigins }));

// Webhooks need the raw body for signature verification, so capture it
// before express.json() parses it.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api", pipelineRoutes);
app.use("/webhooks", webhookRoutes);

app.listen(port, async () => {
  console.log(`Backend listening on http://localhost:${port}`);
  await refreshCache(); // warm the cache on boot

  const interval = Number(process.env.REFRESH_INTERVAL_MINUTES || 10);
  cron.schedule(`*/${interval} * * * *`, () => {
    refreshCache();
  });
  console.log(`Scheduled refresh every ${interval} minute(s).`);
});
