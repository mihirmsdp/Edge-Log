import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from "@/services/api";
import { classNames, formatCurrency, formatDate } from "@/lib/format";

type MarketMode = "market" | "option-pro";
const MARKET_MODE_STORAGE_KEY = "edgelog-market-mode";

function ArrowIcon({ positive }: { positive: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {positive ? <path d="M4 12l4-4 3 3 5-5" /> : <path d="M4 8l4 4 3-3 5 5" />}
      {positive ? <path d="M13 6h3v3" /> : <path d="M13 14h3v-3" />}
    </svg>
  );
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={classNames("h-4 w-4", spinning ? "animate-spin" : "")} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 10a6 6 0 1 1-1.76-4.24" />
      <path d="M16 4v4h-4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
      <path d="M6.5 2.8v3.2" />
      <path d="M13.5 2.8v3.2" />
      <path d="M3.5 8h13" />
    </svg>
  );
}

function ChevronIcon({ open = false }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={classNames("h-4 w-4 transition-transform", open ? "rotate-180" : "")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
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
    <div className="rounded-[24px] border p-5 transition hover:-translate-y-0.5" style={{ backgroundColor: background, borderColor }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-medium text-primary">{sector}</p>
          <p className="mt-1 text-xs text-muted">{advancing} up / {declining} down / {total} names</p>
        </div>
        <div className={classNames("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", positive ? "bg-profit/12 text-profit" : "bg-loss/12 text-loss")}>
          <ArrowIcon positive={positive} />
          <span className="mono">{Math.abs(changePercent).toFixed(2)}%</span>
        </div>
      </div>
      <div className="mt-6 flex items-end justify-between gap-3">
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
                  "h-9 w-2 rounded-full",
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

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">{label}</p>
      <p className="mono mt-3 text-2xl font-semibold text-primary">{value}</p>
      <p className="mt-2 text-sm text-muted">{helper}</p>
    </div>
  );
}

function MarketModeView() {
  const sectorHeatmapQuery = useQuery({
    queryKey: ["market-sector-heatmap"],
    queryFn: api.getMarketSectorHeatmap,
    refetchInterval: 30_000,
    staleTime: 15_000
  });

  const topMoversQuery = useQuery({
    queryKey: ["market-top-movers"],
    queryFn: api.getMarketTopMovers,
    refetchInterval: 30_000,
    staleTime: 15_000
  });

  const sectors = sectorHeatmapQuery.data?.sectors ?? [];
  const strongestSector = sectors.length ? [...sectors].sort((a, b) => b.changePercent - a.changePercent)[0] : null;
  const weakestSector = sectors.length ? [...sectors].sort((a, b) => a.changePercent - b.changePercent)[0] : null;
  const strongestDistinctSector = strongestSector && weakestSector && strongestSector.sector === weakestSector.sector && sectors.length > 1
    ? [...sectors].sort((a, b) => b.changePercent - a.changePercent)[1]
    : strongestSector;
  const advancingTotal = sectors.reduce((sum, sector) => sum + sector.advancing, 0);
  const decliningTotal = sectors.reduce((sum, sector) => sum + sector.declining, 0);
  const flatTotal = sectors.reduce((sum, sector) => sum + sector.flat, 0);
  const strongestLeaders = sectors.slice(0, 4).flatMap((sector) => sector.leaders.map((leader) => ({ sector: sector.sector, leader }))).slice(0, 4);

  return (
    <div className="space-y-6 md:space-y-7">
      <div className="grid gap-4 md:grid-cols-3">
        <section className="dashboard-panel p-5">
          <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Leader</p>
          <h3 className="mt-3 text-xl font-semibold text-primary">Strongest sector</h3>
          {strongestDistinctSector ? (
            <>
              <p className="mt-4 text-2xl font-semibold text-primary">{strongestDistinctSector.sector}</p>
              <p className={classNames("mono mt-3 text-lg", strongestDistinctSector.changePercent >= 0 ? "text-profit" : "text-loss")}>{strongestDistinctSector.changePercent >= 0 ? "+" : ""}{strongestDistinctSector.changePercent.toFixed(2)}%</p>
              <p className="mt-3 text-sm text-muted">Leaders: <span className="mono text-primary">{strongestDistinctSector.leaders.join(" / ")}</span></p>
            </>
          ) : <p className="mt-4 text-sm text-muted">Waiting for sector data.</p>}
        </section>

        <section className="dashboard-panel p-5">
          <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Risk</p>
          <h3 className="mt-3 text-xl font-semibold text-primary">Weakest sector</h3>
          {weakestSector ? (
            <>
              <p className="mt-4 text-2xl font-semibold text-primary">{weakestSector.sector}</p>
              <p className="mono mt-3 text-lg text-loss">{weakestSector.changePercent.toFixed(2)}%</p>
              <p className="mt-3 text-sm text-muted">Leaders: <span className="mono text-primary">{weakestSector.leaders.join(" / ")}</span></p>
            </>
          ) : <p className="mt-4 text-sm text-muted">Waiting for sector data.</p>}
        </section>

        <section className="dashboard-panel p-5">
          <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Momentum</p>
          <h3 className="mt-3 text-xl font-semibold text-primary">Top movers</h3>
          <div className="mt-4 space-y-3">
            {(topMoversQuery.data?.movers ?? []).slice(0, 4).map((mover) => (
              <div key={mover.symbol} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-3 py-2.5">
                <span className="mono text-sm text-primary">{mover.symbol}</span>
                <div className="text-right">
                  <p className="mono text-sm text-primary">{formatCurrency(mover.price)}</p>
                  <p className="mono text-xs text-profit">+{mover.changePercent.toFixed(2)}%</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="dashboard-panel p-6 md:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Breadth</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Sector heatmap</h3>
            <p className="mt-2 text-sm text-muted">Live NIFTY 50 sector strength from Upstox quotes. Track leadership, weakness, and where flow is concentrated before you lean on index futures or options.</p>
          </div>
          <div className="rounded-full border border-border bg-[color:var(--dashboard-chip)] px-3 py-1.5 text-xs text-muted">
            {sectorHeatmapQuery.isFetching ? "Refreshing" : sectorHeatmapQuery.data?.cached ? "Cached 30s" : "Live snapshot"}
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(sectorHeatmapQuery.data?.sectors ?? []).length > 0 ? (sectorHeatmapQuery.data?.sectors ?? []).map((tile) => (
            <SectorHeatTile
              key={tile.sector}
              sector={tile.sector}
              changePercent={tile.changePercent}
              advancing={tile.advancing}
              declining={tile.declining}
              total={tile.total}
              leaders={tile.leaders}
            />
          )) : (
            <div className="rounded-2xl border border-border bg-[color:var(--dashboard-subtle)] p-5 text-sm text-muted sm:col-span-2 xl:col-span-4">
              Market breadth is unavailable right now. Check the Upstox analytics token or try again in a moment.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="dashboard-panel p-6">
          <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Breadth</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Market breadth snapshot</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Advancing</p>
              <p className="mono mt-3 text-2xl font-semibold text-profit">{advancingTotal}</p>
            </div>
            <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Declining</p>
              <p className="mono mt-3 text-2xl font-semibold text-loss">{decliningTotal}</p>
            </div>
            <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Flat</p>
              <p className="mono mt-3 text-2xl font-semibold text-primary">{flatTotal}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Leadership tape</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {strongestLeaders.length > 0 ? strongestLeaders.map((item: { sector: string; leader: string }) => (
                <span key={`${item.sector}-${item.leader}`} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-primary">
                  <span className="mono text-profit">{item.leader}</span>
                  <span className="text-muted">{item.sector}</span>
                </span>
              )) : <span className="text-sm text-muted">Waiting for leadership data.</span>}
            </div>
          </div>
        </div>

        <div className="dashboard-panel p-6">
          <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Use</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">How to read it</h3>
          <div className="mt-5 space-y-4 text-sm text-muted">
            <p>Look for broad green in Financials, IT, and Energy when deciding whether NIFTY strength has enough backing for continuation.</p>
            <p>When a single sector carries the whole move, expect more false breakouts and weaker follow-through in index options.</p>
            <p>Use strongest and weakest sectors as a quick shortlist for relative-strength and relative-weakness trades.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function OptionLevelList({
  label,
  levels,
  tone
}: {
  label: string;
  levels: Array<{ strikePrice: number; oi: number; changeOi: number | null }>;
  tone: "support" | "resistance";
}) {
  const toneClasses = tone === "support"
    ? "border-profit/25 bg-profit/8 text-profit"
    : "border-loss/25 bg-loss/8 text-loss";

  return (
    <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">{label}</p>
        <span className={classNames("rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em]", toneClasses)}>
          {tone === "support" ? "Put OI" : "Call OI"}
        </span>
      </div>
      <div className="mt-4 space-y-2.5">
        {levels.length > 0 ? levels.map((level) => (
          <div key={`${label}-${level.strikePrice}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-[color:var(--dashboard-subtle)] px-3 py-3">
            <div>
              <p className="mono text-base font-semibold text-primary">{formatCurrency(level.strikePrice)}</p>
              <p className="mono mt-1 text-xs text-muted">OI {formatCompact(level.oi)}</p>
            </div>
            <p className={classNames("mono text-xs", (level.changeOi ?? 0) >= 0 ? "text-profit" : "text-loss")}>
              dOI {formatCompact(level.changeOi)}
            </p>
          </div>
        )) : <p className="text-sm text-muted">No strong levels in the current range.</p>}
      </div>
    </div>
  );
}

function SignalCard({
  eyebrow,
  title,
  badge,
  badgeClassName,
  description,
  reasons,
  action,
  children
}: {
  eyebrow: string;
  title: string;
  badge: string;
  badgeClassName: string;
  description: string;
  reasons: string[];
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="dashboard-panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">{eyebrow}</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">{title}</h3>
        </div>
        <div className="flex items-center gap-2">{action}{badge ? <span className={classNames("rounded-full px-3 py-1.5 text-xs font-medium", badgeClassName)}>{badge}</span> : null}</div>
      </div>
      <p className="mt-4 text-sm text-primary">{description}</p>
      <div className="mt-4 space-y-2">
        {reasons.length > 0 ? reasons.map((reason) => (
          <div key={`${title}-${reason}`} className="rounded-xl border border-border bg-[color:var(--dashboard-chip)] px-3 py-2.5 text-sm text-muted">
            {reason}
          </div>
        )) : <div className="rounded-xl border border-border bg-[color:var(--dashboard-chip)] px-3 py-2.5 text-sm text-muted">Waiting for a clearer read from the chain.</div>}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function BuildupCard({
  label,
  level,
  tone
}: {
  label: string;
  level: { strikePrice: number; oi: number; changeOi: number | null } | null;
  tone: "bullish" | "bearish" | "neutral";
}) {
  const toneClass = tone === "bullish" ? "text-profit" : tone === "bearish" ? "text-loss" : "text-primary";

  return (
    <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">{label}</p>
      {level ? (
        <>
          <p className="mono mt-3 text-xl font-semibold text-primary">{formatCurrency(level.strikePrice)}</p>
          <p className="mono mt-2 text-sm text-muted">OI {formatCompact(level.oi)}</p>
          <p className={classNames("mono mt-2 text-sm", toneClass)}>dOI {formatCompact(level.changeOi)}</p>
        </>
      ) : <p className="mt-3 text-sm text-muted">No clear signal yet.</p>}
    </div>
  );
}

function OptionProView() {
  const [selectedExpiry, setSelectedExpiry] = useState("");
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(true);
  const expiryMenuRef = useRef<HTMLDivElement | null>(null);
  const [biasExplanation, setBiasExplanation] = useState("");
  const [biasExplanationOpen, setBiasExplanationOpen] = useState(false);
  const optionChainQuery = useQuery({
    queryKey: ["market-option-pro-nifty", selectedExpiry],
    queryFn: () => api.getMarketNiftyOptionChain(selectedExpiry || undefined),
    enabled: shouldFetch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false
  });

  useEffect(() => {
    if (!selectedExpiry && optionChainQuery.data?.selectedExpiry) {
      setSelectedExpiry(optionChainQuery.data.selectedExpiry);
    }
  }, [optionChainQuery.data?.selectedExpiry, selectedExpiry]);

  useEffect(() => {
    if (!expiryOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (expiryMenuRef.current && !expiryMenuRef.current.contains(event.target as Node)) {
        setExpiryOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [expiryOpen]);

  const biasExplainMutation = useMutation({
    mutationFn: () => api.explainMarketNiftyBias(selectedExpiry || undefined),
    onSuccess: (result) => {
      setBiasExplanation(result.explanation);
      setBiasExplanationOpen(true);
    }
  });

  const payload = optionChainQuery.data;
  const expiryOptions = payload?.expiries ?? [];
  const selectedExpiryLabel = selectedExpiry
    ? formatDate(selectedExpiry, { day: "2-digit", month: "long", year: "numeric" })
    : "Select expiry";
  const changeOiChartData = (payload?.rows ?? []).map((row) => ({
    strike: row.strikePrice,
    callChangeOi: row.call.changeOi ?? 0,
    putChangeOi: row.put.changeOi ?? 0
  }));
  const supportLevels = payload?.supportResistance.support ?? [];
  const resistanceLevels = payload?.supportResistance.resistance ?? [];
  const buildup = payload?.buildup;
  const heatmapRows = payload?.heatmapRows ?? [];
  const maxCallOi = Math.max(1, ...heatmapRows.map((row) => row.callOi ?? 0));
  const maxPutOi = Math.max(1, ...heatmapRows.map((row) => row.putOi ?? 0));
  const sentimentTone = buildup?.sentiment === "Bullish"
    ? "bg-profit/12 text-profit"
    : buildup?.sentiment === "Bearish"
      ? "bg-loss/12 text-loss"
      : buildup?.sentiment === "Mixed"
        ? "bg-accent/12 text-accent"
        : "bg-[color:var(--dashboard-chip)] text-primary";
  const biasTone = payload?.rangeBias.tone === "Bullish"
    ? "bg-profit/12 text-profit"
    : payload?.rangeBias.tone === "Bearish"
      ? "bg-loss/12 text-loss"
      : "bg-[color:var(--dashboard-chip)] text-primary";
  const strategyTone = payload?.quickStrategy.stance === "Bullish"
    ? "bg-profit/12 text-profit"
    : payload?.quickStrategy.stance === "Bearish"
      ? "bg-loss/12 text-loss"
      : payload?.quickStrategy.stance === "Neutral"
        ? "bg-accent/12 text-accent"
        : "bg-[color:var(--dashboard-chip)] text-primary";

  return (
    <div className="space-y-6 md:space-y-7">
      <section className="dashboard-panel p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Option Pro</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">NIFTY option chain cockpit</h3>
            <p className="mt-3 max-w-3xl text-sm text-muted">Nearest-expiry chain context for fast read: spot, PCR, max pain, ATM straddle, OI walls, and where call or put positioning is building up.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div ref={expiryMenuRef} className="relative min-w-[240px]">
              <button
                type="button"
                onClick={() => expiryOptions.length > 0 && setExpiryOpen((open) => !open)}
                className="inline-flex w-full items-center gap-3 rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-4 py-3 text-left text-sm font-medium text-primary transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                disabled={expiryOptions.length === 0}
                aria-haspopup="listbox"
                aria-expanded={expiryOpen}
              >
                <CalendarIcon />
                <span className="min-w-0 flex-1 truncate">{selectedExpiryLabel}</span>
                <ChevronIcon open={expiryOpen} />
              </button>
              {expiryOpen ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-border bg-[color:var(--dashboard-tooltip)] p-1 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                  <div className="max-h-72 overflow-y-auto">
                    {expiryOptions.map((expiry) => {
                      const active = expiry === selectedExpiry;
                      return (
                        <button
                          key={expiry}
                          type="button"
                          onClick={() => {
                            setSelectedExpiry(expiry);
                            setBiasExplanation("");
                            setBiasExplanationOpen(false);
                            setExpiryOpen(false);
                          }}
                          className={classNames(
                            "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition",
                            active ? "bg-accent text-[var(--accent-contrast)]" : "text-primary hover:bg-[color:var(--dashboard-chip)]"
                          )}
                        >
                          <span className="truncate">{formatDate(expiry, { day: "2-digit", month: "long", year: "numeric" })}</span>
                          {active ? <span className="mono text-[11px] uppercase tracking-[0.18em]">Live</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setShouldFetch(true);
                setBiasExplanation("");
                setBiasExplanationOpen(false);
                void optionChainQuery.refetch();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-4 py-3 text-sm font-medium text-primary transition hover:border-accent"
            >
              <RefreshIcon spinning={optionChainQuery.isFetching} />
              Refresh
            </button>
          </div>
        </div>
        {payload ? <p className="mt-4 text-sm text-muted">Loaded once. Use refresh whenever you want a fresh chain snapshot.</p> : <p className="mt-4 text-sm text-muted">Loading the initial NIFTY option chain. After that, refresh is fully manual.</p>}
        {optionChainQuery.error ? <p className="mt-4 text-sm text-loss">Unable to load option-chain data right now. Try refresh again.</p> : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Spot" value={payload?.summary.spot ? formatCurrency(payload.summary.spot) : "-"} helper="Underlying spot from chain data." />
        <MetricCard label="PCR" value={payload?.summary.overallPcr?.toFixed(2) ?? "-"} helper="Total put OI divided by total call OI." />
        <MetricCard label="Max pain" value={payload?.summary.maxPain ? formatCurrency(payload.summary.maxPain) : "-"} helper="Strike with lowest aggregate pain." />
        <MetricCard label="ATM straddle" value={payload?.summary.atmStraddle ? formatCurrency(payload.summary.atmStraddle) : "-"} helper="Rough expected move proxy." />
      </div>

      {biasExplanation && biasExplanationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm" onClick={() => setBiasExplanationOpen(false)}>
          <div
            className="w-full max-w-3xl rounded-[28px] border border-border bg-[color:var(--bg-elevated)] shadow-[0_30px_120px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">AI Explain</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Range-day vs trend-day meaning</h3>
                <p className="mt-2 text-sm text-muted">A plain-English explanation of the current rule-based bias and how to interpret it.</p>
              </div>
              <button
                type="button"
                onClick={() => setBiasExplanationOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-[color:var(--dashboard-chip)] text-primary transition hover:border-accent"
                aria-label="Close AI explanation"
              >
                <span className="text-lg leading-none">x</span>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-4 py-4 text-sm leading-7 text-primary whitespace-pre-wrap">
                {biasExplanation}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SignalCard
          eyebrow="Bias"
          title="Range-day vs trend-day"
          badge={payload?.rangeBias ? `${payload.rangeBias.bias} / ${payload.rangeBias.strength}` : "Balanced / Weak"}
          badgeClassName={biasTone}
          description={payload?.rangeBias ? `${payload.rangeBias.tone} tone from current chain structure.` : "Waiting for chain structure."}
          reasons={payload?.rangeBias.reasons ?? []}
          action={
            <button
              type="button"
              onClick={() => void biasExplainMutation.mutateAsync()}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-[color:var(--dashboard-chip)] px-3 py-1.5 text-xs font-medium text-primary transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
              disabled={biasExplainMutation.isPending || !payload}
            >
              <RefreshIcon spinning={biasExplainMutation.isPending} />
              {biasExplanation ? "View AI Explain" : "AI Explain"}
            </button>
          }
        >
          {biasExplainMutation.error ? (
            <div className="rounded-xl border border-loss/30 bg-loss/8 px-3 py-3 text-sm text-loss">
              Unable to generate the explanation right now. Try again.
            </div>
          ) : null}
        </SignalCard>
        <SignalCard
          eyebrow="Plan"
          title="Quick strategy"
          badge={payload?.quickStrategy?.stance ?? "Wait"}
          badgeClassName={strategyTone}
          description={payload?.quickStrategy ? `${payload.quickStrategy.setup}. ${payload.quickStrategy.description}` : "Waiting for strategy read."}
          reasons={payload?.quickStrategy.reasons ?? []}
        />
      </div>

      {biasExplanation && biasExplanationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm" onClick={() => setBiasExplanationOpen(false)}>
          <div
            className="w-full max-w-3xl rounded-[28px] border border-border bg-[color:var(--bg-elevated)] shadow-[0_30px_120px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">AI Explain</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Range-day vs trend-day meaning</h3>
                <p className="mt-2 text-sm text-muted">A plain-English explanation of the current rule-based bias and how to interpret it.</p>
              </div>
              <button
                type="button"
                onClick={() => setBiasExplanationOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-[color:var(--dashboard-chip)] text-primary transition hover:border-accent"
                aria-label="Close AI explanation"
              >
                <span className="text-lg leading-none">x</span>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-4 py-4 text-sm leading-7 text-primary whitespace-pre-wrap">
                {biasExplanation}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="dashboard-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Levels</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Support / resistance from OI</h3>
              <p className="mt-2 text-sm text-muted">Put OI concentration marks support zones, call OI concentration marks resistance zones near current spot.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <OptionLevelList label="Support" levels={supportLevels} tone="support" />
            <OptionLevelList label="Resistance" levels={resistanceLevels} tone="resistance" />
          </div>
        </section>

        <section className="dashboard-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Buildup</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">OI buildup summary</h3>
              <p className="mt-2 text-sm text-muted">Quick read on where fresh writing or unwinding is showing up around the current chain.</p>
            </div>
            <span className={classNames("rounded-full px-3 py-1.5 text-xs font-medium", sentimentTone)}>
              {buildup?.sentiment ?? "Neutral"}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <BuildupCard label="Call writing" level={buildup?.callWriting ?? null} tone="bearish" />
            <BuildupCard label="Put writing" level={buildup?.putWriting ?? null} tone="bullish" />
            <BuildupCard label="Call unwinding" level={buildup?.callUnwinding ?? null} tone="bullish" />
            <BuildupCard label="Put unwinding" level={buildup?.putUnwinding ?? null} tone="bearish" />
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <section className="dashboard-panel p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Flow</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">Change in OI</h3>
              <p className="mt-2 text-sm text-muted">Green bars show call change in OI, red bars show put change in OI around ATM. Dashed cyan line marks spot context.</p>
            </div>
          </div>
          <div className="mt-6 h-64 md:h-72">
            <ResponsiveContainer>
              <BarChart data={changeOiChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={6}>
                <CartesianGrid stroke="var(--dashboard-grid)" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="strike"
                  domain={["dataMin - 50", "dataMax + 50"]}
                  stroke="var(--text-muted)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatCompact(Number(value))}
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="var(--text-muted)" tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(Number(value))} tick={{ fontSize: 11 }} width={64} />
                {payload?.summary.spot ? (
                  <ReferenceLine
                    x={payload.summary.spot}
                    stroke="var(--accent)"
                    strokeDasharray="4 4"
                    label={{ value: `Spot ${formatCurrency(payload.summary.spot)}`, position: "insideTopRight", fill: "var(--accent)", fontSize: 11 }}
                  />
                ) : null}
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{
                    background: "var(--dashboard-tooltip)",
                    border: "1px solid var(--border)",
                    borderRadius: "18px",
                    color: "var(--text-primary)",
                    boxShadow: "var(--shadow-glow)"
                  }}
                  labelStyle={{ color: "var(--text-primary)" }}
                  itemStyle={{ color: "var(--text-primary)" }}
                  labelFormatter={(value) => `Strike ${formatCurrency(Number(value))}`}
                  formatter={(value: number, name: string) => [formatCompact(value), name === "callChangeOi" ? "Call dOI" : "Put dOI"]}
                />
                <Bar dataKey="callChangeOi" name="Call dOI" fill="var(--profit)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                <Bar dataKey="putChangeOi" name="Put dOI" fill="var(--loss)" radius={[6, 6, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="dashboard-panel p-6">
          <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Heatmap</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">OI wall heatmap</h3>
          <p className="mt-2 text-sm text-muted">Read heavy call OI on the left, heavy put OI on the right, with strike in the middle for a compact wall view.</p>
          <div className="mt-5 rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-3">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-2 pb-2 text-[11px] uppercase tracking-[0.18em] text-muted">
              <span>Call OI</span>
              <span>Strike</span>
              <span className="text-right">Put OI</span>
            </div>
            <div className="space-y-2">
              {heatmapRows.length > 0 ? heatmapRows.map((row) => {
                const callIntensity = Math.max(0.12, (row.callOi ?? 0) / maxCallOi);
                const putIntensity = Math.max(0.12, (row.putOi ?? 0) / maxPutOi);
                const isSpotBand = payload?.summary.atmStrike === row.strikePrice;

                return (
                  <div key={`heatmap-${row.strikePrice}`} className={classNames("grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl p-2", isSpotBand ? "bg-accent/6" : "")}>
                    <div className="rounded-xl border px-3 py-2" style={{ backgroundColor: `rgba(239,68,68,${callIntensity * 0.3})`, borderColor: `rgba(239,68,68,${0.18 + callIntensity * 0.25})` }}>
                      <p className="mono text-sm text-primary">{formatCompact(row.callOi)}</p>
                      <p className={classNames("mono mt-1 text-[11px]", (row.callChangeOi ?? 0) >= 0 ? "text-profit" : "text-loss")}>dOI {formatCompact(row.callChangeOi)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-[color:var(--dashboard-subtle)] px-3 py-2 text-center">
                      <p className="mono text-sm font-semibold text-primary">{formatCurrency(row.strikePrice)}</p>
                    </div>
                    <div className="rounded-xl border px-3 py-2 text-right" style={{ backgroundColor: `rgba(34,197,94,${putIntensity * 0.3})`, borderColor: `rgba(34,197,94,${0.18 + putIntensity * 0.25})` }}>
                      <p className="mono text-sm text-primary">{formatCompact(row.putOi)}</p>
                      <p className={classNames("mono mt-1 text-[11px]", (row.putChangeOi ?? 0) >= 0 ? "text-profit" : "text-loss")}>dOI {formatCompact(row.putChangeOi)}</p>
                    </div>
                  </div>
                );
              }) : <p className="px-2 py-6 text-sm text-muted">Heatmap data will appear once the chain snapshot is available.</p>}
            </div>
          </div>
        </section>

        <section className="dashboard-panel overflow-hidden p-0">
          <div className="border-b border-border px-6 py-5">
            <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent/80">Ladder</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-primary">ATM strike ladder</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border text-[11px] uppercase tracking-[0.18em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Call LTP</th>
                  <th className="px-4 py-3 font-medium">Call OI</th>
                  <th className="px-4 py-3 font-medium">Call dOI</th>
                  <th className="px-4 py-3 font-medium">Strike</th>
                  <th className="px-4 py-3 font-medium">PCR</th>
                  <th className="px-4 py-3 font-medium">Put dOI</th>
                  <th className="px-4 py-3 font-medium">Put OI</th>
                  <th className="px-4 py-3 font-medium">Put LTP</th>
                </tr>
              </thead>
              <tbody>
                {(payload?.rows ?? []).map((row) => {
                  const isAtm = payload?.summary.atmStrike === row.strikePrice;
                  return (
                    <tr key={row.strikePrice} className={classNames("border-b border-border/70 last:border-b-0", isAtm ? "bg-accent/6" : "hover:bg-[color:var(--dashboard-subtle)]")}>
                      <td className="mono px-4 py-3 text-primary">{row.call.ltp !== null ? formatCurrency(row.call.ltp) : "-"}</td>
                      <td className="mono px-4 py-3 text-primary">{formatCompact(row.call.oi)}</td>
                      <td className={classNames("mono px-4 py-3", (row.call.changeOi ?? 0) >= 0 ? "text-profit" : "text-loss")}>{formatCompact(row.call.changeOi)}</td>
                      <td className="mono px-4 py-3 text-base font-semibold text-primary">{formatCurrency(row.strikePrice)}</td>
                      <td className="mono px-4 py-3 text-primary">{row.pcr !== null ? row.pcr.toFixed(2) : "-"}</td>
                      <td className={classNames("mono px-4 py-3", (row.put.changeOi ?? 0) >= 0 ? "text-profit" : "text-loss")}>{formatCompact(row.put.changeOi)}</td>
                      <td className="mono px-4 py-3 text-primary">{formatCompact(row.put.oi)}</td>
                      <td className="mono px-4 py-3 text-primary">{row.put.ltp !== null ? formatCurrency(row.put.ltp) : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
    notation: Math.abs(value) >= 100000 ? "compact" : "standard"
  }).format(value);
}

export function MarketPage() {
  const [mode, setMode] = useState<MarketMode>(() => {
    if (typeof window === "undefined") {
      return "market";
    }

    const stored = window.localStorage.getItem(MARKET_MODE_STORAGE_KEY);
    return stored === "option-pro" ? "option-pro" : "market";
  });

  useEffect(() => {
    window.localStorage.setItem(MARKET_MODE_STORAGE_KEY, mode);
  }, [mode]);

  return (
    <div className="space-y-6 pb-10 md:space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mono text-xs uppercase tracking-[0.35em] text-accent">Market Mode</p>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.05em] text-primary md:text-5xl">Live market workspace</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted md:text-base">Switch between broad market context and the dedicated options trader workspace without leaving the same screen.</p>
        </div>
        <div className="inline-flex rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-1">
          {[
            { id: "market", label: "Market View" },
            { id: "option-pro", label: "Option Pro" }
          ].map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id as MarketMode)}
                className={classNames(
                  "rounded-xl px-4 py-2.5 text-sm font-medium transition",
                  active ? "bg-accent text-[var(--accent-contrast)] shadow-glow" : "text-muted hover:text-primary"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "market" ? <MarketModeView /> : <OptionProView />}
    </div>
  );
}












