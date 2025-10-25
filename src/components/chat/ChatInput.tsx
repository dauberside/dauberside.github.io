import React, { useCallback, useState } from "react";
import type { Message } from "@/types/chat";

interface ChatInputProps {
  username: string;
  onUsernameChange: (username: string) => void;
  onSendMessage: (text: string, options?: { replyTo?: Message }) => void;
  isLoading?: boolean;
  replyTo?: Message | null;
  onCancelReply?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  username,
  onUsernameChange,
  onSendMessage,
  isLoading,
  replyTo,
  onCancelReply,
}) => {
  const [message, setMessage] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (message.trim()) {
        onSendMessage(message, replyTo ? { replyTo } : undefined);
        setMessage("");
        // 送信後に返信モードを解除
        onCancelReply?.();
      }
    },
    [message, onSendMessage, replyTo, onCancelReply],
  );

  const handleUsernameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUsernameChange(e.target.value);
    },
    [onUsernameChange],
  );

  const handleMessageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setMessage(e.target.value);
    },
    [],
  );

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-2 ">
      {replyTo && (
        <div className="rounded-md border border-gray-300/60 bg-gray-50 text-black p-2 flex items-start justify-between gap-2">
          <div className="text-xs">
            <div className="font-semibold mb-1">引用</div>
            <div className="opacity-80">
              ↪︎ {replyTo.username || "Anonymous"}: {replyTo.content.slice(0, 100)}
              {replyTo.content.length > 100 ? "…" : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-xs underline text-blue-700 hover:text-blue-900"
            aria-label="引用をキャンセル"
          >
            キャンセル
          </button>
        </div>
      )}
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium text-black mb-2 px-2"
        >
          👤👤👤
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={handleUsernameChange}
          placeholder="ユーザー名を入力"
          className="w-full p-2 border text-black border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-black mb-2 px-2"
        >
          📝📝📝
        </label>
        <input
          id="message"
          type="text"
          value={message}
          onChange={handleMessageChange}
          placeholder="メッセージを入力"
          className="w-full p-2 border text-black border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full  p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"
      >
        {isLoading ? "送信中…" : "送信"}
      </button>
    </form>
  );
};

export default ChatInput;
