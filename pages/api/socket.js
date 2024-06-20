// socket.js
import { Server } from 'socket.io';
import EventEmitter from 'events';

EventEmitter.defaultMaxListeners = 20;

export default function handler(req, res) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, {
      path: '/api/socket',
      cors: {
        origin: "http://localhost:3000", // ローカル環境用
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      console.log('New client connected');

      socket.on('message', (msg) => {
        console.log('Message received on server:', msg);
        io.emit('message', msg);
      });

      socket.on('disconnect', (reason) => {
        console.log('Client disconnected, reason:', reason);
      });
    });
    console.log('Socket.io server started');
  } else {
    console.log('Socket.io server already running');
  }
  res.end();
}
