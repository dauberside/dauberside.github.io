import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import Footer from '../components/Footer';
import supabase from '../src/utils/supabaseClient.js';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error.message);
      } else {
        setMessages(data);
      }
    };

    const fetchUserId = async () => {
      const user = supabase.auth.user();
      if (user) {
        setUserId(user.id);
      } else {
        console.error('User not authenticated');
      }
    };

    fetchMessages();
    fetchUserId();

    const socket = io({
      path: '/socket.io',
    });

    socket.on('connect', () => {
      console.log('connected');
    });

    socket.on('init', (data) => {
      setMessages(data);
    });

    socket.on('chat message', (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSendMessage = async () => {
    try {
      if (message.trim() && username.trim() && userId) {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId, username, text: message }),
        });

        if (response.ok) {
          const data = await response.json();
          setMessages((prevMessages) => [...prevMessages, data[0]]);
          setMessage('');
        } else {
          const errorData = await response.json();
          console.error('Failed to send message:', errorData);
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  return (
    <div>
      <Header />
      <main className="container mx-auto p-4">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="chat-box overflow-auto h-80 mb-4 border p-4">
            {messages.map((msg, index) => (
              <div key={index} className="chat-message p-2 border-b">
                <strong>{msg.username}:</strong> {msg.text}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mb-2 p-2 border rounded w-full"
            />
            <input
              type="text"
              id="text"
              name="text"
              placeholder="Type a message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mb-2 p-2 border rounded w-full"
            />
            <button onClick={handleSendMessage} className="w-full bg-blue-500 text-white py-2 rounded">
              Send
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Chat;