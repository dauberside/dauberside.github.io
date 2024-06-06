// components/Footer.js
import Player from './Player';

const Footer = ({ spotifyToken }) => {
  const playlistId = '5fih9AyL9vTTBc6bwfkcJA'; // プレイリストIDを設定

  return (
    <footer id="footer">
      <div className="container">
        <Player spotifyToken={spotifyToken} playlistId={playlistId} />
      </div>
    </footer>
  );
};

export default Footer;