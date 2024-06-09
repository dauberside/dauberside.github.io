import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  const { name, email, message } = req.body;

  const output = `
    <p>You have a new contact request</p>
    <h3>Contact Details</h3>
    <ul>
      <li>Name: ${name}</li>
      <li>Email: ${email}</li>
    </ul>
    <h3>Message</h3>
    <p>${message}</p>
  `;

  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS:', process.env.SMTP_PASS);

  let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2', // これを追加して、最小TLSバージョンを指定します
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
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    res.status(200).send('Message sent');
  } catch (error) {
    console.error('Error occurred: ', error);
    res.status(500).send(error.toString());
  }
}

