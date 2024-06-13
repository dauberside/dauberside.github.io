import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import Footer from '../components/Footer';
import supabase from '../src/utils/supabaseClient';

const socket = io({
  path: '/socket.io',
});

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch('/api/messages');
        const data = await response.json();

        if (response.ok) {
          setMessages(data);
        } else {
          console.error('Error fetching messages:', data.error);
        }
      } catch (error) {
        console.error('Unexpected error fetching messages:', error);
      }
    };

    fetchMessages();

    socket.on('chat message', (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    return () => {
      socket.off('chat message');
    };
  }, []);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        console.log('Fetched user data:', data);
        if (error) {
          console.error('Error fetching user ID:', error);
        } else if (data && data.user) {
          setUserId(data.user.id);
        } else {
          console.error('No user found');
          router.push('/login'); // ログインページにリダイレクト
        }
      } catch (error) {
        console.error('Unexpected error fetching user ID:', error);
      }
    };

    fetchUserId();
  }, [router]);

  const handleSendMessage = async () => {
    if (!userId) {
      console.error('User ID is not set');
      return;
    }

    if (message.trim() && username.trim()) {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId, username, text: message }),
        });

        const data = await response.json();

        if (response.ok) {
          socket.emit('chat message', data[0]);
          setMessages((prevMessages) => [...prevMessages, data[0]]);
          setMessage('');
        } else {
          console.error('Failed to send message:', data.error);
        }
      } catch (error) {
        console.error('Unexpected error sending message:', error);
      }
    } else {
      console.error('Username or message is empty');
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
