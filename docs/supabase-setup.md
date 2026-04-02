# Supabase Setup

Supabase files live in the root [supabase](/c:/TradingJournal/supabase) folder.

## Recommended Structure

Use separate Supabase projects for:
- `staging`
- `production`

That keeps auth, trades, journal entries, and AI caches isolated between environments.

## Backend Env

Use [apps/api/.env](/c:/TradingJournal/apps/api/.env) for local development.

Important values:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLIENT_URL`
- `ALLOWED_ORIGINS`
- `COOKIE_DOMAIN`
- `COOKIE_SECURE`
- `COOKIE_SAME_SITE`

## SQL Order

Run these in order for every Supabase environment:

1. [001_extensions.sql](/c:/TradingJournal/supabase/migrations/001_extensions.sql)
2. [002_core_schema.sql](/c:/TradingJournal/supabase/migrations/002_core_schema.sql)
3. [003_rls_policies.sql](/c:/TradingJournal/supabase/migrations/003_rls_policies.sql)
4. [004_storage.sql](/c:/TradingJournal/supabase/migrations/004_storage.sql)
5. [005_premarket_analysis.sql](/c:/TradingJournal/supabase/migrations/005_premarket_analysis.sql)
6. [006_postmarket_analysis.sql](/c:/TradingJournal/supabase/migrations/006_postmarket_analysis.sql)
7. [007_upstox_connections.sql](/c:/TradingJournal/supabase/migrations/007_upstox_connections.sql)

Optional demo data:
- [001_demo_seed.sql](/c:/TradingJournal/supabase/seeds/001_demo_seed.sql)

## Environment Examples

### Local

```env
CLIENT_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
COOKIE_DOMAIN=
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
```

### Staging

```env
CLIENT_URL=https://staging.tradersdaybook.com
ALLOWED_ORIGINS=https://staging.tradersdaybook.com
COOKIE_DOMAIN=
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

### Production

```env
CLIENT_URL=https://app.tradersdaybook.com
ALLOWED_ORIGINS=https://app.tradersdaybook.com,https://www.app.tradersdaybook.com
COOKIE_DOMAIN=
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

## API Notes

- Base API path is `/api/v1`
- Auth uses Supabase sessions in httpOnly cookies
- `GET /api/v1/trades` supports pagination and filters for `page`, `pageSize`, `from`, `to`, `symbol`, `tagId`, and `direction`
- Trade derived fields are calculated automatically by the database trigger on insert and update
- Staging and production should both run the same migration set before testing auth or Upstox connection
