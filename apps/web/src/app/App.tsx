import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api } from "@/services/api";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { TradesPage } from "@/features/trades/TradesPage";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { PlaybookPage } from "@/features/playbook/PlaybookPage";
import { JournalPage } from "@/features/journal/JournalPage";
import { classNames, formatCurrency } from "@/lib/format";
import { useTheme } from "@/theme/theme";

const navItems = [
  ["/", "Dashboard"],
  ["/trades", "Trade Log"],
  ["/analytics", "Analytics"],
  ["/playbook", "Playbook"],
  ["/journal", "Journal"]
] as const;

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function ArrowMini({ positive }: { positive: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {positive ? <path d="M3 10l3-3 2 2 5-5" /> : <path d="M3 6l3 3 2-2 5 5" />}
    </svg>
  );
}

function MoversMarquee() {
  const moversQuery = useQuery({
    queryKey: ["market-top-movers"],
    queryFn: api.getMarketTopMovers,
    retry: false,
    refetchInterval: 30_000,
    staleTime: 15_000
  });

  if (!moversQuery.data?.movers?.length) {
    return null;
  }

  const items = [...moversQuery.data.movers, ...moversQuery.data.movers];

  return (
    <div className="card-surface overflow-hidden rounded-2xl border border-border px-3 py-1.5 md:px-4 md:py-2">
      <div className="flex items-center gap-3">
        <span className="mono shrink-0 text-[10px] uppercase tracking-[0.28em] text-accent/90">Top Movers</span>
        <div className="ticker-marquee relative min-w-0 flex-1 overflow-hidden">
          <div className="ticker-track flex min-w-max items-center gap-6 whitespace-nowrap pr-6">
            {items.map((mover, index) => (
              <div key={`${mover.symbol}-${index}`} className="inline-flex items-center gap-2 text-xs">
                <span className="mono text-primary">{mover.symbol}</span>
                <span className="mono text-muted">{formatCurrency(mover.price)}</span>
                <span className="inline-flex items-center gap-1 text-profit">
                  <ArrowMini positive />
                  <span className="mono">{mover.changePercent.toFixed(2)}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketTickerStrip() {
  const tickerQuery = useQuery({
    queryKey: ["market-ticker-strip"],
    queryFn: api.getMarketTickerStrip,
    retry: false,
    refetchInterval: 30_000,
    staleTime: 15_000
  });

  if (!tickerQuery.data?.tickers?.length) {
    return null;
  }

  return (
    <div className="card-surface rounded-2xl border border-border px-3 py-3 md:px-4 md:py-3.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
        {tickerQuery.data.tickers.map((ticker) => {
          const positive = (ticker.change ?? 0) >= 0;
          return (
            <div key={ticker.id} className="rounded-2xl border border-border bg-[color:var(--dashboard-chip)] px-3 py-2.5 text-center md:px-4 md:py-3">
              <p className="mono text-[10px] uppercase tracking-[0.22em] text-muted">{ticker.label}</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <p className="mono break-words text-base font-semibold leading-tight text-primary md:text-lg">{formatCurrency(ticker.price)}</p>
                {ticker.changePercent !== null ? (
                  <div className={classNames("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium", positive ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>
                    <ArrowMini positive={positive} />
                    <span className="mono">{Math.abs(ticker.changePercent).toFixed(2)}%</span>
                  </div>
                ) : null}
              </div>
              {ticker.change !== null ? (
                <p className={classNames("mono mt-1.5 break-words text-xs", positive ? "text-profit" : "text-loss")}>{positive ? "+" : ""}{formatCurrency(ticker.change)}</p>
              ) : (
                <p className="mono mt-1.5 text-xs text-muted">Live price</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShellNavigation({ onNavigate, onToggleTheme, onSignOut, theme }: { onNavigate?: () => void; onToggleTheme: () => void; onSignOut: () => void; theme: "dark" | "light" }) {
  return (
    <>
      <div>
        <p className="mono text-xs uppercase tracking-[0.35em] text-accent">EdgeLog</p>
        <h1 className="mt-3 text-3xl font-bold text-primary">Trader OS</h1>
        <p className="mt-2 text-sm text-muted">Bloomberg terminal focus with a calmer execution workflow.</p>
      </div>
      <nav className="mt-8 space-y-2 text-sm">
        {navItems.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              classNames(
                "block rounded-2xl border px-4 py-3 transition",
                isActive ? "border-accent bg-elevated text-primary shadow-glow" : "border-transparent bg-transparent text-muted hover:border-border hover:bg-surface hover:text-primary"
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        onClick={onToggleTheme}
        className="mt-6 rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm text-muted transition hover:border-accent hover:text-primary"
      >
        {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      </button>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          onSignOut();
        }}
        className="mt-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm text-muted transition hover:border-accent hover:text-primary"
      >
        Sign out
      </button>
    </>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const signOut = useMutation({
    mutationFn: api.signOut,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    }
  });

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="grid-shell min-h-screen bg-base text-primary">
      <div className="sticky top-0 z-30 border-b border-border bg-[color:var(--bg-base)]/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="mono text-[11px] uppercase tracking-[0.28em] text-accent">EdgeLog</p>
            <p className="truncate text-sm font-medium text-primary">Trader OS</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface text-primary transition hover:border-accent"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] space-y-2 px-4 pt-4 lg:px-6 lg:pt-5">
        <MoversMarquee />
        <MarketTickerStrip />
      </div>

      {mobileMenuOpen ? (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-[color:var(--overlay)]"
          />
          <aside className="card-surface fixed inset-y-0 left-0 z-50 flex w-[min(88vw,21rem)] flex-col overflow-y-auto rounded-r-3xl p-5">
            <ShellNavigation
              onNavigate={() => setMobileMenuOpen(false)}
              onToggleTheme={toggleTheme}
              onSignOut={() => signOut.mutate()}
              theme={theme}
            />
          </aside>
        </div>
      ) : null}

      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 lg:px-6">
        <aside className="card-surface hidden w-64 shrink-0 rounded-3xl p-5 lg:flex lg:flex-col">
          <ShellNavigation onToggleTheme={toggleTheme} onSignOut={() => signOut.mutate()} theme={theme} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function ProtectedApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/trades" element={<TradesPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/playbook" element={<PlaybookPage />} />
        <Route path="/journal" element={<JournalPage />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  const location = useLocation();
  const sessionQuery = useQuery({ queryKey: ["session"], queryFn: api.getSession, retry: false });
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  if (sessionQuery.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading EdgeLog...</div>;
  }

  const isAuthenticated = Boolean(sessionQuery.data?.user);

  if (!isAuthenticated && !isAuthPage) {
    return <Navigate to="/login" replace />;
  }

  if (isAuthenticated && isAuthPage) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}
