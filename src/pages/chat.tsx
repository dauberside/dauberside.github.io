// @ts-nocheck
import React, { useCallback, useEffect, useState } from "react";

import ChatBox from "@/components/chat/ChatBox";
import ChatInput from "@/components/chat/ChatInput";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
const Chat = ({ initialMessages, error: initialError }) => {
  const [messages, setMessages] = useState(initialMessages || []);
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(initialError || null);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    const storedUsername = localStorage.getItem("username") || "";
    setUsername(storedUsername);
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = crypto.randomUUID();
      localStorage.setItem("userId", newUserId);
      setUserId(newUserId);
    }
    let channel;
    const setupRealtimeSubscription = async () => {
      channel = supabase.channel("api:messages").on(
        "postgres_changes",
        {
          event: "*",
          schema: "api",
          table: "messages",
        },
        (payload) => {
          console.log("メッセージの変更を受信:", payload);
          if (payload.eventType === "INSERT") {
            const newMessage = payload.new;
            setMessages((prevMessages) => {
              if (!prevMessages.some((msg) => msg.id === newMessage.id)) {
                return [...prevMessages, newMessage];
              }
              return prevMessages;
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedMessage = payload.new;
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === updatedMessage.id ? updatedMessage : msg,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const deletedMessageId = payload.old.id;
            setMessages((prevMessages) =>
              prevMessages.filter((msg) => msg.id !== deletedMessageId),
            );
          }
        },
      );
      try {
        await channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("リアルタイムサブスクリプションが成功しました");
          } else {
            console.error(
              "リアルタイムサブスクリプションに失敗しました:",
              status,
            );
            setError(
              `リアルタイム更新の設定に失敗しました: ${status}。ページをリロードしてください。`,
            );
          }
        });
      } catch (err) {
        console.error("サブスクリプションエラー:", err);
        setError(
          `リアルタイム更新の設定中にエラーが発生しました: ${err instanceof Error ? err.message : "不明なエラー"}`,
        );
      }
    };
    setupRealtimeSubscription();
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);
  const handleSendMessage = useCallback(
    async (newMessage) => {
      if (!newMessage.trim() || !userId) {
        setError("メッセージを入力してください");
        return;
      }
      setIsLoading(true);
      try {
        const { data, error } = await sendMessage(
          newMessage,
          userId,
          username || "匿名",
          false,
        );
        if (error) {
          throw error;
        }
        console.log("メッセージが正常に送信されました:", data);
        setError(null);
      } catch (error) {
        console.error("メッセージ送信エラー:", error);
        setError(
          `メッセージの送信に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [userId, username],
  );
  const handleDeleteMessage = useCallback(
    async (messageId) => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const { success, error } = await deleteMessage(messageId);
        if (!success) {
          throw error;
        }
        console.log("メッセージが正常に削除されました:", messageId);
        setError(null);
      } catch (error) {
        console.error("メッセージ削除エラー:", error);
        setError(
          `メッセージの削除に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );
  const handleUsernameChange = useCallback((newUsername) => {
    setUsername(newUsername);
    localStorage.setItem("username", newUsername);
  }, []);
  return (
    <div className="min-h-screen bg-[rgb(0,14,40)] text-white">
      <Header className="mx-auto" />
      <main className="container mx-auto px-4">
        <div className="mx-auto">
          <ChatBox
            messages={messages}
            currentUserId={userId}
            onDeleteMessage={handleDeleteMessage}
          />
          <ChatInput
            username={username}
            onUsernameChange={handleUsernameChange}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </div>
      </main>
      <Footer className="max-w-7xl mx-auto px-4" />
    </div>
  );
};
export const getServerSideProps = async () => {
  try {
    console.log("初期メッセージを取得中...");
    const { data: initialMessages, error } = await getMessages();
    if (error) {
      throw error;
    }
    console.log("初期メッセージを取得しました:", initialMessages);
    return {
      props: {
        initialMessages: initialMessages || [],
        error: null,
      },
    };
  } catch (error) {
    console.error("getServerSidePropsでエラーが発生しました:", error);
    return {
      props: {
        initialMessages: [],
        error:
          error instanceof Error
            ? error.message
            : "メッセージの取得中に予期せぬエラーが発生しました",
      },
    };
  }
};
export default Chat;
//# sourceMappingURL=chat.jsx.map
