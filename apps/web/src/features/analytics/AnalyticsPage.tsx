import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/services/api";
import { useAnalyticsFiltersStore } from "@/store/filters";
import { classNames, formatCurrency, formatPercent } from "@/lib/format";

const assetClasses = ["stock", "forex", "futures", "options", "crypto", "cfd", "index"];

function toParams(filters: ReturnType<typeof useAnalyticsFiltersStore.getState>) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.symbol) params.set("symbol", filters.symbol);
  if (filters.direction) params.set("direction", filters.direction);
  filters.assetClass.forEach((value) => params.append("assetClass", value));
  return params;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={classNames("dashboard-panel", className)}>{children}</section>;
}

function SectionHeading({ eyebrow, title, note }: { eyebrow: string; title: string; note?: string }) {
  return (
    <div>
      <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">{eyebrow}</p>
      <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">{title}</h3>
      {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
    </div>
  );
}

function InsightCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "profit" | "loss" }) {
  return (
    <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={classNames("mono mt-3 text-2xl font-semibold tracking-[-0.05em]", tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-primary")}>{value}</p>
    </div>
  );
}

function ChartShell({ title, note, children, className = "" }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <Panel className={classNames("p-5 md:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <SectionHeading eyebrow="Analytics" title={title} note={note} />
      </div>
      <div className="mt-6 h-80">{children}</div>
    </Panel>
  );
}

function chartTooltipStyle() {
  return {
    background: "var(--dashboard-tooltip)",
    border: "1px solid var(--border)",
    borderRadius: "18px",
    color: "var(--text-primary)",
    boxShadow: "var(--shadow-glow)"
  } as const;
}

export function AnalyticsPage() {
  const filters = useAnalyticsFiltersStore();
  const params = useMemo(() => toParams(filters), [filters.from, filters.to, filters.symbol, filters.direction, filters.assetClass.join(",")]);
  const summaryQuery = useQuery({ queryKey: ["analytics-summary", params.toString()], queryFn: () => api.getAnalyticsSummary(params) });
  const byDayQuery = useQuery({ queryKey: ["analytics-day", params.toString()], queryFn: () => api.getAnalyticsByDay(params) });
  const drawdownQuery = useQuery({ queryKey: ["analytics-drawdown", params.toString()], queryFn: () => api.getAnalyticsDrawdown(params) });
  const rollingQuery = useQuery({ queryKey: ["analytics-rolling", params.toString()], queryFn: () => api.getAnalyticsRolling(new URLSearchParams([...params.entries(), ["windowSize", "20"]])) });
  const durationQuery = useQuery({ queryKey: ["analytics-duration", params.toString()], queryFn: () => api.getAnalyticsDuration(params) });

  const loading = summaryQuery.isLoading || byDayQuery.isLoading || drawdownQuery.isLoading || rollingQuery.isLoading || durationQuery.isLoading;
  const activeFilterCount = Number(Boolean(filters.from)) + Number(Boolean(filters.to)) + Number(Boolean(filters.symbol)) + Number(Boolean(filters.direction)) + filters.assetClass.length;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mono text-xs uppercase tracking-[0.35em] text-accent">Analytics</p>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.05em] text-primary md:text-5xl">Pattern detection lab</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted md:text-base">A quieter analytics workspace for finding what actually moves your edge.</p>
        </div>
        <Panel className="p-4 lg:min-w-[320px]">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Filter state</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <InsightCard label="Active filters" value={String(activeFilterCount)} />
            <InsightCard label="Avg win" value={formatCurrency(summaryQuery.data?.avgWin ?? 0)} tone="profit" />
            <InsightCard label="Avg loss" value={formatCurrency(-(summaryQuery.data?.avgLoss ?? 0))} tone="loss" />
          </div>
        </Panel>
      </div>

      <Panel className="sticky top-4 z-20 p-4 md:p-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading eyebrow="Filters" title="Global view controls" note="Every chart below responds to these filters in real time." />
            <button type="button" onClick={() => filters.reset()} className="inline-flex w-fit items-center rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-4 py-3 text-sm text-muted transition hover:border-accent hover:text-primary">
              Reset filters
            </button>
          </div>

          <div className="grid gap-3 xl:grid-cols-4">
            <input type="date" value={filters.from} onChange={(event) => filters.setField("from", event.target.value)} className="field" />
            <input type="date" value={filters.to} onChange={(event) => filters.setField("to", event.target.value)} className="field" />
            <input value={filters.symbol} onChange={(event) => filters.setField("symbol", event.target.value)} placeholder="Search symbol" className="field" />
            <select value={filters.direction} onChange={(event) => filters.setField("direction", event.target.value)} className="field">
              <option value="">All directions</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {assetClasses.map((item) => {
              const selected = filters.assetClass.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => filters.toggleAssetClass(item)}
                  className={classNames(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    selected ? "border-accent bg-accent/10 text-accent" : "border-border bg-[color:var(--dashboard-chip)] text-muted hover:border-accent/40 hover:text-primary"
                  )}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      {loading ? (
        <Panel className="p-8 text-sm text-muted">Loading analytics...</Panel>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartShell title="P&L by day of week" note="Which weekdays tend to deliver or drain the most."><BarChartBox data={byDayQuery.data ?? []} xKey="day" barKey="pnl" /></ChartShell>
            <ChartShell title="Drawdown" note="Running percentage decline from prior equity peaks."><DrawdownChart data={drawdownQuery.data ?? []} /></ChartShell>
            <ChartShell title="Rolling 20-trade win rate" note="Short-term execution drift across the last 20 trades."><RollingChart data={rollingQuery.data ?? []} /></ChartShell>
            <ChartShell title="Hold duration vs P&L" note="Whether longer holds improve or damage trade outcomes."><DurationScatter data={durationQuery.data ?? []} /></ChartShell>
          </div>

          <ChartShell title="Avg win vs avg loss" note="A compact comparison of your typical positive and negative outcomes.">
            <BarChartBox
              data={[
                { label: "Avg Win", value: summaryQuery.data?.avgWin ?? 0 },
                { label: "Avg Loss", value: -(summaryQuery.data?.avgLoss ?? 0) }
              ]}
              xKey="label"
              barKey="value"
            />
          </ChartShell>
        </>
      )}
    </div>
  );
}

function BarChartBox({ data, xKey, barKey }: { data: Array<Record<string, string | number>>; xKey: string; barKey: string }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--dashboard-grid)" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey={xKey} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
        <YAxis stroke="var(--text-muted)" tickFormatter={(value) => formatCurrency(Number(value))} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-primary)" }} itemStyle={{ color: "var(--text-primary)" }} formatter={(value: number) => formatCurrency(value)} />
        <Bar dataKey={barKey} radius={[10, 10, 0, 0]}>
          {data.map((item, index) => <Cell key={index} fill={Number(item[barKey]) >= 0 ? "var(--profit)" : "var(--loss)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DrawdownChart({ data }: { data: Array<{ date: string; drawdownPct: number }> }) {
  return (
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--dashboard-grid)" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="date" stroke="var(--text-muted)" tickLine={false} axisLine={false} />
        <YAxis stroke="var(--text-muted)" tickFormatter={(value) => formatPercent(Number(value))} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-primary)" }} itemStyle={{ color: "var(--text-primary)" }} formatter={(value: number) => formatPercent(value)} />
        <Area dataKey="drawdownPct" stroke="var(--loss)" fill="var(--loss)" fillOpacity={0.18} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RollingChart({ data }: { data: Array<{ date: string; winRate: number }> }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--dashboard-grid)" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="date" stroke="var(--text-muted)" tickLine={false} axisLine={false} />
        <YAxis stroke="var(--text-muted)" tickFormatter={(value) => formatPercent(Number(value))} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-primary)" }} itemStyle={{ color: "var(--text-primary)" }} formatter={(value: number) => formatPercent(value)} />
        <Line dataKey="winRate" stroke="var(--accent)" dot={false} strokeWidth={2.5} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DurationScatter({ data }: { data: Array<{ holdMinutes: number; pnlDollar: number; direction: string }> }) {
  return (
    <ResponsiveContainer>
      <ScatterChart margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--dashboard-grid)" strokeDasharray="3 6" />
        <XAxis type="number" dataKey="holdMinutes" name="Hold minutes" stroke="var(--text-muted)" tickLine={false} axisLine={false} />
        <YAxis type="number" dataKey="pnlDollar" name="P&L" stroke="var(--text-muted)" tickFormatter={(value) => formatCurrency(Number(value))} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={chartTooltipStyle()} labelStyle={{ color: "var(--text-primary)" }} itemStyle={{ color: "var(--text-primary)" }} cursor={{ strokeDasharray: "3 3" }} formatter={(value: number, name) => name === "pnlDollar" ? formatCurrency(value) : value} />
        <Scatter data={data}>
          {data.map((entry, index) => <Cell key={index} fill={entry.pnlDollar >= 0 ? "var(--profit)" : "var(--loss)"} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

