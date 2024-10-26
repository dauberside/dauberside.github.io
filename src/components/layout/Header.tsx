import React, { useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { faInstagram } from '@fortawesome/free-brands-svg-icons';
import ContactForm from '@/components/forms/ContactForm';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => {
  const [isContactFormOpen, setContactFormOpen] = useState(false);

  const handleContactFormOpen = () => {
    setContactFormOpen(true);
  };

  const handleContactFormClose = () => {
    setContactFormOpen(false);
  };

  return (
    <>
      <header id="header" className={className}>
        <div className="container">
          <div id="logo">
            <Link href="/" legacyBehavior>
              <a className="navbar-brand">
                <img src="/images/geometric_pattern.svg" alt="Logo" />
              </a>
            </Link>
          </div>
          <nav className="navbar">
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
                <button onClick={handleContactFormOpen} aria-label="Open contact form">
                  <FontAwesomeIcon icon={faEnvelope} />
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <ContactForm isOpen={isContactFormOpen} onRequestClose={handleContactFormClose} />
    </>
  );
};

export default Header;