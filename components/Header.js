// components/Header.js
import Link from 'next/link';
import Head from 'next/head';
import React, { useEffect } from 'react';

const Header = () => {
  useEffect(() => {
    // Bootstrapが必要なエフェクトがあればここに記述
  }, []);

  return (
    <>
      <Head>
        <title>Contact</title>
        <link rel="stylesheet" href="/css/crime.css" />
        <link rel="stylesheet" href="/css/menu.css" />
        <link rel="stylesheet" href="/css/grid.css" />
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.1/css/all.css" />
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.1/css/v4-shims.css" />
      </Head>
      <header id="header">
        <div className="container">
          <div id="logo">
            <Link href="/" legacyBehavior>
              <a className="navbar-brand">
                <img src="/images/geometric_pattern.svg" alt="Logo" />
              </a>
            </Link>
          </div>
          <nav className="navbar navbar-expand-lg navbar-light bg-light">
            <div className="container-fluid">
              <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
                <span className="navbar-toggler-icon"></span>
              </button>
              <div className="collapse navbar-collapse" id="navbarNavDropdown">
                <ul className="navbar-nav">
                  <li className="nav-item dropdown">
                    <Link href="#" legacyBehavior>
                      <a className="nav-link dropdown-toggle" id="navbarDropdownMenuLink" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                        Menu
                      </a>
                    </Link>
                    <ul className="dropdown-menu" aria-labelledby="navbarDropdownMenuLink">
                      <li>
                        <Link href="/" legacyBehavior>
                          <a className="dropdown-item">Home</a>
                        </Link>
                      </li>
                      <li>
                        <Link href="/project" legacyBehavior>
                          <a className="dropdown-item">Project</a>
                        </Link>
                      </li>
                    </ul>
                  </li>
                  <li className="nav-item">
                    <Link href="https://www.instagram.com/DauberSide/" legacyBehavior>
                      <a className="nav-link"><span className="fab fa-instagram"></span></a>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link href="#" legacyBehavior>
                      <a className="nav-link" data-bs-toggle="modal" data-bs-target="#squarespaceModal">
                        <span className="far fa-envelope"></span>
                      </a>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
};

export default Header;