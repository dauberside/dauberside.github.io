import Link from 'next/link';
import ContactForm from '../components/ContactForm';  // srcディレクトリ内の相対パス
function Header() {
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
                  <a><span className="fab fa-instagram"></span></a>
                </Link>
              </li>
              <li>
                <Link href="#" legacyBehavior>
                  <a data-bs-toggle="modal" data-bs-target="#exampleModal" data-bs-whatever="@mdo">
                    <span className="far fa-envelope"></span>
                  </a>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </header>
      <ContactForm />  {/* ContactFormコンポーネントをレンダリング */}
    </>
  );
}

export default Header;