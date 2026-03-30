import type { Request } from "express";
import { ApiError } from "../lib/errors.js";

export function getAuthContext(request: Request) {
  if (!request.auth) {
    throw new ApiError(401, "Authentication required");
  }

  return request.auth;
}
