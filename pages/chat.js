import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import supabase from '../src/utils/supabaseClient.js'; // 正しいパスを確認

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    // 初期メッセージの取得
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*');
      
      if (error) {
        console.error('Error fetching messages:', error.message);
      } else {
        setMessages(data);
      }
    };

    fetchMessages();

    return () => {
      supabase.removeAllSubscriptions();
    };
  }, []);

  const handleSendMessage = async () => {
    if (message.trim() && username.trim()) {
      const { data, error } = await supabase
        .from('messages')
        .insert([{ username, text: message }]);

      if (error) {
        console.error('Failed to send message:', error.message);
      } else {
        setMessages((prevMessages) => [...prevMessages, ...data]);
        setMessage('');
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
