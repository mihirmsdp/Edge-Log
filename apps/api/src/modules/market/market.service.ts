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

const UPSTOX_BASE_URL = "https://api.upstox.com/v2/market-quote/quotes";
const UPSTOX_NSE_INSTRUMENTS_URL = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz";
const CACHE_TTL_MS = 30_000;
const INSTRUMENTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TOP_MOVER_COUNT = 10;

const tickerConfig: TickerConfig[] = [
  { id: "nifty", label: "NIFTY 50", instrumentKey: env.UPSTOX_KEY_NIFTY },
  { id: "banknifty", label: "BANKNIFTY", instrumentKey: env.UPSTOX_KEY_BANKNIFTY },
  { id: "sensex", label: "SENSEX", instrumentKey: env.UPSTOX_KEY_SENSEX },
  { id: "indiavix", label: "INDIA VIX", instrumentKey: env.UPSTOX_KEY_INDIAVIX }
];

const NIFTY_50_SYMBOLS = [
  "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BEL", "BHARTIARTL",
  "BPCL", "BRITANNIA", "CIPLA", "COALINDIA", "DRREDDY", "EICHERMOT", "ETERNAL", "GRASIM", "HCLTECH", "HDFCBANK",
  "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK", "INFY", "ITC", "JIOFIN", "JSWSTEEL",
  "KOTAKBANK", "LT", "M&M", "MARUTI", "NESTLEIND", "NTPC", "ONGC", "POWERGRID", "RELIANCE", "SBILIFE",
  "SHRIRAMFIN", "SBIN", "SUNPHARMA", "TATACONSUM", "TATAMOTORS", "TATASTEEL", "TCS", "TECHM", "TITAN", "TRENT"
] as const;

let tickerCache: { expiresAt: number; payload: MarketTickerStripPayload } | null = null;
let moversCache: { expiresAt: number; payload: MarketTopMoversPayload } | null = null;
let instrumentsCache: { expiresAt: number; payload: Map<string, string> } | null = null;

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
        const quote = quotesByToken.get(instrumentKey);
        const price = toNumber(quote?.last_price);
        const previousClose = toNumber(quote?.ohlc?.close);
        const directChange = toNumber(quote?.net_change);
        const change = directChange ?? (price !== null && previousClose !== null ? round2(price - previousClose) : null);
        const changePercent = previousClose && previousClose !== 0 && change !== null ? round2((change / previousClose) * 100) : null;

        if (price === null || changePercent === null) {
          return null;
        }

        return {
          symbol,
          price,
          changePercent
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

async function fetchQuotesByInstrumentKeys(instrumentKeys: string[]): Promise<Map<string, UpstoxQuote>> {
  const response = await fetchUpstoxJson<UpstoxFullQuoteResponse>(`${UPSTOX_BASE_URL}?instrument_key=${encodeURIComponent(instrumentKeys.join(","))}`);
  return indexQuotesByToken(response.data);
}

async function getNifty50InstrumentKeys(): Promise<Array<{ symbol: string; instrumentKey: string }>> {
  const instruments = await getNseInstrumentMap();
  const results: Array<{ symbol: string; instrumentKey: string }> = [];

  for (const symbol of NIFTY_50_SYMBOLS) {
    const instrumentKey = instruments.get(symbol);
    if (instrumentKey) {
      results.push({ symbol, instrumentKey });
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


