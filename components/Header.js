import Link from 'next/link';

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
                  <a data-bs-toggle="modal" data-bs-target="#squarespaceModal">
                    <span className="far fa-envelope"></span>
                  </a>
                </Link>
              </li>
              <li>
              <button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#exampleModal" data-bs-whatever="@mdo">Open modal for @mdo</button>
              </li>
            </ul>
          </div>
        </div>
          <div class="modal fade" id="exampleModal" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
            <div class="modal-dialog">
              <div class="modal-content">
                <div class="modal-header">
                  <h1 class="modal-title fs-5" id="exampleModalLabel">New message</h1>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                  <form>
                    <div class="mb-3">
                      <label for="recipient-name" class="col-form-label">Recipient:</label>
                      <input type="text" class="form-control" id="recipient-name">
                    </div>
                    <div class="mb-3">
                      <label for="message-text" class="col-form-label">Message:</label>
                      <textarea class="form-control" id="message-text"></textarea>
                    </div>
                  </form>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                  <button type="button" class="btn btn-primary">Send message</button>
                </div>
              </div>
            </div>
          </div>
      </header>
    </>
  );
}

export default Header;