import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { io } from 'socket.io-client';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(); // サーバーのURLを指定しないことで、同じサーバー上での接続を使用
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('WebSocket connection established on client.');
    });

    newSocket.on('chat message', (msg) => {
      console.log('New message received on client:', msg);
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected on client, reason:', reason);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && username.trim()) {
      const newMessage = { username: username, text: message }; // 修正箇所: 正しいオブジェクト形式に
      console.log('Attempting to send message:', newMessage);

      if (socket && socket.connected) {
        socket.emit('chat message', newMessage);
        setMessage('');
      } else {
        console.error('WebSocket is not open. Waiting for connection...');
        socket.once('connect', () => {
          console.log('Sending message after reconnect:', newMessage);
          socket.emit('chat message', newMessage);
          setMessage('');
        });
      }
    } else {
      console.error('Username or message is empty');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'username') {
      setUsername(value);
    } else if (name === 'message') {
      setMessage(value);
    }
  };

  return (
    <div>
      <Header />
      <main>
        <div className="container my-5">
          <div className="chat-container">
            <div className="chat-box">
              {messages.map((msg, index) => (
                <div key={index} className="chat-message">
                  <strong>{msg.username}:</strong> {msg.text}
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                type="text"
                id="usernameInput"
                name="username"
                className="form-control mb-2"
                placeholder="Enter your username"
                value={username}
                onChange={handleInputChange}
                autoComplete="username"
              />
              <input
                type="text"
                id="messageInput"
                name="message"
                className="form-control mb-2"
                placeholder="Type a message"
                value={message}
                onChange={handleInputChange}
                autoComplete="off"
              />
              <div className="button-group">
                <button className="btn btn-primary" onClick={handleSendMessage}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Chat;
