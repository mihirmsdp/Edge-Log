import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../../types/database.js";
import { analyticsFiltersSchema, createTradeSchema, listTradesQuerySchema, updateTradeSchema } from "./trades.schemas.js";

type TradeClient = SupabaseClient<Database>;
export type TradeListQuery = z.infer<typeof listTradesQuerySchema>;
export type TradeAnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;
export type CreateTradeInput = z.infer<typeof createTradeSchema>;
export type UpdateTradeInput = z.infer<typeof updateTradeSchema>;
type TradeWriteInput = Omit<CreateTradeInput, "tagIds">;

type TradeRow = Database["public"]["Tables"]["trades"]["Row"];

export const tradeSelect = `
  *,
  accounts(id, name, currency),
  trade_tags(tag_id, tags(id, name, color)),
  trade_screenshots(id, file_path, created_at)
`;

const sortByMap: Record<TradeListQuery["sortBy"], string> = {
  entryDate: "entry_date",
  symbol: "symbol",
  direction: "direction",
  entryPrice: "entry_price",
  exitPrice: "exit_price",
  size: "size",
  netPnl: "net_pnl",
  rrMultiple: "rr_multiple",
  setupName: "setup_name",
  rating: "rating"
};

function normalizeAssetClassValue(value: string): string {
  if (value === "equity") return "stock";
  if (value === "future") return "futures";
  if (value === "option") return "options";
  return value;
}

function normalizeAssetClassFilter(value: string | string[]): string | string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAssetClassValue(item));
  }

  return normalizeAssetClassValue(value);
}

function buildBaseTradePayload(input: TradeWriteInput) {
  return {
    account_id: input.accountId,
    symbol: input.symbol.toUpperCase(),
    asset_class: normalizeAssetClassValue(input.assetClass),
    direction: input.direction,
    entry_price: input.entryPrice,
    exit_price: input.exitPrice ?? null,
    stop_loss: input.stopLoss ?? null,
    take_profit: input.takeProfit ?? null,
    size: input.size,
    commission: input.commission,
    entry_date: input.entryDate,
    exit_date: input.exitDate ?? null,
    setup_name: input.setupName ?? null,
    timeframe: input.timeframe ?? null,
    session: input.session ?? null,
    emotion: input.emotion ?? null,
    mistakes: input.mistakes ?? null,
    notes: input.notes ?? null,
    rating: input.rating ?? null
  };
}

function applyCommonTradeFilters<T>(request: T, query: { from?: string; to?: string; symbol?: string; direction?: string; assetClass?: string | string[]; accountId?: string; setupName?: string }) {
  let next = request as any;

  if (query.from) {
    next = next.gte("entry_date", query.from);
  }

  if (query.to) {
    next = next.lte("entry_date", query.to);
  }

  if (query.symbol) {
    next = next.ilike("symbol", `%${query.symbol.toUpperCase()}%`);
  }

  if (query.direction) {
    next = next.eq("direction", query.direction);
  }

  if (query.assetClass) {
    if (Array.isArray(query.assetClass)) {
      next = next.in("asset_class", normalizeAssetClassFilter(query.assetClass));
    } else {
      next = next.eq("asset_class", normalizeAssetClassFilter(query.assetClass));
    }
  }

  if (query.accountId) {
    next = next.eq("account_id", query.accountId);
  }

  if (query.setupName) {
    next = next.ilike("setup_name", `%${query.setupName}%`);
  }

  return next;
}

export function buildTradeInsertPayload(input: TradeWriteInput, userId: string): Database["public"]["Tables"]["trades"]["Insert"] {
  return {
    ...buildBaseTradePayload(input),
    user_id: userId
  };
}

export function buildTradeUpdatePayload(input: TradeWriteInput): Database["public"]["Tables"]["trades"]["Update"] {
  return buildBaseTradePayload(input);
}

export async function replaceTradeTags(client: TradeClient, tradeId: string, tagIds: string[]) {
  const { error: deleteError } = await client.from("trade_tags").delete().eq("trade_id", tradeId);

  if (deleteError) {
    throw deleteError;
  }

  if (tagIds.length === 0) {
    return;
  }

  const rows: Database["public"]["Tables"]["trade_tags"]["Insert"][] = tagIds.map((tagId) => ({ trade_id: tradeId, tag_id: tagId }));
  const { error: insertError } = await client.from("trade_tags").insert(rows);

  if (insertError) {
    throw insertError;
  }
}

async function getTradeIdsForTag(client: TradeClient, tagId: string) {
  const { data, error } = await client.from("trade_tags").select("trade_id").eq("tag_id", tagId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => item.trade_id);
}

export async function listTradesPage(client: TradeClient, query: TradeListQuery) {
  const rangeFrom = (query.page - 1) * query.pageSize;
  const rangeTo = rangeFrom + query.pageSize - 1;

  let tradeIdsByTag: string[] | null = null;
  if (query.tagId) {
    tradeIdsByTag = await getTradeIdsForTag(client, query.tagId);
    if (tradeIdsByTag.length === 0) {
      return {
        trades: [],
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: 0,
          totalPages: 0
        }
      };
    }
  }

  let request = client
    .from("trades")
    .select(tradeSelect, { count: "exact" })
    .order(sortByMap[query.sortBy], { ascending: query.sortOrder === "asc", nullsFirst: query.sortOrder === "asc" });

  request = applyCommonTradeFilters(request, query);

  if (tradeIdsByTag) {
    request = request.in("id", tradeIdsByTag);
  }

  const { data, error, count } = await request.range(rangeFrom, rangeTo);

  if (error) {
    throw error;
  }

  const total = count ?? 0;

  return {
    trades: data ?? [],
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize)
    }
  };
}

export async function getFilteredTrades(client: TradeClient, filters: TradeAnalyticsFilters) {
  let request = client
    .from("trades")
    .select("id, account_id, symbol, asset_class, direction, entry_date, exit_date, entry_price, exit_price, stop_loss, take_profit, size, commission, risk_amount, gross_pnl, net_pnl, rr_multiple, session, setup_name, rating")
    .order("entry_date", { ascending: true });

  request = applyCommonTradeFilters(request, filters);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return (data ?? []) as TradeRow[];
}


