import React from 'react';

const SpotifyPlayer = ({ token }) => {
  return (
    <iframe
      src={`https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0&token=${token}`}
      width="300"
      height="380"
      frameBorder="0"
      allow="encrypted-media"
    ></iframe>
  );
};

export default SpotifyPlayer;