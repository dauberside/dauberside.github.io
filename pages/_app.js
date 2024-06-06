// pages/_app.js
import '../src/styles/global.css'; // グローバルスタイルの正しいパス
import 'bootstrap/dist/css/bootstrap.min.css'; // BootstrapのCSS
import Script from 'next/script';
import Footer from '../components/Footer'; // フッターコンポーネントをインポート

function MyApp({ Component, pageProps }) {
  // Spotifyのトークンを取得する手順を追加する
  const spotifyToken = "f142c21f4e424c60a8733b678bbcac65";

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js"
        strategy="lazyOnload"
      />
      <Component {...pageProps} />
      <Footer spotifyToken={spotifyToken} />
    </>
  );
}

export default MyApp;