import type { CookieOptions, Response } from "express";
import { accessCookieOptions, accessTokenCookieName, clearCookieOptions, refreshCookieOptions, refreshTokenCookieName } from "../config/cookies.js";

export function setSessionCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie(accessTokenCookieName, accessToken, accessCookieOptions as CookieOptions);
  response.cookie(refreshTokenCookieName, refreshToken, refreshCookieOptions as CookieOptions);
}

export function clearSessionCookies(response: Response) {
  response.clearCookie(accessTokenCookieName, clearCookieOptions as CookieOptions);
  response.clearCookie(refreshTokenCookieName, clearCookieOptions as CookieOptions);
}
