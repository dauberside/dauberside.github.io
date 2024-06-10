// pages/_document.js
import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html>
        <Head>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
          />
          <link rel="stylesheet" href="/css/crime.css" />
          <link rel="stylesheet" href="/css/menu.css" />
          <link rel="stylesheet" href="/css/grid.css" />
          <link rel="stylesheet" href="/css/custom.css" />
          <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.15.1/css/all.css"
          />
          <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.15.1/css/v4-shims.css"
          />
        </Head>
        <body>
          <Main />
          <NextScript />
          <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
      </Html>
    );
  }
}

export default MyDocument;