import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ContactForm from '../components/ContactForm';

const Contact = () => {
  useEffect(() => {
    // Any client-side only code here
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
