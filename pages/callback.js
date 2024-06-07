// pages/callback.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

const Callback = () => {
  const router = useRouter();
  const { code } = router.query;

  useEffect(() => {
    if (code) {
      console.log('Authorization code:', code); // デバッグ用
      // Spotify APIにリクエストを送信し、アクセストークンを取得します
      axios.post('/api/spotify-callback', { code })
        .then(response => {
          const { accessToken } = response.data;
          console.log('Access token:', accessToken); // デバッグ用
          // ここでトークンを保存し、次の処理に利用します
          localStorage.setItem('spotifyAccessToken', accessToken);
          router.push('/profile'); // プロフィールページにリダイレクト
        })
        .catch(error => {
          console.error('Error fetching access token:', error);
        });
    }
  }, [code]);

  return (
    <div>
      <h1>認証が完了しました。トークンを取得しています...</h1>
    </div>
  );
};

export default Callback;