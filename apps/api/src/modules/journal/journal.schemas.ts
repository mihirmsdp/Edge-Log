import { z } from "zod";

const isoDate = z.string().trim().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");
const monthValue = z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format");
const dayValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const listJournalEntriesSchema = z.object({
  from: dayValue.optional(),
  to: dayValue.optional()
});

export const journalCalendarSchema = z.object({
  month: monthValue
});

export const journalDaySchema = z.object({
  date: dayValue
});

export const createJournalEntrySchema = z.object({
  date: isoDate,
  mood: z.coerce.number().int().min(1).max(5).nullable().optional(),
  postMarketNotes: z.string().max(12000).default("")
});

export const updateJournalEntrySchema = createJournalEntrySchema.partial();
