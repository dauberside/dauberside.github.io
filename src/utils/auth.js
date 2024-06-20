import supabase from './supabaseClient';

export const signUp = async (email, password) => {
  const { user, error } = await supabase.auth.signUp({ email, password });
  if (error && error.message.includes('already registered')) {
    return { error: '既にアカウントが存在します。ログインしてください。' };
  }
  if (error) throw error;
  return { user };
};

export const signIn = async (email, password) => {
  const { user, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return user;
};
