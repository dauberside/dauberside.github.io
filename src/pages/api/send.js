import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "メソッドが許可されていません" });
  }

  const { name, email, message } = req.body;

  // 入力バリデーション
  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ message: "全てのフィールドを入力してください" });
  }

  if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
    return res
      .status(400)
      .json({ message: "有効なメールアドレスを入力してください" });
  }

 const output = `
  <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #222; background: #f8f8fa; padding: 32px 24px; border-radius: 12px; border: 1px solid #e0e0e0; max-width: 480px;">
    <h1 style="color: #1f1754; font-size: 1.5rem; margin-bottom: 16px;">新しいお問い合わせがあります</h1>
    <ul style="list-style: none; padding: 0; margin-bottom: 24px;">
      <li style="margin-bottom: 8px;"><strong>名前:</strong> ${name}</li>
      <li><strong>メールアドレス:</strong> ${email}</li>
    </ul>
    <h2 style="font-size: 1.1rem; margin-bottom: 8px;">メッセージ</h2>
    <p style="background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #eee;">${message}</p>
  </div>
`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"お問い合わせフォーム" <${process.env.SMTP_USER}>`,
    to: process.env.CONTACT_EMAIL || process.env.SMTP_USER,
    subject: "新しいお問い合わせ",
    text: `名前: ${name}\nメールアドレス: ${email}\n\nメッセージ:\n${message}`,
    html: output,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "メッセージが送信されました" });
  } catch (error) {
    console.error("メール送信エラー:", error);
    res
      .status(500)
      .json({ message: "メッセージの送信中にエラーが発生しました" });
  }
}