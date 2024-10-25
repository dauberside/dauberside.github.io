import React, { useEffect, useState, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { supabase } from '@/utils/supabaseClient';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ChatBox from '@/components/chat/ChatBox';
import ChatInput from '@/components/chat/ChatInput';

interface Message {
  id: number;
  username: string;
  text: string;
  created_at: string;
}

interface ChatProps {
  initialMessages: Message[];
}

export const getServerSideProps: GetServerSideProps<ChatProps> = async () => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('メッセージの取得中にエラーが発生しました:', error);
    return { props: { initialMessages: [] } };
  }

  return { props: { initialMessages: data || [] } };
};

const Chat: React.FC<ChatProps> = ({ initialMessages }) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    const messageListener = supabase
      .channel('realtime:public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        setMessages(prevMessages => [...prevMessages, payload.new as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageListener);
    };
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (text.trim() && username.trim()) {
      const { error } = await supabase
        .from('messages')
        .insert([{ username, text }]);

      if (error) {
        console.error('メッセージの送信中にエラーが発生しました:', error);
        alert('メッセージの送信に失敗しました。もう一度お試しください。');
      }
    } else {
      alert('ユーザー名とメッセージを入力してください。');
    }
  }, [username]);

  const handleEditMessage = useCallback(async (id: number, newText: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ text: newText })
      .eq('id', id);

    if (error) {
      console.error('メッセージの更新中にエラーが発生しました:', error);
      alert('メッセージの更新に失敗しました。もう一度お試しください。');
    } else {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === id ? { ...msg, text: newText } : msg
        )
      );
    }
  }, []);

  const handleDeleteMessage = useCallback(async (id: number) => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('メッセージの削除中にエラーが発生しました:', error);
      alert('メッセージの削除に失敗しました。もう一度お試しください。');
    } else {
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== id));
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Head>
        <title>リアルタイムチャット</title>
        <meta name="description" content="Supabaseを使用したリアルタイムチャットアプリケーション" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-center">リアルタイムチャット</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <ChatBox
            messages={messages}
            currentUsername={username}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
          />
          <ChatInput
            username={username}
            onUsernameChange={setUsername}
            onSendMessage={handleSendMessage}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Chat;