// Obsidian integration domain types (moved into src/types for TS include).
// Minimal initial contract for ingesting notes from an external (n8n) workflow.

export interface ObsidianNote {
  path: string;              // relative path inside vault (e.g. `notes/projectA.md`)
  title: string;             // derived from frontmatter or filename
  content: string;           // full markdown content
  lastModified: string;      // ISO timestamp
  tags?: string[];           // optional extracted tags (frontmatter or inline)
  hash?: string;             // optional pre-computed content hash (sha256 hex)
}

export type IngestMode = 'full' | 'delta';

export interface IngestRequest {
  mode: IngestMode;
  notes: ObsidianNote[];     // batch of notes to consider
  correlationId?: string;    // for tracing across workflow steps
}

export interface IngestResultError {
  path: string;
  reason: string;
}

export interface IngestResponse {
  accepted: number;          // notes accepted for processing
  embedded: number;          // notes whose embeddings were (re)generated
  skipped: number;           // notes skipped due to unchanged hash or filters
  errors?: IngestResultError[];
  correlationId?: string;
}

// Lightweight runtime type guard (best-effort, not exhaustive)
export function isIngestRequest(payload: any): payload is IngestRequest {
  return payload && typeof payload === 'object' && Array.isArray(payload.notes) &&
    (payload.mode === 'full' || payload.mode === 'delta');
}
