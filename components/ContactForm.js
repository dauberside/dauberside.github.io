import React, { useState } from 'react';

const ContactForm = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    // フォーム送信のために隠しiframeを使用
    document.getElementById('hidden_iframe').onload = () => {
      if (submitted) {
        document.getElementById('contact-form').style.display = 'none';
        document.getElementById('success-message').style.display = 'block';
      }
    };
    event.target.submit();
  };

  return (
    <div className="modal" id="exampleModal" tabIndex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="exampleModalLabel">New message</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="form-area">
              <form id="contact-form" role="form" action="https://docs.google.com/forms/u/0/d/e/1FAIpQLSf2tU3FCb0KWeNMbskNq9zIGKlq9k60cveLlBKx3XUOyW-Eew/formResponse" method="post" target="hidden_iframe" onSubmit={handleSubmit}>
                <div className="form-group">
                  <input type="text" name="entry.233542546" className="form-control" id="name" placeholder="Name" required autoComplete="name" />
                </div>
                <div className="form-group">
                  <input type="email" name="entry.1664462797" className="form-control" id="email" placeholder="Email" required autoComplete="email" />
                </div>
                <div className="form-group">
                  <textarea name="entry.2108942869" className="form-control" id="message" placeholder="Message" maxLength="140" rows="7" autoComplete="message"></textarea>
                  <span className="help-block">
                    <p id="characterLeft" className="help-block">Up to 140 characters</p>
                  </span>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-default" data-bs-dismiss="modal" role="button">Close</button>
                  <button type="submit" id="saveImage" className="btn btn-primary" data-action="save" role="button">Submit</button>
                </div>
              </form>
              <div id="success-message" style={{ display: 'none' }}>
                <h5>送信完了しました。ありがとうございました！</h5>
              </div>
              <iframe name="hidden_iframe" id="hidden_iframe" style={{ display: 'none' }}></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactForm;
