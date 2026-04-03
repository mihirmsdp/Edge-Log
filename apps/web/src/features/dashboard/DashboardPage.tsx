import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { formatCurrency, formatDate, classNames } from "@/lib/format";
import { calcHoldTime } from "@/utils/calc";

function ArrowIcon({ positive }: { positive: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {positive ? <path d="M4 12l4-4 3 3 5-5" /> : <path d="M4 8l4 4 3-3 5 5" />}
      {positive ? <path d="M13 6h3v3" /> : <path d="M13 14h3v-3" />}
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.1 8.1-3.564.736.736-3.564 8.1-8.1z" />
    </svg>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <Card className={classNames("dashboard-panel border-0 bg-transparent py-0 text-primary shadow-none", className)}>{children}</Card>;
}

function TrendBadge({ change, suffix = "%" }: { change: number; suffix?: string }) {
  const positive = change >= 0;
  return (
    <Badge variant="secondary" className={classNames("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium", positive ? "bg-profit/10 text-profit hover:bg-profit/10" : "bg-loss/10 text-loss hover:bg-loss/10")}>
      <ArrowIcon positive={positive} />
      <span className="mono">{Math.abs(change).toFixed(2)}{suffix}</span>
    </Badge>
  );
}

function SecondaryMetricCard({ label, value, change, helper, valueClassName = "text-primary" }: { label: string; value: string; change?: number; helper: string; valueClassName?: string }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p>
          <p className={classNames("mono mt-3 text-2xl font-semibold tracking-[-0.04em]", valueClassName)}>{value}</p>
        </div>
        {typeof change === "number" ? <TrendBadge change={change} /> : null}
      </div>
      <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>{helper}</p>
    </Panel>
  );
}

function WinRateRing({ value }: { value: number }) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safeValue / 100);

  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={radius} stroke="var(--dashboard-ring-track)" strokeWidth="10" fill="none" />
        <circle cx="70" cy="70" r={radius} stroke="var(--profit)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="mono text-4xl font-semibold tracking-[-0.06em] text-primary">{safeValue.toFixed(0)}</span>
        <span className="mono -mt-1 text-sm" style={{ color: "var(--text-muted)" }}>percent</span>
      </div>
    </div>
  );
}

function SpotlightCard({ title, eyebrow, children, className = "" }: { title: string; eyebrow: string; children: React.ReactNode; className?: string }) {
  return (
    <Panel className={classNames("dashboard-spotlight overflow-hidden p-6 md:p-7", className)}>
      <div className="dashboard-noise pointer-events-none absolute inset-0" />
      <div className="relative">
        <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">{eyebrow}</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary md:text-[2rem]">{title}</h3>
        {children}
      </div>
    </Panel>
  );
}

function SectorHeatTile({
  sector,
  changePercent,
  advancing,
  declining,
  total,
  leaders
}: {
  sector: string;
  changePercent: number;
  advancing: number;
  declining: number;
  total: number;
  leaders: string[];
}) {
  const positive = changePercent >= 0;
  const intensity = Math.min(1, Math.abs(changePercent) / 2.5);
  const background = positive ? `rgba(34,197,94,${0.12 + intensity * 0.2})` : `rgba(239,68,68,${0.12 + intensity * 0.2})`;
  const borderColor = positive ? `rgba(34,197,94,${0.25 + intensity * 0.35})` : `rgba(239,68,68,${0.25 + intensity * 0.35})`;

  return (
    <div className="rounded-[24px] border p-4 transition hover:-translate-y-0.5" style={{ backgroundColor: background, borderColor }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">{sector}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{advancing} up / {declining} down / {total} names</p>
        </div>
        <div className={classNames("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", positive ? "bg-profit/12 text-profit" : "bg-loss/12 text-loss")}>
          <ArrowIcon positive={positive} />
          <span className="mono">{Math.abs(changePercent).toFixed(2)}%</span>
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Leaders</p>
          <p className="mono mt-2 text-sm text-primary">{leaders.join(" / ")}</p>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: Math.min(total, 6) }).map((_, index) => {
            const active = index < advancing;
            const down = !active && index < advancing + declining;
            return (
              <span
                key={`${sector}-${index}`}
                className={classNames(
                  "h-8 w-2 rounded-full",
                  active ? "bg-profit" : down ? "bg-loss" : "bg-border"
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function calendarDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarLabel(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: api.getAccounts });
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [capitalInput, setCapitalInput] = useState("");
  const [isEditingCapital, setIsEditingCapital] = useState(false);
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", startingBalance: "", currency: "INR" });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>();
  const [visibleMonth, setVisibleMonth] = useState<Date | undefined>();

  useEffect(() => {
    const firstAccountId = accountsQuery.data?.accounts?.[0]?.id;
    if (!selectedAccountId && firstAccountId) {
      setSelectedAccountId(firstAccountId);
    }
  }, [accountsQuery.data?.accounts, selectedAccountId]);

  const selectedAccount = accountsQuery.data?.accounts?.find((account) => account.id === selectedAccountId) ?? accountsQuery.data?.accounts?.[0] ?? null;

  const summaryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedAccount?.id) {
      params.set("accountId", selectedAccount.id);
    }
    return params;
  }, [selectedAccount?.id]);

  const summaryQuery = useQuery({
    queryKey: ["analytics-summary", "dashboard", summaryParams.toString()],
    queryFn: () => api.getAnalyticsSummary(summaryParams)
  });


  const summary = summaryQuery.data;

  useEffect(() => {
    if (selectedAccount) {
      setCapitalInput(String(selectedAccount.starting_balance ?? 0));
      setIsEditingCapital(false);
    }
  }, [selectedAccount?.id, selectedAccount?.starting_balance]);

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      const name = newAccount.name.trim();
      const startingBalance = Number(newAccount.startingBalance);
      const currency = newAccount.currency.trim().toUpperCase();

      if (!name || name.length < 2) {
        throw new Error("Enter an account name with at least 2 characters.");
      }

      if (!Number.isFinite(startingBalance) || startingBalance < 0) {
        throw new Error("Enter a valid non-negative starting capital.");
      }

      if (currency.length !== 3) {
        throw new Error("Currency must be a 3-letter code like INR.");
      }

      return api.createAccount({ name, startingBalance, currency });
    },
    onSuccess: async (result) => {
      setNewAccount({ name: "", startingBalance: "", currency: result.account.currency });
      setSelectedAccountId(result.account.id);
      setShowNewAccountForm(false);
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
  });

  const updateCapitalMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccount) {
        throw new Error("Create an account first to set starting capital.");
      }

      const startingBalance = Number(capitalInput);
      if (!Number.isFinite(startingBalance) || startingBalance < 0) {
        throw new Error("Enter a valid non-negative starting capital.");
      }

      return api.updateAccount(selectedAccount.id, { startingBalance });
    },
    onSuccess: async () => {
      setIsEditingCapital(false);
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
  });

  const calendarEntries = useMemo(() => {
    if (!summary) return [] as Array<{ date: string; pnl: number; day: Date }>;
    return Object.entries(summary.calendarHeatmap)
      .map(([date, pnl]) => ({ date, pnl, day: parseCalendarDate(date) }))
      .sort((left, right) => left.day.getTime() - right.day.getTime());
  }, [summary]);

  const calendarPnlMap = useMemo(() => {
    return new Map(calendarEntries.map((entry) => [entry.date, entry.pnl]));
  }, [calendarEntries]);

  const latestCalendarDate = calendarEntries[calendarEntries.length - 1]?.day;

  useEffect(() => {
    setSelectedCalendarDate(undefined);
    setVisibleMonth(undefined);
  }, [selectedAccount?.id]);

  useEffect(() => {
    if (!latestCalendarDate) {
      setSelectedCalendarDate(undefined);
      setVisibleMonth(undefined);
      return;
    }

    setSelectedCalendarDate((current) => current ?? latestCalendarDate);
    setVisibleMonth((current) => current ?? new Date(latestCalendarDate.getFullYear(), latestCalendarDate.getMonth(), 1));
  }, [latestCalendarDate]);

  const selectedCalendarPnl = selectedCalendarDate ? (calendarPnlMap.get(calendarDateKey(selectedCalendarDate)) ?? null) : null;
  const profitableDays = calendarEntries.filter((entry) => entry.pnl > 0).map((entry) => entry.day);
  const losingDays = calendarEntries.filter((entry) => entry.pnl < 0).map((entry) => entry.day);
  const flatDays = calendarEntries.filter((entry) => entry.pnl === 0).map((entry) => entry.day);

  if (accountsQuery.isLoading || (summaryQuery.isLoading && selectedAccount)) {
    return <div className="py-12" style={{ color: "var(--text-muted)" }}>Loading dashboard...</div>;
  }

  const startingCapital = selectedAccount?.starting_balance ?? 0;
  const currentCapital = startingCapital + (summary?.totalPnl ?? 0);
  const portfolioChange = currentCapital - startingCapital;
  const portfolioChangePercent = startingCapital > 0 ? (portfolioChange / startingCapital) * 100 : 0;
  const portfolioPositive = portfolioChange >= 0;
  const lastMonthCapital = currentCapital - (summary?.vsLastMonth.pnl ?? 0);

  return (
    <div className="space-y-6 pb-10 md:space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mono text-xs uppercase tracking-[0.35em] text-accent">Dashboard</p>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.05em] text-primary md:text-5xl">Command center</h2>
          <p className="mt-3 max-w-2xl text-sm md:text-base" style={{ color: "var(--text-muted)" }}>A quieter, sharper view of capital, performance, and trade behavior across your active account.</p>
        </div>
        <Panel className="p-3 sm:p-4 lg:min-w-[360px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>Active account</p>
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Switch accounts or create a new one.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={selectedAccount?.id ?? ""} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="h-11 min-w-[240px] rounded-2xl border-border bg-[color:var(--surface)] px-3.5 text-sm text-primary shadow-none transition-all hover:border-accent/40 hover:bg-[color:var(--dashboard-chip)] focus-visible:ring-2 focus-visible:ring-accent/20 md:min-w-[280px]">
                  <SelectValue placeholder="Select account">
                    {selectedAccount ? `${selectedAccount.name} / ${selectedAccount.currency}` : "Select account"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" className="rounded-2xl border-border bg-[color:var(--surface)] p-1 text-primary shadow-2xl">
                  {(accountsQuery.data?.accounts ?? []).map((account) => (
                    <SelectItem key={account.id} value={account.id} className="rounded-xl px-3 py-2.5 text-sm text-primary focus:bg-[color:var(--dashboard-chip)] focus:text-primary">
                      {account.name} / {account.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => setShowNewAccountForm((current) => !current)} className="h-11 rounded-xl border-border bg-transparent px-4 text-primary shadow-none hover:border-accent hover:bg-[color:var(--dashboard-chip)]">
                {showNewAccountForm ? "Close" : "New Account"}
              </Button>
            </div>
          </div>

          {showNewAccountForm || (accountsQuery.data?.accounts?.length ?? 0) === 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-[color:var(--dashboard-subtle)] p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <input value={newAccount.name} onChange={(event) => setNewAccount((current) => ({ ...current, name: event.target.value }))} placeholder="Account name" className="field" />
                <input type="number" min="0" step="0.01" value={newAccount.startingBalance} onChange={(event) => setNewAccount((current) => ({ ...current, startingBalance: event.target.value }))} placeholder="Starting capital" className="field mono" />
                <input value={newAccount.currency} onChange={(event) => setNewAccount((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="INR" className="field" maxLength={3} />
              </div>
              <Button type="button" onClick={() => createAccountMutation.mutate()} className="mono mt-3 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-accent/90">
                {createAccountMutation.isPending ? "Creating..." : "Create Account"}
              </Button>
              {createAccountMutation.error ? <p className="mt-3 text-xs text-loss">{createAccountMutation.error.message}</p> : null}
            </div>
          ) : null}
        </Panel>
      </div>

      {selectedAccount && summary ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <SpotlightCard title="Portfolio value" eyebrow="Capital pulse">
              <div className="mt-8 space-y-5">
                <div>
                  <p className="mono text-[2.6rem] font-semibold tracking-[-0.08em] text-primary md:text-[3.6rem]">{formatCurrency(currentCapital)}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className={classNames("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium", portfolioPositive ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>
                      <ArrowIcon positive={portfolioPositive} />
                      <span className="mono">{Math.abs(portfolioChangePercent).toFixed(2)}%</span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>from starting capital</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>P&L delta</p>
                    <p className={classNames("mono mt-3 text-xl font-semibold", portfolioPositive ? "text-profit" : "text-loss")}>{formatCurrency(portfolioChange)}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Vs last month</p>
                    <p className="mono mt-3 text-xl font-semibold text-primary">{formatCurrency(lastMonthCapital)}</p>
                  </div>
                </div>
              </div>
            </SpotlightCard>

            <SpotlightCard title="Win ratio" eyebrow="Execution quality">
              <div className="mt-7 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <WinRateRing value={summary.winRate} />
                <div className="grid flex-1 gap-4">
                  <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Month-over-month</p>
                    <div className="mt-3 flex items-center gap-3">
                      <TrendBadge change={summary.vsLastMonth.winRate} />
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>vs prior month</span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
                      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Winning trades</p>
                      <p className="mono mt-3 text-2xl font-semibold text-primary">{summary.recentTrades.filter((trade) => (trade.net_pnl ?? 0) >= 0).length}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
                      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Losing trades</p>
                      <p className="mono mt-3 text-2xl font-semibold text-primary">{summary.recentTrades.filter((trade) => (trade.net_pnl ?? 0) < 0).length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Panel className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Starting capital</p>
                  {!isEditingCapital ? (
                    <p className="mono mt-3 text-2xl font-semibold tracking-[-0.05em] text-primary">{formatCurrency(startingCapital)}</p>
                  ) : null}
                </div>
                {selectedAccount && !isEditingCapital ? (
                  <Button type="button" variant="outline" onClick={() => setIsEditingCapital(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border-border bg-[color:var(--dashboard-chip)] hover:border-accent hover:bg-[color:var(--dashboard-chip)] hover:text-primary" style={{ color: "var(--text-muted)" }} aria-label="Edit starting capital">
                    <PencilIcon />
                  </Button>
                ) : null}
              </div>
              {!isEditingCapital ? (
                <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>Base capital for {selectedAccount.name}.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  <input type="number" min="0" step="0.01" value={capitalInput} onChange={(event) => setCapitalInput(event.target.value)} className="field mono" placeholder="Enter capital" />
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => updateCapitalMutation.mutate()} className="flex-1 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-accent/90">
                      {updateCapitalMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setCapitalInput(String(startingCapital)); setIsEditingCapital(false); }} className="rounded-2xl border-border px-4 py-3 text-sm hover:text-primary" style={{ color: "var(--text-muted)" }}>
                      Cancel
                    </Button>
                  </div>
                  {updateCapitalMutation.error ? <p className="text-xs text-loss">{updateCapitalMutation.error.message}</p> : null}
                </div>
              )}
            </Panel>
            <SecondaryMetricCard label="Total P&L" value={formatCurrency(summary.totalPnl)} valueClassName={summary.totalPnl >= 0 ? "text-profit" : "text-loss"} change={summary.vsLastMonth.pnl} helper="Realized performance against last month." />
            <SecondaryMetricCard label="Profit factor" value={summary.profitFactor.toFixed(2)} helper="Gross wins divided by gross losses." />
            <SecondaryMetricCard label="Avg R:R" value={summary.avgRR.toFixed(2)} helper="Average reward-to-risk across closed trades." />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <Panel className="p-6 md:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Curve</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Equity curve</h3>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Cumulative P&amp;L through the selected account.</p>
                </div>
                <div className={classNames("inline-flex w-fit items-center rounded-full px-3 py-2 text-xs font-medium", summary.currentStreak.type === "W" ? "bg-profit/10 text-profit" : summary.currentStreak.type === "L" ? "bg-loss/10 text-loss" : "bg-[color:var(--dashboard-chip)]")} style={!summary.currentStreak.type ? { color: "var(--text-muted)" } : undefined}>
                  <span className="mono">{summary.currentStreak.label}</span>
                </div>
              </div>
              <div className="mt-8 h-80">
                <ResponsiveContainer>
                  <LineChart data={summary.equityCurve} margin={{ top: 10, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--dashboard-grid)" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(value) => formatDate(value, { day: "2-digit", month: "short" })} stroke="var(--text-muted)" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickMargin={8} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value))} stroke="var(--text-muted)" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickMargin={8} width={104} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ stroke: "var(--dashboard-grid)", strokeDasharray: "4 6" }}
                      contentStyle={{
                        background: "var(--dashboard-tooltip)",
                        border: "1px solid var(--border)",
                        borderRadius: "18px",
                        color: "var(--text-primary)",
                        boxShadow: "var(--shadow-glow)"
                      }}
                      labelStyle={{ color: "var(--text-primary)" }}
                      itemStyle={{ color: "var(--text-primary)" }}
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(value) => formatDate(String(value))}
                    />
                    <Line type="monotone" dataKey="cumulativePnl" stroke="var(--accent)" strokeWidth={3} dot={false} activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--bg-base)", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel className="p-6 md:p-7">
              <div>
                <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Pulse</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Calendar heatmap</h3>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Month view with daily realized P&amp;L highlighted by color.</p>
                  {selectedCalendarDate ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-[color:var(--dashboard-chip)] px-3 py-1.5">
                      <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{formatCalendarLabel(selectedCalendarDate)}</span>
                      <span className={classNames(
                        "mono text-sm font-semibold",
                        selectedCalendarPnl !== null && selectedCalendarPnl < 0
                          ? "text-loss"
                          : selectedCalendarPnl !== null && selectedCalendarPnl > 0
                            ? "text-profit"
                            : "text-primary"
                      )}>
                        {selectedCalendarPnl !== null ? formatCurrency(selectedCalendarPnl) : "No data"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-5">
                <Calendar
                  mode="single"
                  navLayout="around"
                  month={visibleMonth}
                  onMonthChange={setVisibleMonth}
                  selected={selectedCalendarDate}
                  onSelect={setSelectedCalendarDate}
                  modifiers={{
                    profit: profitableDays,
                    loss: losingDays,
                    flat: flatDays,
                    selectedDay: selectedCalendarDate ? [selectedCalendarDate] : [],
                  }}
                  modifiersClassNames={{
                    profit: "[&>button]:bg-profit/15 [&>button]:text-profit hover:[&>button]:bg-profit/20 [&>button[data-selected-single=true]]:bg-profit/15 [&>button[data-selected-single=true]]:text-profit",
                    loss: "[&>button]:bg-loss/15 [&>button]:text-loss hover:[&>button]:bg-loss/20 [&>button[data-selected-single=true]]:bg-loss/15 [&>button[data-selected-single=true]]:text-loss",
                    flat: "[&>button]:bg-[color:var(--dashboard-chip)] [&>button]:text-primary [&>button[data-selected-single=true]]:bg-[color:var(--dashboard-chip)] [&>button[data-selected-single=true]]:text-primary",
                    selectedDay: "[&>button]:ring-2 [&>button]:ring-accent [&>button]:ring-offset-2 [&>button]:ring-offset-background",
                  }}
                  className="w-full bg-transparent p-0"
                  classNames={{
                    root: "w-full bg-transparent p-0",
                    months: "w-full",
                    month: "relative w-full rounded-[18px] border border-border bg-transparent p-3 pt-4",
                    month_caption: "relative z-0 mb-3 flex min-h-10 items-center justify-center px-12 pointer-events-none",
                    caption_label: "text-sm font-medium text-primary",
                    nav: "absolute inset-x-3 top-3 flex items-center justify-between",
                    button_previous: "absolute left-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-transparent p-0 text-primary hover:bg-[color:var(--dashboard-chip)]",
                    button_next: "absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-transparent p-0 text-primary hover:bg-[color:var(--dashboard-chip)]",
                    weekdays: "mb-2 grid grid-cols-7 gap-2",
                    weekday: "text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
                    week: "mt-2 grid grid-cols-7 gap-2",
                    day: "aspect-square",
                    day_button: "h-11 w-full rounded-2xl border border-transparent bg-transparent text-sm font-medium transition data-[selected-single=true]:bg-transparent data-[selected-single=true]:text-inherit",
                    today: "[&>button]:ring-1 [&>button]:ring-accent/40",
                    outside: "opacity-35 [&>button]:text-muted-foreground",
                  }}
                />
              </div>
            </Panel>
          </div>


          <div className="grid gap-6 xl:grid-cols-2">
            {[summary.bestTrade, summary.worstTrade].map((trade, index) => (
              <Panel key={index} className="p-6 md:p-7">
                <h3 className="text-xl font-semibold">{index === 0 ? "Best trade" : "Worst trade"}</h3>
                {trade ? (
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="mono text-lg">{trade.symbol}</span>
                      <span className={classNames("mono rounded-full px-3 py-1 text-xs", (trade.net_pnl ?? 0) >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>{formatCurrency(trade.net_pnl)}</span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>{trade.setup_name ?? "No setup"}</p>
                    <div className="grid grid-cols-2 gap-3 text-sm" style={{ color: "var(--text-muted)" }}>
                      <div>Entry: <span className="mono text-primary">{formatDateTime(trade.entry_date)}</span></div>
                      <div>Hold: <span className="mono text-primary">{calcHoldTime(trade.entry_date, trade.exit_date)}</span></div>
                    </div>
                  </div>
                ) : <p className="mt-5 text-sm" style={{ color: "var(--text-muted)" }}>No completed trades yet.</p>}
              </Panel>
            ))}
          </div>

          <Panel className="overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-border px-6 py-5 md:flex-row md:items-center md:justify-between md:px-7">
              <div>
                <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Flow</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Recent trades</h3>
              </div>
              <div className="rounded-full border border-border bg-[color:var(--dashboard-chip)] px-3 py-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                Last 10 completed trades
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[680px] text-left text-sm">
                <TableHeader className="border-b border-border text-xs uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6 py-4 font-medium md:px-7">Date</TableHead>
                    <TableHead className="px-6 py-4 font-medium">Symbol</TableHead>
                    <TableHead className="px-6 py-4 font-medium">Direction</TableHead>
                    <TableHead className="px-6 py-4 font-medium">P&amp;L</TableHead>
                    <TableHead className="px-6 py-4 font-medium">Hold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.recentTrades.map((trade) => (
                    <TableRow key={trade.id} className="border-b border-border/70 last:border-b-0 hover:bg-[color:var(--dashboard-subtle)]">
                      <TableCell className="px-6 py-4 md:px-7" style={{ color: "var(--text-muted)" }}>{formatDate(trade.entry_date)}</TableCell>
                      <TableCell className="mono px-6 py-4 text-base font-medium text-primary">{trade.symbol}</TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge variant="secondary" className={classNames("rounded-full px-3 py-1 text-xs font-medium capitalize", trade.direction === "long" ? "bg-profit/10 text-profit hover:bg-profit/10" : "bg-loss/10 text-loss hover:bg-loss/10")}>{trade.direction}</Badge>
                      </TableCell>
                      <TableCell className={classNames("mono px-6 py-4 font-medium", (trade.net_pnl ?? 0) >= 0 ? "text-profit" : "text-loss")}>{formatCurrency(trade.net_pnl)}</TableCell>
                      <TableCell className="mono px-6 py-4" style={{ color: "var(--text-muted)" }}>{calcHoldTime(trade.entry_date, trade.exit_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </>
      ) : (
        <Panel className="p-8 text-sm text-muted">Create and select an account to start tracking starting capital, current capital, and performance per account.</Panel>
      )}
    </div>
  );
}

function formatDateTime(value: string | null | undefined) {
  return formatDate(value, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}







































