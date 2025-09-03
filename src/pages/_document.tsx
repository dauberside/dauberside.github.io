import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
  DocumentInitialProps,
} from "next/document";

class MyDocument extends Document<DocumentInitialProps> {
  static async getInitialProps(
    ctx: DocumentContext,
  ): Promise<DocumentInitialProps> {
    const initialProps = await Document.getInitialProps(ctx);
    return initialProps;
  }

  render() {
    return (
      <Html lang="ja" dir="ltr">
        <Head>
          {/**
           * _document は SSR 専用の静的マークアップ領域です。
           * <title> はここに書かず、各ページ or _app.tsx + next/head で管理します。
           * 外部 CSS/JS の読み込みも基本は _app.tsx で行います。
           */}

          {/** 例: PWA やテーマカラー（必要なら有効化） */}
          {/* <meta name="theme-color" content="#000E28" /> */}

          {/** 例: フォントの事前読み込み（public/fonts に置いた場合）
          <link
            rel="preload"
            href="/fonts/YourFont.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          */}
        </Head>
        <body className="min-h-screen bg-[rgb(0,14,40)] antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
