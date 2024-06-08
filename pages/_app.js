import '../src/styles/globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import Script from 'next/script';
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    const loadBootstrap = async () => {
      const bootstrap = await import('bootstrap');
      const exampleModal = document.getElementById('exampleModal');
      if (exampleModal) {
        exampleModal.addEventListener('show.bs.modal', event => {
          const button = event.relatedTarget;
          const recipient = button.getAttribute('data-bs-whatever');
          const modalTitle = exampleModal.querySelector('.modal-title');
          const modalBodyInput = exampleModal.querySelector('.modal-body input');
          modalTitle.textContent = `New message to ${recipient}`;
          modalBodyInput.value = recipient;
        });
      }
    };
    loadBootstrap();
  }, []);

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" strategy="beforeInteractive" />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;