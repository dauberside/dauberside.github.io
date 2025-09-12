import { kv } from "@vercel/kv";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "メソッドが許可されていません" });
  }

  const { name, email, message, recaptchaToken } = req.body || {};

  // 簡易レート制限: 1IP/分（KVが未設定でもメール送信は継続）
  const ip = (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  ).replace("::ffff:", "");
  try {
    if (process.env.KV_URL || process.env.KV_REST_API_URL) {
      const key = `rate:contact:${ip}`;
      const cntRaw = await kv.incr(key);
      const cnt = Number(cntRaw) || 0;
      // 60秒のTTLを都度設定（初回 or 更新）
      await kv.expire(key, 60);
      if (cnt > 1) {
        return res.status(429).json({
          message: "短時間に送信が多すぎます。しばらくしてからお試しください",
        });
      }
    }
  } catch {
    // KV未設定や障害時はスルー
  }

  // reCAPTCHA 検証（任意。環境変数があれば v3/enterpriseに対応）
  if (process.env.RECAPTCHA_SECRET_KEY && recaptchaToken) {
    try {
      const verifyUrl = process.env.RECAPTCHA_SITE_KEY?.startsWith("projects/")
        ? `https://recaptchaenterprise.googleapis.com/v1beta1/projects/${encodeURIComponent(
            process.env.RECAPTCHA_SITE_KEY.split("/")[1] || "",
          )}/assessments?key=${encodeURIComponent(
            process.env.RECAPTCHA_API_KEY || "",
          )}`
        : "https://www.google.com/recaptcha/api/siteverify";

      if (verifyUrl.includes("siteverify")) {
        const params = new URLSearchParams();
        params.set("secret", process.env.RECAPTCHA_SECRET_KEY);
        params.set("response", recaptchaToken);
        const resp = await fetch(verifyUrl, { method: "POST", body: params });
        const json = await resp.json();
        if (
          !json.success ||
          (typeof json.score === "number" && json.score < 0.3)
        ) {
          return res
            .status(400)
            .json({ message: "reCAPTCHA 検証に失敗しました" });
        }
      } else {
        // Enterprise 簡易実装（詳細なイベントスコアリングは省略）
        const ev = {
          event: {
            token: recaptchaToken,
            siteKey: process.env.RECAPTCHA_SITE_KEY,
            expectedAction: "contact_submit",
          },
        };
        const resp = await fetch(verifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ev),
        });
        const json = await resp.json();
        const score = json?.riskAnalysis?.score ?? 1;
        if (!json.tokenProperties?.valid || score < 0.3) {
          return res
            .status(400)
            .json({ message: "reCAPTCHA Enterprise 検証に失敗しました" });
        }
      }
    } catch {
      return res.status(400).json({ message: "reCAPTCHA 検証に失敗しました" });
    }
  }

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
