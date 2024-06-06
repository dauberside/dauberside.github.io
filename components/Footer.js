import Player from './Player';

const Footer = ({ spotifyToken }) => {
  return (
    <footer id="footer">
      <Player token={spotifyToken} />
    </footer>
  );
};

export default Footer;