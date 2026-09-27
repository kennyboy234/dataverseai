// backend/src/lib/supabaseUserClient.ts

import { createClient } from "@supabase/supabase-js";

import { env } from "../config/env.js";

/**
 * Creates a brand-new, throwaway Supabase client using the anon key.
 * Used ONLY for operations that need to sign a user in or refresh their
 * session (supabase-js sets an internal session on the client when you
 * call signInWithPassword/refreshSession, which would silently downgrade
 * the shared admin client below from service_role to that user's role).
 * Always create a fresh one per call — never reuse or export a singleton.
 */
export function createUserClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
