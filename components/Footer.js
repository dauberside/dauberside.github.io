import Player from './Player';

const Footer = ({ spotifyToken }) => {
  return (
    <footer id="footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'black', color: 'white', padding: '10px' }}>
      <Player token={spotifyToken} />
    </footer>
  );
};

export default Footer;