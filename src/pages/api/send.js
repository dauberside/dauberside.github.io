import nodemailer from "nodemailer";
import formidable from "formidable";
import fs from "fs";

// Next.jsのbodyParserを無効化
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "メソッドが許可されていません" });
  }

  // formidableでmultipart/form-dataをパース
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ message: "ファイルの解析に失敗しました" });
    }

    const { name, email, message } = fields;
    const file = files.file; // フロント側のinput name="file"の場合

    // バリデーション（省略可）

    const output = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h1 style="color: #000000ff;">新しいお問い合わせがあります</h1>
        <ul style="list-style: none; padding: 0;">
          <li><strong>名前:</strong> ${name}</li>
          <li><strong>メールアドレス:</strong> ${email}</li>
        </ul>
        <h2>メッセージ</h2>
        <p>${message}</p>
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

    // 添付ファイルがある場合
    const attachments = [];
    if (file) {
      attachments.push({
        filename: file.originalFilename,
        content: fs.createReadStream(file.filepath),
      });
    }

    const mailOptions = {
      from: `"お問い合わせフォーム" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_EMAIL || process.env.SMTP_USER,
      subject: "新しいお問い合わせ",
      text: `名前: ${name}\nメールアドレス: ${email}\n\nメッセージ:\n${message}`,
      html: output,
      attachments,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "メッセージが送信されました" });
    } catch (error) {
      console.error("メール送信エラー:", error);
      res.status(500).json({ message: "メッセージの送信中にエラーが発生しました" });
    }
  });
}
