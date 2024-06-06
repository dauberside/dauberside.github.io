import '../src/styles/globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import Script from 'next/script';
import Footer from '../components/Footer';

function MyApp({ Component, pageProps }) {
  const spotifyToken = "f142c21f4e424c60a8733b678bbcac65"; // 有効なSpotifyトークンを設定

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