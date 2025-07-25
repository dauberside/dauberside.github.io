export interface Message {
  id: number;
  created_at: string;
  content: string;
  user_id: string;
  username?: string; // オプショナルとして追加
}
