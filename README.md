# EdgeLog

EdgeLog is a trading journal web app for active traders. It combines a React frontend, an Express API, Supabase for database and auth, AI-assisted journal analysis, and live Indian market context.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- State/Data: Zustand, React Query
- Charts: Recharts
- Backend: Node.js, Express, TypeScript
- Database/Auth: Supabase
- AI: Google Gemini
- Market Data: Upstox Analytics Token + Upstox OAuth connection

## Design Direction

- Theme: Bloomberg Terminal meets Linear App
- Fonts: JetBrains Mono for headings and numbers, DM Sans for body text
- Money display: formatted in INR across the UI
- Theme support: dark mode and light mode

## Main Features

- Auth with Supabase-backed login and registration
- Dashboard with KPI cards, equity curve, heatmap, streaks, recent trades, and multi-account support
- Trade log with filters, sorting, pagination, bulk delete, and trade modal
- Analytics with day-of-week, drawdown, rolling win rate, duration vs P&L, and average win/loss views
- Playbook setups with CRUD and setup performance stats
- Daily journal with calendar, mood tracking, day-wise trade context, and markdown notes
- AI-powered NIFTY journal card with premarket, live-price, and post-market modes
- Live market strip for NIFTY, BANKNIFTY, SENSEX, and India VIX
- Rolling top movers ticker built from Upstox NIFTY 50 quote data
- Market Mode with sector heatmap and Option Pro workspace
- Upstox account connection flow through OAuth
- Multiple trading accounts with starting capital and computed current capital

## Project Structure

```text
EdgeLog/
|-- apps/
|   |-- api/
|   |   |-- src/
|   |   |   |-- config/
|   |   |   |-- lib/
|   |   |   |-- middleware/
|   |   |   |-- modules/
|   |   |   |   |-- accounts/
|   |   |   |   |-- analytics/
|   |   |   |   |-- auth/
|   |   |   |   |-- dashboard/
|   |   |   |   |-- journal/
|   |   |   |   |-- market/
|   |   |   |   |-- playbook/
|   |   |   |   |-- tags/
|   |   |   |   |-- trades/
|   |   |   |   |-- upstox/
|   |   |   |   `-- users/
|   |   |   |-- routes/
|   |   |   |-- types/
|   |   |   `-- index.ts
|   |   |-- .env.example
|   |   `-- package.json
|   |-- web/
|   |   |-- src/
|   |   |   |-- app/
|   |   |   |-- features/
|   |   |   |-- services/
|   |   |   |-- styles/
|   |   |   |-- theme/
|   |   |   |-- types/
|   |   |   `-- utils/
|   |   `-- .env.example
|   `-- package.json
|-- docs/
|   `-- supabase-setup.md
|-- packages/
|-- supabase/
|   |-- migrations/
|   `-- seeds/
`-- package.json
```

## Requirements

- Node.js 20+
- npm 10+
- A Supabase project for each environment you want to isolate
- A Gemini API key for AI journal analysis
- An Upstox Analytics Token for live market strips and movers
- An Upstox Developer app if you want broker connection via OAuth

## Environment

Create `apps/api/.env` from `apps/api/.env.example` and `apps/web/.env` from `apps/web/.env.example`.

### Local API Example

```env
PORT=4000
CLIENT_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
COOKIE_DOMAIN=
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
UPSTOX_ANALYTICS_TOKEN=your_upstox_analytics_token
UPSTOX_CLIENT_ID=your_upstox_client_id
UPSTOX_CLIENT_SECRET=your_upstox_client_secret
UPSTOX_REDIRECT_URI=http://localhost:4000/api/v1/upstox/callback
UPSTOX_STATE_SECRET=replace-with-long-random-secret
```

### Local Web Example

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

### Staging Deployment Example

Render staging API:

```env
CLIENT_URL=https://staging.tradersdaybook.com
ALLOWED_ORIGINS=https://staging.tradersdaybook.com
COOKIE_DOMAIN=
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
NODE_ENV=production
SUPABASE_URL=your_staging_supabase_url
SUPABASE_ANON_KEY=your_staging_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_staging_supabase_service_role_key
UPSTOX_REDIRECT_URI=https://api.staging.tradersdaybook.com/api/v1/upstox/callback
```

Vercel Preview:

```env
VITE_API_BASE_URL=https://api.staging.tradersdaybook.com/api/v1
```

### Production Deployment Example

Render production API:

```env
CLIENT_URL=https://app.tradersdaybook.com
ALLOWED_ORIGINS=https://app.tradersdaybook.com,https://www.app.tradersdaybook.com
COOKIE_DOMAIN=
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
NODE_ENV=production
SUPABASE_URL=your_production_supabase_url
SUPABASE_ANON_KEY=your_production_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_supabase_service_role_key
UPSTOX_REDIRECT_URI=https://api.tradersdaybook.com/api/v1/upstox/callback
```

Vercel Production:

```env
VITE_API_BASE_URL=https://api.tradersdaybook.com/api/v1
```

## Database Setup

Supabase SQL files live in [`supabase/`](./supabase).

Apply migrations in this order:

1. `001_extensions.sql`
2. `002_core_schema.sql`
3. `003_rls_policies.sql`
4. `004_storage.sql`
5. `005_premarket_analysis.sql`
6. `006_postmarket_analysis.sql`
7. `007_upstox_connections.sql`

Optional demo data:

1. `001_demo_seed.sql`

For more detail, see [`docs/supabase-setup.md`](./docs/supabase-setup.md).

## Install

From the repo root:

```powershell
npm install
```

## Run Locally

Start both API and frontend:

```powershell
npm run dev
```

Services:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/health`

You can also run them separately:

```powershell
npm run dev:api
npm run dev:web
```

## Build And Typecheck

```powershell
npm run build --workspace @edgelog/api
npm run build --workspace @edgelog/web
npm run typecheck --workspace @edgelog/api
npm run typecheck --workspace @edgelog/web
```

## API Base Path

All API routes are served under:

```text
/api/v1
```

Main route groups:

- `/auth`
- `/users`
- `/dashboard`
- `/analytics`
- `/accounts`
- `/trades`
- `/tags`
- `/playbook-setups`
- `/journal`
- `/market`
- `/upstox`

## Important Endpoints

Auth:

- `POST /api/v1/auth/sign-up`
- `POST /api/v1/auth/sign-in`
- `POST /api/v1/auth/sign-out`
- `GET /api/v1/auth/me`

Trades:

- `GET /api/v1/trades`
- `POST /api/v1/trades`
- `GET /api/v1/trades/:id`
- `PUT /api/v1/trades/:id`
- `DELETE /api/v1/trades/:id`
- `DELETE /api/v1/trades` for bulk delete

Market:

- `GET /api/v1/market/ticker-strip`
- `GET /api/v1/market/top-movers`
- `GET /api/v1/market/sector-heatmap`
- `GET /api/v1/market/options/nifty-chain`
- `POST /api/v1/market/options/nifty-chain/explain`

Upstox:

- `GET /api/v1/upstox/config`
- `GET /api/v1/upstox/status`
- `GET /api/v1/upstox/connect`
- `GET /api/v1/upstox/callback`
- `POST /api/v1/upstox/disconnect`

## Deployment Notes

- Vercel Preview can be used as staging when paired with a separate Render staging API service.
- A separate Supabase project for staging is strongly recommended so auth and data stay isolated.
- Keep `COOKIE_DOMAIN` blank when you want staging and production cookies isolated by host.
- `ALLOWED_ORIGINS` should list every browser origin that is expected to call the API in that environment.
- Upstox OAuth redirect URIs must exactly match the deployed API callback URL for each environment.

## Notes

- The frontend expects the API to allow credentials and run at `CLIENT_URL` or a value inside `ALLOWED_ORIGINS`.
- The API uses cookie-based auth with Supabase tokens.
- AI journal responses are cached in Supabase to avoid unnecessary Gemini calls.
- During market hours, the journal card shows live NIFTY price rather than a generated analysis.
- The market strip and movers ticker use Upstox read-only market data with backend caching.
