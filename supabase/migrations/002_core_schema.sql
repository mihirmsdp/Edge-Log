do $$
begin
  if not exists (select 1 from pg_type where typname = 'trade_asset_class') then
    create type public.trade_asset_class as enum ('stock', 'forex', 'futures', 'options', 'crypto', 'cfd', 'index');
  end if;

  if not exists (select 1 from pg_type where typname = 'trade_direction') then
    create type public.trade_direction as enum ('long', 'short');
  end if;

  if not exists (select 1 from pg_type where typname = 'trade_timeframe') then
    create type public.trade_timeframe as enum ('m1', 'm5', 'm15', 'm30', 'h1', 'h4', 'd1', 'w1');
  end if;

  if not exists (select 1 from pg_type where typname = 'trade_session') then
    create type public.trade_session as enum ('asia', 'london', 'new_york', 'overnight', 'pre_market', 'after_hours');
  end if;

  if not exists (select 1 from pg_type where typname = 'trade_emotion') then
    create type public.trade_emotion as enum ('calm', 'focused', 'confident', 'hesitant', 'anxious', 'fomo', 'revenge');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_trade_derived_fields()
returns trigger
language plpgsql
as $$
declare
  raw_gross numeric(18,4);
  raw_net numeric(18,4);
  raw_risk numeric(18,4);
begin
  raw_risk := case
    when new.stop_loss is null then null
    when new.direction = 'long' then abs(new.entry_price - new.stop_loss) * new.size
    else abs(new.stop_loss - new.entry_price) * new.size
  end;

  raw_gross := case
    when new.exit_price is null then null
    when new.direction = 'long' then (new.exit_price - new.entry_price) * new.size
    else (new.entry_price - new.exit_price) * new.size
  end;

  raw_net := case
    when raw_gross is null then null
    else raw_gross - coalesce(new.commission, 0)
  end;

  new.risk_amount := raw_risk;
  new.gross_pnl := raw_gross;
  new.net_pnl := raw_net;
  new.rr_multiple := case
    when raw_risk is null or raw_risk = 0 or raw_net is null then null
    else raw_net / raw_risk
  end;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  starting_balance numeric(18,2) not null check (starting_balance >= 0),
  currency char(3) not null default 'USD',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint tags_user_id_name_key unique (user_id, name)
);

create table if not exists public.playbook_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date timestamptz not null,
  content text not null,
  mood text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null,
  asset_class public.trade_asset_class not null,
  direction public.trade_direction not null,
  entry_price numeric(18,4) not null check (entry_price > 0),
  exit_price numeric(18,4),
  stop_loss numeric(18,4),
  take_profit numeric(18,4),
  size numeric(18,4) not null check (size > 0),
  commission numeric(18,2) not null default 0 check (commission >= 0),
  risk_amount numeric(18,4),
  gross_pnl numeric(18,4),
  net_pnl numeric(18,4),
  rr_multiple numeric(18,4),
  entry_date timestamptz not null,
  exit_date timestamptz,
  setup_name text,
  timeframe public.trade_timeframe,
  session public.trade_session,
  emotion public.trade_emotion,
  mistakes text,
  notes text,
  rating integer check (rating between 1 and 10),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trade_tags (
  trade_id uuid not null references public.trades (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (trade_id, tag_id)
);

create table if not exists public.trade_screenshots (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  file_path text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists accounts_user_id_idx on public.accounts (user_id);
create index if not exists accounts_user_id_created_at_idx on public.accounts (user_id, created_at desc);
create index if not exists tags_user_id_idx on public.tags (user_id);
create index if not exists playbook_setups_user_id_idx on public.playbook_setups (user_id);
create index if not exists playbook_setups_user_created_idx on public.playbook_setups (user_id, created_at desc);
create index if not exists journal_entries_user_id_idx on public.journal_entries (user_id);
create index if not exists journal_entries_user_date_idx on public.journal_entries (user_id, date desc);
create index if not exists trades_account_id_idx on public.trades (account_id);
create index if not exists trades_user_id_idx on public.trades (user_id);
create index if not exists trades_symbol_idx on public.trades (symbol);
create index if not exists trades_direction_idx on public.trades (direction);
create index if not exists trades_entry_date_idx on public.trades (entry_date desc);
create index if not exists trades_user_entry_date_idx on public.trades (user_id, entry_date desc);
create index if not exists trades_user_symbol_idx on public.trades (user_id, symbol);
create index if not exists trade_screenshots_trade_id_idx on public.trade_screenshots (trade_id);
create index if not exists trade_tags_tag_id_idx on public.trade_tags (tag_id);
create index if not exists trade_tags_trade_id_idx on public.trade_tags (trade_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email,
      name = coalesce(excluded.name, public.profiles.name),
      updated_at = timezone('utc', now());

  return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email,
      updated_at = timezone('utc', now())
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email on auth.users
for each row execute procedure public.sync_profile_email();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trades_set_derived_fields on public.trades;
create trigger trades_set_derived_fields
before insert or update on public.trades
for each row execute procedure public.set_trade_derived_fields();

create or replace view public.dashboard_trade_summary
with (security_invoker = true) as
select
  user_id,
  count(*)::int as total_trades,
  count(*) filter (where coalesce(net_pnl, 0) > 0)::int as wins,
  count(*) filter (where coalesce(net_pnl, 0) < 0)::int as losses,
  coalesce(sum(case when coalesce(net_pnl, 0) > 0 then net_pnl else 0 end), 0)::numeric(18,2) as gross_profit,
  coalesce(sum(case when coalesce(net_pnl, 0) < 0 then net_pnl else 0 end), 0)::numeric(18,2) as gross_loss,
  coalesce(sum(coalesce(net_pnl, 0)), 0)::numeric(18,2) as net_pnl,
  coalesce(round((count(*) filter (where coalesce(net_pnl, 0) > 0)::numeric / nullif(count(*), 0)) * 100, 2), 0)::numeric(6,2) as win_rate
from public.trades
group by user_id;

grant select on public.dashboard_trade_summary to authenticated;
