create table if not exists public.upstox_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  upstox_user_id text,
  upstox_user_name text,
  upstox_email text,
  broker text not null default 'UPSTOX',
  access_token text,
  extended_token text,
  exchanges text[] not null default '{}',
  products text[] not null default '{}',
  connected_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists upstox_connections_connected_at_idx on public.upstox_connections(connected_at desc);

alter table public.upstox_connections enable row level security;

drop policy if exists "Users can view their upstox connection" on public.upstox_connections;
create policy "Users can view their upstox connection"
  on public.upstox_connections
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage their upstox connection" on public.upstox_connections;
create policy "Users can manage their upstox connection"
  on public.upstox_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
