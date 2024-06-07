// pages/profile.js
import { useEffect, useState } from 'react';
import axios from 'axios';

const Profile = () => {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const accessToken = localStorage.getItem('spotifyAccessToken');
    if (accessToken) {
      axios.get('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      .then(response => {
        setProfile(response.data);
      })
      .catch(error => {
        console.error('Error fetching profile:', error);
      });
    }
  }, []);

  if (!profile) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Welcome, {profile.display_name}</h1>
      <img src={profile.images[0].url} alt="Profile Picture" />
      <p>Email: {profile.email}</p>
      <p>Followers: {profile.followers.total}</p>
    </div>
  );
};

export default Profile;