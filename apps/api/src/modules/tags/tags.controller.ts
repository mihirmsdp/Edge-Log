import type { Request, Response } from "express";
import { ApiError } from "../../lib/errors.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAuthContext } from "../../utils/get-auth-context.js";
import { createTagSchema, updateTagSchema } from "./tags.schemas.js";

export const listTags = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const { data, error } = await supabase.from("tags").select("*").order("name", { ascending: true });

  if (error) {
    throw error;
  }

  response.json({ tags: data });
});

export const createTag = asyncHandler(async (request: Request, response: Response) => {
  const { supabase, user } = getAuthContext(request);
  const payload = createTagSchema.parse(request.body);
  const { data, error } = await supabase.from("tags").insert({ user_id: user.id, name: payload.name, color: payload.color }).select("*").single();

  if (error) {
    throw error;
  }

  response.status(201).json({ tag: data });
});

export const updateTag = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const tagId = String(request.params.tagId);
  const payload = updateTagSchema.parse(request.body);

  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, "At least one field is required");
  }

  const { data, error } = await supabase.from("tags").update(payload).eq("id", tagId).select("*").single();

  if (error) {
    throw error;
  }

  response.json({ tag: data });
});

export const deleteTag = asyncHandler(async (request: Request, response: Response) => {
  const { supabase } = getAuthContext(request);
  const tagId = String(request.params.tagId);
  const { error } = await supabase.from("tags").delete().eq("id", tagId);

  if (error) {
    throw error;
  }

  response.status(204).send();
});
