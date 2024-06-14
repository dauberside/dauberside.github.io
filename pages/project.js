import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoginModal from '../components/LoginModal';

const Project = () => {
  const [showModal, setShowModal] = useState(false);

  const handleClose = () => setShowModal(false);
  const handleShow = () => setShowModal(true);

  const handleLogin = async (email, password) => {
    // ログイン処理
    if (email === 'user@example.com' && password === 'password') {
      const user = { email };
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } else {
      throw new Error('Invalid email or password');
    }
  };

  const handleSignup = async (email, password) => {
    // サインアップ処理
    const user = { email, password };
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  };

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
          <Link href="#" legacyBehavior>
            <a onClick={handleShow}>
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
      <LoginModal show={showModal} handleClose={handleClose} handleLogin={handleLogin} handleSignup={handleSignup} />
    </div>
  );
};

export default Project;
