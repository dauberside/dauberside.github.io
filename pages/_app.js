import React from 'react';
import App from 'next/app';
import '../src/styles/globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import Script from 'next/script';
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
config.autoAddCss = false

class MyApp extends App {
  componentDidCatch(error, errorInfo) {
    console.error('Error caught in _app.js:', error);
    console.error('Error info:', errorInfo);
  }

  render() {
    const { Component, pageProps } = this.props;
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
}

export default MyApp;