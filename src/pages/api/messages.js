import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { user_id, username, text } = req.body;

    console.log('Received message:', { user_id, username, text }); // 追加: リクエスト内容をログに出力

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{ user_id, username, text }])
        .select();

      if (error) {
        console.error('Error inserting message:', error);
        return res.status(500).json({ error: error.message });
      }

      res.status(200).json(data);
    } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching messages:', error);
        return res.status(500).json({ error: error.message });
      }

      res.status(200).json(data);
    } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
