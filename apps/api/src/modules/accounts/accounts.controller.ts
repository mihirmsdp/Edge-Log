import type { Request, Response } from "express";
import { ApiError } from "../../lib/errors.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";
import { createAccountSchema, updateAccountSchema } from "./accounts.schemas.js";

export const listAccounts = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  response.json({ accounts: data });
});

export const createAccount = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);
  const payload = createAccountSchema.parse(request.body);

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: payload.name,
      starting_balance: payload.startingBalance,
      currency: payload.currency
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  response.status(201).json({ account: data });
});

export const updateAccount = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const accountId = String(request.params.accountId);
  const payload = updateAccountSchema.parse(request.body);

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "At least one field is required");
  }

  const updates = {
    ...(payload.name ? { name: payload.name } : {}),
    ...(payload.startingBalance !== undefined ? { starting_balance: payload.startingBalance } : {}),
    ...(payload.currency ? { currency: payload.currency } : {})
  };

  const { data, error } = await supabase.from("accounts").update(updates).eq("id", accountId).select("*").single();

  if (error) {
    throw error;
  }

  response.json({ account: data });
});

export const deleteAccount = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const accountId = String(request.params.accountId);
  const { error } = await supabase.from("accounts").delete().eq("id", accountId);

  if (error) {
    throw error;
  }

  response.status(204).send();
});
