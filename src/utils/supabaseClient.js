import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase URL or Key in environment variables");
}

// 環境変数をコンソールにログ出力（開発環境のみ）
if (process.env.NODE_ENV !== 'production') {
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
