import React from 'react';
import { Message } from '../../types/chat';

interface ChatBoxProps {
  messages: Message[];
  currentUsername: string;
  onEditMessage: (id: number, newText: string) => void;
  onDeleteMessage: (id: number) => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({ messages, currentUsername, onEditMessage, onDeleteMessage }) => {
  return (
    <div className="chat-box h-96 overflow-y-auto mb-4 p-4 border border-gray-300 rounded">
      {messages.map((msg) => (
        <div key={msg.id} className={`chat-message mb-2 p-2 rounded ${msg.username === currentUsername ? 'bg-blue-100 text-right' : 'bg-gray-100'}`}>
          <strong>{msg.username}:</strong> {msg.text}
          {msg.username === currentUsername && (
            <div className="message-actions mt-1">
              <button
                onClick={() => {
                  const newText = prompt('メッセージを編集', msg.text);
                  if (newText) onEditMessage(msg.id, newText);
                }}
                className="text-xs text-blue-600 mr-2"
              >
                編集
              </button>
              <button
                onClick={() => onDeleteMessage(msg.id)}
                className="text-xs text-red-600"
              >
                削除
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ChatBox;