import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  BookText,
  CandlestickChart,
  LayoutDashboard,
  LogOut,
  Menu,
  MoonStar,
  SunMedium,
  TrendingUp,
  X,
} from "lucide-react";
import { api } from "@/services/api";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { TradesPage } from "@/features/trades/TradesPage";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { PlaybookPage } from "@/features/playbook/PlaybookPage";
import { JournalPage } from "@/features/journal/JournalPage";
import { MarketPage } from "@/features/market/MarketPage";
import { Button } from "@/components/ui/button";
import { classNames, formatCurrency } from "@/lib/format";
import { useTheme } from "@/theme/theme";

const navItems = [
  ["/", "Dashboard", LayoutDashboard],
  ["/trades", "Trade Log", CandlestickChart],
  ["/analytics", "Analytics", BarChart3],
  ["/market", "Market", TrendingUp],
  ["/playbook", "Playbook", BookOpen],
  ["/journal", "Journal", BookText],
] as const;

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
    staleTime: 15_000,
  });

  if (!moversQuery.data?.movers?.length) {
    return null;
  }

  const items = [...moversQuery.data.movers, ...moversQuery.data.movers];

  return (
    <div className="card-surface overflow-hidden rounded-2xl border border-border px-3 py-1.5 md:px-4 md:py-2">
      <div className="flex items-center gap-3">
        <span className="mono shrink-0 text-[10px] uppercase tracking-[0.28em] text-accent">Top Movers</span>
        <div className="ticker-marquee relative min-w-0 flex-1 overflow-hidden">
          <div className="ticker-track flex min-w-max items-center gap-6 whitespace-nowrap pr-6">
            {items.map((mover, index) => (
              <div key={`${mover.symbol}-${index}`} className="inline-flex items-center gap-2 text-xs">
                <span className="mono text-primary">{mover.symbol}</span>
                <span className="mono" style={{ color: "var(--text-muted)" }}>{formatCurrency(mover.price)}</span>
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
    staleTime: 15_000,
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
              <p className="mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>{ticker.label}</p>
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
                <p className="mono mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>Live price</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppSidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleTheme,
  onSignOut,
  theme,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
  theme: "dark" | "light";
}) {
  const location = useLocation();

  const content = (
    <div className={classNames("dashboard-sidebar card-surface flex h-full flex-col rounded-[28px] border border-border/90 p-3", collapsed ? "items-center" : "items-stretch")}>
      <div className={classNames("rounded-2xl border border-border bg-[color:var(--dashboard-chip)] p-3", collapsed ? "w-full px-0" : "") }>
        <div className={classNames("flex items-center gap-3", collapsed ? "justify-center" : "") }>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-accent shadow-[0_8px_22px_rgba(0,125,143,0.16)]">
            <LayoutDashboard className="size-4.5" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="mono text-[11px] uppercase tracking-[0.3em] text-accent">EdgeLog</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.04em] text-primary">Trader OS</p>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--text-muted)" }}>Focus, structure, and review in one workflow.</p>
            </div>
          ) : null}
        </div>
      </div>

      <nav className="mt-3 flex-1 space-y-1.5">
        {navItems.map(([to, label, Icon]) => {
          const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onCloseMobile}
              className={classNames(
                "flex items-center gap-3 rounded-2xl border px-3 py-3 text-[15px] font-medium transition-all duration-150",
                collapsed ? "justify-center px-0" : "",
                isActive
                  ? "border-transparent bg-accent text-[var(--accent-contrast)] shadow-[0_10px_30px_rgba(0,125,143,0.18)]"
                  : "border-transparent text-primary hover:border-border hover:bg-[color:var(--dashboard-chip)]"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="size-4.5 shrink-0" />
              {!collapsed ? <span>{label}</span> : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <Button type="button" variant="outline" onClick={onToggleTheme} className={classNames("h-11 w-full rounded-2xl border-border bg-surface text-primary hover:bg-[color:var(--dashboard-chip)]", collapsed ? "px-0" : "justify-start") }>
          {theme === "dark" ? <SunMedium className="size-4.5 shrink-0" /> : <MoonStar className="size-4.5 shrink-0" />}
          {!collapsed ? <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span> : null}
        </Button>
        <Button type="button" variant="outline" onClick={() => { onCloseMobile(); onSignOut(); }} className={classNames("h-11 w-full rounded-2xl border-border bg-surface text-primary hover:bg-[color:var(--dashboard-chip)]", collapsed ? "px-0" : "justify-start") }>
          <LogOut className="size-4.5 shrink-0" />
          {!collapsed ? <span>Sign out</span> : null}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside className={classNames("hidden lg:block", collapsed ? "w-[88px]" : "w-[250px]")}>{content}</aside>
      {mobileOpen ? (
        <div className="lg:hidden">
          <button type="button" aria-label="Close navigation overlay" onClick={onCloseMobile} className="fixed inset-0 z-40 bg-[color:var(--overlay)]" />
          <aside className="fixed inset-y-0 left-0 z-50 w-[min(84vw,19rem)] p-3">{content}</aside>
        </div>
      ) : null}
    </>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  const [mobileOpen, setMobileOpen] = useState(false);
  const signOut = useMutation({
    mutationFn: api.signOut,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="grid-shell min-h-screen bg-base text-primary">
      <div className="mx-auto flex w-full max-w-[1600px] justify-end px-4 pt-4 lg:hidden lg:px-6">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => setMobileOpen(true)} className="rounded-xl border-border bg-surface text-primary hover:bg-[color:var(--dashboard-chip)]">
          <Menu className="size-4.5" />
        </Button>
      </div>

      <div className="mx-auto w-full max-w-[1600px] space-y-2 px-4 pt-4 lg:px-6 lg:pt-5">
        <MoversMarquee />
        <MarketTickerStrip />
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] items-start gap-4 px-4 py-4 lg:px-6 lg:py-5">
        <AppSidebar
          collapsed={false}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}

          onToggleTheme={toggleTheme}
          onSignOut={() => signOut.mutate()}
          theme={theme}
        />
        <main className="min-w-0 flex-1">{children}</main>
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
        <Route path="/market" element={<MarketPage />} />
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
    return <div className="flex min-h-screen items-center justify-center" style={{ color: "var(--text-muted)" }}>Loading EdgeLog...</div>;
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








