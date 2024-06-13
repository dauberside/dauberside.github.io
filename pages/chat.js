import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import Footer from '../components/Footer';
import supabase from '../src/utils/supabaseClient.js';
import { signInWithEmail, signOut } from '../src/utils/auth.js'; // 新しいauth.jsからインポート
import { Button, Input, Card } from '@shadcn/ui'; // shadcn/uiコンポーネントをインポート

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

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
        setLoggedIn(true);
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

  const handleLogin = async () => {
    try {
      const user = await signInWithEmail(email, password);
      setUserId(user.id);
      setLoggedIn(true);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUserId(null);
      setLoggedIn(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!loggedIn) {
    return (
      <div>
        <Header />
        <main className="container mx-auto p-4">
          <Card className="p-6 max-w-md mx-auto">
            <h2 className="text-2xl mb-4">Login</h2>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-2"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-4"
            />
            <Button onClick={handleLogin} className="w-full">Login</Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="container mx-auto p-4">
        <Button onClick={handleLogout} className="mb-4">Logout</Button>
        <Card className="p-6">
          <div className="chat-box overflow-auto h-80 mb-4">
            {messages.map((msg, index) => (
              <div key={index} className="chat-message p-2 border-b">
                <strong>{msg.username}:</strong> {msg.text}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <Input
              type="text"
              id="name"
              name="name"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mb-2"
            />
            <Input
              type="text"
              id="text"
              name="text"
              placeholder="Type a message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mb-2"
            />
            <Button onClick={handleSendMessage} className="w-full">Send</Button>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Chat;
