// pages/_app.js
import '../src/styles/globals.css'; // グローバルスタイル
import 'bootstrap/dist/css/bootstrap.min.css'; // BootstrapのCSS
import '../src/styles/spotify-player.css'; // Spotifyプレーヤースタイル
import Script from 'next/script';
import Footer from '../components/Footer';

function MyApp({ Component, pageProps }) {
  const spotifyToken = "f142c21f4e424c60a8733b678bbcac65"; // Spotifyのアクセストークン

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