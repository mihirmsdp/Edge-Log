alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.tags enable row level security;
alter table public.playbook_setups enable row level security;
alter table public.journal_entries enable row level security;
alter table public.trades enable row level security;
alter table public.trade_tags enable row level security;
alter table public.trade_screenshots enable row level security;

create policy "profiles are viewable by owner"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles are updatable by owner"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "accounts owned by user"
on public.accounts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "tags owned by user"
on public.tags for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "playbook setups owned by user"
on public.playbook_setups for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "journal entries owned by user"
on public.journal_entries for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "trades owned by user"
on public.trades for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "trade tags readable through owned trades"
on public.trade_tags for select
using (
  exists (
    select 1
    from public.trades
    where trades.id = trade_tags.trade_id
      and trades.user_id = auth.uid()
  )
);

create policy "trade tags insertable through owned trades and tags"
on public.trade_tags for insert
with check (
  exists (
    select 1
    from public.trades
    where trades.id = trade_tags.trade_id
      and trades.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags
    where tags.id = trade_tags.tag_id
      and tags.user_id = auth.uid()
  )
);

create policy "trade tags deletable through owned trades"
on public.trade_tags for delete
using (
  exists (
    select 1
    from public.trades
    where trades.id = trade_tags.trade_id
      and trades.user_id = auth.uid()
  )
);

create policy "trade screenshots readable through owned trades"
on public.trade_screenshots for select
using (
  exists (
    select 1
    from public.trades
    where trades.id = trade_screenshots.trade_id
      and trades.user_id = auth.uid()
  )
);

create policy "trade screenshots insertable through owned trades"
on public.trade_screenshots for insert
with check (
  exists (
    select 1
    from public.trades
    where trades.id = trade_screenshots.trade_id
      and trades.user_id = auth.uid()
  )
);

create policy "trade screenshots deletable through owned trades"
on public.trade_screenshots for delete
using (
  exists (
    select 1
    from public.trades
    where trades.id = trade_screenshots.trade_id
      and trades.user_id = auth.uid()
  )
);
