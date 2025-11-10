import { useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { buildObsidianOpenUri, normalizeVaultFile, isCanvasFile } from '@/lib/obsidian-uri';

/**
 * Client helper page to launch Obsidian via custom URI scheme.
 * Example: /obsidian/open?vault=Obsidian%20Vault&file=DauberCanvas.canvas
 *
 * Why a page? Some environments block cross-protocol redirects from HTTP.
 * Rendering a clickable link and attempting client-side navigation improves reliability
 * and provides a user-friendly fallback with instructions.
 */
const ObsidianOpenPage: NextPage = () => {
  const router = useRouter();
  const { vault: qVault, file: qFile, path: qPath, noAuto } = router.query as Record<string, string | undefined>;
  const [attempted, setAttempted] = useState(false);

  const { uri, vault, file } = useMemo(() => {
    const vault = qVault || '';
    const file = qFile || '';
    if (vault && file) {
      const nf = normalizeVaultFile(vault, file);
      return { uri: buildObsidianOpenUri(nf), vault: nf.vault, file: nf.file };
    }
    if (qPath) {
      return { uri: buildObsidianOpenUri({ path: qPath }), vault: '', file: qPath };
    }
    return { uri: 'obsidian://open', vault: vault || '', file: file || '' };
  }, [qVault, qFile, qPath]);

  useEffect(() => {
    if (noAuto === '1') return; // allow manual-only mode
    if (attempted) return;
    // Delay slightly to ensure layout renders in case the scheme is blocked
    const t = setTimeout(() => {
      try {
        window.location.href = uri;
      } catch {
        // ignore
      } finally {
        setAttempted(true);
      }
    }, 100);
    return () => clearTimeout(t);
  }, [uri, attempted, noAuto]);

  const isCanvas = isCanvasFile(file);

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Open in Obsidian</h1>
      <p style={{ marginBottom: 16 }}>以下のリンクから Obsidian を起動します。自動で開かない場合はボタンをクリックしてください。</p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <a href={uri} style={{
          display: 'inline-block', background: '#4f46e5', color: '#fff', padding: '10px 16px', borderRadius: 8,
          textDecoration: 'none', fontWeight: 600
        }}>Obsidian で開く</a>
        <code style={{ background: '#f5f5f5', padding: '6px 8px', borderRadius: 6, fontSize: 12 }}>{uri}</code>
      </div>

      {(vault || file) && (
        <ul style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
          {vault && <li><strong>Vault:</strong> <span>{vault}</span></li>}
          {file && <li><strong>File:</strong> <span>{file}</span> {isCanvas && <em style={{ color: '#6b7280' }}>(canvas)</em>}</li>}
        </ul>
      )}

      <details style={{ fontSize: 14 }}>
        <summary>開かないときの対処</summary>
        <ol style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>Obsidian がインストール済みで起動中か確認</li>
          <li>Vault 名が正しいか（Obsidian の「Vault の切替」で確認）</li>
          <li>ファイルパスは Vault 相対パスか（先頭のスラッシュは不要）</li>
          <li>ブラウザのカスタムURLスキーム許可/プロンプトに「許可」</li>
          <li>自動遷移がブロックされる場合は上の「Obsidian で開く」ボタンをクリック</li>
        </ol>
        <p style={{ marginTop: 8 }}>自動遷移を無効化してこのページだけ表示するには、クエリに <code>noAuto=1</code> を付けてください。</p>
      </details>
    </div>
  );
};

export default ObsidianOpenPage;
