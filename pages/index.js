// pages/index.js
import React from 'react';
import Header from '../src/components/Header';
import Footer from '../src/components/Footer';

const HomePage = () => {
  return (
    <div>
      <Header />
      <main>
        <h2>Welcome to My Website</h2>
        <p>This is the homepage.</p>
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;