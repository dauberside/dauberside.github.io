import { useEffect } from 'react';

const SpotifyPlayer = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const token = localStorage.getItem('spotifyToken');
      const player = new Spotify.Player({
        name: 'Web Playback SDK',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5
      });

      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      player.connect();
    };
  }, []);

  return (
    <div>
      <h2>Spotify Player</h2>
      <div id="spotify-player"></div>
    </div>
  );
};

export default SpotifyPlayer;
