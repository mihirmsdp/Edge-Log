import type { Request, Response } from "express";
import { ApiError } from "../../lib/errors.js";
import { createPublicClient } from "../../lib/supabase.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { clearSessionCookies, setSessionCookies } from "../../utils/session-cookies.js";
import { getAccessTokenFromRequest, getRefreshTokenFromRequest } from "../../utils/request-auth.js";
import { signInSchema, signUpSchema } from "./auth.schemas.js";

export const signUp = asyncHandler(async (request: Request, response: Response) => {
  const payload = signUpSchema.parse(request.body);
  const supabase = createPublicClient();
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        name: payload.name
      }
    }
  });

  if (error) {
    throw new ApiError(400, error.message);
  }

  if (data.session) {
    setSessionCookies(response, data.session.access_token, data.session.refresh_token);
  }

  response.status(201).json({
    user: data.user,
    session: data.session,
    message: data.session ? "Account created" : "Check your email to confirm your account"
  });
});

export const signIn = asyncHandler(async (request: Request, response: Response) => {
  const payload = signInSchema.parse(request.body);
  const supabase = createPublicClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password
  });

  if (error || !data.session) {
    throw new ApiError(401, error?.message ?? "Unable to sign in");
  }

  setSessionCookies(response, data.session.access_token, data.session.refresh_token);

  response.json({
    user: data.user,
    session: data.session
  });
});

export const refreshSession = asyncHandler(async (request: Request, response: Response) => {
  const refreshToken = getRefreshTokenFromRequest(request);

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    throw new ApiError(401, error?.message ?? "Unable to refresh session");
  }

  setSessionCookies(response, data.session.access_token, data.session.refresh_token);

  response.json({
    user: data.user,
    session: data.session
  });
});

export const signOut = asyncHandler(async (request: Request, response: Response) => {
  const accessToken = getAccessTokenFromRequest(request);
  const refreshToken = getRefreshTokenFromRequest(request);

  if (accessToken && refreshToken) {
    const supabase = createPublicClient();
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    await supabase.auth.signOut();
  }

  clearSessionCookies(response);
  response.status(204).send();
});

export const getCurrentSession = asyncHandler(async (request: Request, response: Response) => {
  const accessToken = getAccessTokenFromRequest(request);

  if (!accessToken) {
    response.status(401).json({ user: null });
    return;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    clearSessionCookies(response);
    response.status(401).json({ user: null });
    return;
  }

  response.json({ user: data.user });
});
