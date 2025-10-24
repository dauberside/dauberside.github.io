#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const ParamTypeEnum = z.enum(['string', 'number', 'boolean']);
const ToolParamSchema = z.object({
  name: z.string().min(1),
  type: ParamTypeEnum,
  nullable: z.boolean().default(false),
});
const ToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  params: z.array(ToolParamSchema).default([]),
});
const AgentConfigSchema = z.object({
  name: z.string().min(1),
  instructions: z.string().min(1),
  model: z.string().nullable().default(null),
  tools: z.array(ToolSchema).default([]),
});

const root = process.cwd();
const name = process.argv[2] || 'sample';
const cfgPath = path.join(root, 'src', 'lib', 'agent', 'configs', `${name}.json`);

if (!fs.existsSync(cfgPath)) {
  console.error(`[agent-builder:validate] not found: ${path.relative(root, cfgPath)}`);
  process.exit(1);
}

const raw = fs.readFileSync(cfgPath, 'utf8');
let json;
try {
  json = JSON.parse(raw);
} catch (e) {
  console.error('[agent-builder:validate] invalid JSON:', e.message);
  process.exit(1);
}

const parsed = AgentConfigSchema.safeParse(json);
if (!parsed.success) {
  console.error('[agent-builder:validate] schema errors:');
  for (const issue of parsed.error.issues) {
    console.error('-', issue.path.join('.'), issue.message);
  }
  process.exit(1);
}

console.log('[agent-builder:validate] VALID');
