create table if not exists public.postmkt_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date timestamptz not null,
  analysis_json jsonb not null,
  generated_at timestamptz not null default timezone('utc', now()),
  constraint postmkt_analyses_user_id_date_key unique (user_id, date)
);

create index if not exists postmkt_analyses_user_id_date_idx on public.postmkt_analyses (user_id, date desc);

alter table public.postmkt_analyses enable row level security;

drop policy if exists "Users manage own postmkt analyses" on public.postmkt_analyses;
create policy "Users manage own postmkt analyses"
on public.postmkt_analyses for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
