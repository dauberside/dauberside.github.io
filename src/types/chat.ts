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
}
