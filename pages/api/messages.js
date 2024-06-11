import supabase from '../../src/utils/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { username, text } = req.body;
    const { data, error } = await supabase
      .from('messages')
      .insert([{ username, text }]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data[0]);
  } else if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data);
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
