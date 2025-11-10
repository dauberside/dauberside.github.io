import React from 'react';
import { buildObsidianOpenUri, normalizeVaultFile } from '@/lib/obsidian-uri';

export interface ObsidianLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  vault?: string;
  file?: string;
  path?: string;
  label?: string; // visible label; defaults to children or "Obsidianで開く"
  showFallback?: boolean; // render a small fallback link to /obsidian/open
  fallbackNoAuto?: boolean; // add noAuto=1 to fallback page
}

/**
 * Render an anchor that opens Obsidian via custom URI scheme.
 * Optionally renders a small fallback link to the helper page.
 */
export const ObsidianLink: React.FC<ObsidianLinkProps> = ({
  vault,
  file,
  path,
  label,
  children,
  showFallback = true,
  fallbackNoAuto = true,
  className,
  ...rest
}) => {
  const hasVaultAndFile = !!vault && !!file;
  const href = hasVaultAndFile
    ? buildObsidianOpenUri(normalizeVaultFile(vault!, file!))
    : buildObsidianOpenUri({ path: path || '' });

  const text = (children as any) || label || 'Obsidianで開く';

  // Build fallback page URL (/obsidian/open)
  const params = new URLSearchParams();
  if (hasVaultAndFile) {
    params.set('vault', vault!);
    params.set('file', file!);
  } else if (path) {
    params.set('path', path);
  }
  if (fallbackNoAuto) params.set('noAuto', '1');
  const fallbackHref = `/obsidian/open${params.toString() ? `?${params.toString()}` : ''}`;

  return (
    <span className={className} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <a href={href} {...rest}>{text}</a>
      {showFallback && (
        <a href={fallbackHref} style={{ fontSize: 12, color: '#6b7280', textDecoration: 'underline' }}>
          うまく開かない場合
        </a>
      )}
    </span>
  );
};

export default ObsidianLink;
