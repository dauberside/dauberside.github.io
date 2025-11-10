import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="ja">
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(typeof window!=='undefined'&&!('ethereum'in window)){Object.defineProperty(window,'ethereum',{value:{},writable:true,configurable:true});}}catch(_){}})();`,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
