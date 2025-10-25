#!/usr/bin/env node
/**
 * Nightly KB rebuild daemon
 * - Schedules `pnpm -s kb:build` (via node runner) every day at KB_NIGHTLY_TIME (HH:MM, local time).
 * - Defaults to 03:30 if KB_NIGHTLY_TIME is unset.
 * - Keeps running under PM2.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import dotenv from 'dotenv';

// ESM 互換の __dirname/__filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const envLocal = path.join(repoRoot, '.env.local');
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal, override: false });
if (fs.existsSync(envFile)) dotenv.config({ path: envFile, override: false });

const TIME = (process.env.KB_NIGHTLY_TIME || '03:30').trim(); // HH:MM

function nextRunDelayMs(hhmm) {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return { delay: next.getTime() - now.getTime(), next };
}

function runBuildOnce() {
  return new Promise((resolve) => {
    const start = new Date();
    const child = spawn(process.execPath, [path.join(repoRoot, 'scripts', 'kb', 'build.mjs')], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      const end = new Date();
      console.log(`[kb-nightly] build finished code=${code} duration=${((end - start) / 1000).toFixed(1)}s`);
      resolve(code ?? 0);
    });
    child.on('error', (err) => {
      console.error('[kb-nightly] spawn error', err);
      resolve(1);
    });
  });
}

async function loop() {
  while (true) {
    const { delay, next } = nextRunDelayMs(TIME);
    console.log(`[kb-nightly] next run at ${next.toLocaleString()} (in ${(delay / 1000 / 60).toFixed(1)} min)`);
    await new Promise((r) => setTimeout(r, delay));
    console.log('[kb-nightly] starting kb:build');
    await runBuildOnce();
  }
}

loop().catch((e) => {
  console.error('[kb-nightly] fatal', e);
  process.exit(1);
});
