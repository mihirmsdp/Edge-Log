import type { Request, Response } from "express";
import type { Json } from "../../types/database.js";
import { ApiError } from "../../lib/errors.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";
import { createPlaybookSchema, updatePlaybookSchema } from "./playbook.schemas.js";

type PlaybookTradeStat = { net_pnl: number | null; rr_multiple: number | null; setup_name: string | null };

type PlaybookRulePayload = {
  rulesMarkdown: string;
  entryCriteria: string;
  exitCriteria: string;
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeRules(rules: Json): PlaybookRulePayload {
  if (Array.isArray(rules)) {
    return {
      rulesMarkdown: rules.map((item) => String(item)).join("\n"),
      entryCriteria: "",
      exitCriteria: ""
    };
  }

  if (rules && typeof rules === "object") {
    return {
      rulesMarkdown: typeof rules.rulesMarkdown === "string" ? rules.rulesMarkdown : "",
      entryCriteria: typeof rules.entryCriteria === "string" ? rules.entryCriteria : "",
      exitCriteria: typeof rules.exitCriteria === "string" ? rules.exitCriteria : ""
    };
  }

  return {
    rulesMarkdown: "",
    entryCriteria: "",
    exitCriteria: ""
  };
}

function serializeRules(payload: PlaybookRulePayload): Json {
  return {
    rulesMarkdown: payload.rulesMarkdown,
    entryCriteria: payload.entryCriteria,
    exitCriteria: payload.exitCriteria
  };
}

function buildStats(name: string, trades: PlaybookTradeStat[]) {
  const matched = trades.filter((trade) => (trade.setup_name ?? "").trim().toLowerCase() === name.trim().toLowerCase());
  const wins = matched.filter((trade) => (trade.net_pnl ?? 0) > 0);
  const losses = matched.filter((trade) => (trade.net_pnl ?? 0) < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + (trade.net_pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + (trade.net_pnl ?? 0), 0));

  return {
    tradeCount: matched.length,
    winRate: matched.length === 0 ? 0 : (wins.length / matched.length) * 100,
    avgR: average(matched.map((trade) => trade.rr_multiple ?? 0).filter((value) => Number.isFinite(value) && value !== 0)),
    profitFactor: grossLoss === 0 ? grossProfit : grossProfit / grossLoss,
    totalPnl: matched.reduce((sum, trade) => sum + (trade.net_pnl ?? 0), 0)
  };
}

function normalizePlaybook(row: any, trades: PlaybookTradeStat[]) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
    ...normalizeRules(row.rules),
    stats: buildStats(row.name, trades)
  };
}

export const listPlaybooks = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const [{ data: setups, error: setupError }, { data: trades, error: tradeError }] = await Promise.all([
    supabase.from("playbook_setups").select("*").order("created_at", { ascending: false }),
    supabase.from("trades").select("setup_name, net_pnl, rr_multiple").not("setup_name", "is", null)
  ]);

  if (setupError) {
    throw setupError;
  }

  if (tradeError) {
    throw tradeError;
  }

  response.json({ playbookSetups: (setups ?? []).map((setup) => normalizePlaybook(setup, trades ?? [])) });
});

export const createPlaybook = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);
  const payload = createPlaybookSchema.parse(request.body);
  const { data, error } = await supabase
    .from("playbook_setups")
    .insert({
      user_id: user.id,
      name: payload.name,
      description: payload.description ?? null,
      rules: serializeRules(payload)
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  response.status(201).json({ playbookSetup: normalizePlaybook(data, []) });
});

export const updatePlaybook = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const setupId = String(request.params.setupId);
  const payload = updatePlaybookSchema.parse(request.body);

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "At least one field is required");
  }

  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.rulesMarkdown !== undefined || payload.entryCriteria !== undefined || payload.exitCriteria !== undefined) {
    const { data: existing, error: existingError } = await supabase.from("playbook_setups").select("rules").eq("id", setupId).single();

    if (existingError) {
      throw existingError;
    }

    const current = normalizeRules(existing.rules);
    update.rules = serializeRules({
      rulesMarkdown: payload.rulesMarkdown ?? current.rulesMarkdown,
      entryCriteria: payload.entryCriteria ?? current.entryCriteria,
      exitCriteria: payload.exitCriteria ?? current.exitCriteria
    });
  }

  const { data, error } = await supabase.from("playbook_setups").update(update).eq("id", setupId).select("*").single();

  if (error) {
    throw error;
  }

  const { data: trades, error: tradeError } = await supabase.from("trades").select("setup_name, net_pnl, rr_multiple").not("setup_name", "is", null);

  if (tradeError) {
    throw tradeError;
  }

  response.json({ playbookSetup: normalizePlaybook(data, trades ?? []) });
});

export const deletePlaybook = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const setupId = String(request.params.setupId);
  const { error } = await supabase.from("playbook_setups").delete().eq("id", setupId);

  if (error) {
    throw error;
  }

  response.status(204).send();
});
