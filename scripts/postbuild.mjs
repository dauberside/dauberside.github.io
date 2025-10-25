#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const fromDir = path.join(ROOT, '.next', 'static', 'css');
const toDir = path.join(ROOT, 'public', '_next', 'static', 'css');

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true }).catch(() => {});
}

async function copyDir(src, dest) {
  try {
    const entries = await fsp.readdir(src, { withFileTypes: true });
    await ensureDir(dest);
    for (const ent of entries) {
      const s = path.join(src, ent.name);
      const d = path.join(dest, ent.name);
      if (ent.isDirectory()) {
        await copyDir(s, d);
      } else if (ent.isFile()) {
        await fsp.copyFile(s, d);
      }
    }
  } catch (e) {
    // noop
  }
}

(async () => {
  // Disabled by default: Avoid creating public/_next to prevent Next build conflicts.
  // Enable only if explicitly requested (legacy workaround): POSTBUILD_COPY_CSS=1
  if (process.env.POSTBUILD_COPY_CSS === '1') {
    if (fs.existsSync(fromDir)) {
      await copyDir(fromDir, toDir);
      console.log(`[postbuild] Mirrored CSS from ${fromDir} -> ${toDir}`);
    } else {
      console.warn(`[postbuild] Source CSS dir missing: ${fromDir}`);
    }
  } else {
    console.log('[postbuild] Skipping CSS mirror (POSTBUILD_COPY_CSS!=1)');
  }

  // Optional: PM2 reload for production runtime after build to avoid static asset drift
  // Enable by default; set POSTBUILD_PM2_RELOAD=0 to skip.
  if (process.env.POSTBUILD_PM2_RELOAD !== '0') {
    const tryRun = (cmd, args) =>
      new Promise((resolve) => {
        const ps = spawn(cmd, args, { stdio: 'inherit' });
        ps.on('error', () => resolve(false));
        ps.on('close', (code) => resolve(code === 0));
      });

    // Prefer global pm2 if available, fallback to npx -y pm2 (non-interactive)
    const tried = [];
    let ok = false;
    try {
      ok = await tryRun('pm2', ['reload', 'next-app', '--update-env']);
      tried.push('pm2');
      if (!ok) {
        ok = await tryRun('npx', ['-y', 'pm2', 'reload', 'next-app', '--update-env']);
        tried.push('npx -y pm2');
      }
    } catch {}
    if (ok) {
      console.log(`[postbuild] PM2 reload next-app --update-env done`);
    } else {
      console.warn(
        `[postbuild] PM2 reload skipped or failed (tried: ${tried.join(' -> ') || 'none'}). This is safe to ignore on CI/local builds.`
      );
    }
  } else {
    console.log('[postbuild] Skipping PM2 reload due to POSTBUILD_PM2_RELOAD=0');
  }
})();
