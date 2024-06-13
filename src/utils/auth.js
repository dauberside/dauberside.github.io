import supabase from './supabaseClient';

export const signInWithEmail = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Login error: ${error.message}`);
  }
  return data;
};

export const signUpWithEmail = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw new Error(`Signup error: ${error.message}`);
  }
  return data;
};
