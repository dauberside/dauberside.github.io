// components/Player.js
import { useEffect, useState } from 'react';
import styles from '../src/styles/Player.module.css';

const Player = ({ token }) => {
  const [player, setPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);

  useEffect(() => {
    if (!window.Spotify) {
      const script = document.createElement('script');
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => initializeSpotifyPlayer();
    } else {
      initializeSpotifyPlayer();
    }

    function initializeSpotifyPlayer() {
      window.onSpotifyWebPlaybackSDKReady = () => {
        const spotifyPlayer = new window.Spotify.Player({
          name: 'Web Playback SDK Player',
          getOAuthToken: cb => { cb(token); },
          volume: 0.5
        });

        setPlayer(spotifyPlayer);

        spotifyPlayer.addListener('ready', ({ device_id }) => {
          console.log('Ready with Device ID', device_id);
        });

        spotifyPlayer.addListener('not_ready', ({ device_id }) => {
          console.log('Device ID has gone offline', device_id);
        });

        spotifyPlayer.addListener('player_state_changed', (state) => {
          if (!state) return;
          setCurrentTrack(state.track_window.current_track);
          setIsPlaying(!state.paused);
        });

        spotifyPlayer.connect();
      };
    }

    return () => {
      if (player) {
        player.disconnect();
      }
    };
  }, [token]);

  return (
    <div className={styles.player}>
      {currentTrack && (
        <div className={styles.trackInfo}>
          <img src={currentTrack.album.images[0].url} alt={currentTrack.name} className={styles.albumArt} />
          <div className={styles.trackDetails}>
            <div className={styles.trackName}>{currentTrack.name}</div>
            <div className={styles.trackArtist}>{currentTrack.artists[0].name}</div>
          </div>
        </div>
      )}
      <div className={styles.controls}>
        <button className={styles.controlButton} onClick={() => player.previousTrack()}>⏮️</button>
        <button className={styles.controlButton} onClick={() => player.togglePlay()}>{isPlaying ? '⏸️' : '▶️'}</button>
        <button className={styles.controlButton} onClick={() => player.nextTrack()}>⏭️</button>
      </div>
    </div>
  );
};

export default Player;

