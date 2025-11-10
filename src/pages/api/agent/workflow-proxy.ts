import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { TextWorkflowInputSchema, TextWorkflowOutputSchema } from '@/lib/agent/workflows/schemas';
import { runWorkflow } from '@/lib/agent/workflows/text-workflow';
import fs from 'node:fs';
import path from 'node:path';
// Note: import formidable dynamically to avoid TS type requirement at build time

export const config = {
  api: {
    bodyParser: false, // allow multipart/form-data via formidable
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rid = (req.headers['x-request-id'] as string) || randomUUID();
  const OBS = process.env.NEXT_OBSERVABILITY === '1';
  const hiRes = typeof (process as any).hrtime?.bigint === 'function';
  const t0: any = hiRes ? (process as any).hrtime.bigint() : Date.now();
  const done = (status: number, meta?: Record<string, any>) => {
    if (!OBS) return;
    try {
      const t1: any = hiRes ? (process as any).hrtime.bigint() : Date.now();
      const ms = hiRes ? Number((t1 as bigint) - (t0 as bigint)) / 1e6 : (t1 as number) - (t0 as number);
      const info = { method: req.method, status, ms: Math.max(0, ms).toFixed(1), rid, ...(meta || {}) } as any;
      console.log('[obs]/api/agent/workflow-proxy', info);
    } catch {}
  };

  if (req.method === 'GET') {
    res.setHeader('Allow', 'POST');
    done(200, { path: 'GET-info' });
    return res.status(200).json({
      ok: true,
      endpoint: '/api/agent/workflow-proxy',
      expected: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { input_as_text: 'say hello' },
      },
      notes: [
        'Protected by middleware (IP allowlist or Basic Auth) when ADMIN_ENABLE_PROTECTION=1.',
        'This route runs the workflow server-side without requiring the internal token from the browser.',
      ],
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    done(405, { path: 'method' });
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const contentType = (req.headers['content-type'] || '').toString().toLowerCase();
  let input_as_text: string = '';
  let kb_snippets: Array<{ source: string; text: string; score?: number | null }>|undefined = undefined;
  const isMultipart = contentType.includes('multipart/form-data');

  if (isMultipart) {
    // Handle multipart upload (single file supported initially)
    try {
      const formidable = (await import('formidable')).default as any;
      const form = formidable({
        multiples: false,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        filter: (part: any) => !!part.mimetype && (part.mimetype.startsWith('image/') || part.mimetype.startsWith('audio/') || part.mimetype === 'text/plain' || part.mimetype === 'application/json' || part.mimetype === 'application/pdf'),
      });

      const { fields, files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
        form.parse(req, (err: any, fields: any, files: any) => {
          if (err) return reject(err);
          resolve({ fields, files });
        });
      });

  const pickField = (v: any) => Array.isArray(v) ? v[0] : v;
  const textFieldRaw = pickField(fields.input_as_text ?? fields.message ?? fields.text ?? fields.input);
  input_as_text = typeof textFieldRaw === 'string' ? textFieldRaw : '';
      const kbField = Array.isArray(fields.kb_snippets) ? fields.kb_snippets[0] : (fields.kb_snippets as any);
      if (typeof kbField === 'string') {
        try { kb_snippets = JSON.parse(kbField); } catch {}
      }

      // minimal validation using Zod by constructing object
      const preCheck = TextWorkflowInputSchema.safeParse({ input_as_text, kb_snippets });
      if (!preCheck.success) {
        done(400, { path: 'validate-multipart', reason: 'zod' });
        return res.status(400).json({ error: 'invalid_input', details: preCheck.error.flatten() });
      }

      const fileAny = (files as any)?.file || (Object.values(files)[0] as any);
      if (fileAny) {
        const { filepath, originalFilename, mimetype, size } = fileAny || {};
        const fname = String(originalFilename || 'attachment');
        const mtype = String(mimetype || 'application/octet-stream');
        const sz = Number(size || 0);

        // Best-effort preview for text-like files, capped to 2000 chars
        let preview: string | null = null;
        try {
          if (mtype.startsWith('text/') || mtype === 'application/json') {
            const buf = fs.readFileSync(filepath);
            const txt = buf.toString('utf8');
            preview = txt.slice(0, 2000);
          }
        } catch {}

        const attachNote = `添付ファイル: ${fname} (${mtype}, ${Math.round(sz/1024)}KB)` + (preview ? `\n内容プレビュー:\n${preview}` : '\n(このファイルはプレビューされていません)');
        const extra = { source: `attachment:${fname}`, text: attachNote } as const;
        kb_snippets = Array.isArray(kb_snippets) ? [...kb_snippets, extra] : [extra];
      }
    } catch (e: any) {
      console.error(`[api/agent/workflow-proxy] rid=${rid} multipart_error`, e);
      done(415, { path: 'multipart', error: e?.message });
      return res.status(415).json({ error: 'invalid_multipart' });
    }
  } else {
    if (!contentType.includes('application/json')) {
      done(415, { path: 'validate', reason: 'content_type' });
      return res.status(415).json({ error: 'invalid_content_type' });
    }
    // bodyParser is disabled; manually read and parse JSON
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      let body: any = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }

      // Accept alias keys and normalize to input_as_text
      const alias = body?.input_as_text ?? body?.message ?? body?.text ?? body?.input ?? '';
      input_as_text = typeof alias === 'string' ? alias : '';
      const kbField = body?.kb_snippets;
      if (Array.isArray(kbField)) {
        kb_snippets = kbField as any;
      } else if (typeof kbField === 'string') {
        try { kb_snippets = JSON.parse(kbField); } catch {}
      }

      const parse = TextWorkflowInputSchema.safeParse({ input_as_text, kb_snippets });
      if (!parse.success) {
        done(400, { path: 'validate', reason: 'zod' });
        return res.status(400).json({ error: 'invalid_input', details: parse.error.flatten() });
      }
      ({ input_as_text, kb_snippets } = parse.data as any);
    } catch (e: any) {
      done(400, { path: 'validate', reason: 'json_parse', error: e?.message });
      return res.status(400).json({ error: 'invalid_json' });
    }
  }

  // Best-effort: in dev, try to hydrate OPENAI_API_KEY from .env.local if missing
  if (process.env.NODE_ENV !== 'production' && !process.env.OPENAI_API_KEY) {
    try {
      const root = process.cwd();
      const envLocal = path.join(root, '.env.local');
      const envFile = path.join(root, '.env');
      const tryExtract = (p: string) => {
        try {
          if (!fs.existsSync(p)) return;
          const txt = fs.readFileSync(p, 'utf8');
          const m = txt.replace(/[\uFEFF\u200B]/g, '').match(/(?:^|\n)\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.+)/m);
          if (m) {
            let v = m[1].trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith('\'') && v.endsWith('\''))) v = v.slice(1, -1);
            if (v) process.env.OPENAI_API_KEY = v;
          }
        } catch {}
      };
      tryExtract(envLocal); if (!process.env.OPENAI_API_KEY) tryExtract(envFile);
    } catch {}
  }

  // Mock handling mirrors other routes
  const mockRequested = process.env.AGENT_MOCK_MODE === '1' || String((req.query as any)?.mock) === '1';
  const isProd = process.env.NODE_ENV === 'production';
  const mockEnabled = !isProd && mockRequested;
  if (mockEnabled) {
    const mock = { output_text: `mock:${input_as_text}`, actions: [
      { type: 'open_url', label: 'KB を検索', url: `/api/kb/search?q=${encodeURIComponent(input_as_text.slice(0,64))}` },
    ] } as const;
    const outParse = TextWorkflowOutputSchema.safeParse(mock);
    if (!outParse.success) { done(500, { path: 'mock', reason: 'invalid_output' }); return res.status(500).json({ error: 'mock_output_invalid' }); }
    done(200, { path: 'mock' });
    return res.status(200).json(mock);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error(`[api/agent/workflow-proxy] rid=${rid} missing OPENAI_API_KEY`);
    const mockAllowed = process.env.NODE_ENV !== 'production' && process.env.AGENT_MOCK_MODE === '1';
    if (mockAllowed) {
      const mock = { output_text: `mock:${input_as_text}`, actions: [
        { type: 'open_url', label: 'KB を検索', url: `/api/kb/search?q=${encodeURIComponent(input_as_text.slice(0,64))}` },
      ] } as const;
      const outParse = TextWorkflowOutputSchema.safeParse(mock);
      if (!outParse.success) { done(500, { path: 'mock-fallback', reason: 'invalid_output' }); return res.status(500).json({ error: 'mock_output_invalid' }); }
      done(200, { path: 'mock-fallback' });
      return res.status(200).json(mock);
    }
    done(500, { path: 'precheck', error: 'missing_OPENAI_API_KEY' });
    return res.status(500).json({ error: 'missing_OPENAI_API_KEY (set in .env.local and restart server)' });
  }

  try {
  const result = await runWorkflow({ input_as_text, kb_snippets });
    const out = TextWorkflowOutputSchema.parse(result);
    done(200, { path: 'run' });
    return res.status(200).json(out);
  } catch (err: any) {
    console.error(`[api/agent/workflow-proxy] rid=${rid} error`, err);
    done(500, { path: 'catch', error: err?.message || String(err) });
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}
