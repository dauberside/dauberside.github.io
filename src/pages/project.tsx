import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useRouter } from 'next/router';

const Project = () => {
  const router = useRouter();

  const handleChatClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    router.push('/chat');
  };


  return (
    <div>
      <Head>
        <title>Projects</title>
      </Head>
      <Header />
      <main>
        <div className="container">
          {
            <Link href="/dauber" legacyBehavior>
            <a>
              <div className="col-md-12">
                <div className="grid_row">
                  <div className="grid grid-cols-6 gap-4 py-2 border-t border-b border-gray-700 pb-2">
                    <div className="col-1"><small>🙆‍♂️</small></div>
                    <div className="col-2"><small>2020</small></div>
                    <div className="col-6"><small>Dauber</small></div>
                  </div>
                </div>
              </div>
            </a>
          </Link>
          }
          {
          /*<Link href="/Sketch" legacyBehavior>
            <a>
              <div className="col-md-12">
                <div className="grid_row">
                  <div className="row toybox">
                    <div className="col-1"><small>🗒</small></div>
                    <div className="col-2"><small>2020</small></div>
                    <div className="col-6"><small>Sketch</small></div>
                  </div>
                </div>
              </div>
            </a>
          </Link> 
          */
          }
          {
          <Link href="#" legacyBehavior>
            <a onClick={handleChatClick}>
              <div className="col-md-12">
                <div className="grid_row">
                  <div className="grid grid-cols-6 gap-4 py-2 border-b border-gray-700 pb-2">
                    <div className="col-1"><small>💬</small></div>
                    <div className="col-2"><small>2023</small></div>
                    <div className="col-6"><small>Chat</small></div>
                  </div>
                </div>
              </div>
            </a>
          </Link>
          }
          { /*
            <Link href="/continuance" legacyBehavior>
            <a>
              <div className="col-md-12">
                <div className="grid_row">
                  <div className="row toybox">
                    <div className="col-1"><small>🔁</small></div>
                    <div className="col-2"><small>🍺</small></div>
                    <div className="col-6"><small>continuance</small></div>
                  </div>
                </div>
              </div>
            </a>
          </Link> */
          }
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Project;
