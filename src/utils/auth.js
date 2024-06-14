import supabase from './supabaseClient';

// ここに認証ロジックを追加します。
// 例えば、他の認証サービスを使用するロジックなど。

export const login = async (email, password) => {
  // Supabase関連のコードを削除または他の方法に置き換えます
  // const { user, error } = await supabase.auth.signInWithPassword({ email, password });
  // if (error) throw error;
  // return user;

  // 仮の例: ローカルストレージを使用した簡単な認証
  if (email === 'user@example.com' && password === 'password') {
    const user = { email };
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } else {
    throw new Error('Invalid email or password');
  }
};

export const logout = () => {
  // Supabase関連のコードを削除または他の方法に置き換えます
  // await supabase.auth.signOut();

  // 仮の例: ローカルストレージを使用した簡単なログアウト
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  // Supabase関連のコードを削除または他の方法に置き換えます
  // return supabase.auth.user();

  // 仮の例: ローカルストレージを使用したユーザー取得
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};
