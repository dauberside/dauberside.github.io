import Navbar from '../components/Navbar';

export default function Home() {
  return (
    <>
      <Navbar />
      <div className="center">
        <h1>Welcome to my site</h1>
        <p>This is a static page converted to Next.js</p>
        <img src="/images/bg.JPG" alt="Background" style={{ width: '100%', height: 'auto' }} />
      </div>
      {/* Modal Structure */}
      <div className="modal fade" id="squarespaceModal" tabIndex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button" className="close" data-dismiss="modal">
                <span aria-hidden="true">×</span>
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-area">
                <form role="form">
                  {/* Add form elements here */}
                </form>
              </div>
            </div>
            <div className="modal-footer">
              <div className="btn-group btn-group-justified" role="group" aria-label="group button">
                <div className="btn-group" role="group">
                  <button type="button" className="btn btn-default" data-dismiss="modal" role="button">Close</button>
                </div>
                <div className="btn-group btn-delete hidden" role="group">
                  <button type="button" id="delImage" className="btn btn-default btn-hover-red" data-dismiss="modal" role="button">Delete</button>
                </div>
                <div className="btn-group" role="group">
                  <button type="button" id="saveImage" className="btn btn-default btn-hover-green" data-action="save" role="button">Submit</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        body {
          background-image: url('/images/bg.JPG');
          background-position: center center;
          background-size: cover;
          background-attachment: fixed;
          background-repeat: no-repeat;
          color: #fff;
          background-color: #000;
          font-family: 'Arial', 'Verdana', sans-serif;
          font-weight: 400;
          font-size: 14px;
          line-height: 1.6em;
          letter-spacing: 0px;
        }
        header {
          padding: 20px 20px 50px 20px;
        }
        .center {
          margin-top: 50px;
        }
        .modal-header {
          padding-bottom: 5px;
        }
        .modal-footer {
          padding: 0;
        }
        .modal-footer .btn-group button {
          height: 40px;
          border-top-left-radius: 0;
          border-top-right-radius: 0;
          border: none;
          border-right: 1px solid #ddd;
        }
        .modal-footer .btn-group:last-child > button {
          border-right: 0;
        }
      `}</style>
      <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js"></script>
      <script src="/js/crime.js"></script>
    </>
  );
}