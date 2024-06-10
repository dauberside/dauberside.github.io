import React, { useState } from 'react';

const ContactForm = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const jsonData = Object.fromEntries(data.entries());

    setFormData(jsonData);

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        body: JSON.stringify(jsonData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const errorText = await response.text();
        setErrorMessage(errorText);
        console.error('Failed to send message:', errorText);
      }
    } catch (error) {
      setErrorMessage(error.message);
      console.error('Error occurred:', error);
    }
  };

  return (
    <div className={`modal ${submitted ? 'show' : ''}`} id="exampleModal" tabIndex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true" style={{ display: submitted ? 'block' : 'none' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="exampleModalLabel">New message</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={() => setSubmitted(false)}></button>
          </div>
          <div className="modal-body">
            <div className="form-area">
              {!submitted ? (
                <form id="contact-form" role="form" onSubmit={handleSubmit}>
                  <div className="form-group">
                    <input type="text" name="name" className="form-control" id="name" placeholder="Name" required autoComplete="name" />
                  </div>
                  <div className="form-group">
                    <input type="email" name="email" className="form-control" id="email" placeholder="Email" required autoComplete="email" />
                  </div>
                  <div className="form-group">
                    <textarea name="message" className="form-control" id="message" placeholder="Message" maxLength="140" rows="7" autoComplete="message"></textarea>
                    <span className="help-block">
                      <p id="characterLeft" className="help-block">Up to 140 characters</p>
                    </span>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn" data-bs-dismiss="modal" role="button">Close</button>
                    <button type="submit" id="saveImage" className="btn" data-action="save" role="button">Submit</button>
                  </div>
                  {errorMessage && <div className="alert alert-danger mt-3">{errorMessage}</div>}
                </form>
              ) : (
                <div id="success-message">
                  <h5>送信完了しました。ありがとうございました！</h5>
                  <p><strong>Name:</strong> {formData.name}</p>
                  <p><strong>Email:</strong> {formData.email}</p>
                  <p><strong>Message:</strong> {formData.message}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactForm;