import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
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

function buildCalendarGrid(month: string, days: Array<{ date: string; hasEntry: boolean; journalEntryId: string | null; tradeCount: number; pnl: number }>) {
  const base = new Date(`${month}-01T00:00:00.000Z`);
  const firstDayOffset = (base.getUTCDay() + 6) % 7;
  const cells: Array<{ type: "blank" } | ({ type: "day" } & (typeof days)[number])> = [];

  for (let index = 0; index < firstDayOffset; index += 1) {
    cells.push({ type: "blank" });
  }

  days.forEach((day) => cells.push({ type: "day", ...day }));
  return cells;
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

  const calendarCells = useMemo(() => buildCalendarGrid(month, calendarQuery.data?.days ?? []), [calendarQuery.data?.days, month]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mono text-xs uppercase tracking-[0.35em] text-accent">Daily Journal</p>
          <h2 className="mt-3 text-4xl font-bold">Session-by-session reflection</h2>
          <p className="mt-2 text-sm text-muted">Track the emotional backdrop behind the numbers and review each trading day with context.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)))} className="rounded-2xl border border-border px-4 py-3 text-sm text-muted">Prev month</button>
          <button type="button" onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1)))} className="rounded-2xl border border-border px-4 py-3 text-sm text-muted">Next month</button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
        <section className="card-surface rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mono text-xs uppercase tracking-[0.3em] text-accent">{month}</p>
              <h3 className="mt-2 text-2xl font-semibold">Trading calendar</h3>
            </div>
            <div className="text-sm text-muted">Dots show activity. Tint shows the day&apos;s P&amp;L.</div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.25em] text-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => <div key={label}>{label}</div>)}
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarCells.map((cell, index) => {
              if (cell.type === "blank") {
                return <div key={`blank-${index}`} className="h-24 rounded-2xl border border-transparent" />;
              }

              const intensity = Math.min(0.85, 0.14 + Math.abs(cell.pnl) / 6000);
              const isSelected = selectedDate === cell.date;
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDate(cell.date)}
                  className={classNames("relative h-24 rounded-2xl border p-3 text-left transition", isSelected ? "border-accent shadow-glow" : "border-border hover:border-accent/40")}
                  style={{ backgroundColor: cell.tradeCount === 0 ? "var(--bg-surface)" : cell.pnl >= 0 ? `rgba(34,197,94,${intensity})` : `rgba(239,68,68,${intensity})` }}
                >
                  <p className="mono text-sm text-primary">{cell.date.slice(-2)}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cell.hasEntry && <span className="h-2 w-2 rounded-full bg-accent" />}
                    {cell.tradeCount > 0 && <span className={classNames("h-2 w-2 rounded-full", cell.pnl >= 0 ? "bg-profit" : "bg-loss")} />}
                  </div>
                  {cell.tradeCount > 0 && <p className="mono absolute bottom-3 left-3 text-xs text-primary">{formatCurrency(cell.pnl)}</p>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <div className="card-surface rounded-3xl p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="mono text-xs uppercase tracking-[0.3em] text-accent">{selectedDate}</p>
                <h3 className="mt-2 text-2xl font-semibold">{formatDate(`${selectedDate}T00:00:00.000Z`, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</h3>
                <p className="mt-2 text-sm text-muted">{dayQuery.data?.summary.tradeCount ?? 0} trades • {formatCurrency(dayQuery.data?.summary.pnl ?? 0)}</p>
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
                      <p className="text-sm text-muted">{trade.setup_name ?? "No setup"} • {calcHoldTime(trade.entry_date, trade.exit_date)}</p>
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
