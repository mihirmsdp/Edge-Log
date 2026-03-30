import { ApiError } from "../../lib/errors.js";

export const GOOGLE_FINANCE_NIFTY_URL = "https://www.google.com/finance/quote/NIFTY_50:INDEXNSE?hl=en";

export function getIstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function getIstDayBounds(date: string) {
  const start = new Date(`${date}T00:00:00+05:30`);
  const end = new Date(`${date}T00:00:00+05:30`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getPromptDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00+05:30`));
}

function parsePriceString(value: string) {
  const numeric = value.replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchGoogleFinanceNiftySpot() {
  const response = await fetch(GOOGLE_FINANCE_NIFTY_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new ApiError(502, `Google Finance spot lookup failed with status ${response.status}`);
  }

  const html = await response.text();
  const primaryMatch = html.match(/class=\"YMlKec fxKbKc\"[^>]*>([^<]+)</i) ?? html.match(/class=\"YMlKec\"[^>]*>([^<]+)</i);

  if (!primaryMatch?.[1]) {
    throw new ApiError(502, "Unable to parse NIFTY spot from Google Finance");
  }

  const spot = parsePriceString(primaryMatch[1]);
  if (spot == null) {
    throw new ApiError(502, "Parsed Google Finance spot was invalid");
  }

  return spot;
}
