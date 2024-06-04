import React from 'react';
import Header from '../src/components/Header';
import Footer from '../src/components/Footer';

const ContactPage = () => {
  return (
    <div>
      <Header />
      <main>
        <h2>Contact Us</h2>
        <form>
          <div>
            <label htmlFor="name">Name:</label>
            <input type="text" id="name" name="name" required />
          </div>
          <div>
            <label htmlFor="email">Email:</label>
            <input type="email" id="email" name="email" required />
          </div>
          <div>
            <label htmlFor="message">Message:</label>
            <textarea id="message" name="message" required></textarea>
          </div>
          <button type="submit">Send</button>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default ContactPage;