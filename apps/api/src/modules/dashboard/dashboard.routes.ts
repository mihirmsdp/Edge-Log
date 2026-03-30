import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { getDashboardSummary } from "./dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get("/summary", getDashboardSummary);
