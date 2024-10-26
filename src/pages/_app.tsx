import React from 'react';
import Head from 'next/head';
import { AppProps } from 'next/app';
import Script from 'next/script';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import '@/styles/globals.css';
import '@/styles/crime.css';
import '@/styles/grid.css';
import 'bootstrap/dist/css/bootstrap.min.css';

config.autoAddCss = false;

function AppProps({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js"
        strategy="afterInteractive"
      />
      <Component {...pageProps} />
    </>
  );
}

export default AppProps;