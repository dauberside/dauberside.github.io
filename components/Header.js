import React, { useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { faInstagram } from '@fortawesome/free-brands-svg-icons';
import ContactForm from './ContactForm';

const Header = () => {
  const [isContactFormOpen, setContactFormOpen] = useState(false);

  const handleContactFormOpen = () => {
    setContactFormOpen(true);
  };

  const handleContactFormClose = () => {
    setContactFormOpen(false);
  };

  return (
    <>
      <header id="header">
        <div className="container">
          <div id="logo">
            <Link href="/" legacyBehavior>
              <a className="navbar-brand">
                <img src="/images/geometric_pattern.svg" alt="Logo" />
              </a>
            </Link>
          </div>
          <div className="navbar">
            <ul className="list-inline">
              <li className="nav-item dropdown">
                <a className="nav-link dropdown-toggle" href="#" id="dropdownMenuLink" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                  Menu
                </a>
                <ul className="dropdown-menu" aria-labelledby="dropdownMenuLink">
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
              <li>
                <Link href="https://www.instagram.com/DauberSide/" legacyBehavior>
                  <a><FontAwesomeIcon icon={faInstagram} /></a>
                </Link>
              </li>
              <li>
                <Link href="#" legacyBehavior>
                  <a data-bs-toggle="modal" data-bs-target="#contactModal" aria-label="Open contact form" onClick={handleContactFormOpen}>
                    <FontAwesomeIcon icon={faEnvelope} />
                  </a>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </header>
      <ContactForm isOpen={isContactFormOpen} onRequestClose={handleContactFormClose} />
    </>
  );
};

export default Header;