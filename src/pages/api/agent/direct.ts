import type { NextApiRequest, NextApiResponse } from 'next';
// Use dynamic import for formidable to avoid type surface coupling
import { randomUUID } from 'crypto';
import { callCfChat } from '@/lib/ai';
import { TextPreview } from '@/lib/agent/direct/types';
import { isTextLike, previewFromFilePath, previewFromBuffer, truncate } from '@/lib/agent/direct/attachments';
import { kbSearch } from '@/lib/agent/direct/kb';
import { SYSTEM_JA, buildUserMessage } from '@/lib/agent/direct/prompt';
import fs from 'node:fs/promises';
import path from 'node:path';

export const config = { api: { bodyParser: false } };

async function parseMultipart(req: NextApiRequest): Promise<{ fields: Record<string, any>, files: Record<string, any> }> {
  const formidable = (await import('formidable')).default as any;
  const form = formidable({ multiples: true, maxFileSize: 20 * 1024 * 1024 });
  return await new Promise((resolve, reject) => {
    form.parse(req as any, (err: any, fields: any, files: any) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

async function readJsonBody(req: NextApiRequest): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function appendChatLog(line: Record<string, unknown>) {
  try {
    const dir = path.join(process.cwd(), 'data', 'chat-logs');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `chat-${new Date().toISOString().slice(0, 10)}.ndjson`);
    const sanitize = (v: unknown) =>
      typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').slice(0, 4000) : v;
    const payload = Object.fromEntries(Object.entries(line).map(([k, v]) => [k, sanitize(v)]));
    await fs.appendFile(file, JSON.stringify(payload) + '\n', 'utf8');
  } catch {}
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const rid = randomUUID();
  try {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const isMultipart = contentType.includes('multipart/form-data');

    let message = '';
    let tool = '' as string;
    let toolParams: any = {};
  const previews: TextPreview[] = [];

    if (isMultipart) {
  const { fields, files } = await parseMultipart(req);
      message = String(fields.message || fields.text || fields.input || '').trim();
      tool = String(fields.tool || '').trim();
      try { toolParams = fields.Tool_Parameters ? JSON.parse(String(fields.Tool_Parameters)) : {}; } catch { toolParams = {}; }

      // collect files
      const fileLists = Object.values(files) as any[];
      for (const list of fileLists) {
        const arr = Array.isArray(list) ? list : [list];
        for (const f of arr) {
          const mime = f?.mimetype || '';
          const name = f?.originalFilename || f?.newFilename || 'file';
          const size = typeof f?.size === 'number' ? f.size : undefined;
          if (f?.filepath) {
            previews.push(await previewFromFilePath(name, mime, size, f.filepath));
          } else {
            previews.push({ key: name, fileName: name, mimeType: mime, size, hasText: false });
          }
        }
      }
    } else {
      const body = await readJsonBody(req);
      message = String(body.message ?? body.text ?? body.input ?? '').trim();
      tool = String(body.tool || '').trim();
      toolParams = typeof body.Tool_Parameters === 'object' ? (body.Tool_Parameters || {}) : (()=>{ try { return JSON.parse(body.Tool_Parameters || '{}'); } catch { return {}; }})();
      // Optional: base64 files [{name,mime,data}]
      const files = Array.isArray(body.files) ? body.files : [];
      for (const f of files) {
        const name = String(f.name || 'file');
        const mime = String(f.mime || '');
        const data = String(f.data || '');
        try {
          const buf = data ? Buffer.from(data, 'base64') : undefined;
          previews.push(previewFromBuffer(name, mime, buf));
        } catch {
          previews.push({ key: name, fileName: name, mimeType: mime, hasText: false });
        }
      }
    }

    if (!message) return res.status(400).json({ error: 'missing_message' });

    // Optional: KB search tool (fast heuristic or explicit request)
    let kbBlock = '';
    const wantKb = String((req.query.use_kb as string) || '').trim() === '1' || tool === 'kb_search';
    if (wantKb) {
      const q = (toolParams?.query ?? toolParams?.q ?? message) as string;
      const kb = await kbSearch(q, 5);
      if (kb.used && kb.block) kbBlock = kb.block;
    }

    const usedKb = !!kbBlock;

    const finalPrompt = buildUserMessage(message, previews, kbBlock);

    const reply = await callCfChat(finalPrompt, SYSTEM_JA);

    // 返信直前にログ
    await appendChatLog({
      ts: new Date().toISOString(),
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
      sessionId: (req.headers['x-session-id'] as string) || '',
      route: 'direct',
      message: message ?? '',
      usedKb,
      previews_count: previews?.length ?? 0,
      latency_ms: Date.now() - startedAt,
    });
    return res.status(200).json({ ok: true, reply, usedKb, previews });
  } catch (e: any) {
    return res.status(500).json({ error: 'direct_agent_error', message: e?.message || String(e) });
  }
}
