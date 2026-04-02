export interface Profile {
  id: string;
  email: string;
  name: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Account {
  id: string;
  name: string;
  currency: string;
  starting_balance: number;
  created_at?: string;
}

export interface TradeTagRelation {
  tag_id: string;
  tags: Tag;
}

export interface TradeScreenshot {
  id: string;
  file_path: string;
  created_at: string;
}

export interface Trade {
  id: string;
  account_id: string;
  user_id: string;
  symbol: string;
  asset_class: string;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  size: number;
  commission: number;
  risk_amount: number | null;
  gross_pnl: number | null;
  net_pnl: number | null;
  rr_multiple: number | null;
  entry_date: string;
  exit_date: string | null;
  setup_name: string | null;
  timeframe: string | null;
  session: string | null;
  emotion: string | null;
  mistakes: string | null;
  notes: string | null;
  rating: number | null;
  created_at: string;
  accounts?: Pick<Account, "id" | "name" | "currency">;
  trade_tags?: TradeTagRelation[];
  trade_screenshots?: TradeScreenshot[];
}

export interface TradesResponse {
  trades: Trade[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AnalyticsSummary {
  totalPnl: number;
  winRate: number;
  profitFactor: number;
  avgRR: number;
  totalTrades: number;
  currentStreak: { type: "W" | "L" | null; count: number; label: string };
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  avgWin: number;
  avgLoss: number;
  equityCurve: Array<{ date: string; cumulativePnl: number }>;
  calendarHeatmap: Record<string, number>;
  recentTrades: Trade[];
  vsLastMonth: { pnl: number; winRate: number; trades: number };
}

export interface PlaybookSetup {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  rulesMarkdown: string;
  entryCriteria: string;
  exitCriteria: string;
  created_at: string;
  stats: {
    tradeCount: number;
    winRate: number;
    avgR: number;
    profitFactor: number;
    totalPnl: number;
  };
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  created_at: string;
  mood: number | null;
  postMarketNotes: string;
}

export interface JournalCalendarDay {
  date: string;
  hasEntry: boolean;
  journalEntryId: string | null;
  tradeCount: number;
  pnl: number;
}

export interface JournalDayTrade {
  id: string;
  symbol: string;
  direction: "long" | "short";
  entry_date: string;
  exit_date: string | null;
  net_pnl: number | null;
  rr_multiple: number | null;
  setup_name: string | null;
  rating: number | null;
}

export interface JournalDayResponse {
  date: string;
  journalEntry: JournalEntry | null;
  trades: JournalDayTrade[];
  summary: {
    tradeCount: number;
    pnl: number;
  };
}

export interface PremarketLevel {
  price: number;
  type: "Strong" | "Moderate";
  note: string;
}

export interface PremarketAnalysis {
  date: string;
  sessionBias: "Bullish" | "Bearish" | "Neutral" | "Sideways";
  biasStrength: "Strong" | "Moderate" | "Weak";
  summary: string;
  globalCues: {
    sentiment: "Positive" | "Negative" | "Mixed";
    notes: string;
  };
  levels: {
    spot: number;
    support: PremarketLevel[];
    resistance: PremarketLevel[];
    dayRange: { low: number; high: number };
    weeklyPivot: number;
    maxPain: number;
  };
  scenarios: {
    bullCase: { trigger: string; target: number; invalidation: number };
    bearCase: { trigger: string; target: number; invalidation: number };
  };
  watchlist: Array<{ symbol: string; note: string }>;
  optionsNote: string;
  riskEvents: string[];
  disclaimer: string;
}

export interface PremarketAnalysisPayload {
  cached: boolean;
  generatedAt: string;
  analysis: PremarketAnalysis;
}

export interface PostmarketAnalysis {
  date: string;
  dayType: "Trend" | "Range" | "Reversal" | "Mixed" | "Quiet";
  sessionVerdict: "Constructive" | "Neutral" | "Challenging";
  summary: string;
  premarketReview: {
    accuracy: "High" | "Medium" | "Low";
    usefulness: "High" | "Medium" | "Low";
    notes: string;
  };
  tradeReview: {
    tradeCount: number;
    netPnl: number;
    winCount: number;
    lossCount: number;
    bestSymbol: string;
    bestTradePnl: number;
    worstSymbol: string;
    worstTradePnl: number;
  };
  whatWorked: string[];
  whatFailed: string[];
  tomorrowFocus: string[];
  disclaimer: string;
}

export interface PostmarketAnalysisPayload {
  cached: boolean;
  generatedAt: string;
  analysis: PostmarketAnalysis;
}

export interface NiftyLivePricePayload {
  spot: number;
  symbol: string;
  source: string;
  fetchedAt: string;
}

export interface UpstoxConnection {
  user_id: string;
  upstox_user_id: string | null;
  upstox_user_name: string | null;
  upstox_email: string | null;
  broker: string;
  exchanges: string[];
  products: string[];
  connected_at: string;
  updated_at: string;
}

export interface UpstoxImportPreviewTrade {
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
}

export interface UpstoxTradeImportPreviewResponse {
  source: "UPSTOX";
  mode: "day" | "range";
  startDate: string | null;
  endDate: string | null;
  trades: UpstoxImportPreviewTrade[];
}

export interface UpstoxTradeImportRunResponse {
  imported: Array<{ tradeId: string; importKey: string; symbol: string }>;
  summary: {
    requested: number;
    imported: number;
    skipped: number;
  };
}

export interface UpstoxStatusResponse {
  connected: boolean;
  connection: UpstoxConnection | null;
}

export interface UpstoxConfigResponse {
  enabled: boolean;
}
export interface MarketTicker {
  id: string;
  label: string;
  symbol: string;
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
}

export interface MarketTickerStripPayload {
  source: string;
  fetchedAt: string;
  cached: boolean;
  tickers: MarketTicker[];
}

export interface MarketMover {
  symbol: string;
  price: number;
  changePercent: number;
}

export interface MarketTopMoversPayload {
  source: string;
  fetchedAt: string;
  cached: boolean;
  movers: MarketMover[];
}

export interface MarketSectorTile {
  sector: string;
  changePercent: number;
  advancing: number;
  declining: number;
  flat: number;
  total: number;
  leaders: string[];
}

export interface MarketSectorHeatmapPayload {
  source: string;
  fetchedAt: string;
  cached: boolean;
  sectors: MarketSectorTile[];
}

export interface MarketOptionLeg {
  ltp: number | null;
  oi: number | null;
  changeOi: number | null;
  volume: number | null;
  iv: number | null;
  delta: number | null;
}

export interface MarketOptionChainRow {
  strikePrice: number;
  pcr: number | null;
  call: MarketOptionLeg;
  put: MarketOptionLeg;
}

export interface MarketOptionLevel {
  strikePrice: number;
  oi: number;
  changeOi: number | null;
}

export interface MarketOptionHeatmapRow {
  strikePrice: number;
  callOi: number | null;
  callChangeOi: number | null;
  putOi: number | null;
  putChangeOi: number | null;
}

export interface MarketOptionBuildupSummary {
  sentiment: "Bullish" | "Bearish" | "Mixed" | "Neutral";
  callWriting: MarketOptionLevel | null;
  putWriting: MarketOptionLevel | null;
  callUnwinding: MarketOptionLevel | null;
  putUnwinding: MarketOptionLevel | null;
}

export interface MarketOptionRangeBias {
  bias: "Trend Day" | "Range Day" | "Balanced";
  tone: "Bullish" | "Bearish" | "Neutral";
  strength: "Strong" | "Moderate" | "Weak";
  reasons: string[];
}

export interface MarketOptionQuickStrategy {
  stance: "Bullish" | "Bearish" | "Neutral" | "Wait";
  setup: string;
  description: string;
  reasons: string[];
}

export interface MarketOptionBiasExplainPayload {
  explanation: string;
  generatedAt: string;
  expiry: string | null;
}

export interface MarketOptionChainPayload {
  source: string;
  fetchedAt: string;
  cached: boolean;
  underlying: {
    key: string;
    label: string;
  };
  expiries: string[];
  selectedExpiry: string | null;
  summary: {
    spot: number | null;
    overallPcr: number | null;
    maxPain: number | null;
    atmStrike: number | null;
    atmStraddle: number | null;
    expectedMove: number | null;
    strongestCallOiStrike: number | null;
    strongestPutOiStrike: number | null;
  };
  supportResistance: {
    support: MarketOptionLevel[];
    resistance: MarketOptionLevel[];
  };
  buildup: MarketOptionBuildupSummary;
  rangeBias: MarketOptionRangeBias;
  quickStrategy: MarketOptionQuickStrategy;
  heatmapRows: MarketOptionHeatmapRow[];
  rows: MarketOptionChainRow[];
}






