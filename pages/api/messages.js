require('dotenv').config({ path: '.env.local' });
const express = require('express');
const bodyParser = require('body-parser');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

// Supabaseクライアントの作成
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer, {
    path: '/socket.io',
  });

  server.use(bodyParser.urlencoded({ extended: false }));
  server.use(bodyParser.json());

  // チャットメッセージ送信エンドポイント
  server.post('/api/messages', async (req, res) => {
    const { username, text } = req.body;
    const { data, error } = await supabase
      .from('messages')
      .insert([{ username, text }]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data);
  });

  io.on('connection', (socket) => {
    console.log('a user connected');

    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      socket.emit('init', data.reverse());
    }

    fetchMessages();

    socket.on('disconnect', () => {
      console.log('user disconnected');
    });

    socket.on('chat message', async (msg) => {
      const { data, error } = await supabase
        .from('messages')
        .insert([{ username: msg.username, text: msg.text }]);

      if (error) {
        console.error('Error saving message:', error);
        return;
      }

      io.emit('chat message', msg);
    });
  });

  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
});
