import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { getTickerStrip, getTopMovers } from "./market.controller.js";

export const marketRouter = Router();

marketRouter.use(requireAuth);
marketRouter.get("/ticker-strip", getTickerStrip);
marketRouter.get("/top-movers", getTopMovers);
