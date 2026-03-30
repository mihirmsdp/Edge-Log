import type { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/errors.js";
import type { Json } from "../../types/database.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";
import { fetchGoogleFinanceNiftySpot, getIstDayBounds, getIstToday, getPromptDate } from "./market-data.js";
import { premarketQuerySchema } from "./premarket.schemas.js";

const SYSTEM_PROMPT = `
You are an expert Indian stock market analyst and professional
Nifty 50 trader with 15+ years of experience in technical analysis,
price action, and derivatives. You specialize in intraday and
positional trading on NSE.

Today's date is: {DATE} (IST)
Current Google Finance NIFTY 50 spot reference: {SPOT_HINT}

Generate a structured premarket analysis report for Nifty 50 for
today's trading session. Base your analysis on:
- Recent price action and trend context
- Key technical levels that matter today
- Global market cues (SGX Nifty, Dow, Nasdaq, Gift City)
- Options data context (PCR, max pain, OI buildup)
- Intraday bias and trade setup guidance

Use the provided live spot reference as the anchor for all numeric levels.
Respond ONLY in the following JSON format, no markdown, no preamble:

{
  "date": "DD MMM YYYY",
  "sessionBias": "Bullish" | "Bearish" | "Neutral" | "Sideways",
  "biasStrength": "Strong" | "Moderate" | "Weak",
  "summary": "2-3 sentence overview of today's setup",
  "globalCues": {
    "sentiment": "Positive" | "Negative" | "Mixed",
    "notes": "Brief note on SGX Nifty, US futures, Asian markets"
  },
  "levels": {
    "spot": <current approx nifty spot>,
    "support": [
      { "price": 00000, "type": "Strong" | "Moderate", "note": "reason" },
      { "price": 00000, "type": "Strong" | "Moderate", "note": "reason" },
      { "price": 00000, "type": "Strong" | "Moderate", "note": "reason" }
    ],
    "resistance": [
      { "price": 00000, "type": "Strong" | "Moderate", "note": "reason" },
      { "price": 00000, "type": "Strong" | "Moderate", "note": "reason" },
      { "price": 00000, "type": "Strong" | "Moderate", "note": "reason" }
    ],
    "dayRange": { "low": 00000, "high": 00000 },
    "weeklyPivot": 00000,
    "maxPain": 00000
  },
  "scenarios": {
    "bullCase": {
      "trigger": "What needs to happen for bullish move",
      "target": 00000,
      "invalidation": 00000
    },
    "bearCase": {
      "trigger": "What needs to happen for bearish move",
      "target": 00000,
      "invalidation": 00000
    }
  },
  "watchlist": [
    { "symbol": "SYMBOL", "note": "why watching today" }
  ],
  "optionsNote": "PCR, OI, max pain context in 1-2 sentences",
  "riskEvents": ["Any news/events to watch today"],
  "disclaimer": "AI-generated analysis. Not financial advice. DYOR."
}
`;

const levelSchema = z.object({
  price: z.coerce.number(),
  type: z.enum(["Strong", "Moderate"]),
  note: z.string().trim().min(1)
});

const premarketAnalysisSchema = z.object({
  date: z.string().trim().min(1),
  sessionBias: z.enum(["Bullish", "Bearish", "Neutral", "Sideways"]),
  biasStrength: z.enum(["Strong", "Moderate", "Weak"]),
  summary: z.string().trim().min(1),
  globalCues: z.object({
    sentiment: z.enum(["Positive", "Negative", "Mixed"]),
    notes: z.string().trim().min(1)
  }),
  levels: z.object({
    spot: z.coerce.number(),
    support: z.array(levelSchema).length(3),
    resistance: z.array(levelSchema).length(3),
    dayRange: z.object({ low: z.coerce.number(), high: z.coerce.number() }),
    weeklyPivot: z.coerce.number(),
    maxPain: z.coerce.number()
  }),
  scenarios: z.object({
    bullCase: z.object({
      trigger: z.string().trim().min(1),
      target: z.coerce.number(),
      invalidation: z.coerce.number()
    }),
    bearCase: z.object({
      trigger: z.string().trim().min(1),
      target: z.coerce.number(),
      invalidation: z.coerce.number()
    })
  }),
  watchlist: z.array(z.object({ symbol: z.string().trim().min(1), note: z.string().trim().min(1) })).min(1),
  optionsNote: z.string().trim().min(1),
  riskEvents: z.array(z.string().trim().min(1)).min(1),
  disclaimer: z.string().trim().min(1)
});

type PremarketAnalysis = z.infer<typeof premarketAnalysisSchema>;

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

function writeSseEvent(response: Response, event: string, payload: Record<string, unknown>) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function extractJson(text: string) {
  const withoutFence = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new ApiError(502, "Gemini response did not include valid JSON");
  }

  return withoutFence.slice(firstBrace, lastBrace + 1);
}

function withLiveSpot(analysis: PremarketAnalysis, spot: number | null) {
  if (spot == null) {
    return analysis;
  }

  return {
    ...analysis,
    levels: {
      ...analysis.levels,
      spot
    }
  };
}

function normalizePremarketRow(row: { generated_at: string; analysis_json: Json }, liveSpot: number | null) {
  const parsed = premarketAnalysisSchema.parse(row.analysis_json);
  return {
    generatedAt: row.generated_at,
    analysis: withLiveSpot(parsed, liveSpot)
  };
}

export const streamPremarketAnalysis = asyncHandler(async (request: Request, response: Response) => {
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
    let liveSpot: number | null = null;
    try {
      liveSpot = await fetchGoogleFinanceNiftySpot();
      writeSseEvent(response, "status", { message: `Live NIFTY spot fetched from Google Finance: ${liveSpot.toFixed(2)}` });
    } catch (spotError) {
      const message = spotError instanceof Error ? spotError.message : "Unable to fetch live NIFTY spot";
      writeSseEvent(response, "status", { message: `${message}. Falling back to Gemini-only numeric context.` });
    }

    if (query.refresh) {
      const { error: deleteError } = await supabase.from("premkt_analyses").delete().gte("date", bounds.start).lt("date", bounds.end);
      if (deleteError) {
        throw deleteError;
      }
    }

    const { data: cached, error: cachedError } = await supabase
      .from("premkt_analyses")
      .select("analysis_json, generated_at")
      .gte("date", bounds.start)
      .lt("date", bounds.end)
      .maybeSingle();

    if (cachedError) {
      throw cachedError;
    }

    if (cached) {
      const normalized = normalizePremarketRow(cached, liveSpot);
      writeSseEvent(response, "complete", { cached: true, ...normalized });
      response.end();
      return;
    }

    const model = getModel();
    if (!model) {
      writeSseEvent(response, "failure", { message: "Gemini API key is not configured on the server." });
      response.end();
      return;
    }

    writeSseEvent(response, "status", { message: "Generating premarket analysis for Nifty 50..." });

    const prompt = SYSTEM_PROMPT
      .replace("{DATE}", getPromptDate(date))
      .replace("{SPOT_HINT}", liveSpot != null ? liveSpot.toFixed(2) : "Unavailable");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = withLiveSpot(premarketAnalysisSchema.parse(JSON.parse(extractJson(text))), liveSpot);

    const { data: saved, error: saveError } = await supabase
      .from("premkt_analyses")
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

    const normalized = normalizePremarketRow(saved, liveSpot);
    writeSseEvent(response, "complete", { cached: false, ...normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate premarket analysis";
    writeSseEvent(response, "failure", { message });
  } finally {
    response.end();
  }
});

export { extractJson, writeSseEvent };
