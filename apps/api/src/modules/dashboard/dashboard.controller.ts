import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";

export const getDashboardSummary = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);

  const [{ data: accounts, error: accountsError }, { data: summary, error: summaryError }, { data: recentTrades, error: tradesError }] = await Promise.all([
    supabase.from("accounts").select("id, name, currency, starting_balance, created_at").order("created_at", { ascending: true }),
    supabase.from("dashboard_trade_summary").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("trades").select("id, symbol, direction, entry_date, exit_date, entry_price, exit_price, size, commission, rating").order("entry_date", { ascending: false }).limit(10)
  ]);

  if (accountsError) {
    throw accountsError;
  }

  if (summaryError) {
    throw summaryError;
  }

  if (tradesError) {
    throw tradesError;
  }

  response.json({
    accounts,
    summary: summary ?? {
      user_id: user.id,
      total_trades: 0,
      wins: 0,
      losses: 0,
      gross_profit: 0,
      gross_loss: 0,
      net_pnl: 0,
      win_rate: 0
    },
    recentTrades
  });
});
