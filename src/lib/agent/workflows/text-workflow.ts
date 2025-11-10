import type { AgentInputItem } from "@openai/agents";
import { Runner, withTrace } from "@openai/agents";

import { agent } from "@/lib/agent/agent";

import type { TextWorkflowInput } from "./schemas";

export type WorkflowInput = TextWorkflowInput; // include optional kb_snippets
export type WorkflowOutput = {
  output_text: string;
  actions?: Array<{
    type: "open_url" | "call_api" | "navigate" | "copy";
    label: string;
    url?: string;
    method?: "GET" | "POST";
    body?: any;
  }>;
};

// Simple text-in → text-out workflow using the existing generated agent
export async function runWorkflow(
  workflow: WorkflowInput,
): Promise<WorkflowOutput> {
  return withTrace("Agent builder workflow", async () => {
    const conversationHistory: AgentInputItem[] = [
      // Inject KB context up front when available (best-effort plain text)
      ...(Array.isArray(workflow.kb_snippets) && workflow.kb_snippets.length > 0
        ? ([
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    "以下は知識ベースから抽出した関連スニペットです。必要に応じて参照し、出典を明示してください。\n" +
                    workflow.kb_snippets
                      .slice(0, 5)
                      .map((s, i) => `【${i + 1}】${s.source}:\n${s.text}`)
                      .join("\n\n"),
                },
              ],
            },
          ] as AgentInputItem[])
        : []),
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: workflow.input_as_text,
          },
        ],
      },
    ];

    const runner = new Runner({
      traceMetadata: { __trace_source__: "agent-builder" },
    });

    const result = await runner.run(agent, conversationHistory);

    if (!result.finalOutput) {
      throw new Error("Agent result is undefined");
    }

    // Heuristic quick-actions based on the input text (non-invasive, safe defaults)
    const text = (workflow.input_as_text || "").toLowerCase();
    const actions: WorkflowOutput["actions"] = [];
    try {
      if (/vercel|デプロイ|deploy/.test(text)) {
        actions?.push({
          type: "open_url",
          label: "Vercel ダッシュボードを開く",
          url: "https://vercel.com/dashboard",
        });
      }
      if (/ログ|log|エラー/.test(text)) {
        actions?.push({
          type: "open_url",
          label: "プロダクション Smoke 結果 (GitHub Actions)",
          url: "https://github.com/dauberside/dauberside.github.io/actions/workflows/prod-smoke.yml",
        });
      }
      if (/kb|ドキュメント|docs/.test(text)) {
        const q = encodeURIComponent(workflow.input_as_text.slice(0, 64));
        actions?.push({
          type: "open_url",
          label: "KB を検索",
          url: `/api/kb/search?q=${q}`,
        });
      }
      if (/エージェント|agent|実行|run/.test(text)) {
        actions?.push({
          type: "call_api",
          label: "内部エージェント実行 (/api/agent/run)",
          url: "/api/agent/run",
          method: "POST",
          body: { input: workflow.input_as_text },
        });
      }
      if (/スケジュール|会議|calendar|予定/.test(text)) {
        actions?.push({
          type: "open_url",
          label: "Google カレンダーを開く",
          url: "https://calendar.google.com/",
        });
      }
    } catch {}

    return { output_text: result.finalOutput, actions };
  });
}
