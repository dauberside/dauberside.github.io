#!/usr/bin/env node
/**
 * kb-rebuild.mjs - KB Index Rebuild Script
 *
 * Generates embeddings for all markdown files in the vault and updates
 * the KB index at kb/index/embeddings.json
 *
 * Usage:
 *   node scripts/kb-rebuild.mjs [--vault-path <path>]
 *
 * Environment:
 *   WORKSPACE_ROOT - Project root directory
 *   OBSIDIAN_VAULT_PATH - Obsidian vault location (optional)
 *   KB_EMBED_MODE - Embedding mode: 'hash' (default) | 'openai' | 'mock'
 *   OPENAI_API_KEY - Required if KB_EMBED_MODE=openai
 *
 * Output:
 *   kb/index/embeddings.json - Updated KB index
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ROOT = process.env.WORKSPACE_ROOT || path.resolve(__dirname, '..');
const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || ROOT;
const KB_INDEX_PATH = path.join(ROOT, 'kb', 'index', 'embeddings.json');
const EMBED_MODE = (process.env.KB_EMBED_MODE || 'hash').toLowerCase();
const EMBED_DIM = 256;
const MODEL = 'text-embedding-3-small';

// Chunking configuration
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

console.log('🔧 KB Rebuild Configuration:');
console.log(`  Vault Path: ${VAULT_PATH}`);
console.log(`  Index Path: ${KB_INDEX_PATH}`);
console.log(`  Embed Mode: ${EMBED_MODE}`);
console.log(`  Model: ${MODEL}`);
console.log('');

/**
 * Find all markdown files in vault
 */
async function findMarkdownFiles(dir) {
  const files = [];
  
  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip common directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  
  await walk(dir);
  return files;
}

/**
 * Read file content
 */
async function readFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const relativePath = path.relative(VAULT_PATH, filePath);
    return { path: relativePath, content };
  } catch (err) {
    console.warn(`⚠️  Failed to read ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Compute content hash
 */
function computeHash(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Chunk text with overlap
 */
function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let i = 0;
  const len = text?.length || 0;
  
  if (!len) return chunks;
  
  while (i < len) {
    const end = Math.min(i + size, len);
    const slice = text.slice(i, end);
    chunks.push(slice);
    if (end === len) break;
    i += Math.max(1, size - overlap);
  }
  
  return chunks;
}

/**
 * Tokenize text for hash-based embedding
 */
function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, ' ')
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

/**
 * FNV-1a 32-bit hash
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
 * Generate hash-based embedding
 */
function hashEmbed(text, dim = EMBED_DIM) {
  const tokens = tokenize(text);
  const vec = new Float32Array(dim);
  
  for (const tok of tokens) {
    const h = fnv1a(tok);
    const idx = h % dim;
    vec[idx] += 1.0;
  }
  
  // Normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  
  return Array.from(vec);
}

/**
 * Generate OpenAI embedding (placeholder - requires implementation)
 */
async function openaiEmbed(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for openai embed mode');
  }
  
  // TODO: Implement OpenAI API call
  throw new Error('OpenAI embedding not yet implemented. Use KB_EMBED_MODE=hash');
}

/**
 * Generate embedding based on mode
 */
async function generateEmbedding(text) {
  switch (EMBED_MODE) {
    case 'hash':
      return hashEmbed(text, EMBED_DIM);
    case 'openai':
      return await openaiEmbed(text);
    case 'mock':
      return new Array(EMBED_DIM).fill(0);
    default:
      throw new Error(`Unknown embed mode: ${EMBED_MODE}`);
  }
}

/**
 * Main rebuild process
 */
async function rebuild() {
  console.log('🔍 Searching for markdown files...\n');
  
  const files = await findMarkdownFiles(VAULT_PATH);
  console.log(`📚 Found ${files.length} markdown files\n`);
  
  if (files.length === 0) {
    console.log('⚠️  No markdown files found. Nothing to process.');
    return;
  }
  
  console.log('📖 Reading file contents...\n');
  const notes = (await Promise.all(files.map(readFile))).filter(Boolean);
  console.log(`✅ Read ${notes.length} files successfully\n`);
  
  console.log('✂️  Chunking content...\n');
  const chunks = [];
  let chunkId = 0;
  
  for (const note of notes) {
    const noteChunks = chunkText(note.content);
    for (let i = 0; i < noteChunks.length; i++) {
      chunks.push({
        id: chunkId++,
        source: note.path,
        chunk_index: i,
        text: noteChunks[i],
        hash: computeHash(noteChunks[i])
      });
    }
  }
  
  console.log(`✅ Generated ${chunks.length} chunks from ${notes.length} notes\n`);
  
  console.log('🧮 Generating embeddings...\n');
  const processedChunks = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await generateEmbedding(chunk.text);
    
    processedChunks.push({
      id: chunk.id,
      source: chunk.source,
      chunk_index: chunk.chunk_index,
      text: chunk.text,
      embedding
    });
    
    if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
      process.stdout.write(`  Progress: ${i + 1}/${chunks.length} chunks\r`);
    }
  }
  
  console.log('\n');
  
  // Build index
  const index = {
    header: {
      model: MODEL,
      embed_mode: EMBED_MODE,
      embed_dim: EMBED_DIM,
      created_at: new Date().toISOString(),
      root: VAULT_PATH,
      files: notes.length,
      chunks: processedChunks.length
    },
    data: processedChunks
  };
  
  // Ensure directory exists
  const indexDir = path.dirname(KB_INDEX_PATH);
  await fs.mkdir(indexDir, { recursive: true });
  
  // Write index
  console.log('💾 Writing index...\n');
  await fs.writeFile(KB_INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
  
  console.log('✅ KB index rebuilt successfully!\n');
  console.log(`📊 Statistics:`);
  console.log(`  Files: ${notes.length}`);
  console.log(`  Chunks: ${processedChunks.length}`);
  console.log(`  Index: ${KB_INDEX_PATH}`);
  console.log('');
}

// Run
rebuild().catch(err => {
  console.error('❌ Error rebuilding KB:', err);
  process.exit(1);
});
