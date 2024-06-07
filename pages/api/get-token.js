// pages/api/get-token.js
import axios from 'axios';

export default async (req, res) => {
  if (req.method === 'POST') {
    const { code } = req.body;

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', process.env.SPOTIFY_REDIRECT_URI);
    params.append('client_id', process.env.SPOTIFY_CLIENT_ID);
    params.append('client_secret', process.env.SPOTIFY_CLIENT_SECRET);

    try {
      const response = await axios.post('https://accounts.spotify.com/api/token', params);
      res.status(200).json(response.data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch access token' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};