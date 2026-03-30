import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/services/api";
import type { Trade } from "@/types/api";
import { classNames, formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { calcHoldTime, calcPnL, calcRMultiple, calcRisk } from "@/utils/calc";

const assetClasses = ["equity", "future", "option"] as const;
const mistakesOptions = ["Late entry", "Early exit", "Ignored stop", "Oversized position", "Chased move", "No mistake"];

const tradeSchema = z.object({
  accountId: z.string().min(1),
  symbol: z.string().min(1),
  assetClass: z.enum(["equity", "future", "option"]),
  direction: z.enum(["long", "short"]),
  entryPrice: z.coerce.number().positive(),
  exitPrice: z.coerce.number().positive().nullable().optional(),
  stopLoss: z.coerce.number().positive().nullable().optional(),
  takeProfit: z.coerce.number().positive().nullable().optional(),
  size: z.coerce.number().positive(),
  commission: z.coerce.number().nonnegative(),
  entryDate: z.string().min(1),
  exitDate: z.string().nullable().optional(),
  mistakes: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
  rating: z.coerce.number().min(1).max(5).nullable().optional()
});

type TradeFormValues = z.infer<typeof tradeSchema>;

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={classNames("h-5 w-5", filled ? "fill-[var(--warning)] text-[var(--warning)]" : "fill-none text-muted", className)}>
      <path
        d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.078 3.318a1 1 0 00.95.69h3.49c.969 0 1.371 1.24.588 1.81l-2.824 2.052a1 1 0 00-.364 1.118l1.079 3.318c.299.921-.755 1.688-1.539 1.118l-2.823-2.052a1 1 0 00-1.176 0l-2.823 2.052c-.784.57-1.838-.197-1.539-1.118l1.079-3.318a1 1 0 00-.364-1.118L2.98 8.745c-.783-.57-.38-1.81.588-1.81h3.49a1 1 0 00.95-.69l1.078-3.318z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function renderStars(value: number | null | undefined) {
  const count = Math.max(0, Math.min(5, value ?? 0));
  return Array.from({ length: 5 }, (_, index) => <StarIcon key={`${count}-${index}`} filled={index < count} className="h-4 w-4" />);
}

function normalizeAssetClass(value: string | null | undefined): TradeFormValues["assetClass"] {
  if (value === "equity" || value === "future" || value === "option") return value;
  if (value === "stock" || value === "index" || value === "cfd") return "equity";
  if (value === "futures") return "future";
  if (value === "options") return "option";
  return "equity";
}


export function TradesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ from: "", to: "", assetClass: "", symbol: "", direction: "", tagId: "" });
  const [sortBy, setSortBy] = useState("entryDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<string[]>([]);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const params = useMemo(() => {
    const next = new URLSearchParams({ page: String(page), pageSize: "25", sortBy, sortOrder });
    Object.entries(filters).forEach(([key, value]) => { if (value) next.set(key, value); });
    return next;
  }, [page, sortBy, sortOrder, filters]);

  const tradesQuery = useQuery({ queryKey: ["trades", params.toString()], queryFn: () => api.getTrades(params) });
  const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: api.getTags });
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: api.getAccounts });

  useEffect(() => {
    setSelected([]);
  }, [tradesQuery.data?.pagination.page, tradesQuery.data?.pagination.total]);

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteTrades(ids),
    onSuccess: async () => {
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ["trades"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
    }
  });

  const openCreate = () => {
    setEditingTrade(null);
    setModalOpen(true);
  };

  const openEdit = (trade: Trade) => {
    setEditingTrade(trade);
    setModalOpen(true);
  };

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const trades = tradesQuery.data?.trades ?? [];
  const pagination = tradesQuery.data?.pagination;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mono text-xs uppercase tracking-[0.35em] text-accent">Trade Log</p>
          <h2 className="mt-3 text-4xl font-bold">Execution review board</h2>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => deleteMutation.mutate(selected)} disabled={selected.length === 0 || deleteMutation.isPending} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted disabled:opacity-50">
            Delete selected ({selected.length})
          </button>
          <button type="button" onClick={openCreate} className="mono rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-[var(--accent-contrast)]">New trade</button>
        </div>
      </div>

      <section className="card-surface rounded-3xl p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <input type="date" value={filters.from} onChange={(event) => { setFilters((current) => ({ ...current, from: event.target.value })); setPage(1); }} className="rounded-2xl border border-border bg-surface px-4 py-3" />
          <input type="date" value={filters.to} onChange={(event) => { setFilters((current) => ({ ...current, to: event.target.value })); setPage(1); }} className="rounded-2xl border border-border bg-surface px-4 py-3" />
          <select value={filters.assetClass} onChange={(event) => { setFilters((current) => ({ ...current, assetClass: event.target.value })); setPage(1); }} className="rounded-2xl border border-border bg-surface px-4 py-3">
            <option value="">All asset classes</option>
            {assetClasses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input value={filters.symbol} onChange={(event) => { setFilters((current) => ({ ...current, symbol: event.target.value })); setPage(1); }} placeholder="Search symbol" className="rounded-2xl border border-border bg-surface px-4 py-3" />
          <select value={filters.direction} onChange={(event) => { setFilters((current) => ({ ...current, direction: event.target.value })); setPage(1); }} className="rounded-2xl border border-border bg-surface px-4 py-3">
            <option value="">All directions</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <select value={filters.tagId} onChange={(event) => { setFilters((current) => ({ ...current, tagId: event.target.value })); setPage(1); }} className="rounded-2xl border border-border bg-surface px-4 py-3">
            <option value="">All tags</option>
            {(tagsQuery.data?.tags ?? []).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </div>
      </section>

      <section className="card-surface overflow-hidden rounded-3xl">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" checked={selected.length > 0 && selected.length === trades.length} onChange={(event) => setSelected(event.target.checked ? trades.map((trade) => trade.id) : [])} /></th>
                {[
                  ["entryDate", "Date"], ["symbol", "Symbol"], ["direction", "Direction"], ["entryPrice", "Entry"], ["exitPrice", "Exit"], ["size", "Size"], ["netPnl", "P&L ?"], ["netPnlPercent", "P&L %"], ["rrMultiple", "R-multiple"], ["hold", "Hold time"], ["setupName", "Setup"], ["rating", "Rating"]
                ].map(([key, label]) => (
                  <th key={key} className="px-4 py-3">
                    <button type="button" onClick={() => key !== "netPnlPercent" && key !== "hold" ? toggleSort(key) : undefined} className="flex items-center gap-2">
                      {label}
                      {sortBy === key && <span className="mono text-accent">{sortOrder === "asc" ? "\u2191" : "\u2193"}</span>}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const pnlPercent = trade.entry_price && trade.exit_price ? calcPnL(trade.entry_price, trade.exit_price, 1, trade.direction, 0).percent : 0;
                const profitable = (trade.net_pnl ?? 0) >= 0;
                return (
                  <tr key={trade.id} className="border-t border-border/80" style={{ borderLeft: `4px solid ${profitable ? '#22c55e' : '#ef4444'}` }}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(trade.id)} onChange={() => setSelected((current) => current.includes(trade.id) ? current.filter((id) => id !== trade.id) : [...current, trade.id])} /></td>
                    <td className="px-4 py-3 text-muted">{formatDate(trade.entry_date)}</td>
                    <td className="mono px-4 py-3">{trade.symbol}</td>
                    <td className="px-4 py-3"><span className={classNames("rounded-full px-3 py-1 text-xs", trade.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>{trade.direction === "long" ? "Long" : "Short"}</span></td>
                    <td className="mono px-4 py-3">{formatCurrency(trade.entry_price)}</td>
                    <td className="mono px-4 py-3">{trade.exit_price ? formatCurrency(trade.exit_price) : "-"}</td>
                    <td className="mono px-4 py-3">{trade.size}</td>
                    <td className={classNames("mono px-4 py-3", profitable ? "text-profit" : "text-loss")}>{formatCurrency(trade.net_pnl)}</td>
                    <td className={classNames("mono px-4 py-3", profitable ? "text-profit" : "text-loss")}>{formatPercent(pnlPercent)}</td>
                    <td className="mono px-4 py-3">{(trade.rr_multiple ?? 0).toFixed(2)}</td>
                    <td className="mono px-4 py-3">{calcHoldTime(trade.entry_date, trade.exit_date)}</td>
                    <td className="px-4 py-3 text-muted">{trade.setup_name ?? "-"}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1">{renderStars(trade.rating)}</div></td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openEdit(trade)} className="text-accent">Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm text-muted">
          <span>Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1}</span>
          <div className="flex gap-2">
            <button type="button" disabled={(pagination?.page ?? 1) <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-border px-3 py-2 disabled:opacity-50">Prev</button>
            <button type="button" disabled={(pagination?.page ?? 1) >= (pagination?.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)} className="rounded-xl border border-border px-3 py-2 disabled:opacity-50">Next</button>
          </div>
        </div>
      </section>

      {modalOpen && (
        <TradeFormModal
          trade={editingTrade}
          accounts={accountsQuery.data?.accounts ?? []}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function TradeFormModal({ trade, accounts, onClose }: { trade: Trade | null; accounts: Array<{ id: string; name: string; currency: string }>; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"entry" | "notes">("entry");
  const [files, setFiles] = useState<File[]>([]);
  const mutation = useMutation({
    mutationFn: async (values: TradeFormValues) => {
      const payload = {
        ...values,
        notes: values.notes || null,
        rating: values.rating || null,
        exitPrice: values.exitPrice || null,
        stopLoss: values.stopLoss || null,
        takeProfit: values.takeProfit || null,
        exitDate: values.exitDate || null,
        entryDate: new Date(values.entryDate).toISOString(),
        exitDateIso: values.exitDate ? new Date(values.exitDate).toISOString() : null
      };

      const normalized = {
        ...payload,
        exitDate: payload.exitDateIso,
        mistakes: values.mistakes
      };

      delete (normalized as any).exitDateIso;

      const response = trade ? await api.updateTrade(trade.id, normalized) : await api.createTrade(normalized);
      if (files.length > 0) {
        await api.uploadScreenshots(response.trade.id, files.slice(0, 4));
      }
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trades"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
      onClose();
    }
  });

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeSchema),
    defaultValues: trade ? {
      accountId: trade.account_id,
      symbol: trade.symbol,
      assetClass: normalizeAssetClass(trade.asset_class),
      direction: trade.direction,
      entryPrice: trade.entry_price,
      exitPrice: trade.exit_price,
      stopLoss: trade.stop_loss,
      takeProfit: trade.take_profit,
      size: trade.size,
      commission: trade.commission,
      entryDate: trade.entry_date.slice(0, 16),
      exitDate: trade.exit_date ? trade.exit_date.slice(0, 16) : "",
      mistakes: trade.mistakes ? trade.mistakes.split(", ") : [],
      notes: trade.notes ?? "",
      rating: trade.rating ?? 3
    } : {
      accountId: accounts[0]?.id ?? "",
      symbol: "",
      assetClass: "equity",
      direction: "long",
      entryPrice: 0,
      exitPrice: null,
      stopLoss: null,
      takeProfit: null,
      size: 0,
      commission: 0,
      entryDate: new Date().toISOString().slice(0, 16),
      exitDate: "",
      mistakes: [],
      notes: "",
      rating: 3
    }
  });

  const watched = form.watch();
  const pnlPreview = calcPnL(Number(watched.entryPrice ?? 0), Number(watched.exitPrice ?? 0), Number(watched.size ?? 0), watched.direction, Number(watched.commission ?? 0));
  const riskPreview = calcRisk(Number(watched.entryPrice ?? 0), Number(watched.stopLoss ?? 0), Number(watched.size ?? 0));
  const rPreview = calcRMultiple(Number(watched.entryPrice ?? 0), Number(watched.exitPrice ?? 0), Number(watched.stopLoss ?? 0), Number(watched.size ?? 0), watched.direction, Number(watched.commission ?? 0));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--overlay)] px-4 py-8">
      <div className="card-surface w-full max-w-5xl rounded-[32px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">{trade ? "Edit trade" : "Log a trade"}</h3>
            <p className="text-sm text-muted">Capture execution details and review notes in one place.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-border px-3 py-2 text-muted">Close</button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ["entry", "Entry Details"],
            ["notes", "Notes & Media"]
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id as typeof tab)} className={classNames("rounded-full px-4 py-2 text-sm", tab === id ? "bg-accent text-[var(--accent-contrast)]" : "border border-border text-muted")}>{label}</button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
          <form className="space-y-6" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            {tab === "entry" && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Symbol"><input className="field" {...form.register("symbol")} /></Field>
                <Field label="Asset class"><select className="field" {...form.register("assetClass")}>{assetClasses.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
                <Field label="Account"><select className="field" {...form.register("accountId")}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
                <Field label="Direction"><div className="flex gap-2">{(["long", "short"] as const).map((item) => <button type="button" key={item} onClick={() => form.setValue("direction", item)} className={classNames("flex-1 rounded-2xl border px-4 py-3", watched.direction === item ? "border-accent bg-accent/10 text-accent" : "border-border text-muted")}>{item}</button>)}</div></Field>
                <Field label="Entry price"><input type="number" step="0.01" className="field mono" {...form.register("entryPrice")} /></Field>
                <Field label="Exit price"><input type="number" step="0.01" className="field mono" {...form.register("exitPrice")} /></Field>
                <Field label="Stop price"><input type="number" step="0.01" className="field mono" {...form.register("stopLoss")} /></Field>
                <Field label="Target price"><input type="number" step="0.01" className="field mono" {...form.register("takeProfit")} /></Field>
                <Field label="Size"><input type="number" step="0.01" className="field mono" {...form.register("size")} /></Field>
                <Field label="Commission"><input type="number" step="0.01" className="field mono" {...form.register("commission")} /></Field>
                <Field label="Entry date & time"><input type="datetime-local" className="field" {...form.register("entryDate")} /></Field>
                <Field label="Exit date & time"><input type="datetime-local" className="field" {...form.register("exitDate")} /></Field>
              </div>
            )}

            {tab === "notes" && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Mistakes"><div className="flex flex-wrap gap-2">{mistakesOptions.map((item) => { const checked = watched.mistakes.includes(item); return <button key={item} type="button" onClick={() => form.setValue("mistakes", checked ? watched.mistakes.filter((value) => value !== item) : [...watched.mistakes, item])} className={classNames("rounded-full border px-3 py-2 text-xs", checked ? "border-loss bg-loss/10 text-loss" : "border-border text-muted")}>{item}</button>; })}</div></Field>
                  <Field label="Rating"><div className="flex gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => form.setValue("rating", value)} className="rounded-lg p-1 transition hover:bg-surface"><StarIcon filled={(watched.rating ?? 0) >= value} className="h-6 w-6" /></button>)}</div></Field>
                </div>
                <Field label="Notes (Markdown)"><textarea rows={8} className="field" {...form.register("notes")} /></Field>
                <Field label="Screenshots"><input type="file" multiple accept="image/*" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))} className="field" /></Field>
                {files.length > 0 && <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">{files.map((file) => file.name).join(", ")}</div>}
              </div>
            )}

            {mutation.error && <div className="rounded-2xl border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">{mutation.error.message}</div>}

            <div className="flex gap-3">
              <button type="submit" className="mono rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-[var(--accent-contrast)]">{mutation.isPending ? "Saving..." : trade ? "Update trade" : "Save trade"}</button>
              <button type="button" onClick={onClose} className="rounded-2xl border border-border px-5 py-3 text-sm text-muted">Cancel</button>
            </div>
          </form>

          <div className="card-surface rounded-3xl p-5">
            <p className="mono text-xs uppercase tracking-[0.3em] text-accent">Live preview</p>
            <div className="mt-5 space-y-4">
              <PreviewRow label="P&L ?" value={formatCurrency(pnlPreview.dollar)} tone={pnlPreview.dollar >= 0 ? "profit" : "loss"} />
              <PreviewRow label="P&L %" value={formatPercent(pnlPreview.percent)} tone={pnlPreview.percent >= 0 ? "profit" : "loss"} />
              <PreviewRow label="Risk ?" value={formatCurrency(riskPreview.dollar)} />
              <PreviewRow label="R multiple" value={rPreview.toFixed(2)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-muted">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function PreviewRow({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-4">
      <p className="text-xs uppercase tracking-[0.25em] text-muted">{label}</p>
      <p className={classNames("mono mt-2 text-2xl font-semibold", tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-primary")}>{value}</p>
    </div>
  );
}





