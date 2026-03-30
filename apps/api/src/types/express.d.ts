import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        accessToken: string;
        user: User;
        supabase: SupabaseClient<Database>;
      };
    }
  }
}

export {};
