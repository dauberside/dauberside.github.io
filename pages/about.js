import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const AboutPage = () => {
  return (
    <div>
      <Header />
      <main>
        <h2>About Us</h2>
        <p>Welcome to My Website. We are dedicated to providing the best service possible.</p>
        <p>Our mission is to deliver high-quality products that bring value to our customers.</p>
        <p>Feel free to explore our website and learn more about what we do.</p>
      </main>
      <Footer />
    </div>
  );
};

export default AboutPage;