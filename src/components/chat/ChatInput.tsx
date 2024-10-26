import React, { useState, useCallback } from 'react';

interface ChatInputProps {
  username: string;
  onUsernameChange: (username: string) => void;
  onSendMessage: (text: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ username, onUsernameChange, onSendMessage }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  }, [message, onSendMessage]);

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUsernameChange(e.target.value);
  }, [onUsernameChange]);

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-2 ">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-white mb-2 px-2">
        👤👤👤
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={handleUsernameChange}
          placeholder="ユーザー名を入力"
          className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-white mb-2 px-2">
        📝📝📝
        </label>
        <input
          id="message"
          type="text"
          value={message}
          onChange={handleMessageChange}
          placeholder="メッセージを入力"
          className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      <button 
        type="submit" 
        className="w-full  p-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"
      >
        送信
      </button>
    </form>
  );
};

export default ChatInput;