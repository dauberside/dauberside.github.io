// pages/_app.js
import Script from 'next/script';
import '../src/styles/global.css';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
        strategy="lazyOnload"
      />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;