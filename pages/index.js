import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Home = () => {
  return (
    <div>
      <Header />
      <main>
        <h1>Welcome to My Website</h1>
        <p>This is the homepage.</p>
      </main>
      <Footer />
    </div>
  );
};

export default Home;