import React from 'react';  // この行を追加
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Project = () => {
  return (
    <div>
      <Head>
        <title>Projects</title>
      </Head>
      <Header />
      <main>
        <div className="container">
          <Link href="/dauber" legacyBehavior>
            <a>
              <div className="col-md-12">
                <div className="grid_row">
                  <div style={{ borderTop: '1px solid' }} className="row">
                    <div className="col-1"><small>🙆‍♂️</small></div>
                    <div className="col-2"><small>2020</small></div>
                    <div className="col-6"><small>Dauber</small></div>
                  </div>
                </div>
              </div>
            </a>
          </Link>
          <Link href="/Sketch" legacyBehavior>
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
          <Link href="/chat" legacyBehavior>
            <a>
              <div className="col-md-12">
                <div className="grid_row">
                  <div className="row">
                    <div className="col-1"><small>💬</small></div>
                    <div className="col-2"><small>2023</small></div>
                    <div className="col-6"><small>Chat</small></div>
                  </div>
                </div>
              </div>
            </a>
          </Link>
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
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Project;
