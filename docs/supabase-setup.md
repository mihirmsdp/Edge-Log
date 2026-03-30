# Supabase Setup

Supabase files now live in the root [supabase](c:/TradingJournal/supabase) folder instead of `infra/`.

## Backend Env

Use [apps/api/.env](c:/TradingJournal/apps/api/.env) for local development.

Required values:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `CLIENT_URL`

## SQL Order

Run these in order:

1. [001_extensions.sql](c:/TradingJournal/supabase/migrations/001_extensions.sql)
2. [002_core_schema.sql](c:/TradingJournal/supabase/migrations/002_core_schema.sql)
3. [003_rls_policies.sql](c:/TradingJournal/supabase/migrations/003_rls_policies.sql)
4. [004_storage.sql](c:/TradingJournal/supabase/migrations/004_storage.sql)

Optional demo data:
- [001_demo_seed.sql](c:/TradingJournal/supabase/seeds/001_demo_seed.sql)

## API Notes

- Base API path is `/api/v1`
- Auth uses Supabase sessions in httpOnly cookies
- `GET /api/v1/trades` supports pagination and filters for `page`, `pageSize`, `from`, `to`, `symbol`, `tagId`, and `direction`
- Trade derived fields are calculated automatically by the database trigger on insert and update
