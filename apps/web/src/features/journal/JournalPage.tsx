import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Calendar } from "@/components/ui/calendar";
import { classNames, formatCurrency, formatDate } from "@/lib/format";
import { calcHoldTime } from "@/utils/calc";
import { renderMarkdown } from "@/lib/markdown";
import { PremktAnalysis } from "./PremktAnalysis";

const moodOptions = [
  { value: 1, emoji: "??", label: "Rough" },
  { value: 2, emoji: "??", label: "Off-balance" },
  { value: 3, emoji: "??", label: "Neutral" },
  { value: 4, emoji: "??", label: "Focused" },
  { value: 5, emoji: "??", label: "Locked in" }
];

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateFromDayKey(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function JournalPage() {
  const queryClient = useQueryClient();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dayKey(new Date()));
  const [mood, setMood] = useState<number | null>(3);
  const [postMarketNotes, setPostMarketNotes] = useState("");
  const [preview, setPreview] = useState(false);

  const month = monthKey(visibleMonth);
  const calendarQuery = useQuery({ queryKey: ["journal-calendar", month], queryFn: () => api.getJournalCalendar(month) });
  const dayQuery = useQuery({ queryKey: ["journal-day", selectedDate], queryFn: () => api.getJournalDay(selectedDate) });

  useEffect(() => {
    const entry = dayQuery.data?.journalEntry;
    setMood(entry?.mood ?? 3);
    setPostMarketNotes(entry?.postMarketNotes ?? "");
  }, [dayQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { date: `${selectedDate}T00:00:00.000Z`, mood, postMarketNotes };
      const existing = dayQuery.data?.journalEntry;
      if (existing) {
        return api.updateJournalEntry(existing.id, payload);
      }
      return api.createJournalEntry(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["journal-calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["journal-day", selectedDate] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const existing = dayQuery.data?.journalEntry;
      if (!existing) return;
      return api.deleteJournalEntry(existing.id);
    },
    onSuccess: async () => {
      setMood(3);
      setPostMarketNotes("");
      await queryClient.invalidateQueries({ queryKey: ["journal-calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["journal-day", selectedDate] });
    }
  });

  const calendarDays = calendarQuery.data?.days ?? [];
  const selectedCalendarDate = useMemo(() => dateFromDayKey(selectedDate), [selectedDate]);
  const selectedCalendarDay = useMemo(() => calendarDays.find((day) => day.date === selectedDate) ?? null, [calendarDays, selectedDate]);
  const profitableDays = useMemo(() => calendarDays.filter((day) => day.tradeCount > 0 && day.pnl > 0).map((day) => dateFromDayKey(day.date)), [calendarDays]);
  const losingDays = useMemo(() => calendarDays.filter((day) => day.tradeCount > 0 && day.pnl < 0).map((day) => dateFromDayKey(day.date)), [calendarDays]);
  const flatDays = useMemo(() => calendarDays.filter((day) => day.tradeCount > 0 && day.pnl === 0).map((day) => dateFromDayKey(day.date)), [calendarDays]);
  const entryDays = useMemo(() => calendarDays.filter((day) => day.hasEntry).map((day) => dateFromDayKey(day.date)), [calendarDays]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mono text-xs uppercase tracking-[0.35em] text-accent">Daily Journal</p>
          <h2 className="mt-3 text-4xl font-bold">Session-by-session reflection</h2>
          <p className="mt-2 text-sm text-muted">Track the emotional backdrop behind the numbers and review each trading day with context.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
        <section className="card-surface rounded-3xl p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mono text-xs uppercase tracking-[0.3em] text-accent">{month}</p>
                <h3 className="mt-2 text-2xl font-semibold">Trading calendar</h3>
                <p className="mt-2 text-sm text-muted">Minimal month view with journal-entry markers and realized P&amp;L tint.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-[color:var(--dashboard-chip)] px-3 py-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-accent" />Journal entry</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-[color:var(--dashboard-chip)] px-3 py-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-profit" />Profit day</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-[color:var(--dashboard-chip)] px-3 py-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-loss" />Loss day</span>
              </div>
            </div>

            <div className="rounded-[22px] border border-border bg-transparent p-3">
              <Calendar
                mode="single"
                navLayout="around"
                showOutsideDays={false}
                month={visibleMonth}
                onMonthChange={(date) => setVisibleMonth(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)))}
                selected={selectedCalendarDate}
                onSelect={(date) => {
                  if (!date) return;
                  setSelectedDate(dayKey(date));
                }}
                modifiers={{
                  profit: profitableDays,
                  loss: losingDays,
                  flat: flatDays,
                  hasEntry: entryDays,
                  selectedDay: [selectedCalendarDate],
                }}
                modifiersClassNames={{
                  profit: "[&>button]:bg-profit/15 [&>button]:text-profit hover:[&>button]:bg-profit/20 [&>button[data-selected-single=true]]:bg-profit/15 [&>button[data-selected-single=true]]:text-profit",
                  loss: "[&>button]:bg-loss/15 [&>button]:text-loss hover:[&>button]:bg-loss/20 [&>button[data-selected-single=true]]:bg-loss/15 [&>button[data-selected-single=true]]:text-loss",
                  flat: "[&>button]:bg-[color:var(--dashboard-chip)] [&>button]:text-primary [&>button[data-selected-single=true]]:bg-[color:var(--dashboard-chip)] [&>button[data-selected-single=true]]:text-primary",
                  hasEntry: "[&>button]:after:absolute [&>button]:after:bottom-2 [&>button]:after:left-1/2 [&>button]:after:h-1.5 [&>button]:after:w-1.5 [&>button]:after:-translate-x-1/2 [&>button]:after:rounded-full [&>button]:after:bg-accent",
                  selectedDay: "[&>button]:ring-2 [&>button]:ring-accent [&>button]:ring-offset-2 [&>button]:ring-offset-background",
                }}
                className="w-full bg-transparent p-0"
                classNames={{
                  root: "w-full bg-transparent p-0",
                  months: "w-full",
                  month: "relative w-full",
                  month_caption: "relative z-0 mb-3 flex min-h-10 items-center justify-center px-12 pointer-events-none",
                  caption_label: "text-sm font-medium text-primary",
                  nav: "absolute inset-x-0 top-0 flex items-center justify-between",
                  button_previous: "absolute left-0 top-0 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-transparent p-0 text-primary hover:bg-[color:var(--dashboard-chip)]",
                  button_next: "absolute right-0 top-0 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-transparent p-0 text-primary hover:bg-[color:var(--dashboard-chip)]",
                  weekdays: "mb-2 grid grid-cols-7 gap-2",
                  weekday: "text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
                  week: "mt-2 grid grid-cols-7 gap-2",
                  day: "aspect-square",
                  day_button: "h-12 w-full rounded-2xl border border-transparent bg-transparent text-sm font-medium transition data-[selected-single=true]:bg-transparent data-[selected-single=true]:text-inherit",
                  today: "[&>button]:ring-1 [&>button]:ring-accent/40",
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-4 py-3">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted">{formatDate(`${selectedDate}T00:00:00.000Z`, { day: "2-digit", month: "long", year: "numeric" })}</span>
              <span className={classNames(
                "mono text-sm font-semibold",
                selectedCalendarDay && selectedCalendarDay.tradeCount > 0
                  ? selectedCalendarDay.pnl >= 0
                    ? "text-profit"
                    : "text-loss"
                  : "text-primary"
              )}>
                {selectedCalendarDay && selectedCalendarDay.tradeCount > 0 ? formatCurrency(selectedCalendarDay.pnl) : "No trades"}
              </span>
              <span className="text-sm text-muted">{selectedCalendarDay?.hasEntry ? "Journal entry saved" : "No journal entry yet"}</span>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="card-surface rounded-3xl p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="mono text-xs uppercase tracking-[0.3em] text-accent">{selectedDate}</p>
                <h3 className="mt-2 text-2xl font-semibold">{formatDate(`${selectedDate}T00:00:00.000Z`, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</h3>
                <p className="mt-2 text-sm text-muted">{dayQuery.data?.summary.tradeCount ?? 0} trades � {formatCurrency(dayQuery.data?.summary.pnl ?? 0)}</p>
              </div>
              <button type="button" onClick={() => setPreview((current) => !current)} className="rounded-2xl border border-border px-4 py-3 text-sm text-muted">
                {preview ? "Edit mode" : "Preview mode"}
              </button>
            </div>

            <div className="mt-6">
              <PremktAnalysis date={selectedDate} />
            </div>

            <div className="mt-6">
              <p className="text-sm text-muted">Mood</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {moodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMood(option.value)}
                    className={classNames("rounded-2xl border px-4 py-3 text-left transition", mood === option.value ? "border-accent bg-accent/10 text-primary" : "border-border bg-surface text-muted")}
                  >
                    <span className="block text-2xl">{option.emoji}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.2em]">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {!preview ? (
              <div className="mt-6">
                <label className="block text-sm text-muted">
                  <span className="mb-2 block">Post-market notes</span>
                  <textarea rows={10} value={postMarketNotes} onChange={(event) => setPostMarketNotes(event.target.value)} className="field" />
                </label>
              </div>
            ) : (
              <div className="mt-6">
                <PreviewPanel title="Post-market" content={postMarketNotes} />
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => saveMutation.mutate()} className="mono rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-[var(--accent-contrast)]">{saveMutation.isPending ? "Saving..." : "Save entry"}</button>
              <button type="button" onClick={() => deleteMutation.mutate()} disabled={!dayQuery.data?.journalEntry || deleteMutation.isPending} className="rounded-2xl border border-loss/40 px-5 py-3 text-sm text-loss disabled:opacity-40">Delete entry</button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-semibold">That day&apos;s trades</h4>
                <p className="text-sm text-muted">Read-only execution snapshot for the selected date.</p>
              </div>
              <div className="mono text-sm text-muted">{dayQuery.data?.trades.length ?? 0} trades</div>
            </div>

            <div className="mt-4 space-y-3">
              {(dayQuery.data?.trades ?? []).map((trade) => (
                <div key={trade.id} className="rounded-2xl border border-border bg-base px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="mono text-lg text-primary">{trade.symbol}</p>
                      <p className="text-sm text-muted">{trade.setup_name ?? "No setup"} � {calcHoldTime(trade.entry_date, trade.exit_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={classNames("rounded-full px-3 py-1 text-xs", trade.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>{trade.direction}</span>
                      <span className={classNames("mono text-sm", (trade.net_pnl ?? 0) >= 0 ? "text-profit" : "text-loss")}>{formatCurrency(trade.net_pnl)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {(dayQuery.data?.trades ?? []).length === 0 && <p className="text-sm text-muted">No trades logged on this day.</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PreviewPanel({ title, content }: { title: string; content: string }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-muted">{title}</p>
      <div className="markdown-content mt-3 max-w-none text-sm text-primary" dangerouslySetInnerHTML={{ __html: renderMarkdown(content || "No notes yet.") }} />
    </section>
  );
}
