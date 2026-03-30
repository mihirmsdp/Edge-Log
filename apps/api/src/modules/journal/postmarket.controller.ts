import type { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "../../config/env.js";
import type { Json } from "../../types/database.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";
import { fetchGoogleFinanceNiftySpot, getIstDayBounds, getIstToday, getPromptDate } from "./market-data.js";
import { premarketQuerySchema } from "./premarket.schemas.js";
import { extractJson, writeSseEvent } from "./premarket.controller.js";

const SYSTEM_PROMPT = `
You are an expert Indian stock market analyst and trading performance coach for active Nifty 50 traders.

Today's date is: {DATE} (IST)

Generate a structured post-market review for the session. Focus on:
- how the day broadly played out
- how useful or accurate the morning premarket analysis was
- what mattered most for execution quality
- what to carry forward into the next session

Use the provided morning analysis and trade summary as the source context.
Do not invent exact market data that is not present in the input.

Respond ONLY in the following JSON format, no markdown, no preamble:

{
  "date": "DD MMM YYYY",
  "dayType": "Trend" | "Range" | "Reversal" | "Mixed" | "Quiet",
  "sessionVerdict": "Constructive" | "Neutral" | "Challenging",
  "summary": "2-3 sentence post-market summary",
  "premarketReview": {
    "accuracy": "High" | "Medium" | "Low",
    "usefulness": "High" | "Medium" | "Low",
    "notes": "How the morning analysis helped or where it missed"
  },
  "tradeReview": {
    "tradeCount": 0,
    "netPnl": 0,
    "winCount": 0,
    "lossCount": 0,
    "bestSymbol": "SYMBOL or N/A",
    "bestTradePnl": 0,
    "worstSymbol": "SYMBOL or N/A",
    "worstTradePnl": 0
  },
  "whatWorked": ["Short bullet", "Short bullet"],
  "whatFailed": ["Short bullet", "Short bullet"],
  "tomorrowFocus": ["Short bullet", "Short bullet"],
  "disclaimer": "AI-generated analysis. Not financial advice. DYOR."
}
`;

const postmarketAnalysisSchema = z.object({
  date: z.string().trim().min(1),
  dayType: z.enum(["Trend", "Range", "Reversal", "Mixed", "Quiet"]),
  sessionVerdict: z.enum(["Constructive", "Neutral", "Challenging"]),
  summary: z.string().trim().min(1),
  premarketReview: z.object({
    accuracy: z.enum(["High", "Medium", "Low"]),
    usefulness: z.enum(["High", "Medium", "Low"]),
    notes: z.string().trim().min(1)
  }),
  tradeReview: z.object({
    tradeCount: z.coerce.number().int().nonnegative(),
    netPnl: z.coerce.number(),
    winCount: z.coerce.number().int().nonnegative(),
    lossCount: z.coerce.number().int().nonnegative(),
    bestSymbol: z.string().trim().min(1),
    bestTradePnl: z.coerce.number(),
    worstSymbol: z.string().trim().min(1),
    worstTradePnl: z.coerce.number()
  }),
  whatWorked: z.array(z.string().trim().min(1)).min(1),
  whatFailed: z.array(z.string().trim().min(1)).min(1),
  tomorrowFocus: z.array(z.string().trim().min(1)).min(1),
  disclaimer: z.string().trim().min(1)
});

let modelInstance: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;

function getModel() {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  if (!modelInstance) {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    modelInstance = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
  }

  return modelInstance;
}

function normalizePostmarketRow(row: { generated_at: string; analysis_json: Json }) {
  return {
    generatedAt: row.generated_at,
    analysis: postmarketAnalysisSchema.parse(row.analysis_json)
  };
}

async function fetchTradeContext(supabase: any, date: string) {
  const bounds = getIstDayBounds(date);
  const { data, error } = await supabase
    .from("trades")
    .select("symbol, direction, net_pnl, rr_multiple, setup_name, entry_date, exit_date")
    .gte("entry_date", bounds.start)
    .lt("entry_date", bounds.end)
    .order("entry_date", { ascending: true });

  if (error) {
    throw error;
  }

  const trades = data ?? [];
  const wins = trades.filter((trade: { net_pnl: number | null }) => (trade.net_pnl ?? 0) > 0);
  const losses = trades.filter((trade: { net_pnl: number | null }) => (trade.net_pnl ?? 0) < 0);
  const sortedByPnl = [...trades].sort((left: { net_pnl: number | null }, right: { net_pnl: number | null }) => (right.net_pnl ?? 0) - (left.net_pnl ?? 0));
  const bestTrade = sortedByPnl[0];
  const worstTrade = sortedByPnl.length > 0 ? sortedByPnl[sortedByPnl.length - 1] : null;

  return {
    trades,
    summary: {
      tradeCount: trades.length,
      netPnl: trades.reduce((sum: number, trade: { net_pnl: number | null }) => sum + (trade.net_pnl ?? 0), 0),
      winCount: wins.length,
      lossCount: losses.length,
      avgR: trades.length > 0 ? trades.reduce((sum: number, trade: { rr_multiple: number | null }) => sum + (trade.rr_multiple ?? 0), 0) / trades.length : 0,
      bestTrade: bestTrade ? { symbol: bestTrade.symbol, pnl: bestTrade.net_pnl ?? 0 } : { symbol: "N/A", pnl: 0 },
      worstTrade: worstTrade ? { symbol: worstTrade.symbol, pnl: worstTrade.net_pnl ?? 0 } : { symbol: "N/A", pnl: 0 }
    }
  };
}

export const streamPostmarketAnalysis = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);
  const query = premarketQuerySchema.parse(request.query);
  const date = query.date ?? getIstToday();
  const bounds = getIstDayBounds(date);

  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  response.flushHeaders?.();

  try {
    if (query.refresh) {
      const { error: deleteError } = await supabase.from("postmkt_analyses").delete().gte("date", bounds.start).lt("date", bounds.end);
      if (deleteError) {
        throw deleteError;
      }
    }

    const { data: cached, error: cachedError } = await supabase
      .from("postmkt_analyses")
      .select("analysis_json, generated_at")
      .gte("date", bounds.start)
      .lt("date", bounds.end)
      .maybeSingle();

    if (cachedError) {
      throw cachedError;
    }

    if (cached) {
      writeSseEvent(response, "complete", { cached: true, ...normalizePostmarketRow(cached) });
      response.end();
      return;
    }

    const model = getModel();
    if (!model) {
      writeSseEvent(response, "failure", { message: "Gemini API key is not configured on the server." });
      response.end();
      return;
    }

    writeSseEvent(response, "status", { message: "Collecting the session context..." });

    const [premarketResult, tradeContext, liveSpot] = await Promise.all([
      supabase.from("premkt_analyses").select("analysis_json, generated_at").gte("date", bounds.start).lt("date", bounds.end).maybeSingle(),
      fetchTradeContext(supabase, date),
      fetchGoogleFinanceNiftySpot().catch(() => null)
    ]);

    writeSseEvent(response, "status", { message: "Generating post-market review..." });

    const contextPayload = {
      date: getPromptDate(date),
      currentSpotReference: liveSpot,
      morningPremarketAnalysis: premarketResult.data?.analysis_json ?? null,
      dayTradeSummary: tradeContext.summary,
      dayTrades: tradeContext.trades
    };

    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nContext JSON:\n${JSON.stringify(contextPayload)}`);
    const parsed = postmarketAnalysisSchema.parse(JSON.parse(extractJson(result.response.text())));

    const { data: saved, error: saveError } = await supabase
      .from("postmkt_analyses")
      .upsert(
        {
          user_id: user.id,
          date: bounds.start,
          analysis_json: parsed,
          generated_at: new Date().toISOString()
        },
        { onConflict: "user_id,date" }
      )
      .select("analysis_json, generated_at")
      .single();

    if (saveError) {
      throw saveError;
    }

    writeSseEvent(response, "complete", { cached: false, ...normalizePostmarketRow(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate post-market analysis";
    writeSseEvent(response, "failure", { message });
  } finally {
    response.end();
  }
});

export const getLiveNiftyPrice = asyncHandler(async (_request: Request, response: Response) => {
  const spot = await fetchGoogleFinanceNiftySpot();
  response.json({
    spot,
    symbol: "NIFTY 50",
    source: "Google Finance",
    fetchedAt: new Date().toISOString()
  });
});
