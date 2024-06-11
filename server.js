require('dotenv').config({ path: '.env.local' });
const express = require('express');
const bodyParser = require('body-parser');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: 'https://www.xn--tu8hz2e.tk',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      credentials: true  // 追加
    }
  });

  server.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://www.xn--tu8hz2e.tk');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // CORS設定
  server.use(cors({
    origin: 'https://www.xn--tu8hz2e.tk',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true  // 追加
  }));

  server.use(bodyParser.urlencoded({ extended: false }));
  server.use(bodyParser.json());

  io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
      console.log('user disconnected');
    });

    socket.on('chat message', (msg) => {
      io.emit('chat message', msg);
    });
  });

  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
