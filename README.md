# Nature pipeline dashboard

Executive dashboard that syncs deal-stage data from HubSpot and displays it
as weekly / monthly / quarterly charts and KPIs. Two parts:

- `backend/` — Node/Express service. Holds the HubSpot token, fetches and
  aggregates deals, exposes one endpoint. **Nothing else talks to HubSpot.**
- `frontend/` — React (Vite) app. Calls the backend only, renders the charts.

## 1. HubSpot setup (one-time, in your HubSpot account)

1. Settings → Integrations → **Private Apps** → Create a private app.
2. Scopes: `crm.objects.deals.read`, `crm.schemas.deals.read`, `crm.objects.pipelines.read`.
3. Copy the generated token (`pat-na1-...`) — you'll only see it once.
4. Optional, for real-time updates: in the same private app, go to
   **Webhooks** → subscribe to `deal.propertyChange` on `dealstage`, and note
   the signing secret.

## 2. Run the backend

```bash
cd backend
cp .env.example .env
# edit .env and paste your HUBSPOT_TOKEN
npm install
npm run dev
```

Visit `http://localhost:4000/api/pipeline-summary` — you should see JSON
grouped by week/month/quarter and stage.

## 3. Run the frontend

```bash
cd frontend
cp .env.example .env   # defaults to http://localhost:4000, fine for local dev
npm install
npm run dev
```

Visit `http://localhost:5173`.

## 4. Deploying

- Backend: any Node host works (Railway, Render, Fly.io, an EC2 box). Set the
  same env vars as `.env` in that host's dashboard — never commit `.env`.
- Frontend: Vercel or Netlify. Set `VITE_API_URL` to your deployed backend's
  URL, then `npm run build` (or let the platform build it for you).
- Point the webhook URL (step 1.4) at `https://your-backend-domain/webhooks/hubspot`
  once the backend is deployed.

## 5. Push this to GitHub

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
├── backend/
│   ├── src/
│   │   ├── server.js          # Express app, cron schedule
│   │   ├── hubspotClient.js   # HubSpot API calls
│   │   ├── aggregate.js       # groups deals by stage + time window
│   │   ├── cache.js           # in-memory cache + refresh logic
│   │   ├── routes/pipeline.js # GET/POST /api/pipeline-summary
│   │   └── webhooks/hubspot.js
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   ├── components/
    │   │   ├── MetricCard.jsx
    │   │   └── StageChart.jsx
    │   └── styles.css
    └── .env.example
```

## Notes

- Counts are based on `createdate` falling inside the current week/month/
  quarter, mirroring HubSpot's own "this week/month/quarter so far" reports.
  If you'd rather count deals that *moved into* a stage recently regardless
  of creation date, swap `createdate` for `hs_lastmodifieddate` in
  `backend/src/aggregate.js`.
- The dashboard renders one full section per HubSpot pipeline automatically
  (e.g. one per campus/program) — no configuration needed. Two pipelines can
  use the same stage label (both call a stage "New"), so stages are always
  scoped by pipeline ID under the hood, never merged across pipelines.
- The cache refreshes on a timer (`REFRESH_INTERVAL_MINUTES`, default 10) and
  instantly on webhook events, so there's no need to poll HubSpot on every
  page load.
