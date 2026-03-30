import type { Request } from "express";
import { accessTokenCookieName, refreshTokenCookieName } from "../config/cookies.js";

export function getAccessTokenFromRequest(request: Request) {
  const authHeader = request.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const cookieToken = request.cookies?.[accessTokenCookieName];
  return typeof cookieToken === "string" ? cookieToken : undefined;
}

export function getRefreshTokenFromRequest(request: Request) {
  const cookieToken = request.cookies?.[refreshTokenCookieName];
  return typeof cookieToken === "string" ? cookieToken : undefined;
}
