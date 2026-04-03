import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { CalendarDays, ChevronDown } from "lucide-react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAnalyticsFiltersStore } from "@/store/filters";
import { classNames, formatCurrency, formatDate, formatPercent } from "@/lib/format";

const pnlChartConfig = {
  pnl: { label: "P&L", color: "var(--accent)" },
  cumulativePnl: { label: "Cumulative P&L", color: "var(--accent)" },
  drawdownPct: { label: "Drawdown", color: "var(--loss)" },
  winRate: { label: "Win rate", color: "var(--accent)" },
  pnlDollar: { label: "P&L", color: "var(--accent)" },
} satisfies ChartConfig;

function toParams(filters: ReturnType<typeof useAnalyticsFiltersStore.getState>) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.direction) params.set("direction", filters.direction);
  return params;
}

function parseFilterDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toFilterDate(date: Date | undefined) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFilterDate(value: string) {
  if (!value) return "Select date";
  return formatDate(value, { day: "2-digit", month: "short", year: "numeric" });
}

function Panel({ children, className = "", ...props }: React.ComponentProps<"section">) {
  return <section className={classNames("dashboard-panel", className)} {...props}>{children}</section>;
}

function SectionHeading({ eyebrow, title, note }: { eyebrow: string; title: string; note?: string }) {
  return (
    <div>
      <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">{eyebrow}</p>
      <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">{title}</h3>
      {note ? <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{note}</p> : null}
    </div>
  );
}

function InsightCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "profit" | "loss" }) {
  return (
    <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-3 py-3.5">
      <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className={classNames("mono mt-2 text-xl font-semibold tracking-[-0.04em]", tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-primary")}>{value}</p>
    </div>
  );
}

function ChartShell({ title, note, children, className = "" }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <Panel className={classNames("p-4 md:p-4.5", className)}>
      <div className="flex items-start justify-between gap-4">
        <SectionHeading eyebrow="Analytics" title={title} note={note} />
      </div>
      <div className="mt-4 h-60">{children}</div>
    </Panel>
  );
}

function DateFilterField({
  label,
  value,
  open,
  onOpenChange,
  onChange,
}: {
  label: string;
  value: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(!open)}
        className="h-12 w-full justify-between rounded-2xl border-border bg-surface px-4 text-primary hover:bg-[color:var(--dashboard-chip)]"
      >
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          <span className="text-primary" style={!value ? { color: "var(--text-muted)" } : undefined}>{formatFilterDate(value)}</span>
        </span>
        <ChevronDown className={classNames("h-4 w-4 transition-transform", open ? "rotate-180" : "rotate-0")} />
      </Button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 rounded-[22px] border border-border bg-[color:var(--dashboard-tooltip)] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{label}</p>
            {value ? (
              <button type="button" onClick={() => { onChange(""); onOpenChange(false); }} className="text-xs text-accent">
                Clear
              </button>
            ) : null}
          </div>
          <Calendar
            mode="single"
            selected={parseFilterDate(value)}
            onSelect={(date) => {
              onChange(toFilterDate(date));
              onOpenChange(false);
            }}
            className="rounded-lg bg-transparent p-0"
            classNames={{
              root: "bg-transparent p-0",
              month: "w-full",
              month_caption: "flex h-10 items-center justify-center px-10",
              caption_label: "text-sm font-medium text-primary",
              nav: "absolute inset-x-0 top-0 flex items-center justify-between px-1",
              button_previous: "h-8 w-8 rounded-xl border border-border bg-transparent p-0 text-primary hover:bg-[color:var(--dashboard-chip)]",
              button_next: "h-8 w-8 rounded-xl border border-border bg-transparent p-0 text-primary hover:bg-[color:var(--dashboard-chip)]",
              weekday: "text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
              day_button: "h-10 w-10 rounded-2xl border border-transparent bg-transparent text-sm font-medium transition data-[selected-single=true]:bg-[color:var(--dashboard-chip)] data-[selected-single=true]:text-primary",
              today: "[&>button]:ring-1 [&>button]:ring-accent/40",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function AnalyticsPage() {
  const filters = useAnalyticsFiltersStore();
  const [openDateField, setOpenDateField] = useState<"from" | "to" | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = useMemo(() => toParams(filters), [filters.from, filters.to, filters.direction]);
  const summaryQuery = useQuery({ queryKey: ["analytics-summary", params.toString()], queryFn: () => api.getAnalyticsSummary(params) });
  const byDayQuery = useQuery({ queryKey: ["analytics-day", params.toString()], queryFn: () => api.getAnalyticsByDay(params) });
  const drawdownQuery = useQuery({ queryKey: ["analytics-drawdown", params.toString()], queryFn: () => api.getAnalyticsDrawdown(params) });
  const rollingQuery = useQuery({ queryKey: ["analytics-rolling", params.toString()], queryFn: () => api.getAnalyticsRolling(new URLSearchParams([...params.entries(), ["windowSize", "20"]])) });
  const durationQuery = useQuery({ queryKey: ["analytics-duration", params.toString()], queryFn: () => api.getAnalyticsDuration(params) });

  const loading = summaryQuery.isLoading || byDayQuery.isLoading || drawdownQuery.isLoading || rollingQuery.isLoading || durationQuery.isLoading;
  const activeFilterCount = Number(Boolean(filters.from)) + Number(Boolean(filters.to)) + Number(Boolean(filters.direction));

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mono text-xs uppercase tracking-[0.35em] text-accent">Analytics</p>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.05em] text-primary md:text-5xl">Pattern detection lab</h2>
          <p className="mt-3 max-w-2xl text-sm md:text-base" style={{ color: "var(--text-muted)" }}>A quieter analytics workspace for finding what actually moves your edge.</p>
        </div>
        <Panel className="p-4 lg:min-w-[320px]">
          <p className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Filter state</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <InsightCard label="Active filters" value={String(activeFilterCount)} />
            <InsightCard label="Avg win" value={formatCurrency(summaryQuery.data?.avgWin ?? 0)} tone="profit" />
            <InsightCard label="Avg loss" value={formatCurrency(-(summaryQuery.data?.avgLoss ?? 0))} tone="loss" />
          </div>
        </Panel>
      </div>

      <Panel className="sticky top-4 z-20 p-3 md:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="mono text-[11px] uppercase tracking-[0.28em] text-accent/80">Filters</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-base font-semibold text-primary">Global view controls</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Every chart below responds in real time.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setOpenDateField(null);
                  setFiltersOpen((current) => !current);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface text-primary transition hover:bg-[color:var(--dashboard-chip)]"
                aria-expanded={filtersOpen}
                aria-controls="analytics-filters-panel"
                aria-label={filtersOpen ? "Collapse filters" : "Expand filters"}
              >
                <ChevronDown className={classNames("h-4 w-4 transition-transform", filtersOpen ? "rotate-180" : "rotate-0")} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenDateField(null);
                  filters.reset();
                }}
                className="inline-flex h-10 items-center rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-4 text-sm text-primary transition hover:border-accent hover:bg-[color:var(--dashboard-subtle)]"
              >
                Reset filters
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <div id="analytics-filters-panel" className="grid gap-3 xl:grid-cols-[1fr_1fr_220px]">
              <DateFilterField
                label="From"
                value={filters.from}
                open={openDateField === "from"}
                onOpenChange={(open) => setOpenDateField(open ? "from" : null)}
                onChange={(value) => filters.setField("from", value)}
              />
              <DateFilterField
                label="To"
                value={filters.to}
                open={openDateField === "to"}
                onOpenChange={(open) => setOpenDateField(open ? "to" : null)}
                onChange={(value) => filters.setField("to", value)}
              />
              <Select value={filters.direction || "all"} onValueChange={(value) => filters.setField("direction", value === "all" ? "" : value)}>
                <SelectTrigger className="h-12 rounded-2xl border-border bg-surface px-4 text-primary">
                  <SelectValue placeholder="All directions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All directions</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </Panel>

      {loading ? (
        <Panel className="p-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading analytics...</Panel>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartShell title="P&L by day of week" note="Which weekdays tend to deliver or drain the most."><BarChartBox data={byDayQuery.data ?? []} xKey="day" barKey="pnl" /></ChartShell>
            <ChartShell title="Drawdown" note="Running percentage decline from prior equity peaks."><DrawdownChart data={drawdownQuery.data ?? []} /></ChartShell>
            <ChartShell title="Rolling 20-trade win rate" note="Short-term execution drift across the last 20 trades."><RollingChart data={rollingQuery.data ?? []} /></ChartShell>
            <ChartShell title="Hold duration vs P&L" note="Whether longer holds improve or damage trade outcomes."><DurationScatter data={durationQuery.data ?? []} /></ChartShell>
          </div>

          <ChartShell title="Cumulative P&L trend" note="Track how the filtered trade set compounds over time.">
            <CumulativeTrendChart data={summaryQuery.data?.equityCurve ?? []} />
          </ChartShell>
        </>
      )}
    </div>
  );
}

function BarChartBox({ data, xKey, barKey }: { data: Array<Record<string, string | number>>; xKey: string; barKey: string }) {
  return (
    <ChartContainer config={pnlChartConfig}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="42%">
        <CartesianGrid stroke="var(--dashboard-grid)" vertical={false} strokeDasharray="2 6" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tickLine={false} axisLine={false} tickMargin={8} width={96} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
        <Bar dataKey={barKey} radius={[6, 6, 0, 0]} maxBarSize={22}>
          {data.map((item, index) => <Cell key={index} fill={Number(item[barKey]) >= 0 ? "var(--profit)" : "var(--loss)"} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function DrawdownChart({ data }: { data: Array<{ date: string; drawdownPct: number }> }) {
  return (
    <ChartContainer config={pnlChartConfig}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--dashboard-grid)" vertical={false} strokeDasharray="2 6" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <YAxis tickFormatter={(value) => formatPercent(Number(value))} tickLine={false} axisLine={false} tickMargin={8} width={78} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatPercent(Number(value))} />} />
        <Area dataKey="drawdownPct" stroke="var(--loss)" fill="var(--loss)" fillOpacity={0.12} strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}

function RollingChart({ data }: { data: Array<{ date: string; winRate: number }> }) {
  return (
    <ChartContainer config={pnlChartConfig}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--dashboard-grid)" vertical={false} strokeDasharray="2 6" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <YAxis tickFormatter={(value) => formatPercent(Number(value))} tickLine={false} axisLine={false} tickMargin={8} width={78} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatPercent(Number(value))} />} />
        <Line dataKey="winRate" stroke="var(--accent)" dot={false} strokeWidth={2} />
      </LineChart>
    </ChartContainer>
  );
}

function DurationScatter({ data }: { data: Array<{ holdMinutes: number; pnlDollar: number; direction: string }> }) {
  return (
    <ChartContainer config={pnlChartConfig}>
      <ScatterChart margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--dashboard-grid)" strokeDasharray="2 6" />
        <XAxis type="number" dataKey="holdMinutes" name="Hold minutes" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <YAxis type="number" dataKey="pnlDollar" name="P&L" tickFormatter={(value) => formatCurrency(Number(value))} tickLine={false} axisLine={false} tickMargin={8} width={96} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => name === "pnlDollar" ? formatCurrency(Number(value)) : String(value)} />} cursor={{ strokeDasharray: "2 6" }} />
        <Scatter data={data} fill="var(--accent)">
          {data.map((entry, index) => <Cell key={index} fill={entry.pnlDollar >= 0 ? "var(--profit)" : "var(--loss)"} />)}
        </Scatter>
      </ScatterChart>
    </ChartContainer>
  );
}

function CumulativeTrendChart({ data }: { data: Array<{ date: string; cumulativePnl: number }> }) {
  return (
    <ChartContainer config={pnlChartConfig}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--dashboard-grid)" vertical={false} strokeDasharray="2 6" />
        <XAxis dataKey="date" tickFormatter={(value) => formatDate(String(value), { day: "2-digit", month: "short" })} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tickLine={false} axisLine={false} tickMargin={8} width={96} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => formatDate(String(label))} formatter={(value) => formatCurrency(Number(value))} />} />
        <Area dataKey="cumulativePnl" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.12} strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}





