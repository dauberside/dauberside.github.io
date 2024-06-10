// 環境変数の設定ファイルを読み込む
require('dotenv').config({ path: '.env.local' });

const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');

// 環境変数から開発モードかどうかを判定する
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// デバッグ用にSMTPの設定をコンソールに出力する
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS);

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer);

  // body-parserミドルウェアを使ってリクエストボディを解析する
  server.use(bodyParser.urlencoded({ extended: false }));
  server.use(bodyParser.json());

  // /sendエンドポイントでのメール送信処理
  server.post('/send', (req, res) => {
    // メールの内容を定義
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

    // nodemailerを使ってメール送信設定を行う
    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT == 465, // 465番ポートの場合はセキュア接続
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      logger: true,
      debug: true,
    });

    // メールオプションを設定
    let mailOptions = {
      from: `"Nodemailer Contact" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'Contact Request',
      text: 'Hello world?',
      html: output,
    };

    // メールを送信
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error occurred: ', error);
        return res.status(500).send(error.toString());
      }
      console.log('Message sent: %s', info.messageId);
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      res.status(200).send('Message sent');
    });
  });

  // socket.ioの接続設定
  io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
      console.log('user disconnected');
    });

    // クライアントからのメッセージを受け取り、全クライアントに送信する
    socket.on('chat message', (msg) => {
      io.emit('chat message', msg);
    });
  });

  // その他のすべてのリクエストに対してNext.jsのハンドラーを使う
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  // サーバーを起動してポート3000でリスンする
  httpServer.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
});
