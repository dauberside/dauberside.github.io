import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ContactForm from '../components/ContactForm';

const Contact = () => {
  return (
    <div>
      <Head>
        <title>Contact</title>
        <link rel="stylesheet" href="/css/crime.css" />
        <link rel="stylesheet" href="/css/menu.css" />
        <link rel="stylesheet" href="/css/grid.css" />
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.1/css/all.css" />
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.1/css/v4-shims.css" />
      </Head>
      <Header />
      <main>
        <h2>Contact Us</h2>
        <ContactForm />
      </main>
      <Footer />
    </div>
  );
};

export default Contact;