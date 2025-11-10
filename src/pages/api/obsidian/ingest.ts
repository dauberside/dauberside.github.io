import type { NextApiRequest, NextApiResponse } from 'next';
import { IngestResponse, isIngestRequest } from '@/types/obsidian';
import { processNotesDelta } from '@/lib/kb/ingest';

// Minimal POST endpoint to accept Obsidian notes from n8n and queue processing.
// Security: If process.env.OBSIDIAN_INGEST_TOKEN is set, require header `x-obsidian-token` to match.
// This is a stub: it validates and returns counters without doing actual embedding.

export default async function handler(req: NextApiRequest, res: NextApiResponse<IngestResponse | { error: string }>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const configuredToken = process.env.OBSIDIAN_INGEST_TOKEN;
  const providedToken = req.headers['x-obsidian-token'];
  if (configuredToken) {
    if (typeof providedToken !== 'string' || providedToken !== configuredToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const payload = req.body;
  if (!isIngestRequest(payload)) {
    return res.status(400).json({ error: 'Invalid payload: expected { mode, notes[] }' });
  }

  const accepted = Array.isArray(payload.notes) ? payload.notes.length : 0;

  // Call diff pipeline (embedding still stubbed)
  let diffResult;
  try {
    diffResult = await processNotesDelta(payload.notes);
  } catch (e: any) {
    return res.status(500).json({ error: `diff pipeline failed: ${e?.message || e}` });
  }

  const embedded = diffResult.embeddedNotes ?? 0;
  const skipped = diffResult.diff.skipped.length;
  const errorsArr = diffResult.diff.errors;

  // Extend base response with diff/plan preview
  const response: IngestResponse & { plan?: { path: string; chunks: number }[]; message?: string; toEmbed?: number; skipped?: number; embeddedChunks?: number } = {
    accepted,
    embedded,
    skipped,
    errors: errorsArr,
    correlationId: payload.correlationId,
    plan: diffResult.plan,
    message: diffResult.message,
    toEmbed: diffResult.diff.toEmbed.length,
    embeddedChunks: diffResult.embeddedChunks,
  };

  return res.status(202).json(response);
}
