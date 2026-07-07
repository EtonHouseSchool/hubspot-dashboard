# Admissions pipeline dashboard

Executive dashboard that syncs deal-stage data from HubSpot and displays it
as weekly / monthly / quarterly charts and KPIs, one section per pipeline
(e.g. one per campus/program). Single Vite + React app:

- `frontend/src/` — the dashboard UI.
- `frontend/api/` — Vercel serverless functions. Hold the HubSpot token,
  fetch and aggregate deals. **Nothing else talks to HubSpot.**

There's no separate backend server or database — the serverless functions
fetch directly from HubSpot on each request (only the deals actually needed
for the current view, via a date-filtered search, to keep it fast) and rely
on Vercel's edge cache instead of an in-memory one, since serverless
functions don't keep a warm process running between requests.

## 1. HubSpot setup (one-time, in your HubSpot account)

Create a Private App or Service Key under Settings → Integrations, scoped to:
`crm.objects.deals.read`, `crm.schemas.deals.read`, `crm.objects.pipelines.read`.
Copy the generated token — you'll only see it once.

## 2. Run it locally

Local dev uses the [Vercel CLI](https://vercel.com/docs/cli) so the `/api`
functions run alongside the Vite app exactly like production:

```bash
npm install -g vercel   # one-time
cd frontend
cp .env.example .env
# edit .env and paste your HUBSPOT_TOKEN
npm install
vercel dev
```

Visit the local URL it prints (typically `http://localhost:3000`).

## 3. Deploying

1. Push this repo to GitHub (see below if you haven't already).
2. On [vercel.com](https://vercel.com), **Add New Project** → import the repo.
3. Set **Root Directory** to `frontend`. Vercel auto-detects the Vite preset.
4. Add environment variable `HUBSPOT_TOKEN` (Project Settings → Environment
   Variables) with your real token — never commit it to `.env`.
5. Deploy. Every push to `main` auto-redeploys.

Vercel's free Hobby tier covers this comfortably with no recurring billing.

## 4. Push this to GitHub

From the project root (this folder):

```bash
git add .
git commit -m "Initial commit: HubSpot pipeline dashboard"
```

Then create an empty repo on GitHub (github.com → New repository — don't
initialize it with a README, since you already have one), and connect it:

```bash
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If prompted for credentials, use a GitHub personal access token (Settings →
Developer settings → Personal access tokens) rather than your account
password — GitHub no longer accepts password auth over HTTPS. Never paste
that token into a chat with anyone, including here.

## Project structure

```
hubspot-dashboard/
└── frontend/
    ├── api/
    │   ├── _lib/
    │   │   ├── hubspotClient.js   # HubSpot API calls
    │   │   └── aggregate.js       # groups deals by pipeline + stage + time window
    │   ├── pipeline-summary.js    # GET /api/pipeline-summary
    │   └── deals.js               # GET /api/deals — deals behind one chart bar
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   ├── components/
    │   │   ├── MetricCard.jsx
    │   │   ├── PipelineSection.jsx
    │   │   ├── StageChart.jsx
    │   │   └── DealPanel.jsx
    │   └── styles.css
    └── .env.example
```

## Notes

- Counts are based on `createdate` falling inside the current week/month/
  quarter, mirroring HubSpot's own "this week/month/quarter so far" reports.
  If you'd rather count deals that *moved into* a stage recently regardless
  of creation date, swap `createdate` for `hs_lastmodifieddate` in
  `frontend/api/_lib/aggregate.js`.
- The dashboard renders one full section per HubSpot pipeline automatically
  (e.g. one per campus/program) — no configuration needed. Two pipelines can
  use the same stage label (both call a stage "New"), so stages are always
  scoped by pipeline ID under the hood, never merged across pipelines.
- `/api/pipeline-summary` is cached at Vercel's edge for 5 minutes (serving
  stale for up to 2 more while refreshing in the background). The "Refresh
  now" button bypasses this with a cache-busting param to force a live fetch.
- Both endpoints only fetch deals created since the oldest boundary they
  actually need (not the account's full history) — this is what keeps a
  serverless request fast instead of paginating through every deal ever
  created on every call.
