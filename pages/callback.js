// pages/callback.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const Callback = () => {
  const router = useRouter();
  const { code } = router.query;

  useEffect(() => {
    if (code) {
      // ここでSpotify APIにリクエストを送信し、トークンを取得します。
      // 例: fetch('/api/spotify-callback', { method: 'POST', body: JSON.stringify({ code }) });
    }
  }, [code]);

  return (
    <div>
      <h1>認証が完了しました</h1>
      {/* 必要に応じてここに情報を表示 */}
    </div>
  );
};

export default Callback;