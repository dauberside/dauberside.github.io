#!/usr/bin/env node
// Lightweight Tailscale API smoke: lists devices and prints a summary.
// - Reads token from process.env.TAILSCALE_API_TOKEN
// - If missing, attempts to read from ./.env.local -> dauber_tailscale_api_key
// - Never logs token. Exits non-zero on failure.

/* eslint-disable no-console */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE_URL = 'https://api.tailscale.com/api/v2';
const DEVICES_ENDPOINT = `${BASE_URL}/tailnet/-/devices`;

async function getToken() {
  const envToken = process.env.TAILSCALE_API_TOKEN?.trim();
  if (envToken) return envToken;
  // Fallback: parse .env.local for dauber_tailscale_api_key or TAILSCALE_API_TOKEN
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const raw = await readFile(envPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    let token;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // simple parser for KEY=VALUE (supports quotes)
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key === 'TAILSCALE_API_TOKEN' && val) {
        token = val;
        break;
      }
      if (key === 'dauber_tailscale_api_key' && val) {
        token = val;
        // don't break; prefer explicit TAILSCALE_API_TOKEN if appears later
      }
    }
    if (token) return token.trim();
  } catch (e) {
    // ignore if file missing
  }
  return null;
}

async function main() {
  const token = await getToken();
  if (!token) {
    console.error('[tailscale:smoke] Missing token. Set TAILSCALE_API_TOKEN or define dauber_tailscale_api_key in .env.local');
    process.exit(2);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(DEVICES_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[tailscale:smoke] HTTP ${res.status}: ${text?.slice(0, 320)}`);
      process.exit(1);
    }

    const data = await res.json();
    const devices = Array.isArray(data?.devices) ? data.devices : [];
    const summary = devices.map(d => {
      const name = d?.hostname || d?.name || d?.givenName || 'unknown';
      const id = d?.id || d?.deviceId || 'n/a';
      return `${name}(${id})`;
    });
    console.log(`[tailscale:smoke] OK devices=${devices.length}${summary.length ? ' → ' + summary.slice(0, 5).join(', ') : ''}`);
    process.exit(0);
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.error('[tailscale:smoke] Request timed out (10s)');
    } else {
      console.error('[tailscale:smoke] Error:', err?.message || String(err));
    }
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}

main();
