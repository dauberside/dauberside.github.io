import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Project = () => {
  return (
    <div>
      <Head>
        <title>Project</title>
        <link rel="stylesheet" href="/css/crime.css" />
        <link rel="stylesheet" href="/css/menu.css" />
        <link rel="stylesheet" href="/css/grid.css" />
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.1/css/all.css" />
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.1/css/v4-shims.css" />
      </Head>
      <Header />
      <main>
        <h2>Our Projects</h2>
        <p>Details about our projects.</p>
      </main>
      <Footer />
    </div>
  );
};

export default Project;