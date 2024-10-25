import { parse } from 'cookie';
import { supabase } from '../../../../src/utils/supabaseClient';

export default async function handler(req, res) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies['sb:token'];

  console.log('Cookies:', req.headers.cookie);
  console.log('Parsed Cookies:', cookies);
  console.log('Token:', token);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error } = await supabase.auth.api.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const method = req.method;

  switch (method) {
    case 'POST':
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert([{ user_id: user.id, text }]);

      if (messageError) {
        return res.status(500).json({ error: messageError.message });
      }

      res.status(200).json({ message: 'Message created successfully', data: messageData });
      break;

    case 'GET':
      const { data: messages, error: fetchError } = await supabase
        .from('messages')
        .select('id, text, created_at, users (username)');

      if (fetchError) {
        return res.status(500).json({ error: fetchError.message });
      }

      res.status(200).json({ messages });
      break;

    default:
      res.setHeader('Allow', ['POST', 'GET']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}