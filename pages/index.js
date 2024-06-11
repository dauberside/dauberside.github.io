import React from 'react'; // Reactをインポート
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <h1>Welcome to my website</h1>
      </main>
      <Footer />
    </>
  );
}