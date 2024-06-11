import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Contact = () => {
  useEffect(() => {
  }, []);

  return (
    <div>
      <Header />
      <h1>Contact Us</h1>
      <ContactForm />
      <Footer />
    </div>
  );
};

export default Contact;
