import { z } from "zod";

const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());
const dateFilter = z.string().trim().min(1);
const assetClassEnum = z.enum(["stock", "forex", "futures", "options", "crypto", "cfd", "index", "equity", "future", "option"]);

export const listTradesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  from: dateFilter.optional(),
  to: dateFilter.optional(),
  symbol: z.string().trim().max(20).optional(),
  tagId: z.string().trim().optional(),
  direction: z.enum(["long", "short"]).optional(),
  assetClass: assetClassEnum.optional(),
  accountId: z.string().trim().optional(),
  setupName: z.string().trim().max(100).optional(),
  sortBy: z.enum(["entryDate", "symbol", "direction", "entryPrice", "exitPrice", "size", "netPnl", "rrMultiple", "setupName", "rating"]).default("entryDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export const analyticsFiltersSchema = z.object({
  from: dateFilter.optional(),
  to: dateFilter.optional(),
  symbol: z.string().trim().max(20).optional(),
  direction: z.enum(["long", "short"]).optional(),
  setupName: z.string().trim().max(100).optional(),
  accountId: z.string().trim().optional(),
  assetClass: z.array(assetClassEnum).optional().or(assetClassEnum.transform((value) => [value]))
});

const tradePayloadShape = {
  accountId: z.string().min(1),
  symbol: z.string().trim().min(1).max(20),
  assetClass: assetClassEnum,
  direction: z.enum(["long", "short"]),
  entryPrice: z.coerce.number().positive(),
  exitPrice: z.coerce.number().positive().nullable().optional(),
  stopLoss: z.coerce.number().positive().nullable().optional(),
  takeProfit: z.coerce.number().positive().nullable().optional(),
  size: z.coerce.number().positive(),
  commission: z.coerce.number().nonnegative().default(0),
  entryDate: isoDate,
  exitDate: isoDate.nullable().optional(),
  setupName: z.string().trim().max(100).nullable().optional(),
  timeframe: z.enum(["m1", "m5", "m15", "m30", "h1", "h4", "d1", "w1"]).nullable().optional(),
  session: z.enum(["asia", "london", "new_york", "overnight", "pre_market", "after_hours"]).nullable().optional(),
  emotion: z.enum(["calm", "focused", "confident", "hesitant", "anxious", "fomo", "revenge"]).nullable().optional(),
  mistakes: z.array(z.string()).optional().transform((value) => value?.join(", ") ?? null),
  notes: z.string().trim().max(8000).nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  tagIds: z.array(z.string()).default([])
} as const;

export const createTradeSchema = z.object(tradePayloadShape);
export const updateTradeSchema = z.object(tradePayloadShape);

export const createTradeScreenshotSchema = z.object({
  filePath: z.string().trim().min(1).max(500)
});
