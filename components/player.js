// components/Player.js
import { useEffect, useState } from 'react';
import styles from '../src/styles/Player.module.css';

const Player = ({ token }) => {
  const [player, setPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumCover, setAlbumCover] = useState('');

  useEffect(() => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new Spotify.Player({
        name: 'Web Playback SDK',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5,
        level: 'HW_SECURE_CRYPTO' // Robustness level for DRM
      });

      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      player.addListener('player_state_changed', (state) => {
        if (!state) return;
        
        setIsPlaying(!state.paused);
        setTrackName(state.track_window.current_track.name);
        setArtistName(state.track_window.current_track.artists.map(artist => artist.name).join(', '));
        setAlbumCover(state.track_window.current_track.album.images[0].url);
      });

      player.connect();

      setPlayer(player);
    };

    // Load Spotify SDK script
    const script = document.createElement('script');
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (player) {
        player.disconnect();
      }
    };
  }, [token]);

  const togglePlay = () => {
    player.togglePlay();
  };

  const nextTrack = () => {
    player.nextTrack();
  };

  const previousTrack = () => {
    player.previousTrack();
  };

  return (
    <div className={styles.player}>
      <div className={styles.trackInfo}>
        {albumCover && <img src={albumCover} alt="Album cover" />}
        <div className={styles.trackDetails}>
          <h3>{trackName}</h3>
          <p>{artistName}</p>
        </div>
      </div>
      <div className={styles.controls}>
        <button onClick={previousTrack}>⏮️</button>
        <button onClick={togglePlay}>{isPlaying ? '⏸️' : '▶️'}</button>
        <button onClick={nextTrack}>⏭️</button>
      </div>
    </div>
  );
};

export default Player;
