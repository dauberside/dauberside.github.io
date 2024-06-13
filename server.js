require('dotenv').config({ path: '.env.local' });
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

// Supabaseクライアントの作成
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer, {
    path: '/socket.io',
  });

  server.use(bodyParser.urlencoded({ extended: false }));
  server.use(bodyParser.json());

  // メール送信エンドポイント
  server.post('/api/send', async (req, res) => {
    const output = `
      <p>You have a new contact request</p>
      <h3>Contact Details</h3>
      <ul>
        <li>Name: ${req.body.name}</li>
        <li>Email: ${req.body.email}</li>
      </ul>
      <h3>Message</h3>
      <p>${req.body.message}</p>
    `;

    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT == 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      logger: true,
      debug: true,
    });

    let mailOptions = {
      from: `"Nodemailer Contact" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'Contact Request',
      text: 'Hello world?',
      html: output,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Message sent');
      res.status(200).send('Message sent');
    } catch (error) {
      console.error('Error occurred:', error);
      res.status(500).send(error.toString());
    }
  });

  // チャットメッセージ送信エンドポイント
  server.post('/api/messages', async (req, res) => {
    const { user_id, username, text } = req.body;
    const { data, error } = await supabase
      .from('messages')
      .insert([{ user_id, username, text }])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data);
  });

  // チャット機能
  io.on('connection', (socket) => {
    console.log('a user connected');

    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      socket.emit('init', data.reverse());
    }

    fetchMessages();

    socket.on('disconnect', () => {
      console.log('user disconnected');
    });

    socket.on('chat message', async (msg) => {
      const { data, error } = await supabase
        .from('messages')
        .insert([{ user_id: msg.user_id, username: msg.username, text: msg.text }])
        .select();

      if (error) {
        console.error('Error saving message:', error);
        return;
      }

      io.emit('chat message', data[0]);
    });
  });

  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(3000, (err) => {
    if (err) {
      console.error('Error starting server:', err);
      process.exit(1);
    }
    console.log('> Ready on http://localhost:3000');
  });
}).catch(err => {
  console.error('Error preparing app:', err);
  process.exit(1);
});