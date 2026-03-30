import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { upload } from "../../middleware/upload.js";
import {
  addTradeScreenshot,
  addTradeScreenshotMetadata,
  bulkDeleteTrades,
  createTrade,
  deleteTrade,
  deleteTradeScreenshot,
  getTrade,
  listTrades,
  updateTrade
} from "./trades.controller.js";

export const tradesRouter = Router();

tradesRouter.use(requireAuth);
tradesRouter.get("/", listTrades);
tradesRouter.post("/", createTrade);
tradesRouter.delete("/", bulkDeleteTrades);
tradesRouter.get("/:id", getTrade);
tradesRouter.put("/:id", updateTrade);
tradesRouter.delete("/:id", deleteTrade);
tradesRouter.post("/:id/screenshots", upload.array("screenshots", 4), addTradeScreenshot);
tradesRouter.post("/:id/screenshots/metadata", addTradeScreenshotMetadata);
tradesRouter.delete("/:id/screenshots/:screenshotId", deleteTradeScreenshot);
