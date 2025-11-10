import { z } from "zod";

// パラメータ型の簡易列挙（最小機能）
export const ParamTypeEnum = z.enum(["string", "number", "boolean"]);

export const ToolParamSchema = z.object({
  name: z.string().min(1),
  type: ParamTypeEnum,
  // 設計方針: optional より nullable を優先
  nullable: z.boolean().default(false),
});

export const ToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  params: z.array(ToolParamSchema).default([]),
});

export const AgentConfigSchema = z.object({
  name: z.string().min(1),
  instructions: z.string().min(1),
  model: z.string().nullable().default(null),
  tools: z.array(ToolSchema).default([]),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ToolConfig = z.infer<typeof ToolSchema>;
export type ToolParam = z.infer<typeof ToolParamSchema>;
