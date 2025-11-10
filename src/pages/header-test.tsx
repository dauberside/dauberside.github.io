import React from "react";
import Header from "@/components/layout/Header";

export default function HeaderTestPage() {
  return (
    <div className="min-h-screen bg-[rgb(0,14,40)] text-white font-sans p-6 space-y-8">
      <h1 className="text-2xl font-bold">Header New – 動作確認</h1>

      <p className="text-sm opacity-80">
        テスト項目: クリック開閉 / 外クリック / Esc / Tab移動 / 初期フォーカス / リンク選択で閉じる
      </p>

  <Header />

      <section className="space-y-4">
  <p className="text-xs opacity-70">改善候補: ArrowUp/Down ナビ / 閉じるアニメーション / aria-controls / アイコン差し替え</p>
      </section>

      <div className="h-[1200px] bg-gradient-to-b from-transparent to-black/40 p-4">
        スクロールして外クリック判定確認領域
      </div>
    </div>
  );
}