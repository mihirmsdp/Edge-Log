import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/services/api";
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
  return <section className={classNames("dashboard-panel", className)}>{children}</section>;
}

function TrendBadge({ change, suffix = "%" }: { change: number; suffix?: string }) {
  const positive = change >= 0;
  return (
    <div className={classNames("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium", positive ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>
      <ArrowIcon positive={positive} />
      <span className="mono">{Math.abs(change).toFixed(2)}{suffix}</span>
    </div>
  );
}

function SecondaryMetricCard({ label, value, change, helper }: { label: string; value: string; change?: number; helper: string }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mono mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">{value}</p>
        </div>
        {typeof change === "number" ? <TrendBadge change={change} /> : null}
      </div>
      <p className="mt-4 text-sm text-muted">{helper}</p>
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
        <span className="mono -mt-1 text-sm text-muted">percent</span>
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
          <p className="mt-1 text-xs text-muted">{advancing} up / {declining} down / {total} names</p>
        </div>
        <div className={classNames("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", positive ? "bg-profit/12 text-profit" : "bg-loss/12 text-loss")}>
          <ArrowIcon positive={positive} />
          <span className="mono">{Math.abs(changePercent).toFixed(2)}%</span>
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Leaders</p>
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

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DashboardPage() {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: api.getAccounts });
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [capitalInput, setCapitalInput] = useState("");
  const [isEditingCapital, setIsEditingCapital] = useState(false);
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", startingBalance: "", currency: "INR" });

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

  const calendarDays = useMemo(() => {
    if (!summary) return [] as Array<{ date: string; pnl: number }>;
    return Object.entries(summary.calendarHeatmap).map(([date, pnl]) => ({ date, pnl }));
  }, [summary]);

  if (accountsQuery.isLoading || (summaryQuery.isLoading && selectedAccount)) {
    return <div className="py-12 text-muted">Loading dashboard...</div>;
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
          <p className="mt-3 max-w-2xl text-sm text-muted md:text-base">A quieter, sharper view of capital, performance, and trade behavior across your active account.</p>
        </div>
        <Panel className="p-3 sm:p-4 lg:min-w-[360px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Active account</p>
              <p className="mt-2 text-sm text-muted">Switch or create a new account here.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select value={selectedAccount?.id ?? ""} onChange={(event) => setSelectedAccountId(event.target.value)} className="field min-w-[220px] md:min-w-[240px]">
                {(accountsQuery.data?.accounts ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewAccountForm((current) => !current)} className="inline-flex items-center justify-center rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-4 py-3 text-sm font-medium text-primary transition hover:border-accent hover:text-primary">
                {showNewAccountForm ? "Close" : "New Account"}
              </button>
            </div>
          </div>

          {showNewAccountForm || (accountsQuery.data?.accounts?.length ?? 0) === 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-[color:var(--dashboard-subtle)] p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <input value={newAccount.name} onChange={(event) => setNewAccount((current) => ({ ...current, name: event.target.value }))} placeholder="Account name" className="field" />
                <input type="number" min="0" step="0.01" value={newAccount.startingBalance} onChange={(event) => setNewAccount((current) => ({ ...current, startingBalance: event.target.value }))} placeholder="Starting capital" className="field mono" />
                <input value={newAccount.currency} onChange={(event) => setNewAccount((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="INR" className="field" maxLength={3} />
              </div>
              <button type="button" onClick={() => createAccountMutation.mutate()} className="mono mt-3 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-[var(--accent-contrast)]">
                {createAccountMutation.isPending ? "Creating..." : "Create Account"}
              </button>
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
                    <p className="text-sm text-muted">from starting capital</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">P&L delta</p>
                    <p className={classNames("mono mt-3 text-xl font-semibold", portfolioPositive ? "text-profit" : "text-loss")}>{formatCurrency(portfolioChange)}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Vs last month</p>
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
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Month-over-month</p>
                    <div className="mt-3 flex items-center gap-3">
                      <TrendBadge change={summary.vsLastMonth.winRate} />
                      <span className="text-sm text-muted">vs prior month</span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted">Winning trades</p>
                      <p className="mono mt-3 text-2xl font-semibold text-primary">{summary.recentTrades.filter((trade) => (trade.net_pnl ?? 0) >= 0).length}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted">Losing trades</p>
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
                  <p className="text-sm text-muted">Starting capital</p>
                  {!isEditingCapital ? (
                    <p className="mono mt-3 text-2xl font-semibold tracking-[-0.05em] text-primary">{formatCurrency(startingCapital)}</p>
                  ) : null}
                </div>
                {selectedAccount && !isEditingCapital ? (
                  <button type="button" onClick={() => setIsEditingCapital(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-[color:var(--dashboard-chip)] text-muted transition hover:border-accent hover:text-primary" aria-label="Edit starting capital">
                    <PencilIcon />
                  </button>
                ) : null}
              </div>
              {!isEditingCapital ? (
                <p className="mt-4 text-sm text-muted">Base capital for {selectedAccount.name}.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  <input type="number" min="0" step="0.01" value={capitalInput} onChange={(event) => setCapitalInput(event.target.value)} className="field mono" placeholder="Enter capital" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateCapitalMutation.mutate()} className="flex-1 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-[var(--accent-contrast)]">
                      {updateCapitalMutation.isPending ? "Saving..." : "Save"}
                    </button>
                    <button type="button" onClick={() => { setCapitalInput(String(startingCapital)); setIsEditingCapital(false); }} className="rounded-2xl border border-border px-4 py-3 text-sm text-muted">
                      Cancel
                    </button>
                  </div>
                  {updateCapitalMutation.error ? <p className="text-xs text-loss">{updateCapitalMutation.error.message}</p> : null}
                </div>
              )}
            </Panel>
            <SecondaryMetricCard label="Total P&L" value={formatCurrency(summary.totalPnl)} change={summary.vsLastMonth.pnl} helper="Realized performance against last month." />
            <SecondaryMetricCard label="Profit factor" value={summary.profitFactor.toFixed(2)} helper="Gross wins divided by gross losses." />
            <SecondaryMetricCard label="Avg R:R" value={summary.avgRR.toFixed(2)} helper="Average reward-to-risk across closed trades." />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <Panel className="p-6 md:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Curve</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Equity curve</h3>
                  <p className="mt-2 text-sm text-muted">Cumulative P&amp;L through the selected account.</p>
                </div>
                <div className={classNames("inline-flex w-fit items-center rounded-full px-3 py-2 text-xs font-medium", summary.currentStreak.type === "W" ? "bg-profit/10 text-profit" : summary.currentStreak.type === "L" ? "bg-loss/10 text-loss" : "bg-[color:var(--dashboard-chip)] text-muted")}>
                  <span className="mono">{summary.currentStreak.label}</span>
                </div>
              </div>
              <div className="mt-8 h-80">
                <ResponsiveContainer>
                  <LineChart data={summary.equityCurve} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--dashboard-grid)" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(value) => formatDate(value, { day: "2-digit", month: "short" })} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value))} stroke="var(--text-muted)" width={92} tickLine={false} axisLine={false} />
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
              <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Pulse</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Calendar heatmap</h3>
              <p className="mt-2 text-sm text-muted">A compact monthly pulse of realized daily P&amp;L.</p>
              <div className="mt-6 grid grid-cols-7 gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
                {weekdayLabels.map((day) => (
                  <span key={day} className="px-1">{day.slice(0, 1)}</span>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2">
                {calendarDays.slice(-35).map((day) => {
                  const scaleBase = Math.max(Math.abs(summary.bestTrade?.net_pnl ?? 1), Math.abs(summary.worstTrade?.net_pnl ?? 1), 1);
                  const opacity = Math.min(1, Math.abs(day.pnl) / scaleBase);
                  return (
                    <div
                      key={day.date}
                      className="rounded-2xl border border-border p-3 text-xs"
                      style={{ backgroundColor: day.pnl >= 0 ? `rgba(34,197,94,${0.15 + opacity * 0.55})` : `rgba(239,68,68,${0.15 + opacity * 0.55})` }}
                      title={`${formatDate(day.date)} • ${formatCurrency(day.pnl)}`}
                    >
                      <p className="mono">{day.date.slice(-2)}</p>
                    </div>
                  );
                })}
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
                    <p className="text-sm text-muted">{trade.setup_name ?? "No setup"}</p>
                    <div className="grid grid-cols-2 gap-3 text-sm text-muted">
                      <div>Entry: <span className="mono text-primary">{formatDateTime(trade.entry_date)}</span></div>
                      <div>Hold: <span className="mono text-primary">{calcHoldTime(trade.entry_date, trade.exit_date)}</span></div>
                    </div>
                  </div>
                ) : <p className="mt-5 text-sm text-muted">No completed trades yet.</p>}
              </Panel>
            ))}
          </div>

          <Panel className="overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-border px-6 py-5 md:flex-row md:items-center md:justify-between md:px-7">
              <div>
                <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Flow</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Recent trades</h3>
              </div>
              <div className="rounded-full border border-border bg-[color:var(--dashboard-chip)] px-3 py-1.5 text-xs text-muted">
                Last 10 completed trades
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted">
                  <tr>
                    <th className="px-6 py-4 font-medium md:px-7">Date</th>
                    <th className="px-6 py-4 font-medium">Symbol</th>
                    <th className="px-6 py-4 font-medium">Direction</th>
                    <th className="px-6 py-4 font-medium">P&amp;L</th>
                    <th className="px-6 py-4 font-medium">Hold</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentTrades.map((trade) => (
                    <tr key={trade.id} className="border-b border-border/70 last:border-b-0 hover:bg-[color:var(--dashboard-subtle)]">
                      <td className="px-6 py-4 text-muted md:px-7">{formatDate(trade.entry_date)}</td>
                      <td className="mono px-6 py-4 text-base font-medium text-primary">{trade.symbol}</td>
                      <td className="px-6 py-4">
                        <span className={classNames("inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize", trade.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>{trade.direction}</span>
                      </td>
                      <td className={classNames("mono px-6 py-4 font-medium", (trade.net_pnl ?? 0) >= 0 ? "text-profit" : "text-loss")}>{formatCurrency(trade.net_pnl)}</td>
                      <td className="mono px-6 py-4 text-muted">{calcHoldTime(trade.entry_date, trade.exit_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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





