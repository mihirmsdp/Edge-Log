import crypto from "node:crypto";
import { URLSearchParams } from "node:url";
import { ApiError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { createAdminClient } from "../../lib/supabase.js";

const AUTHORIZE_URL = "https://api.upstox.com/v2/login/authorization/dialog";
const TOKEN_URL = "https://api.upstox.com/v2/login/authorization/token";
const DEFAULT_RETURN_TO = "/market";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

type UpstoxTokenResponse = {
  access_token?: string;
  extended_token?: string;
  user_id?: string;
  user_name?: string;
  email?: string;
  exchanges?: string[];
  products?: string[];
  broker?: string;
};

type UpstoxStatePayload = {
  userId: string;
  returnTo: string;
  issuedAt: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getUpstoxStateSecret() {
  if (!env.UPSTOX_STATE_SECRET) {
    throw new ApiError(503, "Upstox OAuth is not configured on the server");
  }

  return env.UPSTOX_STATE_SECRET;
}

function signState(payload: UpstoxStatePayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", getUpstoxStateSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyState(state: string) {
  const [encodedPayload, providedSignature] = state.split(".");
  if (!encodedPayload || !providedSignature) {
    throw new ApiError(400, "Invalid Upstox state payload");
  }

  const expectedSignature = crypto.createHmac("sha256", getUpstoxStateSecret()).update(encodedPayload).digest("base64url");
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new ApiError(400, "Invalid Upstox state signature");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as UpstoxStatePayload;
  if (!payload.userId || !payload.returnTo || !payload.issuedAt) {
    throw new ApiError(400, "Malformed Upstox state payload");
  }

  if (Date.now() - payload.issuedAt > STATE_MAX_AGE_MS) {
    throw new ApiError(400, "Upstox state has expired. Please try connecting again.");
  }

  return payload;
}

export function getUpstoxAuthorizeUrl(userId: string, returnTo?: string) {
  if (!env.UPSTOX_CLIENT_ID || !env.UPSTOX_REDIRECT_URI || !env.UPSTOX_STATE_SECRET) {
    throw new ApiError(503, "Upstox OAuth is not configured on the server");
  }

  const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : DEFAULT_RETURN_TO;
  const state = signState({
    userId,
    returnTo: safeReturnTo,
    issuedAt: Date.now()
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.UPSTOX_CLIENT_ID,
    redirect_uri: env.UPSTOX_REDIRECT_URI,
    state
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeUpstoxCode(code: string) {
  if (!env.UPSTOX_CLIENT_ID || !env.UPSTOX_CLIENT_SECRET || !env.UPSTOX_REDIRECT_URI) {
    throw new ApiError(503, "Upstox OAuth is not configured on the server");
  }

  const body = new URLSearchParams({
    code,
    client_id: env.UPSTOX_CLIENT_ID,
    client_secret: env.UPSTOX_CLIENT_SECRET,
    redirect_uri: env.UPSTOX_REDIRECT_URI,
    grant_type: "authorization_code"
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as UpstoxTokenResponse & { errors?: Array<{ message?: string }>; message?: string }) : {};

  if (!response.ok) {
    throw new ApiError(response.status, data.errors?.[0]?.message ?? data.message ?? "Unable to connect Upstox");
  }

  if (!data.access_token) {
    throw new ApiError(502, "Upstox token exchange did not return an access token");
  }

  return data;
}

export async function saveUpstoxConnection(userId: string, token: UpstoxTokenResponse) {
  const admin = createAdminClient();
  const { error } = await admin.from("upstox_connections").upsert(
    {
      user_id: userId,
      upstox_user_id: token.user_id ?? null,
      upstox_user_name: token.user_name ?? null,
      upstox_email: token.email ?? null,
      broker: token.broker ?? "UPSTOX",
      access_token: token.access_token ?? null,
      extended_token: token.extended_token ?? null,
      exchanges: token.exchanges ?? [],
      products: token.products ?? [],
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
}

export async function getUpstoxConnection(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("upstox_connections")
    .select("user_id, upstox_user_id, upstox_user_name, upstox_email, broker, exchanges, products, connected_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    connected: Boolean(data),
    connection: data
  };
}

export async function deleteUpstoxConnection(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("upstox_connections").delete().eq("user_id", userId);
  if (error) {
    throw error;
  }
}

export function consumeUpstoxState(state: string) {
  return verifyState(state);
}


