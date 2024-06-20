// __tests__/WebSocketManager.test.js
import WebSocketManager from '../lib/WebSocketManager';
import { io } from 'socket.io-client';

// モックの設定
jest.mock('socket.io-client');

describe('WebSocketManager', () => {
  let socket;

  beforeEach(() => {
    socket = {
      connect: jest.fn(),
      close: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      connected: false,
    };
    io.mockReturnValue(socket);
  });

  test('should establish a WebSocket connection', () => {
    const { connect } = WebSocketManager('ws://localhost:3000/api/socket');
    connect();
    expect(socket.connect).toHaveBeenCalled();
  });

  test('should send a message when connected', () => {
    socket.connected = true;
    const { sendMessage } = WebSocketManager('ws://localhost:3000/api/socket');
    sendMessage('test message');
    expect(socket.emit).toHaveBeenCalledWith('message', 'test message');
  });

  test('should not send a message when not connected', () => {
    const { sendMessage } = WebSocketManager('ws://localhost:3000/api/socket');
    sendMessage('test message');
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
