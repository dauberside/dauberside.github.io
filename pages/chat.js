import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Header from '../components/Header';
import Footer from '../components/Footer';

// ソケットの初期化
const socket = io('https://www.xn--tu8hz2e.tk', {
  path: '/socket.io',
  withCredentials: true
});

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    // メッセージ受信時の処理
    socket.on('chat message', (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    // クリーンアップ
    return () => {
      socket.off('chat message');
    };
  }, []);

  // メッセージ送信処理
  const handleSendMessage = () => {
    if (message.trim() && username.trim()) {
      const msg = { username, text: message };
      socket.emit('chat message', msg);
      setMessage('');
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
                id="username"
                name="username"
                className="form-control mb-2"
                placeholder="Your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
              <input
                type="text"
                id="message"
                name="message"
                className="form-control mb-2"
                placeholder="Type a message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                autoComplete="off"
              />
              <button className="btn btn-primary" onClick={handleSendMessage}>
                Send
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Chat;
