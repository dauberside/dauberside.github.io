import { promises as fsp } from 'node:fs';
import type { TextPreview } from './types';

export function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) : s; }

export function isTextLike(mime?: string, name?: string) {
  const textMimes = ['application/json','application/xml','application/x-yaml','application/csv','text/markdown'];
  if (mime && (mime.startsWith('text/') || textMimes.includes(mime))) return true;
  if (name) {
    const i = name.lastIndexOf('.');
    if (i >= 0) {
      const ext = name.slice(i + 1).toLowerCase();
      if (['md','txt','csv','json','xml','yaml','yml'].includes(ext)) return true;
    }
  }
  return false;
}

export async function previewFromFilePath(name: string, mime: string | undefined, size: number | undefined, filepath: string): Promise<TextPreview> {
  let text: string | undefined;
  try {
    if (isTextLike(mime, name)) {
      const buf = await fsp.readFile(filepath);
      text = buf.toString('utf8');
      if (mime === 'application/json') {
        try { text = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      }
    }
  } catch {}
  return { key: name, fileName: name, mimeType: mime, size, hasText: !!text, text: text ? truncate(text, 32000) : undefined };
}

export function previewFromBuffer(name: string, mime: string | undefined, buf?: Buffer): TextPreview {
  let text: string | undefined;
  if (buf && isTextLike(mime, name)) {
    text = buf.toString('utf8');
    if (mime === 'application/json') { try { text = JSON.stringify(JSON.parse(text), null, 2); } catch {} }
  }
  return { key: name, fileName: name, mimeType: mime, size: buf?.length, hasText: !!text, text: text ? truncate(text, 32000) : undefined };
}

export function previewsBlock(previews: TextPreview[], maxFiles = 3, maxChars = 3000): string {
  if (!Array.isArray(previews) || previews.length === 0) return '';
  const parts = previews.filter(p => p.hasText && p.text).slice(0, maxFiles).map(p => `【${p.fileName} (${p.mimeType || 'unknown'}, ${p.size ?? '?'} bytes)】\n${p.text}`);
  if (!parts.length) return '';
  const block = parts.join('\n\n-----\n\n');
  return truncate(block, maxChars);
}
