import React, { useState } from 'react';

interface ChatInputProps {
  username: string;
  onUsernameChange: (username: string) => void;
  onSendMessage: (text: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ username, onUsernameChange, onSendMessage }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <input
        type="text"
        value={username}
        onChange={(e) => onUsernameChange(e.target.value)}
        placeholder="ユーザー名を入力"
        className="w-full p-2 mb-2 border border-gray-300 rounded"
        required
      />
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="メッセージを入力"
        className="w-full p-2 mb-2 border border-gray-300 rounded"
        required
      />
      <button type="submit" className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        送信
      </button>
    </form>
  );
};

export default ChatInput;