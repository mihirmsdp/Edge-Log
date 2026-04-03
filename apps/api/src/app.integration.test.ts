import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.CLIENT_URL = "http://localhost:5173";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  return {
    adminGetUser: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    refreshSession: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
    publicGetUser: vi.fn(),
    createRequestClient: vi.fn(),
    buildSummary: vi.fn(),
    buildByDayOfWeek: vi.fn(),
    buildBySession: vi.fn(),
    buildBySetup: vi.fn(),
    buildDrawdown: vi.fn(),
    buildRollingWinRate: vi.fn(),
    buildDurationPnl: vi.fn()
  };
});

vi.mock("./lib/supabase.js", () => ({
  createAdminClient: () => ({
    auth: {
      getUser: mocks.adminGetUser
    }
  }),
  createPublicClient: () => ({
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      refreshSession: mocks.refreshSession,
      setSession: mocks.setSession,
      signOut: mocks.signOut,
      getUser: mocks.publicGetUser
    }
  }),
  createRequestClient: (accessToken: string) => mocks.createRequestClient(accessToken)
}));

vi.mock("./modules/analytics/analytics.service.js", () => ({
  buildSummary: mocks.buildSummary,
  buildByDayOfWeek: mocks.buildByDayOfWeek,
  buildBySession: mocks.buildBySession,
  buildBySetup: mocks.buildBySetup,
  buildDrawdown: mocks.buildDrawdown,
  buildRollingWinRate: mocks.buildRollingWinRate,
  buildDurationPnl: mocks.buildDurationPnl
}));

const { app } = await import("./app.js");

function getSetCookieHeader(response: { headers: Record<string, string | string[] | undefined> }) {
  const value = response.headers["set-cookie"];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function createTradeCreationSupabase(freshTrade: Record<string, unknown>) {
  const state: {
    insertedTradePayload?: Record<string, unknown>;
    insertedTagRows?: Array<Record<string, unknown>>;
  } = {};

  return {
    state,
    client: {
      from(table: string) {
        if (table === "trades") {
          return {
            insert(payload: Record<string, unknown>) {
              state.insertedTradePayload = payload;
              return {
                select() {
                  return {
                    single: async () => ({ data: { id: String(freshTrade.id ?? "trade-1") }, error: null })
                  };
                }
              };
            },
            select() {
              const chain = {
                eq(_field: string, _value: string) {
                  return chain;
                },
                single: async () => ({ data: freshTrade, error: null })
              };

              return chain;
            }
          };
        }

        if (table === "trade_tags") {
          return {
            delete() {
              return {
                eq: async () => ({ error: null })
              };
            },
            insert: async (rows: Array<Record<string, unknown>>) => {
              state.insertedTagRows = rows;
              return { error: null };
            }
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }
    }
  };
}

function createTradeCrudSupabase(options?: {
  listResult?: { trades: Array<Record<string, unknown>>; count?: number };
  updatedTrade?: Record<string, unknown>;
}) {
  const state: {
    listedRange?: [number, number];
    updatedTradePayload?: Record<string, unknown>;
    updatedTradeId?: string;
    deletedTradeId?: string;
    bulkDeletedIds?: string[];
    insertedTagRows?: Array<Record<string, unknown>>;
  } = {};

  const listTrades = options?.listResult?.trades ?? [];
  const listCount = options?.listResult?.count ?? listTrades.length;
  const updatedTrade = options?.updatedTrade ?? { id: "trade-2", symbol: "BANKNIFTY" };

  return {
    state,
    client: {
      from(table: string) {
        if (table === "trades") {
          return {
            select() {
              const chain = {
                order() {
                  return chain;
                },
                gte() {
                  return chain;
                },
                lte() {
                  return chain;
                },
                ilike() {
                  return chain;
                },
                eq(field: string, value: string) {
                  state.updatedTradeId = field === "id" ? value : state.updatedTradeId;
                  state.deletedTradeId = field === "id" ? value : state.deletedTradeId;
                  return chain;
                },
                in() {
                  return chain;
                },
                single: async () => ({ data: updatedTrade, error: null }),
                range: async (from: number, to: number) => {
                  state.listedRange = [from, to];
                  return { data: listTrades, error: null, count: listCount };
                }
              };

              return chain;
            },
            update(payload: Record<string, unknown>) {
              state.updatedTradePayload = payload;
              return {
                eq: async (_field: string, tradeId: string) => {
                  state.updatedTradeId = tradeId;
                  return { error: null };
                }
              };
            },
            delete() {
              return {
                eq: async (_field: string, tradeId: string) => {
                  state.deletedTradeId = tradeId;
                  return { error: null };
                },
                in: async (_field: string, ids: string[]) => {
                  state.bulkDeletedIds = ids;
                  return { error: null };
                }
              };
            }
          };
        }

        if (table === "trade_tags") {
          return {
            delete() {
              return {
                eq: async () => ({ error: null })
              };
            },
            insert: async (rows: Array<Record<string, unknown>>) => {
              state.insertedTagRows = rows;
              return { error: null };
            }
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }
    }
  };
}

const validTradePayload = {
  accountId: "account-1",
  symbol: "nifty",
  assetClass: "option",
  direction: "long",
  entryPrice: 100,
  exitPrice: 120,
  stopLoss: 95,
  takeProfit: 130,
  size: 2,
  commission: 5,
  entryDate: "2026-04-01T09:15:00.000Z",
  exitDate: "2026-04-01T09:45:00.000Z",
  setupName: "Breakout",
  timeframe: "m5",
  session: "asia",
  emotion: "calm",
  mistakes: ["late entry"],
  notes: "planned trade",
  rating: 4,
  tagIds: ["tag-1", "tag-2"]
};

describe("api app integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "trader@example.com" } },
      error: null
    });
    mocks.createRequestClient.mockReturnValue({});
    mocks.buildSummary.mockResolvedValue({ totalPnl: 250, totalTrades: 3 });
  });

  it("signs in and sets session cookies", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "trader@example.com" },
        session: { access_token: "access-1", refresh_token: "refresh-1" }
      },
      error: null
    });

    const response = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "trader@example.com", password: "supersecret" });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("trader@example.com");
    expect(getSetCookieHeader(response).join(";")).toContain("edgelog_access_token=access-1");
    expect(getSetCookieHeader(response).join(";")).toContain("edgelog_refresh_token=refresh-1");
  });

  it("refreshes a session from the refresh token cookie", async () => {
    mocks.refreshSession.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "trader@example.com" },
        session: { access_token: "access-2", refresh_token: "refresh-2" }
      },
      error: null
    });

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", ["edgelog_refresh_token=refresh-old"]);

    expect(response.status).toBe(200);
    expect(mocks.refreshSession).toHaveBeenCalledWith({ refresh_token: "refresh-old" });
    expect(getSetCookieHeader(response).join(";")).toContain("edgelog_access_token=access-2");
    expect(getSetCookieHeader(response).join(";")).toContain("edgelog_refresh_token=refresh-2");
  });

  it("signs out and clears session cookies", async () => {
    const response = await request(app)
      .post("/api/v1/auth/sign-out")
      .set("Cookie", ["edgelog_access_token=access-old", "edgelog_refresh_token=refresh-old"]);

    expect(response.status).toBe(204);
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: "access-old",
      refresh_token: "refresh-old"
    });
    expect(mocks.signOut).toHaveBeenCalled();
    expect(getSetCookieHeader(response).join(";")).toContain("edgelog_access_token=");
    expect(getSetCookieHeader(response).join(";")).toContain("edgelog_refresh_token=");
  });

  it("rejects protected routes without authentication", async () => {
    const response = await request(app).get("/api/v1/trades");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        message: "Authentication required"
      }
    });
  });

  it("lists trades through the real route/controller flow", async () => {
    const tradeSupabase = createTradeCrudSupabase({
      listResult: {
        trades: [{ id: "trade-1", symbol: "NIFTY" }],
        count: 1
      }
    });
    mocks.createRequestClient.mockReturnValue(tradeSupabase.client);

    const response = await request(app)
      .get("/api/v1/trades?page=1&pageSize=25")
      .set("Authorization", "Bearer token-123");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      trades: [{ id: "trade-1", symbol: "NIFTY" }],
      pagination: {
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1
      }
    });
    expect(tradeSupabase.state.listedRange).toEqual([0, 24]);
  });

  it("creates a trade through the real route/controller flow", async () => {
    const freshTrade = {
      id: "trade-1",
      symbol: "NIFTY",
      asset_class: "options",
      notes: "planned trade"
    };
    const tradeSupabase = createTradeCreationSupabase(freshTrade);
    mocks.createRequestClient.mockReturnValue(tradeSupabase.client);

    const response = await request(app)
      .post("/api/v1/trades")
      .set("Authorization", "Bearer token-123")
      .send(validTradePayload);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ trade: freshTrade });
    expect(tradeSupabase.state.insertedTradePayload).toMatchObject({
      user_id: "user-1",
      symbol: "NIFTY",
      asset_class: "options",
      mistakes: "late entry"
    });
    expect(tradeSupabase.state.insertedTagRows).toEqual([
      { trade_id: "trade-1", tag_id: "tag-1" },
      { trade_id: "trade-1", tag_id: "tag-2" }
    ]);
  });

  it("updates a trade through the real route/controller flow", async () => {
    const updatedTrade = {
      id: "trade-2",
      symbol: "BANKNIFTY",
      asset_class: "options",
      notes: "updated trade"
    };
    const tradeSupabase = createTradeCrudSupabase({ updatedTrade });
    mocks.createRequestClient.mockReturnValue(tradeSupabase.client);

    const response = await request(app)
      .put("/api/v1/trades/trade-2")
      .set("Authorization", "Bearer token-123")
      .send({
        ...validTradePayload,
        symbol: "banknifty",
        notes: "updated trade",
        tagIds: ["tag-3"]
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ trade: updatedTrade });
    expect(tradeSupabase.state.updatedTradeId).toBe("trade-2");
    expect(tradeSupabase.state.updatedTradePayload).toMatchObject({
      symbol: "BANKNIFTY",
      notes: "updated trade"
    });
    expect(tradeSupabase.state.insertedTagRows).toEqual([{ trade_id: "trade-2", tag_id: "tag-3" }]);
  });

  it("deletes a trade through the real route/controller flow", async () => {
    const tradeSupabase = createTradeCrudSupabase();
    mocks.createRequestClient.mockReturnValue(tradeSupabase.client);

    const response = await request(app)
      .delete("/api/v1/trades/trade-9")
      .set("Authorization", "Bearer token-123");

    expect(response.status).toBe(204);
    expect(tradeSupabase.state.deletedTradeId).toBe("trade-9");
  });

  it("returns validation errors for invalid trade payloads", async () => {
    const response = await request(app)
      .post("/api/v1/trades")
      .set("Authorization", "Bearer token-123")
      .send({ symbol: "NIFTY" });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Validation failed");
  });

  it("returns analytics summary for authenticated requests", async () => {
    const response = await request(app)
      .get("/api/v1/analytics/summary?assetClass=option")
      .set("Authorization", "Bearer token-123");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalPnl: 250, totalTrades: 3 });
    expect(mocks.buildSummary).toHaveBeenCalledWith({}, { assetClass: ["option"] });
  });
});


