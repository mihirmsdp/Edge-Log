import { z } from "zod";
import { analyticsFiltersSchema } from "../trades/trades.schemas.js";

export const summaryFiltersSchema = analyticsFiltersSchema;
export const byDayFiltersSchema = analyticsFiltersSchema;
export const bySessionFiltersSchema = analyticsFiltersSchema;
export const bySetupFiltersSchema = analyticsFiltersSchema;
export const drawdownFiltersSchema = analyticsFiltersSchema;
export const rollingWinRateFiltersSchema = analyticsFiltersSchema.extend({
  windowSize: z.coerce.number().int().min(5).max(100).default(20)
});
export const durationPnlFiltersSchema = analyticsFiltersSchema;
