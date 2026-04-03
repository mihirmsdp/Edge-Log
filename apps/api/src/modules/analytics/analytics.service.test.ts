import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildByDayOfWeek, buildSummary } from "./analytics.service.js";
import { getFilteredTrades } from "../trades/trades.service.js";

vi.mock("../trades/trades.service.js", () => ({
  getFilteredTrades: vi.fn()
}));

const mockedGetFilteredTrades = vi.mocked(getFilteredTrades);

describe("analytics service", () => {
  beforeEach(() => {
    mockedGetFilteredTrades.mockReset();
  });

  it("builds a summary from trade results", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00.000Z"));

    mockedGetFilteredTrades.mockResolvedValue([
      {
        entry_date: "2026-03-05T09:15:00.000Z",
        net_pnl: 100,
        rr_multiple: 2,
        direction: "long"
      },
      {
        entry_date: "2026-04-02T09:15:00.000Z",
        net_pnl: -50,
        rr_multiple: -1,
        direction: "short"
      },
      {
        entry_date: "2026-04-07T09:15:00.000Z",
        net_pnl: 200,
        rr_multiple: 4,
        direction: "long"
      }
    ] as any);

    const summary = await buildSummary({} as any, {} as any);

    expect(summary.totalPnl).toBe(250);
    expect(summary.totalTrades).toBe(3);
    expect(summary.winRate).toBeCloseTo(66.67, 2);
    expect(summary.profitFactor).toBe(6);
    expect(summary.avgRR).toBeCloseTo(1.67, 2);
    expect(summary.currentStreak).toEqual({
      type: "W",
      count: 1,
      label: "1W streak"
    });
    expect(summary.bestTrade?.net_pnl).toBe(200);
    expect(summary.worstTrade?.net_pnl).toBe(-50);
    expect(summary.equityCurve).toEqual([
      { date: "2026-03-05T09:15:00.000Z", cumulativePnl: 100 },
      { date: "2026-04-02T09:15:00.000Z", cumulativePnl: 50 },
      { date: "2026-04-07T09:15:00.000Z", cumulativePnl: 250 }
    ]);
    expect(summary.calendarHeatmap).toEqual({
      "2026-03-05": 100,
      "2026-04-02": -50,
      "2026-04-07": 200
    });
    expect(summary.vsLastMonth).toEqual({
      pnl: 50,
      winRate: -50,
      trades: 1
    });

    vi.useRealTimers();
  });

  it("groups pnl totals by weekday in monday-first order", async () => {
    mockedGetFilteredTrades.mockResolvedValue([
      { entry_date: "2026-04-06T09:15:00.000Z", net_pnl: 100 },
      { entry_date: "2026-04-08T09:15:00.000Z", net_pnl: -25 },
      { entry_date: "2026-04-06T10:15:00.000Z", net_pnl: 10 }
    ] as any);

    await expect(buildByDayOfWeek({} as any, {} as any)).resolves.toEqual([
      { day: "Mon", pnl: 110 },
      { day: "Tue", pnl: 0 },
      { day: "Wed", pnl: -25 },
      { day: "Thu", pnl: 0 },
      { day: "Fri", pnl: 0 },
      { day: "Sat", pnl: 0 },
      { day: "Sun", pnl: 0 }
    ]);
  });
});

