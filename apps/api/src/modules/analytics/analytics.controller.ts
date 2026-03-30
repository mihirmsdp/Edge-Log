import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";
import {
  buildByDayOfWeek,
  buildBySession,
  buildBySetup,
  buildDrawdown,
  buildDurationPnl,
  buildRollingWinRate,
  buildSummary
} from "./analytics.service.js";
import {
  byDayFiltersSchema,
  bySessionFiltersSchema,
  bySetupFiltersSchema,
  drawdownFiltersSchema,
  durationPnlFiltersSchema,
  rollingWinRateFiltersSchema,
  summaryFiltersSchema
} from "./analytics.schemas.js";

export const getAnalyticsSummary = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const filters = summaryFiltersSchema.parse(request.query);
  response.json(await buildSummary(supabase, filters));
});

export const getAnalyticsByDayOfWeek = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const filters = byDayFiltersSchema.parse(request.query);
  response.json(await buildByDayOfWeek(supabase, filters));
});

export const getAnalyticsBySession = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const filters = bySessionFiltersSchema.parse(request.query);
  response.json(await buildBySession(supabase, filters));
});

export const getAnalyticsBySetup = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const filters = bySetupFiltersSchema.parse(request.query);
  response.json(await buildBySetup(supabase, filters));
});

export const getAnalyticsDrawdown = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const filters = drawdownFiltersSchema.parse(request.query);
  response.json(await buildDrawdown(supabase, filters));
});

export const getAnalyticsRollingWinRate = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const { windowSize, ...filters } = rollingWinRateFiltersSchema.parse(request.query);
  response.json(await buildRollingWinRate(supabase, filters, windowSize));
});

export const getAnalyticsDurationPnl = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const filters = durationPnlFiltersSchema.parse(request.query);
  response.json(await buildDurationPnl(supabase, filters));
});
