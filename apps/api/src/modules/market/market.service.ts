import { env } from "../../config/env.js";
import { ApiError } from "../../lib/errors.js";
import { gunzipSync } from "node:zlib";

type TickerConfig = {
  id: string;
  label: string;
  instrumentKey: string;
};

type UpstoxQuote = {
  instrument_token?: string;
  last_price?: number;
  net_change?: number;
  ohlc?: {
    open?: number;
    high?: number;
    low?: number;
    close?: number;
  };
};

type UpstoxFullQuoteResponse = {
  status?: string;
  data?: Record<string, UpstoxQuote>;
};

type UpstoxInstrument = {
  segment?: string;
  instrument_type?: string;
  trading_symbol?: string;
  instrument_key?: string;
};

type UpstoxOptionContract = {
  expiry?: string;
};

type UpstoxOptionContractsResponse = {
  status?: string;
  data?: UpstoxOptionContract[];
};
type UpstoxOptionMarketData = {
  ltp?: number;
  volume?: number;
  oi?: number;
  close_price?: number;
  bid_price?: number;
  bid_qty?: number;
  ask_price?: number;
  ask_qty?: number;
  prev_oi?: number;
};

type UpstoxOptionGreeks = {
  vega?: number;
  theta?: number;
  gamma?: number;
  delta?: number;
  iv?: number;
  pop?: number;
};

type UpstoxOptionLeg = {
  instrument_key?: string;
  market_data?: UpstoxOptionMarketData;
  option_greeks?: UpstoxOptionGreeks;
};

type UpstoxOptionChainRow = {
  expiry?: string;
  pcr?: number;
  strike_price?: number;
  underlying_key?: string;
  underlying_spot_price?: number;
  call_options?: UpstoxOptionLeg;
  put_options?: UpstoxOptionLeg;
};

type UpstoxOptionChainResponse = {
  status?: string;
  data?: UpstoxOptionChainRow[];
};

type MarketTicker = {
  id: string;
  label: string;
  symbol: string;
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
};

type MarketTickerStripPayload = {
  source: "upstox";
  fetchedAt: string;
  cached: boolean;
  tickers: MarketTicker[];
};

type MarketMover = {
  symbol: string;
  price: number;
  changePercent: number;
};

type MarketTopMoversPayload = {
  source: "upstox";
  fetchedAt: string;
  cached: boolean;
  movers: MarketMover[];
};

type SectorMember = {
  symbol: string;
  sector: string;
};

type QuoteSnapshot = {
  symbol: string;
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
};

type MarketSectorTile = {
  sector: string;
  changePercent: number;
  advancing: number;
  declining: number;
  flat: number;
  total: number;
  leaders: string[];
};

type MarketSectorHeatmapPayload = {
  source: "upstox";
  fetchedAt: string;
  cached: boolean;
  sectors: MarketSectorTile[];
};

type MarketOptionLeg = {
  ltp: number | null;
  oi: number | null;
  changeOi: number | null;
  volume: number | null;
  iv: number | null;
  delta: number | null;
};

type MarketOptionChainRowPayload = {
  strikePrice: number;
  pcr: number | null;
  call: MarketOptionLeg;
  put: MarketOptionLeg;
};

type MarketOptionChainSummary = {
  spot: number | null;
  overallPcr: number | null;
  maxPain: number | null;
  atmStrike: number | null;
  atmStraddle: number | null;
  expectedMove: number | null;
  strongestCallOiStrike: number | null;
  strongestPutOiStrike: number | null;
};

type MarketOptionLevel = {
  strikePrice: number;
  oi: number;
  changeOi: number | null;
};

type MarketOptionHeatmapRowPayload = {
  strikePrice: number;
  callOi: number | null;
  callChangeOi: number | null;
  putOi: number | null;
  putChangeOi: number | null;
};

type MarketOptionBuildupSummary = {
  sentiment: "Bullish" | "Bearish" | "Mixed" | "Neutral";
  callWriting: MarketOptionLevel | null;
  putWriting: MarketOptionLevel | null;
  callUnwinding: MarketOptionLevel | null;
  putUnwinding: MarketOptionLevel | null;
};

type MarketOptionRangeBias = {
  bias: "Trend Day" | "Range Day" | "Balanced";
  tone: "Bullish" | "Bearish" | "Neutral";
  strength: "Strong" | "Moderate" | "Weak";
  reasons: string[];
};

type MarketOptionQuickStrategy = {
  stance: "Bullish" | "Bearish" | "Neutral" | "Wait";
  setup: string;
  description: string;
  reasons: string[];
};

type MarketOptionChainPayload = {
  source: "upstox";
  fetchedAt: string;
  cached: boolean;
  underlying: {
    key: string;
    label: string;
  };
  expiries: string[];
  selectedExpiry: string | null;
  summary: MarketOptionChainSummary;
  supportResistance: {
    support: MarketOptionLevel[];
    resistance: MarketOptionLevel[];
  };
  buildup: MarketOptionBuildupSummary;
  rangeBias: MarketOptionRangeBias;
  quickStrategy: MarketOptionQuickStrategy;
  heatmapRows: MarketOptionHeatmapRowPayload[];
  rows: MarketOptionChainRowPayload[];
};

const UPSTOX_BASE_URL = "https://api.upstox.com/v2/market-quote/quotes";
const UPSTOX_OPTION_CONTRACTS_URL = "https://api.upstox.com/v2/option/contract";
const UPSTOX_OPTION_CHAIN_URL = "https://api.upstox.com/v2/option/chain";
const UPSTOX_NSE_INSTRUMENTS_URL = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz";
const CACHE_TTL_MS = 30_000;
const INSTRUMENTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TOP_MOVER_COUNT = 10;
const OPTION_LADDER_ROWS = 7;
const OPTION_HEATMAP_ROWS = 17;
const SUPPORT_RESISTANCE_LEVELS = 3;

const tickerConfig: TickerConfig[] = [
  { id: "nifty", label: "NIFTY 50", instrumentKey: env.UPSTOX_KEY_NIFTY },
  { id: "banknifty", label: "BANKNIFTY", instrumentKey: env.UPSTOX_KEY_BANKNIFTY },
  { id: "sensex", label: "SENSEX", instrumentKey: env.UPSTOX_KEY_SENSEX },
  { id: "indiavix", label: "INDIA VIX", instrumentKey: env.UPSTOX_KEY_INDIAVIX }
];

const NIFTY_50_SECTOR_MAP: SectorMember[] = [
  { symbol: "ADANIENT", sector: "Capital Goods" },
  { symbol: "ADANIPORTS", sector: "Infrastructure" },
  { symbol: "APOLLOHOSP", sector: "Healthcare" },
  { symbol: "ASIANPAINT", sector: "Consumer" },
  { symbol: "AXISBANK", sector: "Financials" },
  { symbol: "BAJAJ-AUTO", sector: "Auto" },
  { symbol: "BAJFINANCE", sector: "Financials" },
  { symbol: "BAJAJFINSV", sector: "Financials" },
  { symbol: "BEL", sector: "Defense" },
  { symbol: "BHARTIARTL", sector: "Telecom" },
  { symbol: "BPCL", sector: "Energy" },
  { symbol: "BRITANNIA", sector: "Consumer" },
  { symbol: "CIPLA", sector: "Healthcare" },
  { symbol: "COALINDIA", sector: "Energy" },
  { symbol: "DRREDDY", sector: "Healthcare" },
  { symbol: "EICHERMOT", sector: "Auto" },
  { symbol: "ETERNAL", sector: "Internet" },
  { symbol: "GRASIM", sector: "Materials" },
  { symbol: "HCLTECH", sector: "IT" },
  { symbol: "HDFCBANK", sector: "Financials" },
  { symbol: "HDFCLIFE", sector: "Financials" },
  { symbol: "HEROMOTOCO", sector: "Auto" },
  { symbol: "HINDALCO", sector: "Metals" },
  { symbol: "HINDUNILVR", sector: "Consumer" },
  { symbol: "ICICIBANK", sector: "Financials" },
  { symbol: "INDUSINDBK", sector: "Financials" },
  { symbol: "INFY", sector: "IT" },
  { symbol: "ITC", sector: "Consumer" },
  { symbol: "JIOFIN", sector: "Financials" },
  { symbol: "JSWSTEEL", sector: "Metals" },
  { symbol: "KOTAKBANK", sector: "Financials" },
  { symbol: "LT", sector: "Capital Goods" },
  { symbol: "M&M", sector: "Auto" },
  { symbol: "MARUTI", sector: "Auto" },
  { symbol: "NESTLEIND", sector: "Consumer" },
  { symbol: "NTPC", sector: "Energy" },
  { symbol: "ONGC", sector: "Energy" },
  { symbol: "POWERGRID", sector: "Energy" },
  { symbol: "RELIANCE", sector: "Energy" },
  { symbol: "SBILIFE", sector: "Financials" },
  { symbol: "SHRIRAMFIN", sector: "Financials" },
  { symbol: "SBIN", sector: "Financials" },
  { symbol: "SUNPHARMA", sector: "Healthcare" },
  { symbol: "TATACONSUM", sector: "Consumer" },
  { symbol: "TATAMOTORS", sector: "Auto" },
  { symbol: "TATASTEEL", sector: "Metals" },
  { symbol: "TCS", sector: "IT" },
  { symbol: "TECHM", sector: "IT" },
  { symbol: "TITAN", sector: "Consumer" },
  { symbol: "TRENT", sector: "Retail" }
];

let tickerCache: { expiresAt: number; payload: MarketTickerStripPayload } | null = null;
let moversCache: { expiresAt: number; payload: MarketTopMoversPayload } | null = null;
let sectorHeatmapCache: { expiresAt: number; payload: MarketSectorHeatmapPayload } | null = null;
let instrumentsCache: { expiresAt: number; payload: Map<string, string> } | null = null;
let optionChainCache = new Map<string, { expiresAt: number; payload: MarketOptionChainPayload }>();

export async function getMarketTickerStrip(): Promise<MarketTickerStripPayload> {
  if (!env.UPSTOX_ANALYTICS_TOKEN) {
    return emptyTickerPayload();
  }

  if (tickerCache && tickerCache.expiresAt > Date.now()) {
    return { ...tickerCache.payload, cached: true };
  }

  try {
    const quotesByToken = await fetchQuotesByInstrumentKeys(tickerConfig.map((item) => item.instrumentKey));
    const tickers = tickerConfig
      .map((item) => buildTicker(item, quotesByToken.get(item.instrumentKey)))
      .filter((item): item is MarketTicker => item !== null);

    if (tickers.length === 0) {
      return emptyTickerPayload();
    }

    const payload: MarketTickerStripPayload = {
      source: "upstox",
      fetchedAt: new Date().toISOString(),
      cached: false,
      tickers
    };

    tickerCache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload
    };

    return payload;
  } catch {
    return emptyTickerPayload();
  }
}

export async function getMarketTopMovers(): Promise<MarketTopMoversPayload> {
  if (!env.UPSTOX_ANALYTICS_TOKEN) {
    return emptyMoversPayload();
  }

  if (moversCache && moversCache.expiresAt > Date.now()) {
    return { ...moversCache.payload, cached: true };
  }

  try {
    const niftyUniverse = await getNifty50InstrumentKeys();
    const quotesByToken = await fetchQuotesByInstrumentKeys(niftyUniverse.map((item) => item.instrumentKey));

    const movers = niftyUniverse
      .map(({ symbol, instrumentKey }) => {
        const snapshot = buildQuoteSnapshot(symbol, quotesByToken.get(instrumentKey));
        if (!snapshot || snapshot.changePercent === null) {
          return null;
        }

        return {
          symbol,
          price: snapshot.price,
          changePercent: snapshot.changePercent
        } satisfies MarketMover;
      })
      .filter((item): item is MarketMover => item !== null)
      .sort((left, right) => right.changePercent - left.changePercent)
      .slice(0, TOP_MOVER_COUNT);

    if (movers.length === 0) {
      return emptyMoversPayload();
    }

    const payload: MarketTopMoversPayload = {
      source: "upstox",
      fetchedAt: new Date().toISOString(),
      cached: false,
      movers
    };

    moversCache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload
    };

    return payload;
  } catch {
    return emptyMoversPayload();
  }
}

export async function getMarketSectorHeatmap(): Promise<MarketSectorHeatmapPayload> {
  if (!env.UPSTOX_ANALYTICS_TOKEN) {
    return emptySectorHeatmapPayload();
  }

  if (sectorHeatmapCache && sectorHeatmapCache.expiresAt > Date.now()) {
    return { ...sectorHeatmapCache.payload, cached: true };
  }

  try {
    const universe = await getNifty50InstrumentKeys();
    const instrumentBySymbol = new Map(universe.map((item) => [item.symbol, item.instrumentKey]));
    const quotesByToken = await fetchQuotesByInstrumentKeys(universe.map((item) => item.instrumentKey));
    const grouped = new Map<string, QuoteSnapshot[]>();

    for (const member of NIFTY_50_SECTOR_MAP) {
      const instrumentKey = instrumentBySymbol.get(member.symbol);
      if (!instrumentKey) {
        continue;
      }

      const snapshot = buildQuoteSnapshot(member.symbol, quotesByToken.get(instrumentKey));
      if (!snapshot || snapshot.changePercent === null) {
        continue;
      }

      const current = grouped.get(member.sector) ?? [];
      current.push(snapshot);
      grouped.set(member.sector, current);
    }

    const sectors = Array.from(grouped.entries())
      .map(([sector, members]) => {
        const advancing = members.filter((member) => (member.changePercent ?? 0) > 0.15).length;
        const declining = members.filter((member) => (member.changePercent ?? 0) < -0.15).length;
        const flat = members.length - advancing - declining;
        const avgChange = members.reduce((sum, member) => sum + (member.changePercent ?? 0), 0) / members.length;
        const leaders = [...members]
          .sort((left, right) => Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0))
          .slice(0, 2)
          .map((member) => member.symbol);

        return {
          sector,
          changePercent: round2(avgChange),
          advancing,
          declining,
          flat,
          total: members.length,
          leaders
        } satisfies MarketSectorTile;
      })
      .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent));

    if (sectors.length === 0) {
      return emptySectorHeatmapPayload();
    }

    const payload: MarketSectorHeatmapPayload = {
      source: "upstox",
      fetchedAt: new Date().toISOString(),
      cached: false,
      sectors
    };

    sectorHeatmapCache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload
    };

    return payload;
  } catch {
    return emptySectorHeatmapPayload();
  }
}

export async function getMarketNiftyOptionChain(expiry?: string): Promise<MarketOptionChainPayload> {
  if (!env.UPSTOX_ANALYTICS_TOKEN) {
    return emptyOptionChainPayload();
  }

  try {
    const contractsResponse = await fetchUpstoxJson<UpstoxOptionContractsResponse>(`${UPSTOX_OPTION_CONTRACTS_URL}?instrument_key=${encodeURIComponent(env.UPSTOX_KEY_NIFTY)}`);
    const expiries = Array.from(new Set((contractsResponse.data ?? []).map((contract: UpstoxOptionContract) => contract.expiry).filter((value: string | undefined): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
    const selectedExpiry = expiry && expiries.includes(expiry) ? expiry : expiries[0] ?? null;

    if (!selectedExpiry) {
      return emptyOptionChainPayload(expiries);
    }

    const cacheKey = `${env.UPSTOX_KEY_NIFTY}::${selectedExpiry}`;
    const cached = optionChainCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.payload, cached: true };
    }

    const chainResponse = await fetchUpstoxJson<UpstoxOptionChainResponse>(`${UPSTOX_OPTION_CHAIN_URL}?instrument_key=${encodeURIComponent(env.UPSTOX_KEY_NIFTY)}&expiry_date=${encodeURIComponent(selectedExpiry)}`);
    const rows = chainResponse.data ?? [];

    if (rows.length === 0) {
      return emptyOptionChainPayload(expiries, selectedExpiry);
    }

    const spot = toNumber(rows[0]?.underlying_spot_price);
    const sortedRows = [...rows].sort((left, right) => toNumber(left.strike_price)! - toNumber(right.strike_price)!);
    const atmRow = spot === null ? sortedRows[Math.floor(sortedRows.length / 2)] : [...sortedRows].sort((left, right) => Math.abs((toNumber(left.strike_price) ?? 0) - spot) - Math.abs((toNumber(right.strike_price) ?? 0) - spot))[0];
    const atmStrike = toNumber(atmRow?.strike_price);
    const strikeRows = sortedRows.filter((row) => toNumber(row.strike_price) !== null);
    const ladderRows = strikeRows
      .sort((left, right) => Math.abs((toNumber(left.strike_price) ?? 0) - (atmStrike ?? 0)) - Math.abs((toNumber(right.strike_price) ?? 0) - (atmStrike ?? 0)))
      .slice(0, OPTION_LADDER_ROWS)
      .sort((left, right) => (toNumber(left.strike_price) ?? 0) - (toNumber(right.strike_price) ?? 0));
    const heatmapRows = strikeRows
      .sort((left, right) => Math.abs((toNumber(left.strike_price) ?? 0) - (atmStrike ?? 0)) - Math.abs((toNumber(right.strike_price) ?? 0) - (atmStrike ?? 0)))
      .slice(0, OPTION_HEATMAP_ROWS)
      .sort((left, right) => (toNumber(left.strike_price) ?? 0) - (toNumber(right.strike_price) ?? 0));

    const totalCallOi = sortedRows.reduce((sum, row) => sum + (toNumber(row.call_options?.market_data?.oi) ?? 0), 0);
    const totalPutOi = sortedRows.reduce((sum, row) => sum + (toNumber(row.put_options?.market_data?.oi) ?? 0), 0);
    const overallPcr = totalCallOi > 0 ? round2(totalPutOi / totalCallOi) : null;
    const atmCallLtp = toNumber(atmRow?.call_options?.market_data?.ltp);
    const atmPutLtp = toNumber(atmRow?.put_options?.market_data?.ltp);
    const atmStraddle = atmCallLtp !== null && atmPutLtp !== null ? round2(atmCallLtp + atmPutLtp) : null;
    const strongestCallOiStrike = findStrongestOiStrike(sortedRows, "call");
    const strongestPutOiStrike = findStrongestOiStrike(sortedRows, "put");
    const maxPain = calculateMaxPain(sortedRows);
    const support = findSupportResistanceLevels(sortedRows, "put", spot, SUPPORT_RESISTANCE_LEVELS);
    const resistance = findSupportResistanceLevels(sortedRows, "call", spot, SUPPORT_RESISTANCE_LEVELS);
    const buildup = buildBuildupSummary(sortedRows, spot);
    const rangeBias = deriveRangeBias({ spot, atmStraddle, overallPcr, support, resistance, buildup });
    const quickStrategy = deriveQuickStrategy({ rangeBias, buildup, support, resistance, spot, atmStraddle, maxPain });

    const payload: MarketOptionChainPayload = {
      source: "upstox",
      fetchedAt: new Date().toISOString(),
      cached: false,
      underlying: {
        key: env.UPSTOX_KEY_NIFTY,
        label: "NIFTY 50"
      },
      expiries,
      selectedExpiry,
      summary: {
        spot,
        overallPcr,
        maxPain,
        atmStrike,
        atmStraddle,
        expectedMove: atmStraddle,
        strongestCallOiStrike,
        strongestPutOiStrike
      },
      supportResistance: {
        support,
        resistance
      },
      buildup,
      rangeBias,
      quickStrategy,
      heatmapRows: heatmapRows.map((row) => ({
        strikePrice: toNumber(row.strike_price) ?? 0,
        callOi: toNumber(row.call_options?.market_data?.oi),
        callChangeOi: getOptionChangeOi(row, "call"),
        putOi: toNumber(row.put_options?.market_data?.oi),
        putChangeOi: getOptionChangeOi(row, "put")
      })),
      rows: ladderRows.map((row) => ({
        strikePrice: toNumber(row.strike_price) ?? 0,
        pcr: toNumber(row.pcr),
        call: buildOptionLeg(row.call_options),
        put: buildOptionLeg(row.put_options)
      }))
    };

    optionChainCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload
    });

    return payload;
  } catch {
    return emptyOptionChainPayload();
  }
}

async function fetchQuotesByInstrumentKeys(instrumentKeys: string[]): Promise<Map<string, UpstoxQuote>> {
  const response = await fetchUpstoxJson<UpstoxFullQuoteResponse>(`${UPSTOX_BASE_URL}?instrument_key=${encodeURIComponent(instrumentKeys.join(","))}`);
  return indexQuotesByToken(response.data);
}

async function getNifty50InstrumentKeys(): Promise<Array<{ symbol: string; instrumentKey: string }>> {
  const instruments = await getNseInstrumentMap();
  const results: Array<{ symbol: string; instrumentKey: string }> = [];

  for (const member of NIFTY_50_SECTOR_MAP) {
    const instrumentKey = instruments.get(member.symbol);
    if (instrumentKey) {
      results.push({ symbol: member.symbol, instrumentKey });
    }
  }

  return results;
}

async function getNseInstrumentMap(): Promise<Map<string, string>> {
  if (instrumentsCache && instrumentsCache.expiresAt > Date.now()) {
    return instrumentsCache.payload;
  }

  const response = await fetch(UPSTOX_NSE_INSTRUMENTS_URL, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new ApiError(response.status, "Failed to download Upstox NSE instruments file");
  }

  const compressed = Buffer.from(await response.arrayBuffer());
  const json = gunzipSync(compressed).toString("utf8");
  const instruments = JSON.parse(json) as UpstoxInstrument[];
  const map = new Map<string, string>();

  for (const instrument of instruments) {
    if (instrument.segment === "NSE_EQ" && instrument.instrument_type === "EQ" && instrument.trading_symbol && instrument.instrument_key) {
      map.set(instrument.trading_symbol, instrument.instrument_key);
    }
  }

  instrumentsCache = {
    expiresAt: Date.now() + INSTRUMENTS_CACHE_TTL_MS,
    payload: map
  };

  return map;
}

async function fetchUpstoxJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.UPSTOX_ANALYTICS_TOKEN}`,
      "Api-Version": env.UPSTOX_API_VERSION
    }
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { message?: string; errors?: Array<{ message?: string }> }) : ({} as T);

  if (!response.ok) {
    const errorPayload = data as { message?: string; errors?: Array<{ message?: string }> };
    const message = errorPayload.errors?.[0]?.message ?? errorPayload.message ?? "Upstox market data request failed";
    throw new ApiError(response.status, message);
  }

  return data;
}

function indexQuotesByToken(data: Record<string, UpstoxQuote> | undefined): Map<string, UpstoxQuote> {
  const map = new Map<string, UpstoxQuote>();
  if (!data) {
    return map;
  }

  for (const [key, quote] of Object.entries(data)) {
    const normalizedKey = key.replace(":", "|");
    map.set(normalizedKey, quote);
    if (quote.instrument_token) {
      map.set(quote.instrument_token, quote);
    }
  }

  return map;
}

function buildTicker(config: TickerConfig, quote: UpstoxQuote | undefined): MarketTicker | null {
  const price = toNumber(quote?.last_price);
  if (price === null) {
    return null;
  }

  const previousClose = toNumber(quote?.ohlc?.close);
  const directChange = toNumber(quote?.net_change);
  const change = directChange ?? (previousClose === null ? null : round2(price - previousClose));
  const changePercent = previousClose && previousClose !== 0 && change !== null ? round2((change / previousClose) * 100) : null;

  return {
    id: config.id,
    label: config.label,
    symbol: config.instrumentKey,
    price,
    previousClose,
    change,
    changePercent
  };
}

function buildQuoteSnapshot(symbol: string, quote: UpstoxQuote | undefined): QuoteSnapshot | null {
  const price = toNumber(quote?.last_price);
  if (price === null) {
    return null;
  }

  const previousClose = toNumber(quote?.ohlc?.close);
  const directChange = toNumber(quote?.net_change);
  const change = directChange ?? (previousClose === null ? null : round2(price - previousClose));
  const changePercent = previousClose && previousClose !== 0 && change !== null ? round2((change / previousClose) * 100) : null;

  return {
    symbol,
    price,
    previousClose,
    change,
    changePercent
  };
}

function buildOptionLeg(leg: UpstoxOptionLeg | undefined): MarketOptionLeg {
  const marketData = leg?.market_data;
  const previousOi = toNumber(marketData?.prev_oi);
  const currentOi = toNumber(marketData?.oi);

  return {
    ltp: toNumber(marketData?.ltp),
    oi: currentOi,
    changeOi: currentOi !== null && previousOi !== null ? round2(currentOi - previousOi) : null,
    volume: toNumber(marketData?.volume),
    iv: toNumber(leg?.option_greeks?.iv),
    delta: toNumber(leg?.option_greeks?.delta)
  };
}
function getOptionChangeOi(row: UpstoxOptionChainRow, side: "call" | "put"): number | null {
  const marketData = side === "call" ? row.call_options?.market_data : row.put_options?.market_data;
  const previousOi = toNumber(marketData?.prev_oi);
  const currentOi = toNumber(marketData?.oi);
  return currentOi !== null && previousOi !== null ? round2(currentOi - previousOi) : null;
}

function buildOptionLevel(row: UpstoxOptionChainRow, side: "call" | "put"): MarketOptionLevel | null {
  const strikePrice = toNumber(row.strike_price);
  const oi = toNumber(side === "call" ? row.call_options?.market_data?.oi : row.put_options?.market_data?.oi);
  if (strikePrice === null || oi === null) {
    return null;
  }

  return {
    strikePrice,
    oi,
    changeOi: getOptionChangeOi(row, side)
  };
}

function findSupportResistanceLevels(rows: UpstoxOptionChainRow[], side: "call" | "put", spot: number | null, count: number): MarketOptionLevel[] {
  const filtered = rows.filter((row) => {
    const strike = toNumber(row.strike_price);
    if (strike === null) {
      return false;
    }

    if (spot === null) {
      return true;
    }

    return side === "put" ? strike <= spot : strike >= spot;
  });

  const sourceRows = filtered.length > 0 ? filtered : rows;

  return sourceRows
    .map((row) => buildOptionLevel(row, side))
    .filter((item): item is MarketOptionLevel => item !== null)
    .sort((left, right) => right.oi - left.oi)
    .slice(0, count)
    .sort((left, right) => side === "put" ? right.strikePrice - left.strikePrice : left.strikePrice - right.strikePrice);
}

function findExtremeBuildup(rows: UpstoxOptionChainRow[], side: "call" | "put", kind: "positive" | "negative", spot: number | null): MarketOptionLevel | null {
  const directionalRows = rows.filter((row) => {
    const strike = toNumber(row.strike_price);
    if (strike === null || spot === null) {
      return true;
    }

    if (kind === "positive") {
      return side === "call" ? strike >= spot : strike <= spot;
    }

    return side === "call" ? strike <= spot : strike >= spot;
  });

  const sourceRows = directionalRows.length > 0 ? directionalRows : rows;
  const levels = sourceRows
    .map((row) => buildOptionLevel(row, side))
    .filter((item): item is MarketOptionLevel => item !== null)
    .filter((item) => kind === "positive" ? (item.changeOi ?? 0) > 0 : (item.changeOi ?? 0) < 0)
    .sort((left, right) => kind === "positive" ? (right.changeOi ?? 0) - (left.changeOi ?? 0) : (left.changeOi ?? 0) - (right.changeOi ?? 0));

  return levels[0] ?? null;
}

function buildBuildupSummary(rows: UpstoxOptionChainRow[], spot: number | null): MarketOptionBuildupSummary {
  const callWriting = findExtremeBuildup(rows, "call", "positive", spot);
  const putWriting = findExtremeBuildup(rows, "put", "positive", spot);
  const callUnwinding = findExtremeBuildup(rows, "call", "negative", spot);
  const putUnwinding = findExtremeBuildup(rows, "put", "negative", spot);

  const totalCallWriting = rows.reduce((sum, row) => sum + Math.max(getOptionChangeOi(row, "call") ?? 0, 0), 0);
  const totalPutWriting = rows.reduce((sum, row) => sum + Math.max(getOptionChangeOi(row, "put") ?? 0, 0), 0);
  const totalCallUnwinding = rows.reduce((sum, row) => sum + Math.abs(Math.min(getOptionChangeOi(row, "call") ?? 0, 0)), 0);
  const totalPutUnwinding = rows.reduce((sum, row) => sum + Math.abs(Math.min(getOptionChangeOi(row, "put") ?? 0, 0)), 0);

  let sentiment: MarketOptionBuildupSummary["sentiment"] = "Neutral";
  if (totalPutWriting > totalCallWriting * 1.15 || totalCallUnwinding > totalPutUnwinding * 1.15) {
    sentiment = "Bullish";
  } else if (totalCallWriting > totalPutWriting * 1.15 || totalPutUnwinding > totalCallUnwinding * 1.15) {
    sentiment = "Bearish";
  } else if (totalPutWriting > 0 || totalCallWriting > 0 || totalCallUnwinding > 0 || totalPutUnwinding > 0) {
    sentiment = "Mixed";
  }

  return {
    sentiment,
    callWriting,
    putWriting,
    callUnwinding,
    putUnwinding
  };
}
function deriveRangeBias({
  spot,
  atmStraddle,
  overallPcr,
  support,
  resistance,
  buildup
}: {
  spot: number | null;
  atmStraddle: number | null;
  overallPcr: number | null;
  support: MarketOptionLevel[];
  resistance: MarketOptionLevel[];
  buildup: MarketOptionBuildupSummary;
}): MarketOptionRangeBias {
  const reasons: string[] = [];
  const nearestSupport = support[0]?.strikePrice ?? null;
  const nearestResistance = resistance[0]?.strikePrice ?? null;
  const rangeWidth = spot !== null && nearestSupport !== null && nearestResistance !== null ? Math.abs(nearestResistance - nearestSupport) : null;
  const straddlePct = spot && atmStraddle ? atmStraddle / spot : null;

  let trendScore = 0;
  let rangeScore = 0;
  let tone: MarketOptionRangeBias["tone"] = "Neutral";

  if (buildup.sentiment === "Bullish") {
    trendScore += 2;
    tone = "Bullish";
    reasons.push("Put writing or call unwinding is dominant.");
  } else if (buildup.sentiment === "Bearish") {
    trendScore += 2;
    tone = "Bearish";
    reasons.push("Call writing or put unwinding is dominant.");
  } else if (buildup.sentiment === "Mixed") {
    rangeScore += 1;
    reasons.push("Buildup is mixed across calls and puts.");
  }

  if (overallPcr !== null) {
    if (overallPcr >= 1.15) {
      trendScore += 1;
      tone = tone === "Neutral" ? "Bullish" : tone;
      reasons.push(`PCR at ${overallPcr.toFixed(2)} shows stronger put-side positioning.`);
    } else if (overallPcr <= 0.85) {
      trendScore += 1;
      tone = tone === "Neutral" ? "Bearish" : tone;
      reasons.push(`PCR at ${overallPcr.toFixed(2)} shows stronger call-side positioning.`);
    } else {
      rangeScore += 1;
      reasons.push(`PCR at ${overallPcr.toFixed(2)} is near balance.`);
    }
  }

  if (straddlePct !== null) {
    if (straddlePct <= 0.006) {
      rangeScore += 2;
      reasons.push("ATM straddle implies a compressed expected move.");
    } else if (straddlePct >= 0.009) {
      trendScore += 1;
      reasons.push("ATM straddle is wide enough for expansion risk.");
    }
  }

  if (rangeWidth !== null && spot !== null) {
    const widthPct = rangeWidth / spot;
    if (widthPct <= 0.01) {
      rangeScore += 1;
      reasons.push("Nearest support and resistance are relatively tight.");
    } else if (widthPct >= 0.016) {
      trendScore += 1;
      reasons.push("Support and resistance are wide enough to allow a directional day.");
    }
  }

  let bias: MarketOptionRangeBias["bias"] = "Balanced";
  if (trendScore >= rangeScore + 2) {
    bias = "Trend Day";
  } else if (rangeScore >= trendScore + 2) {
    bias = "Range Day";
    tone = "Neutral";
  }

  const scoreGap = Math.abs(trendScore - rangeScore);
  const strength: MarketOptionRangeBias["strength"] = scoreGap >= 3 ? "Strong" : scoreGap >= 2 ? "Moderate" : "Weak";

  if (reasons.length === 0) {
    reasons.push("Chain structure is still balanced, so bias is low conviction.");
  }

  return {
    bias,
    tone,
    strength,
    reasons: reasons.slice(0, 3)
  };
}

function deriveQuickStrategy({
  rangeBias,
  buildup,
  support,
  resistance,
  spot,
  atmStraddle,
  maxPain
}: {
  rangeBias: MarketOptionRangeBias;
  buildup: MarketOptionBuildupSummary;
  support: MarketOptionLevel[];
  resistance: MarketOptionLevel[];
  spot: number | null;
  atmStraddle: number | null;
  maxPain: number | null;
}): MarketOptionQuickStrategy {
  const reasons: string[] = [];

  if (rangeBias.bias === "Trend Day" && rangeBias.tone === "Bullish") {
    reasons.push("Bullish buildup is supporting a directional expansion setup.");
    if (support[0]) {
      reasons.push(`Nearest support is stacked around ${formatStrike(support[0].strikePrice)}.`);
    }
    return {
      stance: "Bullish",
      setup: "Bull call spread / buy CE on pullback",
      description: "Lean long only above support or after breakout acceptance. Avoid chasing extended premiums.",
      reasons: reasons.slice(0, 3)
    };
  }

  if (rangeBias.bias === "Trend Day" && rangeBias.tone === "Bearish") {
    reasons.push("Bearish buildup is supporting downside continuation.");
    if (resistance[0]) {
      reasons.push(`Nearest resistance is stacked around ${formatStrike(resistance[0].strikePrice)}.`);
    }
    return {
      stance: "Bearish",
      setup: "Bear put spread / buy PE on failed bounces",
      description: "Lean short only below resistance or after breakdown confirmation. Keep premium risk controlled.",
      reasons: reasons.slice(0, 3)
    };
  }

  if (rangeBias.bias === "Range Day") {
    if (support[0] && resistance[0]) {
      reasons.push(`Range is defined between ${formatStrike(support[0].strikePrice)} and ${formatStrike(resistance[0].strikePrice)}.`);
    }
    if (maxPain !== null) {
      reasons.push(`Max pain near ${formatStrike(maxPain)} favors mean reversion while spot stays inside walls.`);
    }
    return {
      stance: "Neutral",
      setup: "Fade extremes / defined-risk premium selling",
      description: "Prefer range trades near OI walls. If you do not sell premium, stay patient and trade only at the edges.",
      reasons: reasons.slice(0, 3)
    };
  }

  reasons.push("Signals are mixed and conviction is low.");
  if (spot !== null && atmStraddle !== null) {
    reasons.push(`Expected move is roughly ${formatStrike(atmStraddle)} around spot.`);
  }
  if (buildup.sentiment !== "Neutral") {
    reasons.push(`${buildup.sentiment} buildup exists, but not enough for a clean directional plan.`);
  }

  return {
    stance: "Wait",
    setup: "Wait for breakout or clearer edge",
    description: "Let the opening structure settle before choosing direction. Avoid aggressive option buying into mixed flow.",
    reasons: reasons.slice(0, 3)
  };
}

function formatStrike(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function findStrongestOiStrike(rows: UpstoxOptionChainRow[], side: "call" | "put"): number | null {
  const best = [...rows].sort((left, right) => {
    const leftOi = toNumber(side === "call" ? left.call_options?.market_data?.oi : left.put_options?.market_data?.oi) ?? 0;
    const rightOi = toNumber(side === "call" ? right.call_options?.market_data?.oi : right.put_options?.market_data?.oi) ?? 0;
    return rightOi - leftOi;
  })[0];

  return toNumber(best?.strike_price);
}

function calculateMaxPain(rows: UpstoxOptionChainRow[]): number | null {
  const candidates = rows.map((row) => toNumber(row.strike_price)).filter((value): value is number => value !== null);
  if (!candidates.length) {
    return null;
  }

  let bestStrike = candidates[0];
  let bestLoss = Number.POSITIVE_INFINITY;

  for (const settlement of candidates) {
    let totalLoss = 0;
    for (const row of rows) {
      const strike = toNumber(row.strike_price);
      if (strike === null) {
        continue;
      }
      const callOi = toNumber(row.call_options?.market_data?.oi) ?? 0;
      const putOi = toNumber(row.put_options?.market_data?.oi) ?? 0;
      totalLoss += Math.max(0, settlement - strike) * callOi;
      totalLoss += Math.max(0, strike - settlement) * putOi;
    }

    if (totalLoss < bestLoss) {
      bestLoss = totalLoss;
      bestStrike = settlement;
    }
  }

  return bestStrike;
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyTickerPayload(): MarketTickerStripPayload {
  return {
    source: "upstox",
    fetchedAt: new Date().toISOString(),
    cached: false,
    tickers: []
  };
}

function emptyMoversPayload(): MarketTopMoversPayload {
  return {
    source: "upstox",
    fetchedAt: new Date().toISOString(),
    cached: false,
    movers: []
  };
}

function emptySectorHeatmapPayload(): MarketSectorHeatmapPayload {
  return {
    source: "upstox",
    fetchedAt: new Date().toISOString(),
    cached: false,
    sectors: []
  };
}

function emptyOptionChainPayload(expiries: string[] = [], selectedExpiry: string | null = null): MarketOptionChainPayload {
  return {
    source: "upstox",
    fetchedAt: new Date().toISOString(),
    cached: false,
    underlying: {
      key: env.UPSTOX_KEY_NIFTY,
      label: "NIFTY 50"
    },
    expiries,
    selectedExpiry,
    summary: {
      spot: null,
      overallPcr: null,
      maxPain: null,
      atmStrike: null,
      atmStraddle: null,
      expectedMove: null,
      strongestCallOiStrike: null,
      strongestPutOiStrike: null
    },
    supportResistance: {
      support: [],
      resistance: []
    },
    buildup: {
      sentiment: "Neutral",
      callWriting: null,
      putWriting: null,
      callUnwinding: null,
      putUnwinding: null
    },
    rangeBias: {
      bias: "Balanced",
      tone: "Neutral",
      strength: "Weak",
      reasons: []
    },
    quickStrategy: {
      stance: "Wait",
      setup: "Wait for clearer structure",
      description: "Chain data is not available yet.",
      reasons: []
    },
    heatmapRows: [],
    rows: []
  };
}












