// components/Player.js
import { useEffect, useState } from 'react';

const Player = ({ spotifyToken }) => {
  const [player, setPlayer] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);

  useEffect(() => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new Spotify.Player({
        name: 'Web Playback SDK Player',
        getOAuthToken: cb => { cb(spotifyToken); },
        volume: 0.5
      });

      setPlayer(player);

      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      player.addListener('player_state_changed', state => {
        if (!state) return;

        setCurrentTrack(state.track_window.current_track);
        setIsPaused(state.paused);
      });

      player.connect();
    };
  }, [spotifyToken]);

  const handlePlayPause = () => {
    player.togglePlay();
  };

  const handleNextTrack = () => {
    player.nextTrack();
  };

  return (
    <div className="player-controls">
      {currentTrack && (
        <div className="track-info">
          <img src={currentTrack.album.images[0].url} alt={currentTrack.name} className="album-art" />
          <div>
            <div className="track-name">{currentTrack.name}</div>
            <div className="artist-name">{currentTrack.artists[0].name}</div>
          </div>
        </div>
      )}
      <button className="spotify-btn play-pause" onClick={handlePlayPause}>
        {isPaused ? 'Play' : 'Pause'}
      </button>
      <button className="spotify-btn next" onClick={handleNextTrack}>Next</button>
    </div>
  );
}

export default Player;
2. Footer.js の更新
Footer.js でプレーヤーを読み込む部分はそのままです。次に、カスタムスタイルを作成します。

javascript
コードをコピーする
// components/Footer.js
import Player from './Player';

const Footer = ({ spotifyToken }) => {
  return (
    <footer id="footer">
      <Player spotifyToken={spotifyToken} />
    </footer>
  );
}

export default Footer;