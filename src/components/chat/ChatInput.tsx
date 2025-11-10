import React, { useCallback, useRef, useState } from "react";
import type { Message } from "@/types/chat";

interface ChatInputProps {
  username: string;
  onUsernameChange: (username: string) => void;
  onSendMessage: (text: string, options?: { replyTo?: Message; file?: File | null }) => void;
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
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (message.trim()) {
        onSendMessage(message, replyTo ? { replyTo, file } : { file });
        setMessage("");
        setFile(null);
        // 送信後に返信モードを解除
        onCancelReply?.();
      }
    },
    [message, onSendMessage, replyTo, onCancelReply, file],
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

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setFile(f);
  }, []);

  const clearFile = useCallback(() => setFile(null), []);

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
        <div className="relative">
          <input
            id="message"
            type="text"
            value={message}
            onChange={handleMessageChange}
            placeholder="メッセージを入力"
            className="w-full p-2 pr-10 border text-black border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            required
          />
          {/* hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,text/plain,application/pdf,application/json"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden
            tabIndex={-1}
          />
          {/* paperclip trigger inside the input */}
          <button
            type="button"
            aria-label="ファイルを添付"
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            disabled={isLoading}
          >
            📎
          </button>
        </div>
        {file && (
          <div className="mt-1 text-xs text-black flex items-center justify-between bg-gray-50 border border-gray-300 rounded p-2">
            <div className="truncate">選択中: {file.name} ({Math.round(file.size/1024)} KB)</div>
            <button type="button" className="text-blue-700 underline ml-2" onClick={clearFile}>
              クリア
            </button>
          </div>
        )}
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
