import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import Footer from '../components/Footer';

const socket = io({
  path: '/socket.io',
});

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    // 初期メッセージの取得
    fetch('/api/messages')
      .then((response) => response.json())
      .then((data) => setMessages(data))
      .catch((error) => console.error('Error fetching messages:', error));

    socket.on('chat message', (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    return () => {
      socket.off('chat message');
    };
  }, []);

  const handleSendMessage = async () => {
    if (message.trim() && username.trim()) {
        const msg = { username, text: message };
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.SUPABASE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
            },
            body: JSON.stringify(msg),
        });

        if (response.ok) {
            const newMessage = await response.json();
            setMessages((prevMessages) => [...prevMessages, newMessage]);
        } else {
            const error = await response.json();
            console.error('Failed to send message:', error.message);
        }
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
                id="name"
                name="name"
                className="form-control mb-2"
                placeholder="Your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                type="text"
                id="text"
                name="text"
                className="form-control mb-2"
                placeholder="Type a message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
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