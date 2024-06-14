// src/utils/supabaseClient.js

// import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
