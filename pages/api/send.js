const nodemailer = require('nodemailer');

export default async function handler(req, res) {
  const smtpHost = process.env.SMTP_HOST || 'default_host';
  const smtpPort = process.env.SMTP_PORT || 'default_port';
  const smtpUser = process.env.SMTP_USER || 'default_user';
  const smtpPass = process.env.SMTP_PASS || 'default_pass';

  console.log('SMTP_HOST:', smtpHost);
  console.log('SMTP_PORT:', smtpPort);
  console.log('SMTP_USER:', smtpUser);
  console.log('SMTP_PASS:', smtpPass);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort == 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const mailOptions = {
    from: `"Nodemailer Contact" <${smtpUser}>`,
    to: smtpUser,
    subject: 'Contact Request',
    text: 'Hello world?',
    html: `<p>You have a new contact request</p>
           <h3>Contact Details</h3>
           <ul>
             <li>Name: ${req.body.name}</li>
             <li>Email: ${req.body.email}</li>
           </ul>
           <h3>Message</h3>
           <p>${req.body.message}</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    res.status(200).send('Message sent');
  } catch (error) {
    console.log('Error occurred: ', error);
    res.status(500).send(error.toString());
  }
}
