import { previewsBlock } from "./attachments";
import type { TextPreview } from "./types";

export const SYSTEM_JA = [
  "あなたは最新情報の取得と外部ツールの活用に長けた効率的な自動化アシスタントです。",
  "",
  "[ツール使用ポリシー]",
  " - 最新性が重要または根拠が弱い場合は、必要に応じてナレッジ検索結果（付与済み）を参照。",
  " - 不確実なら推測せず、追加確認を提案。",
  "",
  "[回答スタイル]",
  " 1) 要点の短い日本語要約",
  " 2) 実行手順/利用情報の簡潔な説明",
  " 3) 出典（付与されていれば）",
  " 4) 不確実点と次アクションの提案",
].join("\n");

export function buildUserMessage(
  message: string,
  previews?: TextPreview[],
  kbBlock?: string,
) {
  let out = String(message || "").trim();
  const pBlock = previewsBlock(previews || [], 3, 3000);
  if (pBlock) {
    out += `\n\n[添付ファイルプレビュー]\n${pBlock}`;
  }
  if (kbBlock) {
    out += `\n\n[KB検索結果]\n${kbBlock}`;
  }
  return out;
}
