import { GetServerSideProps, NextPage } from 'next'
import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/utils/supabaseClient'
import { Message } from '@/types/chat'
import ChatBox from '@/components/chat/ChatBox'
import ChatInput from '@/components/chat/ChatInput'


interface ChatProps {
  initialMessages: Message[]
}

const Chat: NextPage<ChatProps> = ({ initialMessages }) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [username, setUsername] = useState<string>('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || 'anonymous')
    }
    fetchUserId()

    const channel = supabase
      .channel('realtime messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prevMessages) => [...prevMessages, payload.new as Message])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !userId) return

    const { data, error } = await supabase
      .from('messages')
      .insert({ content, user_id: userId, username })
      .select()

    if (error) {
      console.error('Error sending message:', error)
    } else if (data) {
      setMessages((prevMessages) => [...prevMessages, data[0] as Message])
    }
  }, [userId, username])

  const handleUsernameChange = useCallback((newUsername: string) => {
    setUsername(newUsername)
  }, [])

  return (
    <div className="min-h-screen bg-[rgb(0,14,40)] text-white ">
      <Header className="mx-auto px-4" />
      <main className="container mx-auto px-4">
        <h1 className="px-2 text-2xl font-bold mb-4">🌏🌏🌏</h1>
        <div className="flex-grow flex flex-col">
          <div className="flex-grow overflow-hidden">
            <ChatBox messages={messages} />
          </div>
          <ChatInput
            username={username}
            onUsernameChange={handleUsernameChange}
            onSendMessage={handleSendMessage}
          />
        </div>
      </main>
      <Footer className=" mx-auto px-4 w-full" />
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<ChatProps> = async () => {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })

      return { props: { initialMessages: messages || [] } }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
      return { props: { initialMessages: [] } }
    }

}

export default Chat