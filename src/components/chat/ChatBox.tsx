import React, { useEffect, useRef } from "react";

import type { Message } from "@/types/chat";

interface ChatBoxProps {
  messages: Message[];
}

const ChatBox: React.FC<ChatBoxProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  return (
    <div className="bg-white rounded-lg p-4 mb-4 h-[calc(100vh-250px)] overflow-y-auto">
      {messages.map((message) => (
        <div key={message.id} className="mb-2">
          <span className="font-bold text-blue-600">
            {message.username || "Anonymous"}:
          </span>{" "}
          <span className="text-gray-800">{message.content}</span>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatBox;
