import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { explainNiftyOptionBias, getNiftyOptionChain, getSectorHeatmap, getTickerStrip, getTopMovers } from "./market.controller.js";

export const marketRouter = Router();

marketRouter.use(requireAuth);
marketRouter.get("/ticker-strip", getTickerStrip);
marketRouter.get("/top-movers", getTopMovers);
marketRouter.get("/sector-heatmap", getSectorHeatmap);
marketRouter.get("/options/nifty-chain", getNiftyOptionChain);
marketRouter.post("/options/nifty-chain/explain", explainNiftyOptionBias);
