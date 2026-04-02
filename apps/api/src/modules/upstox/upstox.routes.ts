import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import {
  disconnectUpstox,
  getUpstoxConfig,
  getUpstoxStatus,
  handleUpstoxCallback,
  listUpstoxTradeImportPreview,
  redirectToUpstoxConnect,
  runUpstoxTradeImport
} from "./upstox.controller.js";

export const upstoxRouter = Router();

upstoxRouter.get("/callback", handleUpstoxCallback);
upstoxRouter.get("/config", getUpstoxConfig);
upstoxRouter.use(requireAuth);
upstoxRouter.get("/status", getUpstoxStatus);
upstoxRouter.get("/connect", redirectToUpstoxConnect);
upstoxRouter.post("/disconnect", disconnectUpstox);
upstoxRouter.get("/imports/trades", listUpstoxTradeImportPreview);
upstoxRouter.post("/imports/trades", runUpstoxTradeImport);
