// WebSocketManager.ts
import { io, Socket } from 'socket.io-client';

interface WebSocketManagerType {
  connect: () => void;
  doClose: () => void;
  sendMessage: (message: string) => void;
  socket: Socket;
}

const WebSocketManager = (url: string): WebSocketManagerType => {
  const socket: Socket = io(url, {
    path: '/api/socket',
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });

  const connect = (): void => {
    if (!socket.connected) {
      socket.connect();
      console.log('WebSocket connection established.');
    } else {
      console.log('WebSocket is already connected.');
    }
  };

  const doClose = (): void => {
    if (socket) {
      socket.close();
      console.log('WebSocket connection closed manually.');
    }
  };

  const sendMessage = (message: string): void => {
    if (socket && socket.connected) {
      socket.emit('message', message);
      console.log('Message sent:', message);
    } else {
      console.error('WebSocket is not open. Unable to send message.');
      socket.once('connect', () => {
        console.log('Sending message after reconnect:', message);
        socket.emit('message', message);
      });
    }
  };

  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  socket.on('disconnect', (reason) => {
    console.log('WebSocket disconnected, reason:', reason);
  });

  return { connect, doClose, sendMessage, socket };
};

export default WebSocketManager;
