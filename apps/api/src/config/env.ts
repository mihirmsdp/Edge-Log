import { z } from "zod";

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    return value.toLowerCase() === "true";
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  ALLOWED_ORIGINS: z.string().optional().transform((value) => value ? value.split(",").map((item) => item.trim()).filter(Boolean) : undefined),
  COOKIE_DOMAIN: z.string().optional().transform((value) => value || undefined),
  COOKIE_SECURE: booleanFromEnv.default(false),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().trim().optional().transform((value) => value || undefined),
  UPSTOX_ANALYTICS_TOKEN: z.string().trim().optional().transform((value) => value || undefined),
  UPSTOX_CLIENT_ID: z.string().trim().optional().transform((value) => value || undefined),
  UPSTOX_CLIENT_SECRET: z.string().trim().optional().transform((value) => value || undefined),
  UPSTOX_REDIRECT_URI: z.string().trim().optional().transform((value) => value || undefined),
  UPSTOX_STATE_SECRET: z.string().trim().optional().transform((value) => value || undefined),
  UPSTOX_API_VERSION: z.string().trim().default("2.0"),
  UPSTOX_KEY_NIFTY: z.string().trim().default("NSE_INDEX|Nifty 50"),
  UPSTOX_KEY_BANKNIFTY: z.string().trim().default("NSE_INDEX|Nifty Bank"),
  UPSTOX_KEY_SENSEX: z.string().trim().default("BSE_INDEX|SENSEX"),
  UPSTOX_KEY_INDIAVIX: z.string().trim().default("NSE_INDEX|India VIX")
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
