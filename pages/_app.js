import { useEffect } from 'react';

const initializeModal = () => {
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

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    import('bootstrap').then(() => {
      initializeModal();
    });
  }, []);

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" strategy="beforeInteractive" />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;