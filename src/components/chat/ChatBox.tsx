import React, { useCallback, useEffect, useRef, useState } from "react";

import type { Message } from "@/types/chat";

interface ChatBoxProps {
  messages: Message[];
  onReply?: (message: Message) => void;
  currentUserId?: string;
  onDeleteMessage?: (id: number) => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({
  messages,
  onReply,
  currentUserId,
  onDeleteMessage,
}) => {
  const SHOW_KB_REFS = process.env.NEXT_PUBLIC_SHOW_KB_REFS === "1";
  const HIDE_SPEC_OUTPUT = process.env.NEXT_PUBLIC_HIDE_SPEC_OUTPUT === "1";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [menu, setMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    message: Message | null;
  }>({ open: false, x: 0, y: 0, message: null });

  // 長押し検知用
  const longPressTimer = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu((m) => ({ ...m, open: false }));
    };
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (menu.open) setMenu((m) => ({ ...m, open: false }));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [menu.open]);

  const openMenu = useCallback((x: number, y: number, message: Message) => {
    setMenu({ open: true, x, y, message });
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, message: Message) => {
      e.preventDefault();
      openMenu(e.clientX, e.clientY, message);
    },
    [openMenu],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, message: Message) => {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
      // 500ms 長押しでメニュー
      longPressTimer.current = window.setTimeout(() => {
        openMenu(
          e.clientX || (e as any).pageX || 0,
          e.clientY || (e as any).pageY || 0,
          message,
        );
      }, 500);
    },
    [openMenu],
  );

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const doReply = useCallback(() => {
    if (menu.message && onReply) onReply(menu.message);
    setMenu((m) => ({ ...m, open: false }));
  }, [menu.message, onReply]);

  const doCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(menu.message?.content || "");
    } catch {}
    setMenu((m) => ({ ...m, open: false }));
  }, [menu.message]);

  const doDelete = useCallback(() => {
    if (menu.message && onDeleteMessage) onDeleteMessage(menu.message.id);
    setMenu((m) => ({ ...m, open: false }));
  }, [menu.message, onDeleteMessage]);

  // 指定パターンに一致する「要件/ADR系のドキュメント出力」を検出して隠す
  const specLike = useCallback((text: string | undefined | null) => {
    if (!text) return false;
    const patterns = [
      /\bADR-\d{3,4}\b/i,
      /docs\/decisions\/ADR/i,
      /docs\/requirements\//i,
      /要件定義|要項定義|Context Capsule|コンテキストカプセル/i,
    ];
    return patterns.some((re) => re.test(text));
  }, []);

  const visibleMessages = HIDE_SPEC_OUTPUT
    ? messages.filter((m) => !(m.user_id === "agent" && specLike(m.content)))
    : messages;

  return (
    <div
      ref={containerRef}
      className="relative rounded-lg p-4 mb-4 h-[calc(100vh-250px)] overflow-y-auto"
    >
      {visibleMessages.map((message) => {
        const isAgent = message.user_id === "agent";
        return (
          <div
            key={message.id}
            className={`mb-2 flex ${isAgent ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 whitespace-pre-wrap break-words ${
                isAgent ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
              }`}
              onContextMenu={(e) => handleContextMenu(e, message)}
              onPointerDown={(e) => handlePointerDown(e, message)}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
            >
              <div className="text-xs opacity-70 mb-1 flex items-center justify-between gap-2">
                {message.username || "Anonymous"}
                {/* inline action label removed by request */}
              </div>
              {message.replyTo && (
                <div
                  className={`mb-2 text-xs rounded border-l-2 pl-2 py-1 opacity-80 ${
                    isAgent ? "border-white/60" : "border-gray-400/60"
                  }`}
                >
                  ↪︎ {message.replyTo.username || "Anonymous"}:{" "}
                  {message.replyTo.content.slice(0, 80)}
                  {message.replyTo.content.length > 80 ? "…" : ""}
                </div>
              )}
              <div>{message.content}</div>
              {SHOW_KB_REFS && message.kbRefs && message.kbRefs.length > 0 && (
                <div
                  className={`mt-2 text-xs rounded border-l-2 pl-2 py-1 opacity-90 ${
                    isAgent ? "border-white/60" : "border-gray-400/60"
                  }`}
                >
                  <div className="font-semibold mb-1">引用（KB）</div>
                  <ul className="space-y-1 list-disc pl-4">
                    {message.kbRefs.slice(0, 5).map((k, idx) => (
                      <li key={idx} className="opacity-90">
                        <span className="font-mono text-[11px]">
                          {k.source}
                        </span>
                        <div className="mt-0.5">
                          {k.text.slice(0, 140)}
                          {k.text.length > 140 ? "…" : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {message.actions && message.actions.length > 0 && (
                <div
                  className={`mt-2 text-xs rounded border-l-2 pl-2 py-1 opacity-90 ${
                    isAgent ? "border-white/60" : "border-gray-400/60"
                  }`}
                >
                  <div className="font-semibold mb-1">アクション</div>
                  <ul className="space-y-1 pl-1">
                    {message.actions.slice(0, 5).map((a, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 flex-wrap"
                      >
                        {(a.type === "open_url" || a.type === "navigate") &&
                        a.url ? (
                          <a
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] ${isAgent ? "border-white/60 hover:bg-white/10" : "border-gray-400/60 hover:bg-gray-100"}`}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={a.url}
                          >
                            {a.label}
                          </a>
                        ) : a.type === "copy" ? (
                          <button
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] ${isAgent ? "border-white/60 hover:bg-white/10" : "border-gray-400/60 hover:bg-gray-100"}`}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  typeof a.body === "string"
                                    ? a.body
                                    : JSON.stringify(a.body ?? {}, null, 2),
                                );
                              } catch {}
                            }}
                          >
                            {a.label}
                          </button>
                        ) : a.type === "call_api" && a.url ? (
                          <button
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] ${isAgent ? "border-white/60 hover:bg-white/10" : "border-gray-400/60 hover:bg-gray-100"}`}
                            onClick={async () => {
                              // POST は安全のためコピー用の curl をクリップボードへ、GET は新しいタブで開く
                              const origin =
                                typeof window !== "undefined"
                                  ? window.location.origin
                                  : "";
                              const url = a.url || "";
                              const full = url.startsWith("http")
                                ? url
                                : origin + url;
                              if ((a.method || "GET") === "GET") {
                                window.open(
                                  full,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                                return;
                              }
                              const curl = `curl -si -X ${a.method || "POST"} \n  '${full}' \\n+  -H 'Content-Type: application/json' \\n+  -H 'x-internal-token: <INTERNAL_API_TOKEN>' \\n+  --data '${JSON.stringify(a.body ?? {}, null, 0)}'`;
                              try {
                                await navigator.clipboard.writeText(curl);
                              } catch {}
                            }}
                          >
                            {a.label}
                          </button>
                        ) : (
                          <span className="opacity-70">{a.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />

      {menu.open && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setMenu((m) => ({ ...m, open: false }))}
        >
          <div
            className="absolute z-40 w-44 rounded-md bg-white text-black shadow-lg border border-gray-200 overflow-hidden"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
              onClick={doReply}
            >
              リプライ
            </button>
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
              onClick={doCopy}
            >
              コピー
            </button>
            {menu.message &&
              currentUserId &&
              menu.message.user_id === currentUserId &&
              onDeleteMessage && (
                <button
                  className="w-full text-left px-3 py-2 hover:bg-red-50 text-sm text-red-600"
                  onClick={doDelete}
                >
                  削除
                </button>
              )}
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
              onClick={() => setMenu((m) => ({ ...m, open: false }))}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;
