// pages/profile.js
import { useEffect, useState } from 'react';
import SpotifyPlayer from '../components/SpotifyPlayer';

const Profile = () => {
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('spotifyAccessToken');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  return (
    <div>
      <h1>Profile Page</h1>
      {token ? <SpotifyPlayer token={token} /> : <p>Loading...</p>}
    </div>
  );
};

export default Profile;