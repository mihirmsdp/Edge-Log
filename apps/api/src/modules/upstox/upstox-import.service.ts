import crypto from "node:crypto";
import { URLSearchParams } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/database.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/errors.js";
import { createAdminClient } from "../../lib/supabase.js";
import type { importUpstoxTradesSchema, upstoxTradeImportQuerySchema } from "./upstox.schemas.js";
import type { z } from "zod";

export type UpstoxImportQuery = z.infer<typeof upstoxTradeImportQuerySchema>;
export type ImportUpstoxTradesInput = z.infer<typeof importUpstoxTradesSchema>;

type TradeClient = SupabaseClient<Database>;

type UpstoxTradeForDayRow = {
  trade_id: string;
  order_id?: string;
  instrument_token?: string;
  trading_symbol?: string;
  exchange?: string;
  product?: string;
  order_type?: string;
  transaction_type: "BUY" | "SELL";
  traded_quantity?: number;
  quantity?: number;
  average_price?: number;
  traded_price?: number;
  exchange_timestamp?: string;
  order_timestamp?: string;
};

type UpstoxHistoricalTradeRow = {
  trade_id: string;
  instrument_token?: string;
  symbol?: string;
  exchange?: string;
  segment?: string;
  option_type?: string;
  strike_price?: string | number;
  expiry?: string;
  scrip_name?: string;
  quantity: number;
  price?: number;
  amount?: number;
  trade_date: string;
  transaction_type: "BUY" | "SELL";
};

type UpstoxEnvelope<T> = {
  status?: string;
  data?: T;
  errors?: Array<{ message?: string }> | null;
  meta_data?: {
    page?: {
      total_records?: number;
      total_pages?: number;
      page_number?: number;
      page_size?: number;
    };
  };
};

type NormalizedBrokerLeg = {
  legId: string;
  orderId?: string | null;
  instrumentKey: string;
  symbol: string;
  assetClass: "equity" | "future" | "option";
  transactionType: "BUY" | "SELL";
  quantity: number;
  price: number;
  timestamp: string;
  raw: Json;
};

type OpenLot = {
  lotId: string;
  direction: "long" | "short";
  remainingQuantity: number;
  entryPrice: number;
  entryDate: string;
  symbol: string;
  assetClass: "equity" | "future" | "option";
  instrumentKey: string;
  legIds: string[];
  rawLegs: Json[];
};

type ImportPreviewTrade = {
  importKey: string;
  source: "UPSTOX";
  symbol: string;
  assetClass: "equity" | "future" | "option";
  direction: "long" | "short";
  size: number;
  entryPrice: number;
  exitPrice: number | null;
  entryDate: string;
  exitDate: string | null;
  status: "closed" | "open";
  legCount: number;
  brokerTradeIds: string[];
  imported: boolean;
  importedTradeId: string | null;
};

type BrokerImportRow = Database["public"]["Tables"]["broker_trade_imports"]["Row"];

const UPSTOX_BASE_URL = "https://api.upstox.com";

function inferAssetClassFromSymbol(symbol: string) {
  if (/\b(CE|PE)\b/i.test(symbol) || /(CE|PE)$/i.test(symbol)) {
    return "option" as const;
  }

  if (/FUT/i.test(symbol)) {
    return "future" as const;
  }

  return "equity" as const;
}

function inferAssetClassFromHistoricalRow(row: UpstoxHistoricalTradeRow) {
  if (row.segment === "FO") {
    if (row.option_type === "CE" || row.option_type === "PE") {
      return "option" as const;
    }

    return "future" as const;
  }

  return inferAssetClassFromSymbol(row.symbol ?? row.scrip_name ?? "");
}

function normalizeDateOnly(value: string) {
  return `${value}T12:00:00.000Z`;
}

function parseDayTimestamp(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }

  const normalized = Date.parse(value);
  if (!Number.isNaN(normalized)) {
    return new Date(normalized).toISOString();
  }

  return new Date().toISOString();
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

async function getStoredUpstoxAccessToken(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("upstox_connections")
    .select("access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.access_token) {
    throw new ApiError(400, "Connect Upstox first before importing trades.");
  }

  return data.access_token;
}

async function callUpstox<T>(path: string, accessToken: string, query?: Record<string, string>) {
  const url = new URL(path, UPSTOX_BASE_URL);
  if (query) {
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Api-Version": env.UPSTOX_API_VERSION
    }
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as UpstoxEnvelope<T>) : {};

  if (!response.ok) {
    throw new ApiError(response.status, data.errors?.[0]?.message ?? "Unable to fetch data from Upstox");
  }

  return data;
}

async function getTradesForDay(accessToken: string) {
  const response = await callUpstox<UpstoxTradeForDayRow[]>("/v2/order/trades/get-trades-for-day", accessToken);
  return response.data ?? [];
}

async function getHistoricalTrades(accessToken: string, startDate: string, endDate: string) {
  const rows: UpstoxHistoricalTradeRow[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await callUpstox<UpstoxHistoricalTradeRow[]>("/v2/charges/historical-trades", accessToken, {
      start_date: startDate,
      end_date: endDate,
      page_number: String(page),
      page_size: "100"
    });

    rows.push(...(response.data ?? []));
    totalPages = response.meta_data?.page?.total_pages ?? 1;
    page += 1;
  }

  return rows;
}

function normalizeDayLegs(rows: UpstoxTradeForDayRow[]): NormalizedBrokerLeg[] {
  return rows
    .filter((row) => (row.traded_quantity ?? row.quantity ?? 0) > 0)
    .map((row) => {
      const symbol = (row.trading_symbol ?? row.instrument_token ?? "UNKNOWN").toUpperCase();
      return {
        legId: row.trade_id,
        orderId: row.order_id ?? null,
        instrumentKey: row.instrument_token ?? symbol,
        symbol,
        assetClass: inferAssetClassFromSymbol(symbol),
        transactionType: row.transaction_type,
        quantity: Number(row.traded_quantity ?? row.quantity ?? 0),
        price: Number(row.traded_price ?? row.average_price ?? 0),
        timestamp: parseDayTimestamp(row.exchange_timestamp ?? row.order_timestamp),
        raw: toJson(row)
      };
    })
    .filter((row) => row.quantity > 0 && row.price > 0);
}

function normalizeHistoricalLegs(rows: UpstoxHistoricalTradeRow[]): NormalizedBrokerLeg[] {
  return rows
    .map((row) => {
      const symbol = (row.symbol ?? row.scrip_name ?? row.instrument_token ?? "UNKNOWN").toUpperCase();
      return {
        legId: row.trade_id,
        instrumentKey: row.instrument_token ?? `${symbol}:${row.expiry ?? "spot"}:${row.option_type ?? "na"}`,
        symbol,
        assetClass: inferAssetClassFromHistoricalRow(row),
        transactionType: row.transaction_type,
        quantity: Number(row.quantity ?? 0),
        price: Number(row.price ?? 0),
        timestamp: normalizeDateOnly(row.trade_date),
        raw: toJson(row)
      };
    })
    .filter((row) => row.quantity > 0 && row.price > 0);
}

function buildImportKey(legIds: string[], symbol: string, direction: "long" | "short", entryDate: string, exitDate: string | null, size: number) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ legIds: [...new Set(legIds)].sort(), symbol, direction, entryDate, exitDate, size }))
    .digest("hex");
}

function pairNormalizedLegs(legs: NormalizedBrokerLeg[]): Omit<ImportPreviewTrade, "imported" | "importedTradeId">[] {
  const grouped = new Map<string, NormalizedBrokerLeg[]>();

  for (const leg of [...legs].sort((a, b) => {
    const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.legId.localeCompare(b.legId);
  })) {
    const key = `${leg.instrumentKey}::${leg.symbol}::${leg.assetClass}`;
    const list = grouped.get(key) ?? [];
    list.push(leg);
    grouped.set(key, list);
  }

  const previews: Omit<ImportPreviewTrade, "imported" | "importedTradeId">[] = [];

  for (const groupLegs of grouped.values()) {
    const openLongs: OpenLot[] = [];
    const openShorts: OpenLot[] = [];

    for (const leg of groupLegs) {
      let remaining = leg.quantity;

      if (leg.transactionType === "BUY") {
        while (remaining > 0 && openShorts.length > 0) {
          const lot = openShorts[0];
          const matchedQty = Math.min(remaining, lot.remainingQuantity);
          const legIds = [...lot.legIds, leg.legId];
          previews.push({
            importKey: buildImportKey(legIds, leg.symbol, "short", lot.entryDate, leg.timestamp, matchedQty),
            source: "UPSTOX",
            symbol: leg.symbol,
            assetClass: leg.assetClass,
            direction: "short",
            size: matchedQty,
            entryPrice: lot.entryPrice,
            exitPrice: leg.price,
            entryDate: lot.entryDate,
            exitDate: leg.timestamp,
            status: "closed",
            legCount: legIds.length,
            brokerTradeIds: [...new Set(legIds)]
          });
          lot.remainingQuantity -= matchedQty;
          remaining -= matchedQty;
          if (lot.remainingQuantity <= 0) {
            openShorts.shift();
          }
        }

        if (remaining > 0) {
          openLongs.push({
            lotId: `${leg.legId}:long`,
            direction: "long",
            remainingQuantity: remaining,
            entryPrice: leg.price,
            entryDate: leg.timestamp,
            symbol: leg.symbol,
            assetClass: leg.assetClass,
            instrumentKey: leg.instrumentKey,
            legIds: [leg.legId],
            rawLegs: [leg.raw]
          });
        }
      } else {
        while (remaining > 0 && openLongs.length > 0) {
          const lot = openLongs[0];
          const matchedQty = Math.min(remaining, lot.remainingQuantity);
          const legIds = [...lot.legIds, leg.legId];
          previews.push({
            importKey: buildImportKey(legIds, leg.symbol, "long", lot.entryDate, leg.timestamp, matchedQty),
            source: "UPSTOX",
            symbol: leg.symbol,
            assetClass: leg.assetClass,
            direction: "long",
            size: matchedQty,
            entryPrice: lot.entryPrice,
            exitPrice: leg.price,
            entryDate: lot.entryDate,
            exitDate: leg.timestamp,
            status: "closed",
            legCount: legIds.length,
            brokerTradeIds: [...new Set(legIds)]
          });
          lot.remainingQuantity -= matchedQty;
          remaining -= matchedQty;
          if (lot.remainingQuantity <= 0) {
            openLongs.shift();
          }
        }

        if (remaining > 0) {
          openShorts.push({
            lotId: `${leg.legId}:short`,
            direction: "short",
            remainingQuantity: remaining,
            entryPrice: leg.price,
            entryDate: leg.timestamp,
            symbol: leg.symbol,
            assetClass: leg.assetClass,
            instrumentKey: leg.instrumentKey,
            legIds: [leg.legId],
            rawLegs: [leg.raw]
          });
        }
      }
    }

    const openLots = [...openLongs, ...openShorts];
    for (const lot of openLots) {
      previews.push({
        importKey: buildImportKey(lot.legIds, lot.symbol, lot.direction, lot.entryDate, null, lot.remainingQuantity),
        source: "UPSTOX",
        symbol: lot.symbol,
        assetClass: lot.assetClass,
        direction: lot.direction,
        size: lot.remainingQuantity,
        entryPrice: lot.entryPrice,
        exitPrice: null,
        entryDate: lot.entryDate,
        exitDate: null,
        status: "open",
        legCount: lot.legIds.length,
        brokerTradeIds: [...new Set(lot.legIds)]
      });
    }
  }

  return previews.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
}

async function getExistingImports(userId: string, importKeys: string[]) {
  if (importKeys.length === 0) {
    return new Map<string, BrokerImportRow>();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("broker_trade_imports")
    .select("import_key, imported_trade_id, raw_payload, normalized_payload, broker_trade_ids, created_at, updated_at, user_id, broker, id")
    .eq("user_id", userId)
    .eq("broker", "UPSTOX")
    .in("import_key", importKeys);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((row) => [row.import_key, row as BrokerImportRow]));
}

export async function getUpstoxImportPreview(userId: string, query: UpstoxImportQuery) {
  const accessToken = await getStoredUpstoxAccessToken(userId);
  const legs = query.mode === "day"
    ? normalizeDayLegs(await getTradesForDay(accessToken))
    : normalizeHistoricalLegs(await getHistoricalTrades(accessToken, query.startDate!, query.endDate!));

  const previews = pairNormalizedLegs(legs);
  const existingImports = await getExistingImports(userId, previews.map((item) => item.importKey));

  return {
    source: "UPSTOX" as const,
    mode: query.mode,
    startDate: query.startDate ?? null,
    endDate: query.endDate ?? null,
    trades: previews.map((item) => {
      const existing = existingImports.get(item.importKey);
      return {
        ...item,
        imported: Boolean(existing),
        importedTradeId: existing?.imported_trade_id ?? null
      };
    })
  };
}

export async function importUpstoxTrades(client: TradeClient, userId: string, payload: ImportUpstoxTradesInput) {
  const preview = await getUpstoxImportPreview(userId, payload);
  const selected = preview.trades.filter((item) => payload.importKeys.includes(item.importKey));

  if (selected.length === 0) {
    throw new ApiError(400, "No matching Upstox trades were found for import.");
  }

  const admin = createAdminClient();
  const imported: Array<{ tradeId: string; importKey: string; symbol: string }> = [];
  let skipped = 0;

  for (const item of selected) {
    if (item.imported) {
      skipped += 1;
      continue;
    }

    const { data: trade, error: tradeError } = await client
      .from("trades")
      .insert({
        user_id: userId,
        account_id: payload.accountId,
        symbol: item.symbol,
        asset_class: item.assetClass === "equity" ? "stock" : item.assetClass === "future" ? "futures" : "options",
        direction: item.direction,
        entry_price: item.entryPrice,
        exit_price: item.exitPrice,
        stop_loss: null,
        take_profit: null,
        size: item.size,
        commission: 0,
        entry_date: item.entryDate,
        exit_date: item.exitDate,
        notes: `Imported from Upstox (${item.status}). Broker trade ids: ${item.brokerTradeIds.join(", ")}`,
        rating: null
      })
      .select("id, symbol")
      .single();

    if (tradeError || !trade) {
      throw tradeError ?? new ApiError(400, "Unable to import Upstox trade");
    }

    const { error: importError } = await admin.from("broker_trade_imports").insert({
      user_id: userId,
      broker: "UPSTOX",
      import_key: item.importKey,
      broker_trade_ids: item.brokerTradeIds,
      imported_trade_id: trade.id,
      raw_payload: toJson({ source: item.source, brokerTradeIds: item.brokerTradeIds }),
      normalized_payload: toJson(item)
    });

    if (importError) {
      throw importError;
    }

    imported.push({ tradeId: trade.id, importKey: item.importKey, symbol: trade.symbol });
  }

  return {
    imported,
    summary: {
      requested: payload.importKeys.length,
      imported: imported.length,
      skipped
    }
  };
}
