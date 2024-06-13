import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { signInWithEmail, signUpWithEmail } from '../src/utils/auth.js'; // auth.jsからインポート

const Home = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // 新規登録とログインの切り替え用状態
  const router = useRouter(); // Next.jsのルーティング用

  const handleLogin = async () => {
    try {
      await signInWithEmail(email, password);
      router.push('/chat'); // ログイン成功後にチャットページにリダイレクト
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleSignUp = async () => {
    try {
      await signUpWithEmail(email, password);
      router.push('/chat'); // サインアップ成功後にチャットページにリダイレクト
    } catch (error) {
      console.error('Sign up error:', error);
    }
  };

  return (
    <div>
      <Header />
      <main className="container mx-auto p-4">
        <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl mb-4">{isSignUp ? 'Sign Up' : 'Login'}</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-2 p-2 border rounded w-full"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 p-2 border rounded w-full"
          />
          <button onClick={isSignUp ? handleSignUp : handleLogin} className="w-full bg-blue-500 text-white py-2 rounded">
            {isSignUp ? 'Sign Up' : 'Login'}
          </button>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full bg-gray-500 text-white py-2 rounded mt-4"
          >
            {isSignUp ? 'Already have an account? Login' : 'Don’t have an account? Sign Up'}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Home;