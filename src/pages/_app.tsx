import "@fortawesome/fontawesome-svg-core/styles.css";
import "@/styles/globals.css";

import { config } from "@fortawesome/fontawesome-svg-core";
import type { AppProps } from "next/app";
import { Noto_Sans_JP } from "next/font/google";
import Head from "next/head";
import React from "react";

const notoSans = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

config.autoAddCss = false;

function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={notoSans.variable}>
        <Component {...pageProps} />
      </div>
    </>
  );
}

export default App;
