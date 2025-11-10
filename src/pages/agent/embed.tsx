import Head from "next/head";
import React from "react";

import ChatBox from "@/components/chat/ChatBox";
import ChatInput from "@/components/chat/ChatInput";
import { sendToAgent } from "@/lib/chat/service";
import type { Message } from "@/types/chat";

/**
 * Embeddable chat page for iframe usage.
 * Usage (on any website under the same origin or via public URL):
 *   <iframe src="/agent/embed?test=1" style="width:100%;height:540px;border:0"></iframe>
 */
export default function AgentEmbedPage() {
  const SHOW_KB_REFS = false;
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [username, setUsername] = React.useState<string>("You");

  // Read ?test=1 from query to route to n8n test webhook during development
  const [useTestWebhook, setUseTestWebhook] = React.useState<boolean>(false);
  React.useEffect(() => {
    try {
      const u = new URL(window.location.href);
      setUseTestWebhook(u.searchParams.get("test") === "1");
    } catch {}
  }, []);

  // Post height to parent for auto-resize when embedded
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const postHeight = () => {
      const h =
        containerRef.current?.scrollHeight || document.body.scrollHeight || 0;
      try {
        window.parent.postMessage(
          { type: "agent-embed:height", height: h },
          "*",
        );
      } catch {}
    };
    postHeight();
    const id = setInterval(postHeight, 500);
    return () => clearInterval(id);
  }, [messages, loading]);

  const onSendMessage = React.useCallback(
    async (
      text: string,
      options?: { replyTo?: Message; file?: File | null },
    ) => {
      if (!text.trim()) return;
      setError(null);
      const now = new Date().toISOString();
      const userMsg: Message = {
        id: Date.now(),
        created_at: now,
        content: text,
        user_id: "user",
        username: username || "You",
        replyTo: options?.replyTo,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      try {
        const { output_text, raw } = await sendToAgent(text, {
          test: useTestWebhook,
          kbSnippets: [],
          file: options?.file || null,
        });
        const agentMsg: Message = {
          id: Date.now() + 1,
          created_at: new Date().toISOString(),
          content: output_text,
          user_id: "agent",
          username: "Agent",
          kbRefs: SHOW_KB_REFS ? [] : undefined,
          actions: Array.isArray(raw?.actions)
            ? raw.actions.slice(0, 5)
            : undefined,
        };
        setMessages((prev) => [...prev, agentMsg]);
      } catch (err: any) {
        const msg = String(err?.message || "request failed");
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            created_at: new Date().toISOString(),
            content: msg,
            user_id: "agent",
            username: "Agent",
          },
        ]);
      } finally {
        setLoading(false);
        setReplyTo(null);
      }
    },
    [useTestWebhook, username],
  );

  return (
    <div ref={containerRef} className="min-h-[420px] w-full bg-transparent">
      <Head>
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Head>
      <main className="w-full max-w-[780px] mx-auto px-3 py-3">
        {error && <div className="mb-2 text-red-400 text-xs">{error}</div>}
        <ChatBox messages={messages} onReply={setReplyTo} />
        <ChatInput
          username={username}
          onUsernameChange={setUsername}
          onSendMessage={onSendMessage}
          isLoading={loading}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-2 text-[11px] text-white/60">
            Embed: 右上のURLに `?test=1` を付けると n8n の Test URL に送ります。
          </div>
        )}
      </main>
    </div>
  );
}
