import { useEffect, useState } from 'react';

const Player = ({ token }) => {
  const [player, setPlayer] = useState(null);
  const [isPaused, setPaused] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [artistName, setArtistName] = useState("");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Web Playback SDK Player',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5
      });

      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
      });

      player.addListener('player_state_changed', state => {
        if (!state) {
          return;
        }

        setTrackName(state.track_window.current_track.name);
        setArtistName(state.track_window.current_track.artists.map(artist => artist.name).join(", "));
        setPaused(state.paused);

        player.getCurrentState().then(state => {
          if (!state) {
            console.error('User is not playing music through the Web Playback SDK');
            return;
          }
        });
      });

      player.connect();
      setPlayer(player);
    };
  }, []);

  const handlePlayPause = () => {
    if (player) {
      if (isPaused) {
        player.resume().then(() => {
          setPaused(false);
        });
      } else {
        player.pause().then(() => {
          setPaused(true);
        });
      }
    }
  };

  const handleNextTrack = () => {
    if (player) {
      player.nextTrack();
    }
  };

  return (
    <div id="spotify-player">
      <div className="track-info">
        <h3>{trackName}</h3>
        <p>{artistName}</p>
      </div>
      <div className="controls">
        <button onClick={handlePlayPause}>{isPaused ? 'Play' : 'Pause'}</button>
        <button onClick={handleNextTrack}>Next</button>
      </div>
    </div>
  );
};

export default Player;