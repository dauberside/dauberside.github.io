import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const handleSendMessage = async () => {
    if (message.trim() && username.trim()) {
      const msg = { username, text: message };
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(msg),
      });
  
      if (response.ok) {
        setMessage('');
        const newMessage = await response.json();
        setMessages((prevMessages) => [...prevMessages, newMessage]);
      } else {
        console.error('Failed to send message');
      }
    }
  };

export default supabase;