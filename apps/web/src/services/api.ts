import type {
  Account,
  AnalyticsSummary,
  JournalDayResponse,
  JournalEntry,
  JournalCalendarDay,
  MarketTickerStripPayload,
  MarketTopMoversPayload,
  NiftyLivePricePayload,
  PlaybookSetup,
  Profile,
  Tag,
  Trade,
  TradesResponse
} from "@/types/api";

export const API_BASE = "http://localhost:4000/api/v1";

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.message ?? "Request failed");
  }

  return data as T;
}

export const api = {
  getSession: () => request<{ user: Profile | null }>("/auth/me"),
  signIn: (payload: { email: string; password: string }) => request("/auth/sign-in", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload: { name: string; email: string; password: string }) => request("/auth/sign-up", { method: "POST", body: JSON.stringify(payload) }),
  signOut: () => request("/auth/sign-out", { method: "POST" }),
  getTags: () => request<{ tags: Tag[] }>("/tags"),
  getAccounts: () => request<{ accounts: Account[] }>("/accounts"),
  createAccount: (payload: { name: string; startingBalance: number; currency: string }) => request<{ account: Account }>("/accounts", { method: "POST", body: JSON.stringify(payload) }),
  updateAccount: (id: string, payload: { name?: string; startingBalance?: number; currency?: string }) => request<{ account: Account }>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAccount: (id: string) => request<void>(`/accounts/${id}`, { method: "DELETE" }),
  getTrades: (params: URLSearchParams) => request<TradesResponse>(`/trades?${params.toString()}`),
  getTrade: (id: string) => request<{ trade: Trade }>(`/trades/${id}`),
  createTrade: (payload: unknown) => request<{ trade: Trade }>("/trades", { method: "POST", body: JSON.stringify(payload) }),
  updateTrade: (id: string, payload: unknown) => request<{ trade: Trade }>(`/trades/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTrade: (id: string) => request<void>(`/trades/${id}`, { method: "DELETE" }),
  bulkDeleteTrades: (ids: string[]) => request<void>("/trades", { method: "DELETE", body: JSON.stringify({ ids }) }),
  uploadScreenshots: async (tradeId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("screenshots", file));
    return request(`/trades/${tradeId}/screenshots`, { method: "POST", body: formData });
  },
  getAnalyticsSummary: (params: URLSearchParams) => request<AnalyticsSummary>(`/analytics/summary?${params.toString()}`),
  getAnalyticsByDay: (params: URLSearchParams) => request<Array<{ day: string; pnl: number }>>(`/analytics/by-day-of-week?${params.toString()}`),
  getAnalyticsBySession: (params: URLSearchParams) => request<Array<{ session: string; pnl: number }>>(`/analytics/by-session?${params.toString()}`),
  getAnalyticsBySetup: (params: URLSearchParams) => request<Array<{ setup: string; winRate: number; profitFactor: number; totalTrades: number; pnl: number }>>(`/analytics/by-setup?${params.toString()}`),
  getAnalyticsDrawdown: (params: URLSearchParams) => request<Array<{ date: string; drawdownPct: number }>>(`/analytics/drawdown?${params.toString()}`),
  getAnalyticsRolling: (params: URLSearchParams) => request<Array<{ date: string; winRate: number; tradesConsidered: number }>>(`/analytics/rolling-winrate?${params.toString()}`),
  getAnalyticsDuration: (params: URLSearchParams) => request<Array<{ holdMinutes: number; pnlDollar: number; direction: string }>>(`/analytics/duration-pnl?${params.toString()}`),
  getPlaybooks: () => request<{ playbookSetups: PlaybookSetup[] }>("/playbook-setups"),
  createPlaybook: (payload: unknown) => request<{ playbookSetup: PlaybookSetup }>("/playbook-setups", { method: "POST", body: JSON.stringify(payload) }),
  updatePlaybook: (id: string, payload: unknown) => request<{ playbookSetup: PlaybookSetup }>(`/playbook-setups/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePlaybook: (id: string) => request<void>(`/playbook-setups/${id}`, { method: "DELETE" }),
  getJournalCalendar: (month: string) => request<{ month: string; days: JournalCalendarDay[] }>(`/journal-entries/calendar?month=${month}`),
  getJournalDay: (date: string) => request<JournalDayResponse>(`/journal-entries/day?date=${date}`),
  getJournalEntries: (params = new URLSearchParams()) => request<{ journalEntries: JournalEntry[] }>(`/journal-entries?${params.toString()}`),
  createJournalEntry: (payload: unknown) => request<{ journalEntry: JournalEntry }>("/journal-entries", { method: "POST", body: JSON.stringify(payload) }),
  updateJournalEntry: (id: string, payload: unknown) => request<{ journalEntry: JournalEntry }>(`/journal-entries/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteJournalEntry: (id: string) => request<void>(`/journal-entries/${id}`, { method: "DELETE" }),
  getJournalLivePrice: () => request<NiftyLivePricePayload>("/journal/live-price"),
  getMarketTickerStrip: () => request<MarketTickerStripPayload>("/market/ticker-strip"),
  getMarketTopMovers: () => request<MarketTopMoversPayload>("/market/top-movers")
};

export { ApiError };
