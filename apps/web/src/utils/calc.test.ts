import { describe, expect, it } from "vitest";
import { calcHoldTime, calcPnL, calcRMultiple, calcRisk } from "./calc";

describe("calcPnL", () => {
  it("calculates long trade net pnl and percent", () => {
    expect(calcPnL(100, 110, 10, "long", 5)).toEqual({
      dollar: 95,
      percent: 10
    });
  });

  it("calculates short trade net pnl and percent", () => {
    expect(calcPnL(100, 90, 10, "short", 2)).toEqual({
      dollar: 98,
      percent: 10
    });
  });

  it("returns zeros when required values are missing", () => {
    expect(calcPnL(0, 110, 10, "long")).toEqual({
      dollar: 0,
      percent: 0
    });
  });
});

describe("calcRMultiple", () => {
  it("calculates the r multiple from pnl and risk", () => {
    expect(calcRMultiple(100, 110, 95, 10, "long", 0)).toBe(2);
  });

  it("returns zero when risk is zero", () => {
    expect(calcRMultiple(100, 110, 100, 10, "long", 0)).toBe(0);
  });
});

describe("calcRisk", () => {
  it("calculates absolute dollar risk", () => {
    expect(calcRisk(100, 95, 10)).toEqual({ dollar: 50 });
  });
});

describe("calcHoldTime", () => {
  it("returns open for incomplete trades", () => {
    expect(calcHoldTime("2026-04-01T09:15:00.000Z", null)).toBe("Open");
  });

  it("formats minutes, hours, and days", () => {
    expect(calcHoldTime("2026-04-01T09:00:00.000Z", "2026-04-01T09:45:00.000Z")).toBe("45m");
    expect(calcHoldTime("2026-04-01T09:00:00.000Z", "2026-04-01T11:30:00.000Z")).toBe("2h 30m");
    expect(calcHoldTime("2026-04-01T09:00:00.000Z", "2026-04-03T09:00:00.000Z")).toBe("2d");
  });

  it("shows same day when the trade has no intraday timestamp resolution", () => {
    expect(calcHoldTime("2026-04-01T12:00:00.000Z", "2026-04-01T12:00:00.000Z")).toBe("Same day");
  });
});

