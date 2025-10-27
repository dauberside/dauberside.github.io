import { z } from 'zod';

// Zod schemas for the text workflow
export const TextWorkflowInputSchema = z.object({
  input_as_text: z.string().min(1, 'input_as_text is required').max(4000, 'input_as_text must be <= 4000 characters'),
  kb_snippets: z
    .array(
      z.object({
        source: z.string(),
        text: z.string(),
        // 一部実装で null が入るケースがあるため許容（未指定扱い）
        score: z.number().nullable().optional(),
      })
    )
    .optional(),
});

// Allow absolute http(s) or relative app path for URLs
const HttpOrRelativeUrl = z
  .string()
  .trim()
  .refine(
    (s) => s === '' || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/'),
    'url must be absolute http(s) or a relative path starting with /'
  );

export const TextWorkflowOutputSchema = z.object({
  output_text: z.string(),
  actions: z
    .array(
      z.object({
        type: z.enum(['open_url', 'call_api', 'navigate', 'copy']).default('open_url'),
        label: z.string().min(1),
        url: HttpOrRelativeUrl.optional(),
        method: z.enum(['GET', 'POST']).optional(),
        body: z.any().optional(),
      })
    )
    .optional(),
});

export type TextWorkflowInput = z.infer<typeof TextWorkflowInputSchema>;
export type TextWorkflowOutput = z.infer<typeof TextWorkflowOutputSchema>;
