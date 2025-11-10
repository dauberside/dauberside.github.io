/**
 * Utilities for building Obsidian URI scheme links.
 *
 * Reference: obsidian://open?vault=<VaultName>&file=<path%2Fto%2Fnote.md>
 * - vault: Vault display name
 * - file:  Vault-relative path. EncodeURIComponent, but keep '/'
 *
 * Alternative: obsidian://open?path=<absolute path> もあるが、本実装は vault+file を優先。
 */

function encodePathKeepSlash(p: string): string {
  // Encode everything, then restore '/'
  return encodeURIComponent(p).replace(/%2F/gi, '/');
}

function encodeVaultName(name: string): string {
  return encodeURIComponent(name);
}

export interface BuildOpenUriParams {
  vault?: string; // Vault name (optional if using path variant)
  file?: string;  // vault-relative path (e.g., "Folder/Note.md")
  path?: string;  // absolute path variant (not commonly used here)
}

/**
 * Build obsidian://open URI.
 * - Prefer vault+file when provided.
 * - Fallback to path variant when only path is provided.
 */
export function buildObsidianOpenUri(params: BuildOpenUriParams): string {
  const base = 'obsidian://open';
  const { vault, file, path } = params || {};
  if (vault && file) {
    const qs = new URLSearchParams({
      vault: encodeVaultName(vault),
      file: encodePathKeepSlash(file),
    });
    // URLSearchParams re-encodes values; we already encoded. Build manually.
    return `${base}?vault=${encodeVaultName(vault)}&file=${encodePathKeepSlash(file)}`;
  }
  if (path) {
    return `${base}?path=${encodePathKeepSlash(path)}`;
  }
  // Invalid → return base (won't open, but won't crash)
  return base;
}

export function isCanvasFile(file: string | undefined | null): boolean {
  return !!file && /\.canvas$/i.test(file);
}

export function normalizeVaultFile(vault: string, file: string): { vault: string; file: string } {
  // Trim accidental leading slashes in file; Obsidian expects vault-relative path
  const trimmed = file.replace(/^\/+/, '');
  return { vault, file: trimmed };
}
