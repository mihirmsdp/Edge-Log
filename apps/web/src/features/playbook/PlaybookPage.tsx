import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { api } from "@/services/api";
import type { PlaybookSetup } from "@/types/api";
import { classNames, formatCurrency, formatPercent } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";

const playbookSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(4000).optional().default(""),
  rulesMarkdown: z.string().max(12000).optional().default(""),
  entryCriteria: z.string().max(6000).optional().default(""),
  exitCriteria: z.string().max(6000).optional().default("")
});

type PlaybookFormValues = z.infer<typeof playbookSchema>;

export function PlaybookPage() {
  const queryClient = useQueryClient();
  const [editingPlaybook, setEditingPlaybook] = useState<PlaybookSetup | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const playbooksQuery = useQuery({ queryKey: ["playbooks"], queryFn: api.getPlaybooks });

  const deleteMutation = useMutation({
    mutationFn: api.deletePlaybook,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["playbooks"] });
      await queryClient.invalidateQueries({ queryKey: ["trades"] });
      await queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
    }
  });

  const openCreate = () => {
    setEditingPlaybook(null);
    setModalOpen(true);
  };

  const openEdit = (playbook: PlaybookSetup) => {
    setEditingPlaybook(playbook);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mono text-xs uppercase tracking-[0.35em] text-accent">Playbook</p>
          <h2 className="mt-3 text-4xl font-bold">Repeatable setups library</h2>
          <p className="mt-2 text-sm text-muted">Keep the setups you trust visible, measurable, and directly linked to execution history.</p>
        </div>
        <button type="button" onClick={openCreate} className="mono rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-[var(--accent-contrast)]">
          New setup
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {(playbooksQuery.data?.playbookSetups ?? []).map((playbook) => (
          <article key={playbook.id} className="card-surface card-hover rounded-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono text-xs uppercase tracking-[0.3em] text-accent">{playbook.stats.tradeCount} trades</p>
                <h3 className="mt-3 text-2xl font-semibold">{playbook.name}</h3>
                <p className="mt-2 text-sm text-muted">{playbook.description || "No description added yet."}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => openEdit(playbook)} className="rounded-2xl border border-border px-3 py-2 text-sm text-muted hover:text-primary">Edit</button>
                <button type="button" onClick={() => deleteMutation.mutate(playbook.id)} className="rounded-2xl border border-loss/40 px-3 py-2 text-sm text-loss">Delete</button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <StatTile label="Win Rate" value={formatPercent(playbook.stats.winRate)} />
              <StatTile label="Avg R" value={playbook.stats.avgR.toFixed(2)} />
              <StatTile label="Trades" value={String(playbook.stats.tradeCount)} />
              <StatTile label="P&L" value={formatCurrency(playbook.stats.totalPnl)} tone={playbook.stats.totalPnl >= 0 ? "profit" : "loss"} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <MarkdownPanel title="Rules" content={playbook.rulesMarkdown} />
              <MarkdownPanel title="Entry Criteria" content={playbook.entryCriteria} />
              <MarkdownPanel title="Exit Criteria" content={playbook.exitCriteria} />
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <p className={classNames("mono text-sm", playbook.stats.profitFactor >= 1 ? "text-profit" : "text-loss")}>Profit factor {playbook.stats.profitFactor.toFixed(2)}</p>
              <Link to={`/trades?setupName=${encodeURIComponent(playbook.name)}`} className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                View setup trades
              </Link>
            </div>
          </article>
        ))}
      </div>

      {modalOpen && <PlaybookModal playbook={editingPlaybook} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function PlaybookModal({ playbook, onClose }: { playbook: PlaybookSetup | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: PlaybookFormValues) => (playbook ? api.updatePlaybook(playbook.id, values) : api.createPlaybook(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["playbooks"] });
      onClose();
    }
  });

  const form = useForm<PlaybookFormValues>({
    resolver: zodResolver(playbookSchema),
    defaultValues: playbook
      ? {
          name: playbook.name,
          description: playbook.description ?? "",
          rulesMarkdown: playbook.rulesMarkdown,
          entryCriteria: playbook.entryCriteria,
          exitCriteria: playbook.exitCriteria
        }
      : {
          name: "",
          description: "",
          rulesMarkdown: "",
          entryCriteria: "",
          exitCriteria: ""
        }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--overlay)] px-4 py-8">
      <div className="card-surface w-full max-w-4xl rounded-[32px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">{playbook ? "Edit setup" : "Create playbook setup"}</h3>
            <p className="text-sm text-muted">Document the checklist behind a high-conviction trade idea.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-border px-3 py-2 text-muted">Close</button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Setup name"><input className="field" {...form.register("name")} /></Field>
            <Field label="Description"><input className="field" {...form.register("description")} /></Field>
          </div>
          <Field label="Rules (Markdown)"><textarea rows={8} className="field" {...form.register("rulesMarkdown")} /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Entry criteria"><textarea rows={7} className="field" {...form.register("entryCriteria")} /></Field>
            <Field label="Exit criteria"><textarea rows={7} className="field" {...form.register("exitCriteria")} /></Field>
          </div>

          {mutation.error && <div className="rounded-2xl border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">{mutation.error.message}</div>}

          <div className="flex gap-3">
            <button type="submit" className="mono rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-[var(--accent-contrast)]">{mutation.isPending ? "Saving..." : playbook ? "Update setup" : "Create setup"}</button>
            <button type="button" onClick={onClose} className="rounded-2xl border border-border px-5 py-3 text-sm text-muted">Cancel</button>
          </div>
        </form>
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

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-4">
      <p className="text-xs uppercase tracking-[0.25em] text-muted">{label}</p>
      <p className={classNames("mono mt-3 text-xl font-semibold", tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-primary")}>{value}</p>
    </div>
  );
}

function MarkdownPanel({ title, content }: { title: string; content: string }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-muted">{title}</p>
      <div className="markdown-content mt-3 max-w-none text-sm text-primary" dangerouslySetInnerHTML={{ __html: renderMarkdown(content || "-") }} />
    </section>
  );
}


