// pages/profile.js
import { useEffect, useState } from 'react';
import SpotifyPlayer from '../components/SpotifyPlayer';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('spotify_access_token');
        const response = await fetch('https://api.spotify.com/v1/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data = await response.json();
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
  
    fetchProfile();
  }, []);
  
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Welcome, {profile.display_name}</h1>
      <img src={profile.images[0]?.url} alt="Profile Picture" />
      <SpotifyPlayer />
    </div>
  );
};

export default Profile;