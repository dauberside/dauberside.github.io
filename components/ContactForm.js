import React from 'react';

const ContactForm = () => {
  return (
    <div className="modal fade" id="squarespaceModal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-body" style={{ padding: '10px 10px 0px 10px' }}>
            <div className="form-area">
              <form role="form" action="https://docs.google.com/forms/u/0/d/e/1FAIpQLSf2tU3FCb0KWeNMbskNq9zIGKlq9k60cveLlBKx3XUOyW-Eew/formResponse" method="post" target="hidden_iframe" onsubmit="submitted=true;">
                <div className="form-group">
                  <input type="text" name="entry.233542546" className="form-control" id="name" placeholder="Name" required />
                </div>
                <div className="form-group">
                  <input type="email" name="entry.1664462797" className="form-control" id="email" placeholder="Email" required />
                </div>
                <div className="form-group">
                  <textarea name="entry.2108942869" className="form-control" id="message" placeholder="Message" maxlength="140" rows="7"></textarea>
                  <span className="help-block">
                    <p id="characterLeft" className="help-block ">Up to 140 characters</p>
                  </span>
                </div>
                <div className="modal-footer">
                  <div className="btn-group btn-group-justified" role="group" aria-label="group button">
                    <div className="btn-group" role="group">
                      <button type="button" className="btn btn-default" data-dismiss="modal" role="button">close</button>
                    </div>
                    <div className="btn-group btn-delete hidden" role="group">
                      <button type="button" id="delImage" className="btn btn-default btn-hover-red" data-dismiss="modal" role="button">Close</button>
                    </div>
                    <div className="btn-group" role="group">
                      <button type="submit" id="saveImage" className="btn btn-default btn-hover-green" data-action="save" role="button">submit</button>
                    </div>
                  </div>
                </div>
              </form>
              <script type="text/javascript">var submitted = false;</script>
              <iframe name="hidden_iframe" id="hidden_iframe" style={{ display: 'none' }} onload="if(submitted) {window.location='contact/thanks-page.html';}"></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactForm;