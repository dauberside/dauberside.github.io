// utils/spotify.js
export async function getPlaylist(spotifyToken, playlistId) {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: {
        'Authorization': `Bearer ${spotifyToken}`,
      },
    });
  
    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.statusText}`);
    }
  
    const data = await response.json();
    return data;
  }