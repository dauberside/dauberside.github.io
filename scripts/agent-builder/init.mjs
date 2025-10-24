#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const name = process.argv[2] || 'sample';
const outDir = path.join(root, 'src', 'lib', 'agent', 'configs');
const outPath = path.join(outDir, `${name}.json`);

const template = {
  name,
  instructions: 'You are a helpful assistant. Keep answers short.',
  model: null,
  tools: [
    {
      name: 'echo',
      description: 'Echo back input text',
      params: [
        { name: 'text', type: 'string', nullable: false },
      ],
    },
  ],
};

fs.mkdirSync(outDir, { recursive: true });
if (fs.existsSync(outPath)) {
  console.error(`[agent-builder:init] already exists: ${path.relative(root, outPath)}`);
  process.exit(1);
}

fs.writeFileSync(outPath, JSON.stringify(template, null, 2) + '\n', 'utf8');
console.log(`[agent-builder:init] created ${path.relative(root, outPath)}`);
