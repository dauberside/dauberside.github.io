import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import Footer from '../components/Footer';
import supabase from '../src/utils/supabaseClient.js';
import { signInWithEmail, signOut, signUpWithEmail } from '../src/utils/auth.js'; // auth.jsからインポート

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // 新規登録とログインの切り替え用状態
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

  const handleSignUp = async () => {
    try {
      const user = await signUpWithEmail(email, password);
      setUserId(user.id);
      setLoggedIn(true);
    } catch (error) {
      console.error('Sign up error:', error);
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
          <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl mb-4">{isSignUp ? 'Sign Up' : 'Login'}</h2>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-2 p-2 border rounded w-full"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-4 p-2 border rounded w-full"
            />
            <button onClick={isSignUp ? handleSignUp : handleLogin} className="w-full bg-blue-500 text-white py-2 rounded">
              {isSignUp ? 'Sign Up' : 'Login'}
            </button>
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full bg-gray-500 text-white py-2 rounded mt-4"
            >
              {isSignUp ? 'Already have an account? Login' : 'Don’t have an account? Sign Up'}
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="container mx-auto p-4">
        <button onClick={handleLogout} className="mb-4 bg-red-500 text-white py-2 px-4 rounded">
          Logout
        </button>
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