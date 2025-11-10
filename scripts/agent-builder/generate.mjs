#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Config schema (matches src/lib/agent/configs/schema.ts)
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
  console.error(`[agent-builder:generate] not found: ${path.relative(root, cfgPath)}`);
  process.exit(1);
}

const raw = fs.readFileSync(cfgPath, 'utf8');
const cfg = AgentConfigSchema.parse(JSON.parse(raw));

const outDir = path.join(root, 'src', 'lib', 'agent');
const outPath = path.join(outDir, 'agent.generated.ts');

function toTsType(t) {
  switch (t) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    default: return 'unknown';
  }
}

function emitToolType(param) {
  const base = toTsType(param.type);
  return param.nullable ? `${base} | null` : base;
}

const toolTypes = cfg.tools.map(tool => {
  if (!tool.params.length) return `type ${tool.name}Params = Record<string, never>`;
  const fields = tool.params.map(p => `  ${p.name}: ${emitToolType(p)}`).join('\n');
  return `type ${tool.name}Params = {\n${fields}\n}`;
}).join('\n\n');

const zField = (p) => {
  const base = p.type === 'string' ? 'z.string()' : p.type === 'number' ? 'z.number()' : 'z.boolean()';
  return p.nullable ? `${base}.nullable()` : base;
};

const paramSchemas = cfg.tools.map(tool => {
  if (!tool.params.length) return `const ${tool.name}ParamsV3 = z.object({})`;
  const fields = tool.params.map(p => `  ${p.name}: ${zField(p)}`).join(',\n');
  return `const ${tool.name}ParamsV3 = z.object({\n${fields}\n})`;
}).join('\n\n');

const toolFns = cfg.tools.map(tool => {
  const arg = tool.params.length ? `args: ${tool.name}Params` : 'args?: Record<string, never>';
  return `async function ${tool.name}(${arg}) {\n  // TODO: implement tool - ${tool.description}\n  return { ok: true, tool: '${tool.name}', args };\n}`;
}).join('\n\n');

const toolObjs = cfg.tools.map(tool => (
  `  tool({\n` +
  `    name: '${tool.name}',\n` +
  `    description: '${tool.description.replace(/'/g, "\\'")}',\n` +
  `    // zod v3 schema cast to any for Agent types expecting v4\n` +
  `    parameters: ${tool.name}ParamsV3 as any,\n` +
  `    // eslint-disable-next-line @typescript-eslint/no-explicit-any\n` +
  `    execute: async (input: any) => ${tool.name}(input as ${tool.name}Params)\n` +
  `  })`
)).join(',\n');

const header = `/*\n  AUTO-GENERATED FILE - DO NOT EDIT\n  Source: ${path.relative(root, cfgPath)}\n*/`;

const body = `
import { Agent, tool } from '@openai/agents';
import { z } from 'zod';

${toolTypes}

${paramSchemas}

${toolFns}

export const agent = new Agent({
  name: '${cfg.name}',
  instructions: ${JSON.stringify(cfg.instructions)},
  tools: [
${toolObjs}
  ],
});
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${header}\n${body}`, 'utf8');
console.log('[agent-builder:generate] wrote', path.relative(root, outPath));
