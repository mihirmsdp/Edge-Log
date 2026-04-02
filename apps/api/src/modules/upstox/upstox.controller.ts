import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";
import { consumeUpstoxState, deleteUpstoxConnection, exchangeUpstoxCode, getUpstoxAuthorizeUrl, getUpstoxConnection, saveUpstoxConnection } from "./upstox.service.js";
import { importUpstoxTrades, getUpstoxImportPreview } from "./upstox-import.service.js";
import { importUpstoxTradesSchema, upstoxTradeImportQuerySchema } from "./upstox.schemas.js";

function getFrontendRedirect(path: string, status: "connected" | "error", message?: string) {
  const url = new URL(path.startsWith("/") ? path : "/market", env.CLIENT_URL);
  url.searchParams.set("upstox", status);
  if (message) {
    url.searchParams.set("message", message);
  }
  return url.toString();
}

export const getUpstoxStatus = asyncHandler(async (request: Request, response: Response) => {
  const { user } = getAuthContext(request);
  const status = await getUpstoxConnection(user.id);
  response.json(status);
});

export const redirectToUpstoxConnect = asyncHandler(async (request: Request, response: Response) => {
  const { user } = getAuthContext(request);
  const returnTo = typeof request.query.returnTo === "string" ? request.query.returnTo : "/market";
  const authorizeUrl = getUpstoxAuthorizeUrl(user.id, returnTo);
  response.redirect(authorizeUrl);
});

export const handleUpstoxCallback = asyncHandler(async (request: Request, response: Response) => {
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state = typeof request.query.state === "string" ? request.query.state : "";

  if (!code || !state) {
    response.redirect(getFrontendRedirect("/market", "error", "Missing Upstox authorization response."));
    return;
  }

  try {
    const statePayload = consumeUpstoxState(state);
    const token = await exchangeUpstoxCode(code);
    await saveUpstoxConnection(statePayload.userId, token);
    response.redirect(getFrontendRedirect(statePayload.returnTo, "connected"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to connect Upstox";
    response.redirect(getFrontendRedirect("/market", "error", message));
  }
});

export const disconnectUpstox = asyncHandler(async (request: Request, response: Response) => {
  const { user } = getAuthContext(request);
  await deleteUpstoxConnection(user.id);
  response.status(204).send();
});

export const getUpstoxConfig = asyncHandler(async (_request: Request, response: Response) => {
  response.json({
    enabled: Boolean(env.UPSTOX_CLIENT_ID && env.UPSTOX_CLIENT_SECRET && env.UPSTOX_REDIRECT_URI && env.UPSTOX_STATE_SECRET)
  });
});

export const listUpstoxTradeImportPreview = asyncHandler(async (request: Request, response: Response) => {
  const { user } = getAuthContext(request);
  const query = upstoxTradeImportQuerySchema.parse(request.query);
  const result = await getUpstoxImportPreview(user.id, query);
  response.json(result);
});

export const runUpstoxTradeImport = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);
  const payload = importUpstoxTradesSchema.parse(request.body);
  const result = await importUpstoxTrades(supabase, user.id, payload);
  response.status(201).json(result);
});

