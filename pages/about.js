import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const About = () => {
  useEffect(() => {
    // Any client-side only code here
  }, []);

  return (
    <div>
      <Header />
      <h1>About Us</h1>
      <Footer />
    </div>
  );
};

export default About;