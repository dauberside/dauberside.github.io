// components/Player.js
import { useEffect, useState } from 'react';
import { getPlaylist } from '../utils/spotify';
import { FaPlay, FaPause } from 'react-icons/fa';  // FontAwesomeのアイコンを使用

const Player = ({ spotifyToken, playlistId }) => {
  const [player, setPlayer] = useState(null);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [tracks, setTracks] = useState([]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = async () => {
      const playlist = await getPlaylist(spotifyToken, playlistId);
      setTracks(playlist.tracks.items.map(item => item.track.uri));

      const player = new window.Spotify.Player({
        name: 'Web Playback SDK',
        getOAuthToken: cb => { cb(spotifyToken); },
        volume: 0.5,
      });

      setPlayer(player);

      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        player.connect().then(() => {
          playTrack(0);  // 初期トラックを再生
        });
      });

      player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      player.addListener('player_state_changed', (state) => {
        if (!state) return;
        setIsPaused(state.paused);
        setCurrentTrack(state.track_window.current_track);
      });

      player.connect();
    };

    return () => {
      if (player) {
        player.disconnect();
      }
    };
  }, [spotifyToken, playlistId]);

  const playTrack = (index) => {
    player._options.getOAuthToken(accessToken => {
      fetch(`https://api.spotify.com/v1/me/player/play`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [tracks[index]] }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    });
  };

  const handlePlayPause = () => {
    if (isPaused) {
      player.resume().then(() => {
        console.log('Resumed!');
      });
    } else {
      player.pause().then(() => {
        console.log('Paused!');
      });
    }
  };

  return (
    <div className="spotify-player">
      {currentTrack && (
        <div className="track-info">
          <div>Track: <span>{currentTrack.name}</span></div>
          <div>Artist: <span>{currentTrack.artists.map(artist => artist.name).join(', ')}</span></div>
          <div>Album: <span>{currentTrack.album.name}</span></div>
        </div>
      )}
      <div className="control-buttons">
        <button onClick={handlePlayPause}>
          {isPaused ? <FaPlay /> : <FaPause />}
        </button>
      </div>
    </div>
  );
};

export default Player;