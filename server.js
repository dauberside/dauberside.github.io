const cors = require('cors');
const express = require('express');

const server = express();
server.use(cors());

// Your existing code...

const httpServer = http.createServer(server);
const io = new Server(httpServer, {
  path: '/socket.io',
});

// Your existing code...

server.use(bodyParser.urlencoded({ extended: false }));
server.use(bodyParser.json());

// Your existing code...

httpServer.listen(3000, (err) => {
  if (err) throw err;
  console.log('> Ready on http://localhost:3000');
});