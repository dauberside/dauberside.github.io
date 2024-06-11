import React from 'react';  // この行を追加
import Header from '../components/Header';
import Footer from '../components/Footer';

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
