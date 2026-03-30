import type { Request, Response } from "express";
import { getMarketTickerStrip, getMarketTopMovers } from "./market.service.js";

export async function getTickerStrip(_request: Request, response: Response) {
  const payload = await getMarketTickerStrip();
  response.json(payload);
}

export async function getTopMovers(_request: Request, response: Response) {
  const payload = await getMarketTopMovers();
  response.json(payload);
}
