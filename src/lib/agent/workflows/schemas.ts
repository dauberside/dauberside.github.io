import { z } from 'zod';

// Zod schemas for the text workflow
export const TextWorkflowInputSchema = z.object({
  input_as_text: z.string().min(1, 'input_as_text is required').max(2000),
  kb_snippets: z
    .array(
      z.object({
        source: z.string(),
        text: z.string(),
        score: z.number().optional(),
      })
    )
    .optional(),
});

export const TextWorkflowOutputSchema = z.object({
  output_text: z.string(),
});

export type TextWorkflowInput = z.infer<typeof TextWorkflowInputSchema>;
export type TextWorkflowOutput = z.infer<typeof TextWorkflowOutputSchema>;
