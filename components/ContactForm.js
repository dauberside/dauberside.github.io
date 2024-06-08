import React from 'react';

const ContactForm = () => {
  return (
    <div className="modal fade" id="squarespaceModal" tabIndex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="modalLabel">New message</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <form action="https://docs.google.com/forms/u/0/d/e/1FAIpQLSf2tU3FCb0KWeNMbskNq9zIGKlq9k60cveLlBKx3XUOyW-Eew/formResponse" method="post" target="hidden_iframe" onsubmit="submitted=true;">
              <div className="mb-3">
                <label htmlFor="recipient-name" className="col-form-label">Recipient:</label>
                <input type="text" name="entry.233542546" className="form-control" id="recipient-name" required />
              </div>
              <div className="mb-3">
                <label htmlFor="message-text" className="col-form-label">Message:</label>
                <textarea name="entry.2108942869" className="form-control" id="message-text" maxLength="140" rows="7"></textarea>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="submit" className="btn btn-primary">Send message</button>
              </div>
            </form>
            <script type="text/javascript">var submitted = false;</script>
            <iframe name="hidden_iframe" id="hidden_iframe" style={{ display: 'none' }} onLoad="if(submitted) {window.location='contact/thanks-page.html';}"></iframe>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactForm;