/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Supabase is disabled in this build.
 * This stub prevents compile errors when `@supabase/supabase-js` is not installed.
 * To re-enable, install the packages and restore the original implementation.
 */

// Export a proxy that throws on any access to fail fast at runtime if accidentally used.
export const supabase: any = new Proxy(
  {},
  {
    get(_target, prop) {
      throw new Error(
        `Supabase is disabled in this build. Tried to access property "${String(prop)}".`,
      );
    },
  },
);

// Explicit helper to signal disabled state to callers that would try to get a client.
export function getSupabaseClient(): never {
  throw new Error(
    "Supabase is disabled in this build. Reinstall @supabase/supabase-js and restore src/utils/supabaseClient.ts to enable.",
  );
}
