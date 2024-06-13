import { createClient } from '@supabase/supabase-js';

// Securely load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// デバッグログの追加
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or Key in environment variables");
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
