/**
 * Shared embedding utilities for Knowledge Base
 * Supports both OpenAI embeddings and local hash-based embeddings
 */

const OPENAI_MODEL = process.env.KB_EMBEDDING_MODEL || "text-embedding-3-small";
const EMBED_MODE = (process.env.KB_EMBED_MODE || "openai").toLowerCase();
const EMBED_DIM = parseInt(process.env.KB_EMBED_DIM || "256", 10);

// --- Local hash-based embedding (no external API, no data egress) ---

function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, " ")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

// Simple FNV-1a 32-bit hash
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // unsigned
}

function hashEmbed(text: string, dim = 256): number[] {
  const v = new Float32Array(dim);
  const toks = tokenize(text);
  if (toks.length === 0) return Array.from(v);

  // term frequency weighting
  const tf = new Map<string, number>();
  for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);

  for (const [t, f] of tf.entries()) {
    const h = fnv1a(t);
    const idx = h % dim;
    const w = 1 + Math.log(1 + f); // damp frequency
    v[idx] += w;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] = v[i] / norm;

  return Array.from(v);
}

// --- OpenAI embedding ---

async function openaiEmbed(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("missing OPENAI_API_KEY");
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: OPENAI_MODEL, input: text }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Embeddings failed: HTTP ${res.status} ${t}`);
  }

  const json: any = await res.json();
  return json.data?.[0]?.embedding as number[];
}

// --- Unified embedding function ---

/**
 * Generate embedding vector for text
 * Uses KB_EMBED_MODE env var to determine method:
 * - 'hash': Local hash-based embedding (no API calls, no data egress)
 * - 'openai': OpenAI embeddings API (default)
 */
export async function embedQuery(text: string): Promise<number[]> {
  if (EMBED_MODE === "hash") {
    return hashEmbed(text, EMBED_DIM);
  }

  return openaiEmbed(text);
}

/**
 * Get current embedding mode
 */
export function getEmbedMode(): string {
  return EMBED_MODE;
}

/**
 * Get embedding dimension
 */
export function getEmbedDim(): number {
  return EMBED_DIM;
}

/**
 * Batch embed multiple texts
 * @param texts Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (EMBED_MODE === "hash") {
    // Hash mode can process all at once
    return texts.map((text) => hashEmbed(text, EMBED_DIM));
  }

  // OpenAI mode - process one by one to avoid rate limits
  const embeddings: number[][] = [];
  for (const text of texts) {
    const embedding = await openaiEmbed(text);
    embeddings.push(embedding);
  }
  return embeddings;
}
