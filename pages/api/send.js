import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method === 'POST') {
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

    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT == 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    let mailOptions = {
      from: `"Nodemailer Contact" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'Contact Request',
      text: message,
      html: output,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).send('Message sent');
    } catch (error) {
      res.status(500).send(error.toString());
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
