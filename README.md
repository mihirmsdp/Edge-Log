# EdgeLog

EdgeLog is a trading journal web app for active traders. It combines a React frontend, an Express API, Supabase for database and auth, AI-assisted journal analysis, and live Indian market context.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- State/Data: Zustand, React Query
- Charts: Recharts
- Backend: Node.js, Express, TypeScript
- Database/Auth: Supabase
- AI: Google Gemini
- Market Data: Upstox Analytics Token

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
|   |   `-- package.json
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
- A Supabase project
- A Gemini API key for AI journal analysis
- An Upstox Analytics Token for live market strips and movers

## Environment

Create `apps/api/.env` from `apps/api/.env.example`.

Required values:

```env
PORT=4000
CLIENT_URL=http://localhost:5173
COOKIE_DOMAIN=
COOKIE_SECURE=false
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
UPSTOX_ANALYTICS_TOKEN=your_upstox_read_only_token
UPSTOX_API_VERSION=2.0
UPSTOX_KEY_NIFTY=NSE_INDEX|Nifty 50
UPSTOX_KEY_BANKNIFTY=NSE_INDEX|Nifty Bank
UPSTOX_KEY_SENSEX=BSE_INDEX|SENSEX
UPSTOX_KEY_INDIAVIX=NSE_INDEX|India VIX
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

Analytics:

- `GET /api/v1/analytics/summary`
- `GET /api/v1/analytics/by-day-of-week`
- `GET /api/v1/analytics/by-session`
- `GET /api/v1/analytics/by-setup`
- `GET /api/v1/analytics/drawdown`
- `GET /api/v1/analytics/rolling-winrate`
- `GET /api/v1/analytics/duration-pnl`

Journal:

- `GET /api/v1/journal`
- `POST /api/v1/journal`
- `PATCH /api/v1/journal/:entryId`
- `DELETE /api/v1/journal/:entryId`
- `GET /api/v1/journal/live-price`
- `GET /api/v1/journal/premarket?date=YYYY-MM-DD`
- `GET /api/v1/journal/postmarket?date=YYYY-MM-DD`

Playbook:

- `GET /api/v1/playbook-setups`
- `POST /api/v1/playbook-setups`
- `PATCH /api/v1/playbook-setups/:setupId`
- `DELETE /api/v1/playbook-setups/:setupId`

Accounts:

- `GET /api/v1/accounts`
- `POST /api/v1/accounts`
- `PATCH /api/v1/accounts/:accountId`
- `DELETE /api/v1/accounts/:accountId`

Market:

- `GET /api/v1/market/ticker-strip`
- `GET /api/v1/market/top-movers`

## Notes

- The frontend expects the API to allow credentials and run at `CLIENT_URL`.
- The API uses cookie-based auth with Supabase tokens.
- AI journal responses are cached in Supabase to avoid unnecessary Gemini calls.
- During market hours, the journal card shows live NIFTY price rather than a generated analysis.
- The market strip and movers ticker use Upstox read-only market data with backend caching.
