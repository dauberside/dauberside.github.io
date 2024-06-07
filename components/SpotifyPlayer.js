import { useEffect } from 'react';

const SpotifyPlayer = ({ token }) => {
  useEffect(() => {
    if (token) {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);

      window.onSpotifyWebPlaybackSDKReady = () => {
        const player = new Spotify.Player({
          name: 'Web Playback SDK',
          getOAuthToken: cb => { cb(token); }
        });

        player.addListener('ready', ({ device_id }) => {
          console.log('Ready with Device ID', device_id);
        });

        player.addListener('not_ready', ({ device_id }) => {
          console.log('Device ID has gone offline', device_id);
        });

        player.connect();
      };
    }
  }, [token]);

  return (
    <div>
      <h2>Spotify Player</h2>
      <div id="player"></div>
    </div>
  );
};

export default SpotifyPlayer;