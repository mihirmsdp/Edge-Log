import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, API_BASE } from "@/services/api";
import { classNames, formatCurrency, formatDate } from "@/lib/format";
import type { NiftyLivePricePayload, PostmarketAnalysisPayload, PremarketAnalysisPayload } from "@/types/api";

const COLLAPSE_KEY_PREFIX = "edgelog-market-analysis-collapsed";
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const MARKET_OPEN_MINUTES = 9 * 60 + 15;
const MARKET_CLOSE_MINUTES = 15 * 60 + 30;

type MarketPhase = "premarket" | "live" | "postmarket";

function collapseStorageKey(date: string) {
  return `${COLLAPSE_KEY_PREFIX}:${date}`;
}

function formatLevel(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function getIstClock() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute"))
  };
}

function getMarketPhase(date: string): MarketPhase {
  const ist = getIstClock();
  if (date < ist.date) return "postmarket";
  if (date > ist.date) return "premarket";
  if (ist.minutes < MARKET_OPEN_MINUTES) return "premarket";
  if (ist.minutes < MARKET_CLOSE_MINUTES) return "live";
  return "postmarket";
}

function getBiasTone(bias: PremarketAnalysisPayload["analysis"]["sessionBias"]) {
  if (bias === "Bullish") return "profit";
  if (bias === "Bearish") return "loss";
  return "muted";
}

function getVerdictTone(verdict: PostmarketAnalysisPayload["analysis"]["sessionVerdict"]) {
  if (verdict === "Constructive") return "profit";
  if (verdict === "Challenging") return "loss";
  return "muted";
}

function openAnalysisStream(
  kind: "premarket" | "postmarket",
  date: string,
  refresh: boolean,
  controls: {
    setLoading: (value: boolean) => void;
    setStatus: (value: string) => void;
    setError: (value: string | null) => void;
    setPremarketPayload: (value: PremarketAnalysisPayload | null) => void;
    setPostmarketPayload: (value: PostmarketAnalysisPayload | null) => void;
    eventSourceRef: React.MutableRefObject<EventSource | null>;
  }
) {
  controls.setLoading(true);
  controls.setError(null);
  controls.setStatus(refresh ? `Refreshing ${kind} analysis...` : `Loading ${kind} analysis...`);

  const params = new URLSearchParams({ date });
  if (refresh) {
    params.set("refresh", "true");
  }

  let settled = false;
  const source = new EventSource(`${API_BASE}/journal/${kind}?${params.toString()}`, { withCredentials: true });
  controls.eventSourceRef.current = source;

  source.addEventListener("status", (event) => {
    const data = JSON.parse((event as MessageEvent).data) as { message: string };
    controls.setStatus(data.message);
  });

  source.addEventListener("complete", (event) => {
    settled = true;
    if (kind === "premarket") {
      controls.setPremarketPayload(JSON.parse((event as MessageEvent).data) as PremarketAnalysisPayload);
      controls.setPostmarketPayload(null);
    } else {
      controls.setPostmarketPayload(JSON.parse((event as MessageEvent).data) as PostmarketAnalysisPayload);
      controls.setPremarketPayload(null);
    }
    controls.setLoading(false);
    controls.setError(null);
    source.close();
  });

  source.addEventListener("failure", (event) => {
    settled = true;
    const data = JSON.parse((event as MessageEvent).data) as { message: string };
    controls.setError(data.message);
    controls.setLoading(false);
    source.close();
  });

  source.onerror = () => {
    if (!settled) {
      controls.setError(`Unable to open the ${kind} analysis stream.`);
      controls.setLoading(false);
    }
    source.close();
  };

  return source;
}

export function PremktAnalysis({ date }: { date: string }) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [phase, setPhase] = useState<MarketPhase>(() => getMarketPhase(date));
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading market context...");
  const [error, setError] = useState<string | null>(null);
  const [premarketPayload, setPremarketPayload] = useState<PremarketAnalysisPayload | null>(null);
  const [postmarketPayload, setPostmarketPayload] = useState<PostmarketAnalysisPayload | null>(null);

  useEffect(() => {
    const syncPhase = () => setPhase(getMarketPhase(date));
    syncPhase();
    const interval = window.setInterval(syncPhase, 60_000);
    return () => window.clearInterval(interval);
  }, [date]);

  useEffect(() => {
    const stored = window.localStorage.getItem(collapseStorageKey(date));
    setCollapsed(stored === "true");
  }, [date]);

  const livePriceQuery = useQuery<NiftyLivePricePayload>({
    queryKey: ["journal-live-price", date, phase],
    queryFn: api.getJournalLivePrice,
    enabled: phase === "live",
    refetchInterval: 30_000,
    retry: 1
  });

  useEffect(() => {
    eventSourceRef.current?.close();
    setError(null);
    setPremarketPayload(null);
    setPostmarketPayload(null);

    if (phase === "live") {
      setLoading(false);
      setStatus("Tracking live NIFTY 50 price...");
      return;
    }

    const source = openAnalysisStream(phase, date, false, {
      setLoading,
      setStatus,
      setError,
      setPremarketPayload,
      setPostmarketPayload,
      eventSourceRef
    });

    return () => {
      source?.close();
      eventSourceRef.current = null;
    };
  }, [date, phase]);

  const generatedAt = phase === "premarket" ? premarketPayload?.generatedAt : postmarketPayload?.generatedAt;
  const canRegenerate = useMemo(() => {
    if (phase === "live" || !generatedAt) {
      return false;
    }

    return Date.now() - new Date(generatedAt).getTime() > THIRTY_MINUTES_MS;
  }, [generatedAt, phase]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(collapseStorageKey(date), String(next));
  };

  const regenerate = () => {
    if (phase === "live") return;
    eventSourceRef.current?.close();
    openAnalysisStream(phase, date, true, {
      setLoading,
      setStatus,
      setError,
      setPremarketPayload,
      setPostmarketPayload,
      eventSourceRef
    });
  };

  return (
    <section className="card-surface overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <button type="button" onClick={toggleCollapsed} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="text-xl">?</span>
          <div className="min-w-0">
            <p className="mono truncate text-sm uppercase tracking-[0.25em] text-accent">{phase === "premarket" ? "Premarket Analysis" : phase === "live" ? "Live NIFTY" : "Post-market Review"} · {date}</p>
            <p className="text-sm text-muted">{phase === "premarket" ? "Gemini briefing before the open" : phase === "live" ? "Live index pulse during market hours" : "Gemini session review after the close"}</p>
          </div>
        </button>
        {canRegenerate && !loading && (
          <button type="button" onClick={regenerate} className="rounded-2xl border border-border bg-surface px-4 py-2 text-sm text-muted hover:border-accent hover:text-primary">
            Regenerate
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="p-5">
          {phase === "live" ? <LivePricePanel query={livePriceQuery} /> : null}
          {phase !== "live" && loading && !premarketPayload && !postmarketPayload ? <Skeleton status={status} /> : null}

          {!loading && error && (
            <div className="rounded-2xl border border-loss/20 bg-loss/10 p-4 text-sm text-loss">
              <p>{error}</p>
              {phase !== "live" && (
                <button type="button" onClick={regenerate} className="mt-3 rounded-xl border border-loss/40 px-3 py-2 text-xs uppercase tracking-[0.2em]">
                  Try again
                </button>
              )}
            </div>
          )}

          {phase === "premarket" && premarketPayload ? <PremarketContent payload={premarketPayload} /> : null}
          {phase === "postmarket" && postmarketPayload ? <PostmarketContent payload={postmarketPayload} /> : null}
        </div>
      )}
    </section>
  );
}

function LivePricePanel({ query }: { query: { isLoading: boolean; isError: boolean; data: NiftyLivePricePayload | undefined } }) {
  if (query.isLoading) {
    return <Skeleton status="Fetching live NIFTY 50 price..." />;
  }

  if (query.isError || !query.data) {
    return <div className="rounded-2xl border border-loss/20 bg-loss/10 p-4 text-sm text-loss">Unable to load the live NIFTY 50 price right now.</div>;
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-6 text-center">
      <p className="mono text-xs uppercase tracking-[0.3em] text-accent">{query.data.symbol}</p>
      <p className="mono mt-4 text-5xl font-semibold text-primary">{formatLevel(query.data.spot)}</p>
      <p className="mt-3 text-sm text-muted">Source: {query.data.source} • Updated {formatDate(query.data.fetchedAt, { hour: "2-digit", minute: "2-digit" })}</p>
    </div>
  );
}

function PremarketContent({ payload }: { payload: PremarketAnalysisPayload }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={classNames("mono rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]", getBiasTone(payload.analysis.sessionBias) === "profit" && "bg-profit/10 text-profit", getBiasTone(payload.analysis.sessionBias) === "loss" && "bg-loss/10 text-loss", getBiasTone(payload.analysis.sessionBias) === "muted" && "bg-elevated text-muted")}>
              {payload.analysis.sessionBias}
            </span>
            <span className="mono text-sm text-muted">{payload.analysis.biasStrength}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-primary">{payload.analysis.summary}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mono text-xs uppercase tracking-[0.25em] text-muted">Key Levels</p>
            <p className="mt-2 text-sm text-muted">Important support, resistance, and option reference levels for the session.</p>
          </div>
          <div className="rounded-2xl border border-border bg-base px-4 py-3 text-center lg:min-w-44">
            <p className="mono text-xs uppercase tracking-[0.2em] text-muted">Spot</p>
            <p className="mono mt-1 text-2xl font-semibold text-primary">{formatLevel(payload.analysis.levels.spot)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <LevelGroup title="Resistance" tone="loss" levels={payload.analysis.levels.resistance.map((level, index) => ({ ...level, label: `R${payload.analysis.levels.resistance.length - index}` }))} />
          <div className="grid gap-3 md:grid-cols-3">
            <Metric label="Day Range" value={`${formatLevel(payload.analysis.levels.dayRange.low)} - ${formatLevel(payload.analysis.levels.dayRange.high)}`} />
            <Metric label="Weekly Pivot" value={formatLevel(payload.analysis.levels.weeklyPivot)} />
            <Metric label="Max Pain" value={formatLevel(payload.analysis.levels.maxPain)} />
          </div>
          <LevelGroup title="Support" tone="profit" levels={payload.analysis.levels.support.map((level, index) => ({ ...level, label: `S${index + 1}` }))} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="mono text-xs uppercase tracking-[0.25em] text-muted">Scenarios</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ScenarioCard title="Bull case" tone="profit" trigger={payload.analysis.scenarios.bullCase.trigger} target={payload.analysis.scenarios.bullCase.target} invalidation={payload.analysis.scenarios.bullCase.invalidation} />
          <ScenarioCard title="Bear case" tone="loss" trigger={payload.analysis.scenarios.bearCase.trigger} target={payload.analysis.scenarios.bearCase.target} invalidation={payload.analysis.scenarios.bearCase.invalidation} />
        </div>
      </section>

      <InfoStrip title="Global Cues" body={`${payload.analysis.globalCues.sentiment} · ${payload.analysis.globalCues.notes}`} />
      <InfoStrip title="Options" body={payload.analysis.optionsNote} />
      <InfoStrip title="Watchlist" body={payload.analysis.watchlist.map((item) => item.symbol).join(" / ")} />
      <InfoStrip title="Risk Events" body={payload.analysis.riskEvents.join(" / ")} tone="loss" />
      <p className="text-xs text-muted">{payload.analysis.disclaimer}</p>
    </div>
  );
}

function PostmarketContent({ payload }: { payload: PostmarketAnalysisPayload }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={classNames("mono rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]", getVerdictTone(payload.analysis.sessionVerdict) === "profit" && "bg-profit/10 text-profit", getVerdictTone(payload.analysis.sessionVerdict) === "loss" && "bg-loss/10 text-loss", getVerdictTone(payload.analysis.sessionVerdict) === "muted" && "bg-elevated text-muted")}>
              {payload.analysis.sessionVerdict}
            </span>
            <span className="mono text-sm text-muted">{payload.analysis.dayType}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-primary">{payload.analysis.summary}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="mono text-xs uppercase tracking-[0.25em] text-muted">Premarket Review</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge label={`Accuracy ${payload.analysis.premarketReview.accuracy}`} tone={payload.analysis.premarketReview.accuracy === "High" ? "profit" : payload.analysis.premarketReview.accuracy === "Low" ? "loss" : "muted"} />
          <Badge label={`Useful ${payload.analysis.premarketReview.usefulness}`} tone={payload.analysis.premarketReview.usefulness === "High" ? "profit" : payload.analysis.premarketReview.usefulness === "Low" ? "loss" : "muted"} />
        </div>
        <p className="mt-4 text-sm leading-6 text-primary">{payload.analysis.premarketReview.notes}</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <ListPanel title="What Worked" items={payload.analysis.whatWorked} tone="profit" />
        <ListPanel title="What Failed" items={payload.analysis.whatFailed} tone="loss" />
        <ListPanel title="Tomorrow Focus" items={payload.analysis.tomorrowFocus} tone="accent" />
      </div>

      <p className="text-xs text-muted">{payload.analysis.disclaimer}</p>
    </div>
  );
}

function Skeleton({ status }: { status: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{status}</p>
      {[0, 1, 2].map((row) => (
        <div key={row} className="animate-pulse rounded-2xl border border-border bg-surface p-4">
          <div className="h-4 w-1/3 rounded bg-elevated" />
          <div className="mt-3 h-3 w-full rounded bg-elevated" />
          <div className="mt-2 h-3 w-4/5 rounded bg-elevated" />
        </div>
      ))}
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "profit" | "loss" | "muted" }) {
  return <span className={classNames("mono rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]", tone === "profit" && "bg-profit/10 text-profit", tone === "loss" && "bg-loss/10 text-loss", tone === "muted" && "bg-elevated text-muted")}>{label}</span>;
}

function LevelGroup({ title, tone, levels }: { title: string; tone: "profit" | "loss"; levels: Array<PremarketAnalysisPayload["analysis"]["levels"]["support"][number] & { label: string }> }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <p className={classNames("mono text-xs uppercase tracking-[0.25em]", tone === "profit" ? "text-profit" : "text-loss")}>{title}</p>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {levels.map((level) => (
          <CompactLevelCard key={`${title}-${level.label}-${level.price}`} label={level.label} level={level} tone={tone} />
        ))}
      </div>
    </div>
  );
}

function CompactLevelCard({ label, level, tone }: { label: string; level: PremarketAnalysisPayload["analysis"]["levels"]["support"][number]; tone: "profit" | "loss" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-base p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="mono shrink-0 text-xs uppercase tracking-[0.2em] text-muted">{label}</span>
        <span className={classNames("mono text-base text-right", tone === "profit" ? "text-profit" : "text-loss", level.type === "Strong" && "font-bold")}>{formatLevel(level.price)}</span>
      </div>
      <p className="mt-3 break-words text-sm leading-6 text-muted">{level.note}</p>
      <p className={classNames("mono mt-3 text-[11px] uppercase tracking-[0.2em]", tone === "profit" ? "text-profit" : "text-loss", level.type === "Strong" ? "font-bold" : "font-normal")}>{level.type}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-base px-3 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mono mt-2 break-words text-sm text-primary">{value}</p>
    </div>
  );
}

function ScenarioCard({ title, tone, trigger, target, invalidation }: { title: string; tone: "profit" | "loss"; trigger: string; target: number; invalidation: number }) {
  return (
    <div className="rounded-2xl border border-border bg-base p-4">
      <p className={classNames("mono text-xs uppercase tracking-[0.25em]", tone === "profit" ? "text-profit" : "text-loss")}>{title}</p>
      <p className="mt-3 text-sm text-primary">{trigger}</p>
      <div className="mt-4 grid gap-2 text-sm text-muted">
        <div>Target: <span className="mono text-primary">{formatLevel(target)}</span></div>
        <div>Stop: <span className="mono text-primary">{formatLevel(invalidation)}</span></div>
      </div>
    </div>
  );
}

function InfoStrip({ title, body, tone }: { title: string; body: string; tone?: "loss" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className={classNames("mono text-xs uppercase tracking-[0.2em]", tone === "loss" ? "text-loss" : "text-muted")}>{title}</p>
      <p className="mt-2 text-sm text-primary">{body}</p>
    </div>
  );
}

function ListPanel({ title, items, tone }: { title: string; items: string[]; tone: "profit" | "loss" | "accent" }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className={classNames("mono text-xs uppercase tracking-[0.25em]", tone === "profit" && "text-profit", tone === "loss" && "text-loss", tone === "accent" && "text-accent")}>{title}</p>
      <div className="mt-4 space-y-2 text-sm text-primary">
        {items.map((item) => (
          <p key={`${title}-${item}`}>• {item}</p>
        ))}
      </div>
    </section>
  );
}


