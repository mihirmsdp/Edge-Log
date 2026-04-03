import { describe, expect, it, vi } from "vitest";
import { getIstDayBounds, getIstToday, getPromptDate } from "./market-data.js";

describe("journal market date helpers", () => {
  it("returns IST day bounds in utc iso strings", () => {
    expect(getIstDayBounds("2026-04-03")).toEqual({
      start: "2026-04-02T18:30:00.000Z",
      end: "2026-04-03T18:30:00.000Z"
    });
  });

  it("formats prompt dates for India locale", () => {
    expect(getPromptDate("2026-04-03")).toBe("03 Apr 2026");
  });

  it("returns todays date in IST", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T18:45:00.000Z"));

    expect(getIstToday()).toBe("2026-04-04");

    vi.useRealTimers();
  });
});
