do $$
declare
  demo_user_id uuid;
  demo_account_id uuid;
begin
  select id into demo_user_id
  from auth.users
  where email = 'demo@edgelog.app'
  limit 1;

  if demo_user_id is null then
    raise notice 'Skipping demo seed because auth user demo@edgelog.app does not exist yet.';
    return;
  end if;

  delete from public.trade_tags where trade_id in (select id from public.trades where user_id = demo_user_id);
  delete from public.trade_screenshots where trade_id in (select id from public.trades where user_id = demo_user_id);
  delete from public.trades where user_id = demo_user_id;
  delete from public.playbook_setups where user_id = demo_user_id;
  delete from public.journal_entries where user_id = demo_user_id;
  delete from public.tags where user_id = demo_user_id;
  delete from public.accounts where user_id = demo_user_id;

  insert into public.accounts (user_id, name, starting_balance, currency)
  values (demo_user_id, 'Paper Trading', 25000.00, 'USD')
  returning id into demo_account_id;

  insert into public.tags (user_id, name, color)
  values
    (demo_user_id, 'A+ Setup', '#22c55e'),
    (demo_user_id, 'Breakout', '#00e5ff'),
    (demo_user_id, 'Mean Reversion', '#f59e0b'),
    (demo_user_id, 'High Volume', '#38bdf8'),
    (demo_user_id, 'News', '#ef4444'),
    (demo_user_id, 'Overtraded', '#f97316'),
    (demo_user_id, 'Clean Execution', '#a855f7'),
    (demo_user_id, 'Rule Break', '#fb7185');

  insert into public.playbook_setups (user_id, name, description, rules)
  values
    (demo_user_id, 'Opening Range Breakout', 'Momentum setup focused on first expansion after market open.', '["Wait for first 5-minute range","Enter only with volume confirmation","Risk 0.5% per trade"]'::jsonb),
    (demo_user_id, 'VWAP Reclaim', 'Trend continuation setup after reclaiming intraday VWAP.', '["Higher timeframe bias must align","No chasing extended candles","Scale at 1R and 2R"]'::jsonb);

  insert into public.journal_entries (user_id, date, content, mood)
  values
    (demo_user_id, timezone('utc', now()) - interval '5 days', 'Execution felt disciplined. Best trades came from waiting for the open to settle before acting.', 'Focused'),
    (demo_user_id, timezone('utc', now()) - interval '2 days', 'A couple of good reads today, but I need to avoid trimming winners too early when momentum is clean.', 'Calm');

  insert into public.trades (
    account_id,
    user_id,
    symbol,
    asset_class,
    direction,
    entry_price,
    exit_price,
    stop_loss,
    take_profit,
    size,
    commission,
    entry_date,
    exit_date,
    setup_name,
    timeframe,
    session,
    emotion,
    mistakes,
    notes,
    rating
  )
  select
    demo_account_id,
    demo_user_id,
    (array['AAPL', 'NVDA', 'TSLA', 'ES', 'NQ', 'EURUSD', 'GBPJPY', 'BTCUSD'])[((g - 1) % 8) + 1],
    (array['stock', 'stock', 'stock', 'futures', 'futures', 'forex', 'forex', 'crypto'])[((g - 1) % 8) + 1]::public.trade_asset_class,
    case when g % 4 = 0 then 'short' else 'long' end::public.trade_direction,
    round((array[192.0, 874.0, 178.0, 5124.0, 18110.0, 1.0842, 191.42, 64250.0])[((g - 1) % 8) + 1] * (1 + (((g % 7) - 3) * 0.0035)), 4),
    round(
      (
        (array[192.0, 874.0, 178.0, 5124.0, 18110.0, 1.0842, 191.42, 64250.0])[((g - 1) % 8) + 1]
        * (1 + (((g % 7) - 3) * 0.0035))
      )
      * case
          when g % 5 = 0 or g % 9 = 0 then
            case when g % 4 = 0 then 1 + ((0.003 + ((g * 11) % 9) * 0.0022) * 0.55) else 1 - ((0.003 + ((g * 11) % 9) * 0.0022) * 0.55) end
          else
            case when g % 4 = 0 then 1 - (0.003 + ((g * 11) % 9) * 0.0022) else 1 + (0.003 + ((g * 11) % 9) * 0.0022) end
        end,
      4
    ),
    round(((array[192.0, 874.0, 178.0, 5124.0, 18110.0, 1.0842, 191.42, 64250.0])[((g - 1) % 8) + 1] * (1 + (((g % 7) - 3) * 0.0035))) * 0.9955, 4),
    round(((array[192.0, 874.0, 178.0, 5124.0, 18110.0, 1.0842, 191.42, 64250.0])[((g - 1) % 8) + 1] * (1 + (((g % 7) - 3) * 0.0035))) * 1.0075, 4),
    round((array[150.0, 35.0, 90.0, 2.0, 1.0, 30000.0, 20000.0, 0.35])[((g - 1) % 8) + 1] + ((g % 3) * (array[1.0, 1.0, 1.0, 1.0, 1.0, 5000.0, 5000.0, 0.05])[((g - 1) % 8) + 1]), 4),
    round((array[1.25, 1.65, 1.40, 4.80, 4.80, 3.10, 3.30, 6.20])[((g - 1) % 8) + 1] + ((g % 2) * 0.35), 2),
    timezone('utc', timestamp '2025-12-26 14:00:00' + ((g - 1) * interval '44 hours')),
    timezone('utc', timestamp '2025-12-26 14:35:00' + ((g - 1) * interval '44 hours')),
    (array['Opening Range Breakout', 'Trend Pullback', 'VWAP Reclaim', 'Failed Breakdown', 'Opening Drive', 'London Session Break', 'Liquidity Sweep Reversal', 'Range Expansion'])[((g - 1) % 8) + 1],
    (array['m5', 'm15', 'm5', 'm15', 'm5', 'm15', 'm15', 'h1'])[((g - 1) % 8) + 1]::public.trade_timeframe,
    (array['new_york', 'new_york', 'new_york', 'new_york', 'new_york', 'london', 'london', 'overnight'])[((g - 1) % 8) + 1]::public.trade_session,
    (array['calm', 'focused', 'confident', 'hesitant', 'anxious'])[((g - 1) % 5) + 1]::public.trade_emotion,
    (array['Slightly early entry before candle close.', 'Trimmed size too aggressively after the first push.', 'Moved stop to breakeven too soon.', 'No meaningful execution mistakes.', 'Let the tape speed up decision-making near the exit.'])[((g - 1) % 5) + 1],
    (array['Waited for confirmation at a key level and executed on plan.', 'Entry was solid, but management could have been more patient.', 'Trade aligned with higher timeframe bias and daily game plan.', 'Momentum accelerated right after the trigger, making exits easier.', 'Protected capital quickly once price stalled near resistance.'])[((g - 1) % 5) + 1],
    case when g % 5 = 0 or g % 9 = 0 then 4 + (g % 3) else 7 + (g % 4) end
  from generate_series(1, 50) as g;

  insert into public.trade_tags (trade_id, tag_id)
  select t.id, tag_pool.tag_id
  from public.trades t
  cross join lateral (
    select tag.id as tag_id
    from public.tags tag
    where tag.user_id = demo_user_id
    order by abs(('x' || substr(md5(t.id::text || tag.id::text), 1, 8))::bit(32)::int)
    limit 2
  ) tag_pool
  where t.user_id = demo_user_id;
end $$;
