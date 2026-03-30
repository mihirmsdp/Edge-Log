import { env, isProduction } from "./env.js";

export const accessTokenCookieName = "edgelog_access_token";
export const refreshTokenCookieName = "edgelog_refresh_token";

const sameSite = isProduction ? "none" : "lax";

export const accessCookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite,
  domain: env.COOKIE_DOMAIN,
  path: "/",
  maxAge: 1000 * 60 * 60
} as const;

export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite,
  domain: env.COOKIE_DOMAIN,
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 30
} as const;

export const clearCookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite,
  domain: env.COOKIE_DOMAIN,
  path: "/"
} as const;
