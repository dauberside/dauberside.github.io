import React from 'react';
import Link from 'next/link';

const Header = () => {
  return (
    <header id="header">
      <div className="container">
        <div id="logo">
          <Link href="/">
            <a className="navbar-brand">
              <img src="/images/geometric_pattern.svg" alt="Logo" />
            </a>
          </Link>
        </div>
        <div className="navbar">
          <ul className="list-inline">
            <li className="folder">
              <Link href="#">
                <a id="dropdownMenuLink" aria-haspopup="true" aria-expanded="false">
                  <span>menu</span>
                </a>
              </Link>
              <div className="dropdown-menu folder-child-wrapper">
                <ul className="folder-child">
                  <li>
                    <Link href="/">
                      <a className="dropdown-item">
                        <p>home</p>
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href="/project">
                      <a className="dropdown-item">
                        <p>project</p>
                      </a>
                    </Link>
                  </li>
                </ul>
              </div>
            </li>
            <li>
              <Link href="https://www.instagram.com/DauberSide/">
                <a><span className="fab fa-instagram"></span></a>
              </Link>
            </li>
            <li>
              <Link href="#">
                <a data-toggle="modal" data-target="#squarespaceModal">
                  <span className="far fa-envelope"></span>
                </a>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
};

export default Header;