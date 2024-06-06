import Link from 'next/link';

const Header = () => {
  return (
    <header id="header">
      <div className="container">
        <div id="logo">
          <Link href="/" legacyBehavior>
            <a className="navbar-brand">
              <img src="/images/geometric_pattern.svg" alt="Logo" />
            </a>
          </Link>
        </div>
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
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
                  <a className="nav-link">
                    <span className="fab fa-instagram"></span>
                  </a>
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
        </nav>
      </div>
    </header>
  );
};

export default Header;
