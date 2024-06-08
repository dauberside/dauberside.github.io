import '../src/styles/globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import Script from 'next/script';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js"
        strategy="lazyOnload"
      />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;