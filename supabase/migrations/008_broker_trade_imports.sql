create table if not exists public.broker_trade_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  broker text not null,
  import_key text not null,
  broker_trade_ids text[] not null default '{}',
  imported_trade_id uuid references public.trades(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, broker, import_key)
);

create index if not exists broker_trade_imports_user_idx on public.broker_trade_imports(user_id, broker);
create index if not exists broker_trade_imports_trade_idx on public.broker_trade_imports(imported_trade_id);

alter table public.broker_trade_imports enable row level security;

drop policy if exists "Users can view their broker trade imports" on public.broker_trade_imports;
create policy "Users can view their broker trade imports"
  on public.broker_trade_imports
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their broker trade imports" on public.broker_trade_imports;
create policy "Users can manage their broker trade imports"
  on public.broker_trade_imports
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
