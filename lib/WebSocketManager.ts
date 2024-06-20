import { io } from 'socket.io-client';

interface Message {
    username: string;
    text: string;
  }

const WebSocketManager = (url: string) => { // 型 'string' を指定
  const socket = io(url, {
    path: '/api/socket',
    transports: ['websocket', 'polling'],
    withCredentials: true
  });

  const connect = () => {
    if (!socket.connected) {
      socket.connect();
      console.log('Attempting to establish WebSocket connection...');
    } else {
      console.log('WebSocket is already connected.');
    }
  };

  const doClose = () => {
    if (socket) {
      socket.close();
      console.log('WebSocket connection closed manually.');
    }
  };

  const sendMessage = (message: Message) => { // 型 'Message' を指定
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

  socket.on('disconnect', (reason) => {
    console.log('WebSocket disconnected, reason:', reason);
    setTimeout(connect, 5000); // 5秒後に再接続を試みる
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
    setTimeout(connect, 5000); // 5秒後に再接続を試みる
  });

  return { connect, doClose, sendMessage, socket };
};

export default WebSocketManager;
