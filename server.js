const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// WebSocketサーバーの設定
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', ws => {
  console.log('Client connected');

  ws.on('message', message => {
    console.log('Received:', message);
    // メッセージを処理して、アップデートやコントロールを送信します
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log('WebSocket server is running on ws://localhost:8080');

// Spotify認証のためのエンドポイント
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const accessToken = response.data.access_token;
    res.send(`Access Token: ${accessToken}`);
  } catch (error) {
    res.send(`Error: ${error.response.data.error_description}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});