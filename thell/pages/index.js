import Link from 'next/link';
import { useEffect } from 'react';

export default function Navbar() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const script = document.createElement("script");
      script.src = "https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

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
        <nav className="navbar">
          <ul className="list-inline">
            <li className="folder">
              <Link href="/">
                <a id="dropdownMenuLink" aria-haspopup="true" aria-expanded="false">
                  <span>menu</span>
                </a>
              </Link>
              <div className="dropdown-menu folder-child-wrapper">
                <ul className="folder-child">
                  {/* Add your menu items here */}
                </ul>
              </div>
            </li>
            <li>
              <a data-toggle="modal" data-target="#squarespaceModal">
                <span className="glyphicon glyphicon-envelope"></span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}