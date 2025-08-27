import { createClient } from "@supabase/supabase-js";

import { Database } from "@/types/supabase";

if (
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL !== "string" ||
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "string"
) {
  throw new Error("必要な環境変数が設定されていません。");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
