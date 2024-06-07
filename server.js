const express = require('express');
const axios = require('axios');
const session = require('express-session');
const querystring = require('querystring');
const app = express();

require('dotenv').config();

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;

app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
}));

app.get('/callback', async (req, res) => {
    const code = req.query.code;

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirect_uri,
            client_id: client_id,
            client_secret: client_secret,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const access_token = response.data.access_token;
        req.session.access_token = access_token;
        res.redirect('/profile');
    } catch (error) {
        console.error('Error getting Spotify access token', error);
        res.send('Error getting Spotify access token');
    }
});

app.get('/profile', async (req, res) => {
    const access_token = req.session.access_token;

    if (!access_token) {
        return res.redirect('/');
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        const userData = response.data;
        res.send(`<h1>Welcome, ${userData.display_name}</h1><p>Email: ${userData.email}</p>`);
    } catch (error) {
        console.error('Error getting user data from Spotify', error);
        res.send('Error getting user data from Spotify');
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
