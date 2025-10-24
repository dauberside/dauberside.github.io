import crypto from "node:crypto";

import type { NextApiRequest } from "next";

const LINE_ENDPOINT = "https://api.line.me/v2/bot/message/reply";
const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

const LIMITS = {
  buttons: 60, // buttons.template.text 60 chars (column text for carousel too)
  carousel: 60,
  confirm: 240, // confirm.template.text 240 chars
} as const;

function clampText(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  // keep room for ellipsis
  const keep = Math.max(0, max - 1);
  return text.slice(0, keep) + "…";
}

export function verifyLineSignature(req: NextApiRequest, raw: Buffer): boolean {
  const secret = process.env.CHANNEL_SECRET || "";
  const sig = (req.headers["x-line-signature"] as string) || "";
  if (!secret || !sig) return false;
  const mac = crypto.createHmac("sha256", secret).update(raw).digest("base64");
  return mac === sig;
}

export async function replyText(replyToken: string, text: string) {
  const body = { replyToken, messages: [{ type: "text", text }] };
  await lineFetch(body);
  try {
    console.log("[LINE] replyText ok", { bytes: JSON.stringify(body).length });
  } catch {}
}

// Quick Reply support (datetimepickerなど)
export type QuickReplyAction =
  | { type: "postback"; label: string; data: string }
  | { type: "message"; label: string; text: string }
  | { type: "uri"; label: string; uri: string }
  | {
      type: "datetimepicker";
      label: string;
      data: string; // postback.data に入る（postback.params に date/time/datetime が付与される）
      mode: "date" | "time" | "datetime";
      initial?: string; // YYYY-MM-DD or YYYY-MM-DDThh:mm
      max?: string;
      min?: string;
    };

export async function replyTextWithQuickReply(
  replyToken: string,
  text: string,
  items: Array<{ type: "action"; action: QuickReplyAction }>,
  opts?: { cid?: string },
) {
  const body = {
    replyToken,
    messages: [
      {
        type: "text",
        text,
        quickReply: { items: items.slice(0, 13) }, // LINE上限 13
      },
    ],
  } as any;
  await lineFetch(body);
  try {
    console.log("[LINE] replyQuick ok", { items: items.length, cid: opts?.cid });
  } catch {}
}

export async function pushText(to: string, text: string) {
  const token = process.env.CHANNEL_ACCESS_TOKEN || "";
  if (!token) throw new Error("LINE access token is missing");
  const body = { to, messages: [{ type: "text", text }] };
  const res = await fetch(LINE_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`LINE pushText failed: ${res.status} ${t}`);
  }
}

type ButtonsTemplate = {
  type: "buttons";
  title?: string;
  text: string; // 60文字制限
  actions: Array<
    | { type: "postback"; label: string; data: string }
    | { type: "message"; label: string; text: string }
  >;
};

type CarouselTemplate = {
  type: "carousel";
  columns: Array<{
    text: string; // 60文字制限
    actions: Array<{ type: "postback"; label: string; data: string }>;
  }>;
};

type ConfirmTemplate = {
  type: "confirm";
  text: string; // 240文字制限
  actions: Array<
    | { type: "postback"; label: string; data: string }
    | { type: "message"; label: string; text: string }
  >; // LINE仕様上 2 個まで推奨
};

function sanitizeTemplate(
  t: ButtonsTemplate | CarouselTemplate | ConfirmTemplate,
): ButtonsTemplate | CarouselTemplate | ConfirmTemplate {
  if (t.type === "buttons") {
    return { ...t, text: clampText(t.text, LIMITS.buttons) };
  }
  if (t.type === "carousel") {
    const cols = t.columns.map((c) => ({
      ...c,
      text: clampText(c.text, LIMITS.carousel),
      actions: c.actions?.slice(0, 3) || [],
    }));
    return { ...t, columns: cols };
  }
  // confirm
  return {
    ...t,
    text: clampText(t.text, LIMITS.confirm),
    actions: t.actions?.slice(0, 2) || [],
  };
}

export async function replyTemplate(
  replyToken: string,
  template: ButtonsTemplate | CarouselTemplate | ConfirmTemplate,
  altText = "確認",
) {
  const safe = sanitizeTemplate(template);
  const derivedAlt = (() => {
    if (altText && altText.trim()) return altText;
    if ((safe as any).text) {
      const base = String((safe as any).text);
      return clampText(base, 60);
    }
    return "確認";
  })();

  const body = {
    replyToken,
    messages: [{ type: "template", altText: derivedAlt, template: safe }],
  };
  await lineFetch(body);
  try {
    console.log("[LINE] replyTemplate ok", { alt: derivedAlt });
  } catch {}
}

// Send multiple messages in a single reply API call to avoid reusing replyToken
export async function replyMessages(
  replyToken: string,
  messages: Array<any>,
) {
  // sanitize templates inside messages
  const sanitized = messages.map((m) => {
    if (m && m.type === "template" && m.template) {
      return {
        ...m,
        template: sanitizeTemplate(m.template as any),
      };
    }
    return m;
  });
  const body = { replyToken, messages: sanitized };
  await lineFetch(body);
  try {
    console.log("[LINE] replyMessages ok", { count: sanitized.length });
  } catch {}
}

export async function replyConfirm(
  replyToken: string,
  text: string,
  ok: { label: string; data: string },
  cancel?: { label: string; text: string },
  altText = "確認",
) {
  const template: ConfirmTemplate = {
    type: "confirm",
    text,
    actions: [
      { type: "postback", label: ok.label, data: ok.data },
      cancel
        ? { type: "message", label: cancel.label, text: cancel.text }
        : { type: "message", label: "キャンセル", text: "キャンセル" },
    ],
  };
  await replyTemplate(replyToken, template, altText);
}

async function lineFetch(body: unknown) {
  const token = process.env.CHANNEL_ACCESS_TOKEN || "";
  if (!token) throw new Error("LINE access token is missing");
  const res = await fetch(LINE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`LINE replyTemplate failed: ${res.status} ${t}`);
  }
}
