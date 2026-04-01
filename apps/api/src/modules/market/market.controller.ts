import type { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/errors.js";
import { getMarketNiftyOptionChain, getMarketSectorHeatmap, getMarketTickerStrip, getMarketTopMovers } from "./market.service.js";

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

export async function getTickerStrip(_request: Request, response: Response) {
  const payload = await getMarketTickerStrip();
  response.json(payload);
}

export async function getTopMovers(_request: Request, response: Response) {
  const payload = await getMarketTopMovers();
  response.json(payload);
}

export async function getSectorHeatmap(_request: Request, response: Response) {
  const payload = await getMarketSectorHeatmap();
  response.json(payload);
}

export async function getNiftyOptionChain(request: Request, response: Response) {
  const expiry = typeof request.query.expiry === "string" ? request.query.expiry : undefined;
  const payload = await getMarketNiftyOptionChain(expiry);
  response.json(payload);
}

export async function explainNiftyOptionBias(request: Request, response: Response) {
  const model = getModel();
  if (!model) {
    throw new ApiError(503, "Gemini API key is not configured on the server");
  }

  const expiry = typeof request.body?.expiry === "string" ? request.body.expiry : undefined;
  const chain = await getMarketNiftyOptionChain(expiry);

  const prompt = [
    "You are an expert Indian index options mentor.",
    "Explain the current NIFTY options bias in very plain English for an active trader.",
    "Do not give financial advice. Explain what the current rule-based output means.",
    "Keep it concise, readable, and practical.",
    "Write 3 short sections with these headings exactly:",
    "1. What This Means",
    "2. Why The Model Thinks This",
    "3. How To Use It",
    "Avoid markdown tables. Bullets are okay.",
    `Range Bias: ${chain.rangeBias.bias}`,
    `Range Tone: ${chain.rangeBias.tone}`,
    `Range Strength: ${chain.rangeBias.strength}`,
    `Range Reasons: ${chain.rangeBias.reasons.join(" | ")}`,
    `Quick Strategy Stance: ${chain.quickStrategy.stance}`,
    `Quick Strategy Setup: ${chain.quickStrategy.setup}`,
    `Quick Strategy Description: ${chain.quickStrategy.description}`,
    `Quick Strategy Reasons: ${chain.quickStrategy.reasons.join(" | ")}`,
    `Spot: ${chain.summary.spot ?? "n/a"}`,
    `PCR: ${chain.summary.overallPcr ?? "n/a"}`,
    `Max Pain: ${chain.summary.maxPain ?? "n/a"}`,
    `ATM Straddle: ${chain.summary.atmStraddle ?? "n/a"}`,
    `Top Support: ${chain.supportResistance.support.map((level) => `${level.strikePrice} (OI ${level.oi}, dOI ${level.changeOi ?? 0})`).join(" | ") || "n/a"}`,
    `Top Resistance: ${chain.supportResistance.resistance.map((level) => `${level.strikePrice} (OI ${level.oi}, dOI ${level.changeOi ?? 0})`).join(" | ") || "n/a"}`,
    `Buildup Sentiment: ${chain.buildup.sentiment}`
  ].join("\n");

  const result = await model.generateContent(prompt);
  const explanation = result.response.text().trim();

  response.json({
    explanation,
    generatedAt: new Date().toISOString(),
    expiry: chain.selectedExpiry
  });
}
