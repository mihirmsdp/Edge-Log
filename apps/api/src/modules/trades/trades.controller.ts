import type { Request, Response } from "express";
import { ApiError } from "../../lib/errors.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";
import { buildTradeInsertPayload, buildTradeUpdatePayload, listTradesPage, replaceTradeTags, tradeSelect } from "./trades.service.js";
import { createTradeSchema, createTradeScreenshotSchema, listTradesQuerySchema, updateTradeSchema } from "./trades.schemas.js";

export const listTrades = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const query = listTradesQuerySchema.parse(request.query);
  const result = await listTradesPage(supabase, query);

  response.json(result);
});

export const getTrade = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const tradeId = String(request.params.id);
  const { data, error } = await supabase.from("trades").select(tradeSelect).eq("id", tradeId).single();

  if (error) {
    throw error;
  }

  response.json({ trade: data });
});

export const createTrade = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);
  const payload = createTradeSchema.parse(request.body);
  const { tagIds, ...tradeFields } = payload;

  const { data: trade, error } = await supabase
    .from("trades")
    .insert(buildTradeInsertPayload(tradeFields, user.id))
    .select("id")
    .single();

  if (error || !trade) {
    throw error ?? new ApiError(400, "Unable to create trade");
  }

  await replaceTradeTags(supabase, trade.id, tagIds);

  const { data: freshTrade, error: freshError } = await supabase.from("trades").select(tradeSelect).eq("id", trade.id).single();

  if (freshError) {
    throw freshError;
  }

  response.status(201).json({ trade: freshTrade });
});

export const updateTrade = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const tradeId = String(request.params.id);
  const payload = updateTradeSchema.parse(request.body);
  const { tagIds, ...tradeFields } = payload;

  const { error } = await supabase.from("trades").update(buildTradeUpdatePayload(tradeFields)).eq("id", tradeId);

  if (error) {
    throw error;
  }

  await replaceTradeTags(supabase, tradeId, tagIds);

  const { data: trade, error: tradeError } = await supabase.from("trades").select(tradeSelect).eq("id", tradeId).single();

  if (tradeError) {
    throw tradeError;
  }

  response.json({ trade });
});

export const deleteTrade = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const tradeId = String(request.params.id);
  const { error } = await supabase.from("trades").delete().eq("id", tradeId);

  if (error) {
    throw error;
  }

  response.status(204).send();
});

export const bulkDeleteTrades = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const ids = Array.isArray(request.body?.ids) ? request.body.ids.map(String).filter(Boolean) : [];

  if (ids.length === 0) {
    throw new ApiError(400, "No trade ids provided");
  }

  const { error } = await supabase.from("trades").delete().in("id", ids);

  if (error) {
    throw error;
  }

  response.status(204).send();
});

export const addTradeScreenshot = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);
  const tradeId = String(request.params.id);

  if (!Array.isArray(request.files) || request.files.length === 0) {
    throw new ApiError(400, "At least one screenshot is required");
  }

  const uploaded = [];

  for (const file of request.files as Express.Multer.File[]) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${user.id}/${tradeId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("trade-screenshots")
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    const { data: screenshot, error: screenshotError } = await supabase
      .from("trade_screenshots")
      .insert({ trade_id: tradeId, file_path: filePath })
      .select("*")
      .single();

    if (screenshotError) {
      throw screenshotError;
    }

    uploaded.push(screenshot);
  }

  response.status(201).json({ screenshots: uploaded });
});

export const addTradeScreenshotMetadata = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const tradeId = String(request.params.id);
  const payload = createTradeScreenshotSchema.parse(request.body);

  const { data, error } = await supabase
    .from("trade_screenshots")
    .insert({ trade_id: tradeId, file_path: payload.filePath })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  response.status(201).json({ screenshot: data });
});

export const deleteTradeScreenshot = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const tradeId = String(request.params.id);
  const screenshotId = String(request.params.screenshotId);
  const { data: screenshot, error: fetchError } = await supabase.from("trade_screenshots").select("file_path").eq("id", screenshotId).eq("trade_id", tradeId).single();

  if (fetchError) {
    throw fetchError;
  }

  const { error: dbError } = await supabase.from("trade_screenshots").delete().eq("id", screenshotId).eq("trade_id", tradeId);

  if (dbError) {
    throw dbError;
  }

  if (screenshot?.file_path) {
    await supabase.storage.from("trade-screenshots").remove([screenshot.file_path]);
  }

  response.status(204).send();
});
