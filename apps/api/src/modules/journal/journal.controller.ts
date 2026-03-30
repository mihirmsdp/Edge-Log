import type { Request, Response } from "express";
import { ApiError } from "../../lib/errors.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";
import { createJournalEntrySchema, journalCalendarSchema, journalDaySchema, listJournalEntriesSchema, updateJournalEntrySchema } from "./journal.schemas.js";

function toDayIso(dateValue: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return `${dateValue}T00:00:00.000Z`;
  }

  return new Date(dateValue).toISOString();
}

function getDayBounds(dateValue: string) {
  const base = new Date(toDayIso(dateValue));
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 1, 0, 0, 0, 0));
  return { start, end };
}

function parseContent(content: string) {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") {
      return {
        postMarketNotes: typeof parsed.postMarketNotes === "string" ? parsed.postMarketNotes : ""
      };
    }
  } catch {
    return {
      postMarketNotes: content
    };
  }

  return {
    postMarketNotes: ""
  };
}

function serializeContent(postMarketNotes: string) {
  return JSON.stringify({ postMarketNotes });
}

function normalizeEntry(row: any) {
  const content = parseContent(row.content);
  return {
    id: row.id,
    user_id: row.user_id,
    date: row.date,
    created_at: row.created_at,
    mood: row.mood ? Number(row.mood) : null,
    postMarketNotes: content.postMarketNotes
  };
}

async function fetchTradesForDay(supabase: any, dateValue: string) {
  const { start, end } = getDayBounds(dateValue);
  const { data, error } = await supabase
    .from("trades")
    .select("id, symbol, direction, entry_date, exit_date, net_pnl, rr_multiple, setup_name, rating")
    .gte("entry_date", start.toISOString())
    .lt("entry_date", end.toISOString())
    .order("entry_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export const listJournalEntries = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const filters = listJournalEntriesSchema.parse(request.query);
  let query = supabase.from("journal_entries").select("*").order("date", { ascending: false });

  if (filters.from) {
    query = query.gte("date", `${filters.from}T00:00:00.000Z`);
  }

  if (filters.to) {
    query = query.lte("date", `${filters.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  response.json({ journalEntries: (data ?? []).map(normalizeEntry) });
});

export const getJournalCalendar = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const { month } = journalCalendarSchema.parse(request.query);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  const [{ data: entries, error: entriesError }, { data: trades, error: tradesError }] = await Promise.all([
    supabase.from("journal_entries").select("id, date").gte("date", start.toISOString()).lt("date", end.toISOString()),
    supabase.from("trades").select("id, entry_date, net_pnl").gte("entry_date", start.toISOString()).lt("entry_date", end.toISOString())
  ]);

  if (entriesError) {
    throw entriesError;
  }

  if (tradesError) {
    throw tradesError;
  }

  const daysInMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const entryMap = new Map((entries ?? []).map((entry) => [String(entry.date).slice(0, 10), entry.id]));
  const tradeMap = new Map();

  for (const trade of trades ?? []) {
    const key = String(trade.entry_date).slice(0, 10);
    const current = tradeMap.get(key) ?? { pnl: 0, tradeCount: 0 };
    tradeMap.set(key, { pnl: current.pnl + (trade.net_pnl ?? 0), tradeCount: current.tradeCount + 1 });
  }

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), index + 1)).toISOString().slice(0, 10);
    const tradeSummary = tradeMap.get(date) ?? { pnl: 0, tradeCount: 0 };
    return {
      date,
      hasEntry: entryMap.has(date),
      journalEntryId: entryMap.get(date) ?? null,
      tradeCount: tradeSummary.tradeCount,
      pnl: tradeSummary.pnl
    };
  });

  response.json({ month, days });
});

export const getJournalDay = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const { date } = journalDaySchema.parse(request.query);
  const { start, end } = getDayBounds(date);

  const [{ data: entry, error: entryError }, trades] = await Promise.all([
    supabase.from("journal_entries").select("*").gte("date", start.toISOString()).lt("date", end.toISOString()).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    fetchTradesForDay(supabase, date)
  ]);

  if (entryError) {
    throw entryError;
  }

  response.json({
    date,
    journalEntry: entry ? normalizeEntry(entry) : null,
    trades,
    summary: {
      tradeCount: trades.length,
      pnl: trades.reduce((sum: number, trade: { net_pnl: number | null }) => sum + (trade.net_pnl ?? 0), 0)
    }
  });
});

export const createJournalEntry = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);
  const payload = createJournalEntrySchema.parse(request.body);
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      user_id: user.id,
      date: toDayIso(payload.date),
      content: serializeContent(payload.postMarketNotes),
      mood: payload.mood ? String(payload.mood) : null
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  response.status(201).json({ journalEntry: normalizeEntry(data) });
});

export const updateJournalEntry = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const entryId = String(request.params.entryId);
  const payload = updateJournalEntrySchema.parse(request.body);

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "At least one field is required");
  }

  const { data: existing, error: existingError } = await supabase.from("journal_entries").select("*").eq("id", entryId).single();

  if (existingError) {
    throw existingError;
  }

  const current = normalizeEntry(existing);
  const { data, error } = await supabase
    .from("journal_entries")
    .update({
      ...(payload.date ? { date: toDayIso(payload.date) } : {}),
      ...(payload.mood !== undefined ? { mood: payload.mood ? String(payload.mood) : null } : {}),
      ...(payload.postMarketNotes !== undefined
        ? {
            content: serializeContent(payload.postMarketNotes ?? current.postMarketNotes)
          }
        : {})
    })
    .eq("id", entryId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  response.json({ journalEntry: normalizeEntry(data) });
});

export const deleteJournalEntry = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const entryId = String(request.params.entryId);
  const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);

  if (error) {
    throw error;
  }

  response.status(204).send();
});
