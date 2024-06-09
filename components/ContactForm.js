import React, { useState } from 'react';

const ContactForm = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const jsonData = JSON.stringify(Object.fromEntries(data.entries()));

    try {
      const response = await fetch('/send', {
        method: 'POST',
        body: jsonData,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const errorText = await response.text();
        console.error('Failed to send message:', errorText);
        alert('Failed to send message: ' + errorText);
      }
    } catch (error) {
      console.error('Error occurred:', error);
      alert('Failed to send message');
    }
  };

  return (
    <div className="modal fade show" id="exampleModal" tabIndex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true" style={{ display: 'block' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="exampleModalLabel">New message</h5>
            <button type="button" className="btn-close" onClick={() => setSubmitted(false)} aria-label="Close"></button>
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
                    <button type="button" className="btn btn-default" onClick={() => setSubmitted(false)}>Close</button>
                    <button type="submit" id="saveImage" className="btn btn-primary" data-action="save" role="button">Submit</button>
                  </div>
                </form>
              ) : (
                <div id="success-message">
                  <h5>送信完了しました。ありがとうございました！</h5>
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
