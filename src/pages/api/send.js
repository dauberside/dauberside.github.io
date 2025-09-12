import { kv } from "@vercel/kv";
import nodemailer from "nodemailer";

// Next.js API Route config: limit JSON body to 16kb
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "16kb",
    },
  },
};

const MAX_CONTENT_LENGTH = 16 * 1024; // 16 KB
const MAX_NAME = 80;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 140; // UI と同一上限

function htmlEscape(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function maskIp(ip = "unknown") {
  // IPv4: 1.2.3.4 -> 1.2.3.x, IPv6: shorten
  if (ip.includes(".")) {
    const parts = ip.split(".");
    parts[3] = "x";
    return parts.join(".");
  }
  if (ip.includes(":")) return ip.replace(/[0-9a-f]{1,4}$/i, "xxxx");
  return ip;
}

function trunc(s = "", n = 120) {
  s = String(s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function logIncident({ code, reason, req, extra = {} }) {
  try {
    const ip = maskIp(
      (
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "unknown"
      ).replace("::ffff:", ""),
    );
    const ua = trunc(req.headers["user-agent"] || "");
    const path = req.url || "/api/send";
    const payload = {
      ts: new Date().toISOString(),
      code,
      reason,
      path,
      ip,
      ua,
      ...extra,
    };
    // Vercel log
    console.warn("incident", payload);
    // Optional external webhook
    const url = process.env.MONITORING_WEBHOOK_URL;
    if (url) {
      const headers = { "Content-Type": "application/json" };
      if (process.env.MONITORING_WEBHOOK_TOKEN) {
        headers["Authorization"] =
          `Bearer ${process.env.MONITORING_WEBHOOK_TOKEN}`;
      }
      // fire-and-forget
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ event: "incident", payload }),
      }).catch(() => {});
    }
  } catch {
    // ignore logging failures
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "メソッドが許可されていません" });
  }
  // Content-Type を厳格化
  const ct = (req.headers["content-type"] || "").toString().toLowerCase();
  if (!ct.includes("application/json")) {
    logIncident({ code: 415, reason: "bad_content_type", req, extra: { ct } });
    return res.status(415).json({ message: "不正な Content-Type です" });
  }
  // Content-Length が大きすぎる場合は即時拒否
  const cl = parseInt(req.headers["content-length"], 10);
  if (Number.isFinite(cl) && cl > MAX_CONTENT_LENGTH) {
    logIncident({
      code: 413,
      reason: "content_length_exceeded",
      req,
      extra: { cl },
    });
    return res.status(413).json({ message: "リクエストが大きすぎます" });
  }

  const { name, email, message, recaptchaToken, website } = req.body || {};

  // ハニーポット: bot が埋めたら静かに成功扱いで終わる（可観測性を上げたい場合はログへ）
  if (typeof website === "string" && website.trim() !== "") {
    return res.status(200).json({ message: "メッセージが送信されました" });
  }

  // 入力の正規化（trim）と型チェック
  const _name = typeof name === "string" ? name.trim() : "";
  const _email = typeof email === "string" ? email.trim() : "";
  const _message = typeof message === "string" ? message.trim() : "";

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
        logIncident({
          code: 429,
          reason: "rate_limited",
          req,
          extra: { count: cnt },
        });
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
  if (!_name || !_email || !_message) {
    return res
      .status(400)
      .json({ message: "全てのフィールドを入力してください" });
  }

  if (_name.length > MAX_NAME) {
    return res.status(400).json({ message: "お名前が長すぎます" });
  }
  if (_email.length > MAX_EMAIL) {
    return res.status(400).json({ message: "メールアドレスが長すぎます" });
  }
  if (_message.length > MAX_MESSAGE) {
    return res
      .status(400)
      .json({ message: "メッセージは140文字以内で入力してください" });
  }

  if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(_email)) {
    return res
      .status(400)
      .json({ message: "有効なメールアドレスを入力してください" });
  }

  // ここまで来たら name/email/message は安全に使用できる
  const safeName = htmlEscape(_name);
  const safeEmail = htmlEscape(_email);
  const safeMessageHtml = htmlEscape(_message).replaceAll("\n", "<br>");

  const output = `
  <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #222; background: #f8f8fa; padding: 32px 24px; border-radius: 12px; border: 1px solid #e0e0e0; max-width: 480px;">
    <h1 style="color: #1f1754; font-size: 1.5rem; margin-bottom: 16px;">新しいお問い合わせがあります</h1>
    <ul style="list-style: none; padding: 0; margin-bottom: 24px;">
      <li style="margin-bottom: 8px;"><strong>名前:</strong> ${safeName}</li>
      <li><strong>メールアドレス:</strong> ${safeEmail}</li>
    </ul>
    <h2 style="font-size: 1.1rem; margin-bottom: 8px;">メッセージ</h2>
    <p style="background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #eee;">${safeMessageHtml}</p>
  </div>
`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_PORT === "465",
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"お問い合わせフォーム" <${process.env.SMTP_USER}>`,
    to: process.env.CONTACT_EMAIL || process.env.SMTP_USER,
    subject: "新しいお問い合わせ",
    text: `名前: ${_name}\nメールアドレス: ${_email}\n\nメッセージ:\n${_message}`,
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
