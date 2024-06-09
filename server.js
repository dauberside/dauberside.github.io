require('dotenv').config({ path: '.env.local' }); // これをファイルの一番上に置く
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  const smtpHost = process.env.SMTP_HOST || 'default_host';
  const smtpPort = process.env.SMTP_PORT || 'default_port';
  const smtpUser = process.env.SMTP_USER || 'default_user';
  const smtpPass = process.env.SMTP_PASS || 'default_pass';

  console.log('SMTP_HOST:', smtpHost);
  console.log('SMTP_PORT:', smtpPort);
  console.log('SMTP_USER:', smtpUser);
  console.log('SMTP_PASS:', smtpPass);

  server.use(bodyParser.urlencoded({ extended: false }));
  server.use(bodyParser.json());

  server.post('/send', (req, res) => {
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
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort == 465, // ポートが465の場合はtrue、それ以外はfalse
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      logger: true,
      debug: true,
    });

    let mailOptions = {
      from: `"Nodemailer Contact" <${smtpUser}>`,
      to: smtpUser,
      subject: 'Contact Request',
      text: 'Hello world?',
      html: output,
    };

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

  server.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
});
