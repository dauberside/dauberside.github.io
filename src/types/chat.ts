export interface Message {
  id: number;
  created_at: string;
  content: string;
  user_id: string;
  username?: string; // オプショナルとして追加
  // 返信メタ（UI専用。サーバには送らない）
  replyTo?: {
    id: number;
    username?: string;
    content: string;
  };
  // KB 参照（UI専用メタ）
  kbRefs?: Array<{
    source: string;
    text: string;
    score?: number;
  }>;
  // アクション候補（エージェント提案による簡易オペレーション）
  actions?: Array<{
    type: "open_url" | "call_api" | "navigate" | "copy";
    label: string;
    url?: string;
    method?: "GET" | "POST";
    body?: any;
  }>;
}
