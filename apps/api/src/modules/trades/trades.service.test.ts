import { describe, expect, it } from "vitest";
import { buildTradeInsertPayload, buildTradeUpdatePayload } from "./trades.service.js";

const baseInput = {
  accountId: "account-1",
  symbol: "nifty",
  assetClass: "option",
  direction: "long" as const,
  entryPrice: 100,
  exitPrice: 120,
  stopLoss: 95,
  takeProfit: 130,
  size: 2,
  commission: 5,
  entryDate: "2026-04-01T09:15:00.000Z",
  exitDate: "2026-04-01T09:45:00.000Z",
  setupName: "Breakout",
  timeframe: "5m",
  session: "open",
  emotion: "calm",
  mistakes: "none",
  notes: "planned",
  rating: 4
};

describe("buildTradeInsertPayload", () => {
  it("normalizes symbol and asset class and adds the user id", () => {
    expect(buildTradeInsertPayload(baseInput, "user-1")).toMatchObject({
      user_id: "user-1",
      symbol: "NIFTY",
      asset_class: "options",
      account_id: "account-1"
    });
  });
});

describe("buildTradeUpdatePayload", () => {
  it("maps optional empty fields to null", () => {
    expect(
      buildTradeUpdatePayload({
        ...baseInput,
        exitPrice: undefined,
        stopLoss: undefined,
        takeProfit: undefined,
        exitDate: undefined,
        setupName: undefined,
        timeframe: undefined,
        session: undefined,
        emotion: undefined,
        mistakes: undefined,
        notes: undefined,
        rating: undefined
      })
    ).toMatchObject({
      exit_price: null,
      stop_loss: null,
      take_profit: null,
      exit_date: null,
      setup_name: null,
      timeframe: null,
      session: null,
      emotion: null,
      mistakes: null,
      notes: null,
      rating: null
    });
  });
});
