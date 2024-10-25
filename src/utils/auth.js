// auth.js
import { supabase } from './supabaseClient';
import bcrypt from 'bcryptjs';

const { error } = await supabase.auth.api.setCustomConfig({
  otp_expiry: auth.otp_expiry()
});

if (error) {
  console.error('Error setting OTP expiry:', error.message);
}

export const signUpUser = async (email, password, username) => {
  const passwordHash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('users').insert([
    {
      email,
      password_hash: passwordHash,
      username,
    },
  ]);
  return { data, error };
};


export const loginUser = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email, password
  });
  return { data, error };
};