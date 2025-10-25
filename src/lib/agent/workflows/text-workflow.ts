import type { AgentInputItem } from '@openai/agents';
import { Runner, withTrace } from '@openai/agents';
import { agent } from '@/lib/agent/agent';
import type { TextWorkflowInput } from './schemas';

export type WorkflowInput = TextWorkflowInput; // include optional kb_snippets
export type WorkflowOutput = { output_text: string };

// Simple text-in → text-out workflow using the existing generated agent
export async function runWorkflow(workflow: WorkflowInput): Promise<WorkflowOutput> {
  return withTrace('Agent builder workflow', async () => {
    const conversationHistory: AgentInputItem[] = [
      // Inject KB context up front when available (best-effort plain text)
      ...(Array.isArray(workflow.kb_snippets) && workflow.kb_snippets.length > 0
        ? ([{
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text:
                    '以下は知識ベースから抽出した関連スニペットです。必要に応じて参照し、出典を明示してください。\n' +
                    workflow.kb_snippets
                      .slice(0, 5)
                      .map((s, i) => `【${i + 1}】${s.source}:\n${s.text}`)
                      .join('\n\n'),
                },
              ],
            }] as AgentInputItem[])
        : []),
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: workflow.input_as_text,
          },
        ],
      },
    ];

    const runner = new Runner({
      traceMetadata: { __trace_source__: 'agent-builder' },
    });

    const result = await runner.run(agent, conversationHistory);

    if (!result.finalOutput) {
      throw new Error('Agent result is undefined');
    }

    return { output_text: result.finalOutput };
  });
}
