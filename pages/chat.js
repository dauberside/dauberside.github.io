import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { supabase } from '../src/utils/supabaseClient';


const Chat = () => {
  // useState で状態管理
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);

  // useEffect で初回のメッセージ取得とリアルタイムリスナーの設定
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data);
      }
    };

    fetchMessages();

    const messageListener = supabase
      .channel('realtime:public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        setMessages(prevMessages => [...prevMessages, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageListener);
    };
  }, []);

  // メッセージの送信
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (message.trim() && username.trim()) {
      if (editingMessage) {
        const { error } = await supabase
          .from('messages')
          .update({ text: message })
          .eq('id', editingMessage.id);

        if (error) {
          console.error('Error updating message:', error);
        } else {
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.id === editingMessage.id ? { ...msg, text: message } : msg
            )
          );
        }
        setEditingMessage(null);
      } else {
        const { error } = await supabase
          .from('messages')
          .insert([{ username, text: message }]);

        if (error) {
          console.error('Error sending message:', error);
        }
      }
      setMessage('');
    } else {
      console.error('Username or message is empty');
    }
  };

  // メッセージの編集
  const handleEditMessage = (msg) => {
    setMessage(msg.text);
    setEditingMessage(msg);
  };

  // メッセージの削除
  const handleDeleteMessage = async (id) => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting message:', error);
    } else {
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== id));
    }
  };

  // 入力値の変更を管理
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'username') {
      setUsername(value);
    } else if (name === 'message') {
      setMessage(value);
    }
  };

  // JSXの返却
  return (
    <div>
      <Header />
      <main>
        <div className="container my-5">
          <div className="chat-container">
            <div className="chat-box">
              {messages.map((msg, index) => (
                <div key={msg.id} className={`chat-message ${msg.username === username ? 'sent' : 'received'}`}>
                  <strong>{msg.username}:</strong> {msg.text}
                  {msg.username === username && (
                    <div className="message-actions">
                      <button onClick={() => handleEditMessage(msg)}>Edit</button>
                      <button onClick={() => handleDeleteMessage(msg.id)}>Delete</button>
                    </div>
                  )}
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
                <button className="btn btn-dark" onClick={handleSendMessage}>
                  {editingMessage ? 'Update' : 'Send'}
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