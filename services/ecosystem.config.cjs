const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..');
const servicesRoot = __dirname;

// Load environment from repo .env.local then services/.env (override=false)
const envLocal = path.join(repoRoot, '.env.local');
const envFile = path.join(servicesRoot, '.env');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal, override: false });
if (fs.existsSync(envFile)) dotenv.config({ path: envFile, override: false });

// Merge with override for empty values (OPENAI_API_KEY, KB_* are critical)
function mergeEnv(p) {
  try {
    const buf = fs.readFileSync(p);
    const parsed = dotenv.parse(buf);
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v;
    }
  } catch {}
}
if (fs.existsSync(envLocal)) mergeEnv(envLocal);
if (fs.existsSync(envFile)) mergeEnv(envFile);

/**
 * PM2 ecosystem config
 * 初期状態では Next.js アプリのみを常駐させます。
 * kb-api / mcp は必要になった時に apps 配列へ定義を追加してください。
 */
module.exports = {
  apps: [
    // Next.js (production)
    {
      name: 'next-app',
      cwd: repoRoot,
      script: 'node',
      args: [
        path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next'),
        'start',
        '-p',
        process.env.PORT || '3030',
      ],
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '3030',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        KB_INDEX_PATH: process.env.KB_INDEX_PATH,
        ADMIN_ENABLE_PROTECTION: process.env.ADMIN_ENABLE_PROTECTION || '1',
        ADMIN_IP_ALLOWLIST: process.env.ADMIN_IP_ALLOWLIST || '100.102.85.62',
        ALLOWED_ORIGINS:
          process.env.ALLOWED_ORIGINS ||
          'http://100.102.85.62:3030,http://localhost:3030,http://127.0.0.1:3030',
      },
      max_memory_restart: '512M',
      autorestart: true,
    },

    // Nightly KB rebuild daemon
    {
      name: 'kb-nightly',
      cwd: repoRoot,
      script: 'node',
      args: [path.join(servicesRoot, 'kb-nightly.mjs')],
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        KB_NIGHTLY_TIME: process.env.KB_NIGHTLY_TIME || '03:30',
      },
      max_memory_restart: '128M',
      autorestart: true,
    },

    // KB API (independent)
    {
      name: 'kb-api',
      cwd: path.join(servicesRoot, 'kb-api'),
      script: 'node',
      args: [path.join(servicesRoot, 'kb-api', 'server.mjs')],
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.KB_API_PORT || '4040',
        KB_INDEX_PATH: process.env.KB_INDEX_PATH || path.join(repoRoot, 'kb', 'index', 'embeddings.json'),
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      },
      max_memory_restart: '256M',
      autorestart: true,
    },

    // MCP Server (skeleton)
    {
      name: 'mcp-server',
      cwd: path.join(servicesRoot, 'mcp'),
      script: 'node',
      args: [path.join(servicesRoot, 'mcp', 'server.mjs')],
      interpreter: 'none',
      env: { NODE_ENV: 'production', PORT: process.env.MCP_PORT || '5050' },
      max_memory_restart: '128M',
      autorestart: true,
    },
  ],
};
