// pages/index.js
import Head from 'next/head'
import styles from '../styles/Home.module.css'

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Welcome to DauberSide's Next.js App!</title>
        <meta name="description" content="This is your customized homepage." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <a href="#">DauberSide's Next.js App!</a>
        </h1>
        <p className={styles.description}>
          This is your customized homepage.
        </p>
      </main>

      <footer className={styles.footer}>
        <a href="#" target="_blank" rel="noopener noreferrer">
          Powered by DauberSide
        </a>
      </footer>
    </div>
  )
}