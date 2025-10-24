import type { NextApiRequest, NextApiResponse } from 'next';
import { run } from '@openai/agents';
import { agent } from '@/lib/agent/agent';
import { randomUUID } from 'crypto';

// very small in-memory rate limiter keyed by token (single-process best-effort)
const LAST_HIT_BY_TOKEN = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 500; // allow ~2 req/sec per token

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const rid = (req.headers['x-request-id'] as string) || randomUUID();
    if (req.method !== 'POST') return res.status(405).end();
    const tokenHeader = req.headers['x-internal-token'];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (token !== process.env.INTERNAL_API_TOKEN) {
        console.warn(`[api/agent/run] rid=${rid} unauthorized`);
        return res.status(401).json({ error: 'unauthorized' });
    }

    // simple rate limit by token
    const now = Date.now();
    const last = LAST_HIT_BY_TOKEN.get(token || '');
    if (typeof last === 'number' && now - last < RATE_LIMIT_WINDOW_MS) {
        console.warn(`[api/agent/run] rid=${rid} rate_limited wait=${RATE_LIMIT_WINDOW_MS - (now - last)}ms`);
        return res.status(429).json({ error: 'rate_limited' });
    }
    LAST_HIT_BY_TOKEN.set(token || '', now);

    const input = typeof (req.body as any)?.input === 'string' ? (req.body as any).input : 'say hello';

    // Mock mode to allow 200-series smoke tests without real OpenAI keys
    // Enable via env AGENT_MOCK_MODE=1 or query ?mock=1
    const mockRequested = process.env.AGENT_MOCK_MODE === '1' || String((req.query as any)?.mock) === '1';
    const isProd = process.env.NODE_ENV === 'production';
    const mockEnabled = !isProd && mockRequested; // force-disable in production
    if (mockEnabled) {
        console.info(`[api/agent/run] rid=${rid} mock=1 inputLen=${input.length}`);
        return res.status(200).json({ output: `mock:${input}` });
    }

    // Helpful error when OPENAI_API_KEY is missing
    if (!process.env.OPENAI_API_KEY) {
        console.error(`[api/agent/run] rid=${rid} missing OPENAI_API_KEY`);
        return res.status(500).json({ error: 'missing OPENAI_API_KEY (set in .env.local and restart server)' });
    }

    try {
        console.info(`[api/agent/run] rid=${rid} exec inputLen=${input.length}`);
        const result = await run(agent, input);
        console.info(`[api/agent/run] rid=${rid} done`);
        return res.status(200).json({ output: result.finalOutput });
    } catch (err: any) {
        console.error(`[api/agent/run] rid=${rid} error`, err);
        return res.status(500).json({ error: err?.message ?? 'internal error' });
    }
}