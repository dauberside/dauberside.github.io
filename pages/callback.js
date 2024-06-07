// pages/callback.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

const Callback = () => {
  const router = useRouter();

  useEffect(() => {
    const fetchToken = async () => {
      const code = router.query.code;

      if (code) {
        try {
          const response = await axios.post('/api/get-token', { code });
          localStorage.setItem('spotifyAccessToken', response.data.access_token);
          router.push('/profile');
        } catch (error) {
          console.error('Error fetching the token', error);
        }
      }
    };

    fetchToken();
  }, [router.query.code]);

  return <h1>認証が完了しました。トークンを取得しています...</h1>;
};

export default Callback;