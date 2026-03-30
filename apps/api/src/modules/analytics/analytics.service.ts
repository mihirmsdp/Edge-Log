import type { Database } from "../../types/database.js";
import type { TradeAnalyticsFilters } from "../trades/trades.service.js";
import { getFilteredTrades } from "../trades/trades.service.js";

export type AnalyticsTrade = Database["public"]["Tables"]["trades"]["Row"];

function toNumber(value: number | null | undefined) {
  return value ?? 0;
}

function getMonthBounds(baseDate: Date, offsetMonths: number) {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth() + offsetMonths;
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function tradeOutcome(trade: AnalyticsTrade) {
  const pnl = toNumber(trade.net_pnl);
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  return "flat";
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateCurrentStreak(trades: AnalyticsTrade[]) {
  const ordered = [...trades].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  let streakType: "W" | "L" | null = null;
  let streakCount = 0;

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const outcome = tradeOutcome(ordered[index]);
    if (outcome === "flat") continue;
    const nextType = outcome === "win" ? "W" : "L";
    if (!streakType) {
      streakType = nextType;
      streakCount = 1;
      continue;
    }
    if (streakType === nextType) {
      streakCount += 1;
      continue;
    }
    break;
  }

  return {
    type: streakType,
    count: streakCount,
    label: streakType ? `${streakCount}${streakType} streak` : "No streak"
  };
}

function comparePeriod(trades: AnalyticsTrade[], start: Date, end: Date) {
  const scoped = trades.filter((trade) => {
    const entry = new Date(trade.entry_date).getTime();
    return entry >= start.getTime() && entry <= end.getTime();
  });
  const totalPnl = scoped.reduce((sum, trade) => sum + toNumber(trade.net_pnl), 0);
  const wins = scoped.filter((trade) => tradeOutcome(trade) === "win").length;
  return {
    pnl: totalPnl,
    winRate: scoped.length === 0 ? 0 : (wins / scoped.length) * 100,
    trades: scoped.length
  };
}

export async function getAnalyticsBase(supabase: any, filters: TradeAnalyticsFilters) {
  const trades = await getFilteredTrades(supabase, filters);
  const orderedTrades = [...trades].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  return { trades, orderedTrades };
}

export async function buildSummary(supabase: any, filters: TradeAnalyticsFilters) {
  const { trades, orderedTrades } = await getAnalyticsBase(supabase, filters);
  const winningTrades = trades.filter((trade) => toNumber(trade.net_pnl) > 0);
  const losingTrades = trades.filter((trade) => toNumber(trade.net_pnl) < 0);
  const totalPnl = trades.reduce((sum, trade) => sum + toNumber(trade.net_pnl), 0);
  const grossProfit = winningTrades.reduce((sum, trade) => sum + toNumber(trade.net_pnl), 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + toNumber(trade.net_pnl), 0));
  const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
  const avgRR = average(trades.map((trade) => toNumber(trade.rr_multiple)).filter((value) => Number.isFinite(value) && value !== 0));
  const winRate = trades.length === 0 ? 0 : (winningTrades.length / trades.length) * 100;
  const currentStreak = calculateCurrentStreak(orderedTrades);
  const bestTrade = [...trades].sort((a, b) => toNumber(b.net_pnl) - toNumber(a.net_pnl))[0] ?? null;
  const worstTrade = [...trades].sort((a, b) => toNumber(a.net_pnl) - toNumber(b.net_pnl))[0] ?? null;
  const currentMonth = getMonthBounds(new Date(), 0);
  const previousMonth = getMonthBounds(new Date(), -1);
  const currentPeriod = comparePeriod(trades, currentMonth.start, currentMonth.end);
  const previousPeriod = comparePeriod(trades, previousMonth.start, previousMonth.end);

  return {
    totalPnl,
    winRate,
    profitFactor,
    avgRR,
    totalTrades: trades.length,
    currentStreak,
    bestTrade,
    worstTrade,
    avgWin: average(winningTrades.map((trade) => toNumber(trade.net_pnl))),
    avgLoss: average(losingTrades.map((trade) => Math.abs(toNumber(trade.net_pnl)))),
    equityCurve: orderedTrades.reduce<{ date: string; cumulativePnl: number }[]>((acc, trade) => {
      const previous = acc.at(-1)?.cumulativePnl ?? 0;
      acc.push({
        date: trade.entry_date,
        cumulativePnl: previous + toNumber(trade.net_pnl)
      });
      return acc;
    }, []),
    calendarHeatmap: orderedTrades.reduce<Record<string, number>>((acc, trade) => {
      const key = trade.entry_date.slice(0, 10);
      acc[key] = (acc[key] ?? 0) + toNumber(trade.net_pnl);
      return acc;
    }, {}),
    recentTrades: [...orderedTrades].sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()).slice(0, 10),
    vsLastMonth: {
      pnl: currentPeriod.pnl - previousPeriod.pnl,
      winRate: currentPeriod.winRate - previousPeriod.winRate,
      trades: currentPeriod.trades - previousPeriod.trades
    }
  };
}

export async function buildByDayOfWeek(supabase: any, filters: TradeAnalyticsFilters) {
  const { trades } = await getAnalyticsBase(supabase, filters);
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals = new Map(order.map((day) => [day, 0]));

  for (const trade of trades) {
    const jsDay = new Date(trade.entry_date).getUTCDay();
    const label = order[(jsDay + 6) % 7];
    totals.set(label, (totals.get(label) ?? 0) + toNumber(trade.net_pnl));
  }

  return order.map((day) => ({ day, pnl: totals.get(day) ?? 0 }));
}

export async function buildBySession(supabase: any, filters: TradeAnalyticsFilters) {
  const { trades } = await getAnalyticsBase(supabase, filters);
  const totals = new Map<string, number>();

  for (const trade of trades) {
    const session = trade.session ?? "unknown";
    totals.set(session, (totals.get(session) ?? 0) + toNumber(trade.net_pnl));
  }

  return [...totals.entries()].map(([session, pnl]) => ({ session, pnl })).sort((a, b) => b.pnl - a.pnl);
}

export async function buildBySetup(supabase: any, filters: TradeAnalyticsFilters) {
  const { trades } = await getAnalyticsBase(supabase, filters);
  const buckets = new Map<string, AnalyticsTrade[]>();

  for (const trade of trades) {
    const key = trade.setup_name ?? "Unspecified";
    buckets.set(key, [...(buckets.get(key) ?? []), trade]);
  }

  return [...buckets.entries()].map(([setup, items]) => {
    const wins = items.filter((trade) => toNumber(trade.net_pnl) > 0);
    const losses = items.filter((trade) => toNumber(trade.net_pnl) < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + toNumber(trade.net_pnl), 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + toNumber(trade.net_pnl), 0));
    return {
      setup,
      winRate: items.length === 0 ? 0 : (wins.length / items.length) * 100,
      profitFactor: grossLoss === 0 ? grossProfit : grossProfit / grossLoss,
      totalTrades: items.length,
      pnl: items.reduce((sum, trade) => sum + toNumber(trade.net_pnl), 0)
    };
  }).sort((a, b) => b.winRate - a.winRate);
}

export async function buildDrawdown(supabase: any, filters: TradeAnalyticsFilters) {
  const { orderedTrades } = await getAnalyticsBase(supabase, filters);
  let peak = 0;
  let cumulative = 0;

  return orderedTrades.map((trade) => {
    cumulative += toNumber(trade.net_pnl);
    peak = Math.max(peak, cumulative);
    const drawdown = peak === 0 ? 0 : ((cumulative - peak) / peak) * 100;
    return {
      date: trade.entry_date,
      drawdownPct: Number(drawdown.toFixed(2))
    };
  });
}

export async function buildRollingWinRate(supabase: any, filters: TradeAnalyticsFilters, windowSize: number) {
  const { orderedTrades } = await getAnalyticsBase(supabase, filters);
  return orderedTrades.map((trade, index) => {
    const window = orderedTrades.slice(Math.max(0, index - windowSize + 1), index + 1);
    const wins = window.filter((item) => toNumber(item.net_pnl) > 0).length;
    return {
      date: trade.entry_date,
      winRate: window.length === 0 ? 0 : Number(((wins / window.length) * 100).toFixed(2)),
      tradesConsidered: window.length
    };
  });
}

export async function buildDurationPnl(supabase: any, filters: TradeAnalyticsFilters) {
  const { trades } = await getAnalyticsBase(supabase, filters);
  return trades
    .filter((trade) => trade.exit_date)
    .map((trade) => ({
      holdMinutes: Math.max(1, Math.round((new Date(trade.exit_date!).getTime() - new Date(trade.entry_date).getTime()) / 60000)),
      pnlDollar: toNumber(trade.net_pnl),
      direction: trade.direction
    }));
}
