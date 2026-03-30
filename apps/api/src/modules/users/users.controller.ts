import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";
import { updateProfileSchema } from "./users.schemas.js";

export const getMe = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);
  const { data: profile, error } = await supabase.from("profiles").select("id, email, name, created_at, updated_at").eq("id", user.id).single();

  if (error) {
    throw error;
  }

  response.json({ profile });
});

export const updateMe = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);
  const payload = updateProfileSchema.parse(request.body);

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ name: payload.name, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("id, email, name, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  response.json({ profile });
});
