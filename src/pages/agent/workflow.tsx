import React from 'react';
import Head from 'next/head';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ChatBox from '@/components/chat/ChatBox';
import ChatInput from '@/components/chat/ChatInput';
import type { Message } from '@/types/chat';
import { sendToAgent } from '@/lib/chat/service';

export default function AgentWorkflowPage() {
    const SHOW_KB_REFS = process.env.NEXT_PUBLIC_SHOW_KB_REFS === '1';
    // Tokenless UI: calls server-side proxy protected by middleware
    const [mock, setMock] = React.useState(false);
    const [useTestWebhook, setUseTestWebhook] = React.useState(process.env.NEXT_PUBLIC_N8N_CHAT_TEST === '1');
    const [username, setUsername] = React.useState<string>('You');
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [replyTo, setReplyTo] = React.useState<Message | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        // initialize from localStorage to mirror chat page UX (optional)
        const stored = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
        if (stored) setUsername(stored);
    }, []);

    const onUsernameChange = React.useCallback((name: string) => {
        setUsername(name);
        if (typeof window !== 'undefined') localStorage.setItem('username', name);
    }, []);

        const onSendMessage = React.useCallback(async (text: string, options?: { replyTo?: Message; file?: File | null }) => {
        if (!text.trim()) return;
        setError(null);
        const now = new Date().toISOString();
        const userMsg: Message = {
            id: Date.now(),
            created_at: now,
            content: text,
            user_id: 'user',
            username: username || 'You',
            replyTo: options?.replyTo
        };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);
        try {
            // 1) KB 検索（上位3件）
            let kbSnippets: Array<{ source: string; text: string; score?: number }> = [];
            try {
                const q = encodeURIComponent(text);
                const resp = await fetch(`/api/kb/search?q=${q}&topK=3`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (Array.isArray(data?.hits)) {
                        kbSnippets = data.hits.map((h: any) => ({ source: h.source, text: h.text, score: h.score }));
                    }
                }
            } catch {}

            // 2) Agent 呼び出し（KB 文脈を添付）
            const { output_text, raw } = await sendToAgent(text, { mock, test: useTestWebhook, kbSnippets, file: options?.file || null });
            const agentMsg: Message = {
                id: Date.now() + 1,
                created_at: new Date().toISOString(),
                content: output_text,
                user_id: 'agent',
                username: 'Agent',
                kbRefs: SHOW_KB_REFS ? kbSnippets : undefined,
                actions: Array.isArray(raw?.actions) ? raw.actions.slice(0, 5) : undefined,
            };
            setMessages((prev) => [...prev, agentMsg]);
            } catch (err: any) {
                setError(err?.message || 'request failed');
            const errMsg: Message = {
                id: Date.now() + 1,
                created_at: new Date().toISOString(),
                content: String(err?.message || 'request failed'),
                user_id: 'agent',
                username: 'Agent',
            };
            setMessages((prev) => [...prev, errMsg]);
        } finally {
            setLoading(false);
            // 返信モード解除
            setReplyTo(null);
        }
    }, [mock, username]);

    return (
        <div className="min-h-screen font-sans">
            <Head>
                <meta name="robots" content="noindex,nofollow,noarchive" />
            </Head>
            <Header />
            <main className="w-full max-w-[1140px] mx-auto px-[50px] py-6">
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-2xl font-semibold">Agent Workflow</h1>
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={mock}
                            onChange={(e) => setMock(e.target.checked)}
                        />
                        mock=1（開発のみ / 本番無効）
                    </label>
                </div>
                                {process.env.NODE_ENV !== 'production' && (
                                    <div className="mb-2 flex items-center gap-4 text-sm">
                                        <label className="inline-flex items-center gap-2">
                                            <input type="checkbox" checked={useTestWebhook} onChange={(e) => setUseTestWebhook(e.target.checked)} />
                                            n8n Test URL（?test=1 にルーティング）
                                        </label>
                                    </div>
                                )}
                {error && (
                    <div className="mb-3 text-red-300 text-sm">{error}</div>
                )}
                <ChatBox messages={messages} onReply={setReplyTo} />
                <ChatInput
                    username={username}
                    onUsernameChange={onUsernameChange}
                    onSendMessage={onSendMessage}
                    isLoading={loading}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                />
                {loading && (
                    <div className="text-xs text-white/70">Agent is thinking…</div>
                )}
                <div className="mt-4 text-xs text-white/60">
                    ・サーバブリッジ経由（/api/agent/chat → n8n Webhook）で実行します。<br />
                    ・テスト時は上のトグルで ?test=1 を付け、キャンバスの Waiting 中の Test URL へ送ります。<br />
                    ・本番では mock は無効。OPENAI_API_KEY 未設定時は 500 になります。<br />
                    ・簡易レート制限（500ms/トークン）により連続実行で 429 となる場合があります。<br />
                    ・添付: 画像/音声/テキスト/PDF/JSON を1件まで添付可能（10MBまで）。テキスト系は本文プレビューを文脈に注入します。
                </div>
            </main>
            <Footer />
        </div>
    );
}
