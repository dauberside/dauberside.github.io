import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ObsidianNote } from '@/types/obsidian';
import { embedBatch } from '@/lib/kb/embedding';

/** Index JSON minimal structure (subset) */
interface KBIndexHeader {
  model: string;
  created_at: string;
  root?: string;
  files?: number;
  chunks?: number;
}

export interface KBIndexChunk {
  id: number;               // stable numeric id
  source: string;           // file path
  chunk_index: number;      // position within file
  text: string;             // original text
  embedding: number[];      // vector
  // future: hash?
}

export interface KBIndexFile {
  // Potential extension in future: aggregate per-file metadata
  source: string;
  chunkCount: number;
}

export interface KBIndex {
  header: KBIndexHeader;
  data: KBIndexChunk[];
}

export interface DiffInputNote extends ObsidianNote {
  // enforce hash presence after normalization
  hash?: string;
}

export interface DiffResult {
  toEmbed: DiffInputNote[];  // notes requiring (re)embedding
  skipped: DiffInputNote[];  // unchanged notes
  errors: { path: string; reason: string }[];
}

/** Compute sha256 hex of content */
export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Text chunking with overlap (mirrors scripts/kb/build.mjs behavior)
 * - size: 1200 chars per chunk
 * - overlap: 200 chars between consecutive chunks
 */
export function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  const len = text?.length || 0;
  if (!len) return chunks;
  while (i < len) {
    const end = Math.min(i + size, len);
    const slice = text.slice(i, end);
    chunks.push(slice);
    if (end === len) break;
    i += Math.max(1, size - overlap);
  }
  return chunks;
}

/** Convenience: chunk a note's content and return [{chunk_index, text}] */
export function chunkNote(note: DiffInputNote, size = 1200, overlap = 200): { chunk_index: number; text: string }[] {
  const pieces = chunkText(note.content || '', size, overlap);
  return pieces.map((t, idx) => ({ chunk_index: idx, text: t }));
}

/** Load existing KB index (embeddings.json). Returns empty skeleton if missing. */
export async function loadKBIndex(indexPath?: string): Promise<KBIndex> {
  const root = process.cwd();
  const p = indexPath || process.env.KB_INDEX_PATH || path.join(root, 'kb', 'index', 'embeddings.json');
  try {
    const raw = await fs.readFile(p, 'utf8');
    const json = JSON.parse(raw);
    if (Array.isArray(json.data)) {
      return { header: json, data: json.data } as KBIndex;
    }
    // older format fallback
    if (Array.isArray(json.chunks)) {
      return { header: json, data: json.chunks } as KBIndex;
    }
    return { header: json, data: [] };
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return { header: { model: 'unknown', created_at: new Date().toISOString() }, data: [] };
    }
    throw err;
  }
}

/** Build a quick lookup of file latest chunk hash (approx via concatenation) */
function buildFileHashApprox(index: KBIndex): Map<string, string> {
  const map = new Map<string, crypto.Hash>();
  for (const c of index.data) {
    if (!map.has(c.source)) {
      map.set(c.source, crypto.createHash('sha256'));
    }
    map.get(c.source)!.update(c.text);
  }
  const result = new Map<string, string>();
  for (const [k, h] of map.entries()) {
    result.set(k, h.digest('hex'));
  }
  return result;
}

/** Diff incoming notes against approximate file hash from index. */
export function diffNotes(notes: DiffInputNote[], index: KBIndex): DiffResult {
  const existingFileHashes = buildFileHashApprox(index);
  const toEmbed: DiffInputNote[] = [];
  const skipped: DiffInputNote[] = [];
  const errors: { path: string; reason: string }[] = [];

  for (const note of notes) {
    if (!note.path || !note.content) {
      errors.push({ path: note.path || '(unknown)', reason: 'missing path or content' });
      continue;
    }
    const hash = note.hash || computeContentHash(note.content);
    const prev = existingFileHashes.get(note.path);
    if (prev && prev === hash) {
      skipped.push({ ...note, hash });
    } else {
      toEmbed.push({ ...note, hash });
    }
  }
  return { toEmbed, skipped, errors };
}

export interface PersistOptions {
  /** Overwrite existing embeddings.json path; default KB_INDEX_PATH */
  indexPath?: string;
}

/**
 * Persist updated index. This is a stub that simply merges new chunks placeholder.
 * Actual embedding computation is not implemented here; caller should supply vectors.
 */
export async function persistIndex(index: KBIndex, opts: PersistOptions = {}): Promise<void> {
  const root = process.cwd();
  const p = opts.indexPath || process.env.KB_INDEX_PATH || path.join(root, 'kb', 'index', 'embeddings.json');
  const header = { ...index.header, updated_at: new Date().toISOString(), chunks: index.data.length };
  const out = { ...header, data: index.data };
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(out, null, 2), 'utf8');
}

/** High-level pipeline stub: diff notes then (placeholder) embed and persist */
export async function processNotesDelta(notes: DiffInputNote[], opts: { indexPath?: string } = {}) {
  const index = await loadKBIndex(opts.indexPath);
  const diff = diffNotes(notes, index);
  // Placeholder embedding: we do not call OpenAI here (to be implemented)
  // For each note in toEmbed we would normally:
  // 1. Chunk (same logic as scripts/kb/build.mjs)
  // 2. Call embedding API per chunk
  // 3. Append new KBIndexChunk entries with new id sequence

  // If nothing to embed, short-circuit
  if (diff.toEmbed.length === 0) {
    return {
      diff,
      plan: [],
      embeddedNotes: 0,
      embeddedChunks: 0,
      message: 'No new/changed notes to embed',
    } as const;
  }

  // Determine starting id (max existing id + 1)
  let nextId = index.data.reduce((m, c) => c && typeof c.id === 'number' && c.id > m ? c.id : m, -1) + 1;
  const appended: KBIndexChunk[] = [];
  const plan = [] as { path: string; chunks: number }[];

  for (const note of diff.toEmbed) {
    const pieces = chunkText(note.content || '');
    plan.push({ path: note.path, chunks: pieces.length });
    if (pieces.length === 0) continue;
    // Embed in batches, fallback automatically handled inside embedBatch
    const batchSize = 32;
    const embeddings: number[][] = [];
    for (let i = 0; i < pieces.length; i += batchSize) {
      const slice = pieces.slice(i, i + batchSize);
      const embs = await embedBatch(slice);
      embeddings.push(...embs);
    }
    for (let i = 0; i < pieces.length; i++) {
      appended.push({
        id: nextId++,
        source: note.path,
        chunk_index: i,
        text: pieces[i],
        embedding: embeddings[i],
      });
    }
  }

  // Merge and persist updated index
  index.data.push(...appended);
  try {
    await persistIndex(index, { indexPath: opts.indexPath });
  } catch (e: any) {
    return {
      diff,
      plan,
      embeddedNotes: diff.toEmbed.length,
      embeddedChunks: appended.length,
      message: `Persist failed: ${e?.message || e}`,
    } as const;
  }

  return {
    diff,
    plan,
    embeddedNotes: diff.toEmbed.length,
    embeddedChunks: appended.length,
    message: 'Embeddings generated and index persisted',
  } as const;
}
