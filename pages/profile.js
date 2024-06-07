// pages/profile.js
import { useEffect, useState } from 'react';
import SpotifyPlayer from '../components/SpotifyPlayer';

const Profile = () => {
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchToken = () => {
      const token = localStorage.getItem('spotifyAccessToken');
      if (token) {
        setToken(token);
      }
    };

    const fetchProfile = async (token) => {
      try {
        const response = await fetch('https://api.spotify.com/v1/me', {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });
        const data = await response.json();
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchToken();
    if (token) {
      fetchProfile(token);
    }
  }, [token]);

  return (
    <div>
      <h1>Profile Page</h1>
      {profile ? (
        <div>
          <h2>{profile.display_name}</h2>
          <p>Email: {profile.email}</p>
          <img src={profile.images[0]?.url} alt="Profile Image" width="100" />
          <SpotifyPlayer token={token} />
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default Profile;