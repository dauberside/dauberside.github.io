import fs from "node:fs/promises";
import path from "node:path";

import { embedQuery } from "./embedding";

export interface KBChunk {
  id: number;
  source: string; // relative path
  chunk_index: number;
  text: string;
  embedding: number[];
}

export interface KBIndex {
  model: string;
  created_at: string;
  root: string;
  files: number;
  chunks: number;
  data: KBChunk[];
}

export async function loadKBIndex(indexPath?: string): Promise<KBIndex> {
  const root = process.cwd();
  const p =
    indexPath ||
    process.env.KB_INDEX_PATH ||
    path.join(root, "kb", "index", "embeddings.json");
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

export interface SearchHit {
  id: number;
  source: string;
  text: string;
  score: number;
}

export async function searchKB(
  query: string,
  opts?: { topK?: number; indexPath?: string },
): Promise<SearchHit[]> {
  const topK = opts?.topK ?? 5;
  const index = await loadKBIndex(opts?.indexPath);
  const q = await embedQuery(query);
  const scored = index.data.map((ch) => ({
    id: ch.id,
    source: ch.source,
    text: ch.text,
    score: cosine(q, ch.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
