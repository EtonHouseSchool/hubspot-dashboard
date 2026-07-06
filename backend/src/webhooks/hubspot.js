import { Router } from "express";
import crypto from "crypto";
import { refreshCache } from "../cache.js";

const router = Router();

/**
 * Verifies HubSpot's v3 signature so random POSTs to this endpoint can't
 * trigger a refresh. See: developers.hubspot.com/docs/api/webhooks/validating-requests
 * Skips verification if no secret is configured, so local dev still works.
 */
function isValidSignature(req) {
  const secret = process.env.HUBSPOT_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.header("X-HubSpot-Signature-v3");
  const timestamp = req.header("X-HubSpot-Request-Timestamp");
  if (!signature || !timestamp) return false;

  const base = `${req.method}${req.protocol}://${req.get("host")}${req.originalUrl}${req.rawBody}${timestamp}`;
  const expected = crypto.createHmac("sha256", secret).update(base).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// POST /webhooks/hubspot — HubSpot calls this the instant a subscribed
// property (e.g. dealstage) changes, so the dashboard can refresh immediately
// instead of waiting for the next scheduled poll.
router.post("/hubspot", async (req, res) => {
  if (!isValidSignature(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Acknowledge immediately; HubSpot expects a fast response.
  res.status(200).json({ received: true });

  // Refresh in the background — no need to make HubSpot wait for this.
  refreshCache();
});

export default router;
