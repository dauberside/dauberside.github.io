import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Home = () => {
  useEffect(() => {
    // Any client-side only code here
  }, []);

  return (
    <div>
      <Header />
      <h1>Welcome to My Website</h1>
      <Footer />
    </div>
  );
};

export default Home;