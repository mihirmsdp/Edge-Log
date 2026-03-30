import type { NextFunction, Request, Response } from "express";
import { createAdminClient, createRequestClient } from "../lib/supabase.js";
import { ApiError } from "../lib/errors.js";
import { getAccessTokenFromRequest } from "../utils/request-auth.js";

export async function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const accessToken = getAccessTokenFromRequest(request);

  if (!accessToken) {
    next(new ApiError(401, "Authentication required"));
    return;
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.getUser(accessToken);

  if (error || !data.user) {
    next(new ApiError(401, "Invalid or expired session"));
    return;
  }

  request.auth = {
    accessToken,
    user: data.user,
    supabase: createRequestClient(accessToken)
  };

  next();
}
