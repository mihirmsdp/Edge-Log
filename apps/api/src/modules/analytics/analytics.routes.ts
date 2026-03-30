import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import {
  getAnalyticsByDayOfWeek,
  getAnalyticsBySession,
  getAnalyticsBySetup,
  getAnalyticsDrawdown,
  getAnalyticsDurationPnl,
  getAnalyticsRollingWinRate,
  getAnalyticsSummary
} from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);
analyticsRouter.get("/summary", getAnalyticsSummary);
analyticsRouter.get("/by-day-of-week", getAnalyticsByDayOfWeek);
analyticsRouter.get("/by-session", getAnalyticsBySession);
analyticsRouter.get("/by-setup", getAnalyticsBySetup);
analyticsRouter.get("/drawdown", getAnalyticsDrawdown);
analyticsRouter.get("/rolling-winrate", getAnalyticsRollingWinRate);
analyticsRouter.get("/duration-pnl", getAnalyticsDurationPnl);
