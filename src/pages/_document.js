import Document, { Head, Html, Main, NextScript } from "next/document";

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          {/* <title>タグを削除 */}
          {/* 外部スタイルシートの読み込みは_app.jsに移動することをお勧めします */}
        </Head>
        <body>
          <Main />
          <NextScript />
          {/* 外部スクリプトの読み込みは_app.jsに移動することをお勧めします */}
        </body>
      </Html>
    );
  }
}

export default MyDocument;
