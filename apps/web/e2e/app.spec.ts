import { expect, test } from "@playwright/test";

test("user can sign in, create a trade, and see dashboard metrics update", async ({ page }) => {
  let authenticated = false;
  let summary = {
    totalPnl: 25000,
    winRate: 60,
    profitFactor: 1.8,
    avgRR: 1.4,
    totalTrades: 2,
    currentStreak: { type: "W", count: 2, label: "2W streak" },
    bestTrade: null,
    worstTrade: null,
    avgWin: 15000,
    avgLoss: 5000,
    equityCurve: [
      { date: "2026-04-01T09:15:00.000Z", cumulativePnl: 10000 },
      { date: "2026-04-02T09:15:00.000Z", cumulativePnl: 25000 }
    ],
    calendarHeatmap: {
      "2026-04-01": 10000,
      "2026-04-02": 15000
    },
    recentTrades: [],
    vsLastMonth: { pnl: 5000, winRate: 10, trades: 1 }
  };

  const accounts = [
    { id: "account-1", name: "Primary", currency: "INR", starting_balance: 100000 }
  ];

  const tags = [{ id: "tag-1", name: "Breakout", color: "#22c55e" }];

  const trades = [
    {
      id: "trade-1",
      account_id: "account-1",
      user_id: "user-1",
      symbol: "RELIANCE",
      asset_class: "stock",
      direction: "long",
      entry_price: 2400,
      exit_price: 2500,
      stop_loss: 2360,
      take_profit: 2520,
      size: 10,
      commission: 0,
      risk_amount: 400,
      gross_pnl: 1000,
      net_pnl: 1000,
      rr_multiple: 2.5,
      entry_date: "2026-04-01T09:15:00.000Z",
      exit_date: "2026-04-01T10:00:00.000Z",
      setup_name: "Breakout",
      timeframe: "m5",
      session: "asia",
      emotion: "calm",
      mistakes: null,
      notes: "Opening drive setup",
      rating: 4,
      created_at: "2026-04-01T10:05:00.000Z",
      accounts: { id: "account-1", name: "Primary", currency: "INR" },
      trade_tags: [],
      trade_screenshots: []
    }
  ];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();

    const json = async (status: number, body: unknown) => {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body)
      });
    };

    if (path === "/auth/me" && method === "GET") {
      if (!authenticated) {
        await json(401, { user: null });
        return;
      }

      await json(200, {
        user: { id: "user-1", email: "demo@edgelog.app", name: "Demo Trader" }
      });
      return;
    }

    if (path === "/auth/sign-in" && method === "POST") {
      authenticated = true;
      await json(200, {
        user: { id: "user-1", email: "demo@edgelog.app", name: "Demo Trader" },
        session: { access_token: "access-1", refresh_token: "refresh-1" }
      });
      return;
    }

    if (path === "/auth/sign-out" && method === "POST") {
      authenticated = false;
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (path === "/market/top-movers" && method === "GET") {
      await json(200, { source: "mock", fetchedAt: "2026-04-03T00:00:00.000Z", cached: true, movers: [] });
      return;
    }

    if (path === "/market/ticker-strip" && method === "GET") {
      await json(200, { source: "mock", fetchedAt: "2026-04-03T00:00:00.000Z", cached: true, tickers: [] });
      return;
    }

    if (path === "/accounts" && method === "GET") {
      await json(200, { accounts });
      return;
    }

    if (path === "/tags" && method === "GET") {
      await json(200, { tags });
      return;
    }

    if (path === "/upstox/status" && method === "GET") {
      await json(200, { connected: false, connection: null });
      return;
    }

    if (path === "/analytics/summary" && method === "GET") {
      await json(200, summary);
      return;
    }

    if (path === "/trades" && method === "GET") {
      await json(200, {
        trades,
        pagination: {
          page: 1,
          pageSize: 25,
          total: trades.length,
          totalPages: 1
        }
      });
      return;
    }

    if (path === "/trades" && method === "POST") {
      const payload = JSON.parse(request.postData() ?? "{}");
      const createdTrade = {
        id: "trade-2",
        account_id: payload.accountId,
        user_id: "user-1",
        symbol: payload.symbol.toUpperCase(),
        asset_class: payload.assetClass === "option" ? "options" : payload.assetClass,
        direction: payload.direction,
        entry_price: Number(payload.entryPrice),
        exit_price: Number(payload.exitPrice),
        stop_loss: Number(payload.stopLoss),
        take_profit: payload.takeProfit ? Number(payload.takeProfit) : null,
        size: Number(payload.size),
        commission: Number(payload.commission ?? 0),
        risk_amount: 250,
        gross_pnl: 500,
        net_pnl: 500,
        rr_multiple: 2,
        entry_date: payload.entryDate,
        exit_date: payload.exitDate,
        setup_name: null,
        timeframe: null,
        session: null,
        emotion: null,
        mistakes: Array.isArray(payload.mistakes) ? payload.mistakes.join(", ") : null,
        notes: payload.notes ?? null,
        rating: payload.rating ?? null,
        created_at: "2026-04-03T00:00:00.000Z",
        accounts: { id: "account-1", name: "Primary", currency: "INR" },
        trade_tags: [],
        trade_screenshots: []
      };

      trades.unshift(createdTrade);
      summary = {
        ...summary,
        totalPnl: summary.totalPnl + 500,
        totalTrades: summary.totalTrades + 1,
        equityCurve: [...summary.equityCurve, { date: createdTrade.entry_date, cumulativePnl: 25500 }]
      };

      await json(200, { trade: createdTrade });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: `Unhandled mock route: ${method} ${path}` } })
    });
  });

  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Command center" })).toBeVisible();
  await expect(page.getByText(/25,000\.00/).nth(1)).toBeVisible();

  await page.getByRole("link", { name: "Trade Log" }).click();
  await expect(page.getByRole("heading", { name: "Execution review board" })).toBeVisible();
  await page.getByRole("button", { name: "New trade" }).click();
  await expect(page.getByRole("heading", { name: "Log a trade" })).toBeVisible();

  await page.getByLabel("Symbol").fill("banknifty");
  await page.getByLabel("Asset class").selectOption("option");
  await page.getByLabel("Entry price").fill("100");
  await page.getByLabel("Exit price").fill("120");
  await page.getByLabel("Stop price").fill("90");
  await page.getByLabel("Size").fill("25");
  await page.getByRole("button", { name: "Save trade" }).click();

  await expect(page.getByRole("heading", { name: "Execution review board" })).toBeVisible();
  await expect(page.getByText("BANKNIFTY")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText(/25,500\.00/).first()).toBeVisible();
});

