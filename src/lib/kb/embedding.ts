import crypto from 'node:crypto';

const EMBED_MODE = (process.env.KB_EMBED_MODE || 'openai').toLowerCase(); // 'openai' | 'hash'
const EMBED_DIM = Number(process.env.KB_EMBED_DIM || 256);
const MODEL = process.env.KB_EMBEDDING_MODEL || 'text-embedding-3-small';

export interface EmbeddingOptions {
  model?: string;
  dim?: number;
  mode?: 'openai' | 'hash';
}

export async function embedBatch(inputs: string[], opts: EmbeddingOptions = {}): Promise<number[][]> {
  const mode = (opts.mode || EMBED_MODE) as 'openai' | 'hash';
  const dim = Number(opts.dim || EMBED_DIM);
  const model = opts.model || MODEL;

  if (mode === 'openai') {
    // If key missing, fall back to hash
    const key = process.env.OPENAI_API_KEY;
    if (!key) return inputs.map((t) => hashEmbed(t, dim));
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({ model, input: inputs }),
      });
      if (!res.ok) {
        // fallback on HTTP error
        return inputs.map((t) => hashEmbed(t, dim));
      }
      const json = await res.json();
      if (!json?.data) return inputs.map((t) => hashEmbed(t, dim));
      return json.data.map((d: any) => d.embedding);
    } catch {
      // network or other unexpected error → fallback
      return inputs.map((t) => hashEmbed(t, dim));
    }
  }
  // local hash embedding
  return inputs.map((t) => hashEmbed(t, dim));
}

// --- Local embedding utilities ---
function tokenize(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, ' ')
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

// Simple FNV-1a 32-bit hash
function fnv1a(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // unsigned
}

export function hashEmbed(text: string, dim = 256): number[] {
  const v = new Float32Array(dim);
  const toks = tokenize(text);
  if (toks.length === 0) return Array.from(v);
  const tf = new Map<string, number>();
  for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
  for (const [t, f] of tf.entries()) {
    const h = fnv1a(t);
    const idx = h % dim;
    const w = 1 + Math.log(1 + f);
    v[idx] += w;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] = v[i] / norm;
  return Array.from(v);
}

export async function openaiEmbed(text: string, opts: EmbeddingOptions = {}): Promise<number[]> {
  const model = opts.model || MODEL;
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is required for OpenAI embedding mode');
  }
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings API failed: HTTP ${res.status} ${errText}`);
  }
  const json = await res.json();
  return json.data?.[0]?.embedding as number[];
}
