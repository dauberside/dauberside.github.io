// pages/profile.js
import { useEffect, useState } from 'react';
import SpotifyPlayer from '../components/SpotifyPlayer';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('spotify_access_token');
    if (!token) {
      window.location.href = '/';
    } else {
      const fetchProfile = async () => {
        try {
          const response = await fetch('https://api.spotify.com/v1/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await response.json();
          setProfile(data);
          setLoading(false);
        } catch (error) {
          console.error('プロフィール情報の取得に失敗しました', error);
        }
      };

      fetchProfile();
    }
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