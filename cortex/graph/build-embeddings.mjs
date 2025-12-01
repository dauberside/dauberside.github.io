#!/usr/bin/env node
/**
 * build-embeddings.mjs
 *
 * Generate embeddings for concept nodes extracted from Obsidian vault.
 *
 * Input: cortex/graph/concepts.json (from exportConcepts.cs.js)
 * Output: cortex/graph/concept-embeddings.json
 *
 * Architecture:
 * - Concept-based (not chunk-based like KB)
 * - Reuses KB embed() function for consistency
 * - Deterministic text representation via buildConceptText()
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use WORKSPACE_ROOT if available (container/CI), fallback to relative path
const ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(__dirname, '../..');

const GRAPH_DIR = process.env.OBSIDIAN_VAULT_PATH
  ? path.join(process.env.OBSIDIAN_VAULT_PATH, 'graph')
  : __dirname;

const CONCEPTS_PATH = path.join(GRAPH_DIR, 'concepts.json');
const OUTPUT_PATH = path.join(GRAPH_DIR, 'concept-embeddings.json');

// Embedding configuration
const EMBED_MODE = process.env.KB_EMBED_MODE || 'hash';
const MODEL = 'text-embedding-3-small';
const EMBED_DIM = 256;

/**
 * Build deterministic text representation for concept
 * CRITICAL: This function defines what text is embedded - changes break reproducibility
 *
 * @param {Object} concept - Concept from concepts.json
 * @returns {string} Text representation for embedding
 */
function buildConceptText(concept) {
  return [
    concept.label,
    `Types: ${concept.types.join(', ')}`,
    `Frequency: ${concept.frequency}`,
    `Source notes: ${concept.sourceNotes.slice(0, 5).join(', ')}${concept.sourceNotes.length > 5 ? ', ...' : ''}`,
  ].join('\n');
}

/**
 * Tokenizer (from KB builder)
 */
function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, ' ')
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

/**
 * FNV-1a 32-bit hash (from KB builder)
 */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Hash-based embedding (from KB builder)
 */
function hashEmbed(text, dim = 256) {
  const v = new Float32Array(dim);
  const toks = tokenize(text);
  if (toks.length === 0) return Array.from(v);

  const tf = new Map();
  for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);

  for (const [t, f] of tf.entries()) {
    const h = fnv1a(t);
    const idx = h % dim;
    const w = 1 + Math.log(1 + f);
    v[idx] += w;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] = v[i] / norm;

  return Array.from(v);
}

/**
 * Generate embeddings using OpenAI or local hash
 */
async function embedBatch(inputs) {
  if (EMBED_MODE === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set');
    }

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, input: inputs }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Embeddings failed: HTTP ${res.status} ${t}`);
    }

    const json = await res.json();
    return json.data.map(d => d.embedding);
  }

  // Local hash-based embedding (no external API)
  return inputs.map((text) => hashEmbed(text, EMBED_DIM));
}

/**
 * Main pipeline
 */
async function main() {
  console.log('🔧 Building concept embeddings...\n');

  // 1. Read concepts.json
  console.log(`📖 Reading ${CONCEPTS_PATH}`);
  const raw = JSON.parse(await fs.readFile(CONCEPTS_PATH, 'utf8'));
  const concepts = raw.concepts;

  if (!concepts || concepts.length === 0) {
    throw new Error('No concepts found in concepts.json');
  }

  console.log(`✓ Loaded ${concepts.length} concepts\n`);

  // 2. Check embedding mode
  console.log(`📦 Embedding mode: ${EMBED_MODE}`);
  if (EMBED_MODE === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set, falling back to hash mode');
      process.env.KB_EMBED_MODE = 'hash';
    } else {
      console.log(`✓ Using OpenAI model: ${MODEL}`);
    }
  } else {
    console.log(`✓ Using local hash-based embedding (dim: ${EMBED_DIM})`);
  }
  console.log();

  // 3. Build text representations
  console.log('🔄 Building concept text representations...');
  const texts = concepts.map(buildConceptText);
  console.log(`✓ ${texts.length} texts prepared\n`);

  // 4. Generate embeddings in batches
  console.log('🔄 Generating embeddings...');
  const BATCH_SIZE = 100;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, Math.min(i + BATCH_SIZE, texts.length));
    const embeddings = await embedBatch(batch);
    allEmbeddings.push(...embeddings);

    const processed = Math.min(i + BATCH_SIZE, texts.length);
    process.stdout.write(`\r  Processed ${processed}/${texts.length} concepts`);
  }

  console.log('\n✓ Embeddings generated\n');

  // 5. Build nodes with embeddings
  const nodes = concepts.map((concept, i) => ({
    ...concept,
    embedding: allEmbeddings[i],
  }));

  // 6. Build output
  const embeddingModel =
    process.env.KB_EMBED_MODE === 'openai'
      ? 'text-embedding-3-small'
      : 'hash-256';

  const output = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    embeddingModel,
    dimension: nodes[0]?.embedding?.length ?? 0,
    sourceConcepts: CONCEPTS_PATH,
    nodes,
  };

  // 7. Write output
  console.log(`💾 Writing ${OUTPUT_PATH}`);
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✅ ${nodes.length} concept embeddings → ${OUTPUT_PATH}`);
  console.log(`   Model: ${embeddingModel}`);
  console.log(`   Dimension: ${output.dimension}`);
}

main().catch((err) => {
  console.error('❌ build-embeddings failed:', err);
  process.exit(1);
});
