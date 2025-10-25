import type { NextApiRequest, NextApiResponse } from 'next';
import { run } from '@openai/agents';
import { agent } from '@/lib/agent/agent';
import { randomUUID } from 'crypto';

// very small in-memory rate limiter keyed by token (single-process best-effort)
const LAST_HIT_BY_TOKEN = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 500; // allow ~2 req/sec per token

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const rid = (req.headers['x-request-id'] as string) || randomUUID();
    // Provide a friendly usage hint on GET to avoid confusion when clicking the URL in a browser
    if (req.method === 'GET') {
        res.setHeader('Allow', 'POST');
        return res.status(200).json({
            ok: true,
            endpoint: '/api/agent/run',
            expected: {
                method: 'POST',
                headers: {
                    'x-internal-token': '<INTERNAL_API_TOKEN>',
                    'content-type': 'application/json',
                },
                body: { input: 'say hello' },
            },
            notes: [
                'This endpoint requires x-internal-token to match the server env INTERNAL_API_TOKEN.',
                'In production, mock mode is disabled; set OPENAI_API_KEY to execute real runs.',
                'Optional x-request-id header is logged for tracing.',
            ],
        });
    }
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }
    const tokenHeader = req.headers['x-internal-token'];
    const headerToken = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    // Also accept Authorization: Bearer <token> (or Token <token>) as fallback
    let token = headerToken;
    if (!token) {
        const authHeader = (req.headers['authorization'] || req.headers['Authorization' as any]) as string | undefined;
        if (typeof authHeader === 'string') {
            const v = authHeader.trim();
            const lower = v.toLowerCase();
            if (lower.startsWith('bearer ')) token = v.slice(7);
            else if (lower.startsWith('token ')) token = v.slice(6);
        }
    }

    // Normalize tokens (trim whitespace and surrounding quotes) to avoid common misconfig
    const normalize = (v: unknown) =>
        (typeof v === 'string' ? v : '').trim().replace(/^['"]|['"]$/g, '');
    const envTokenRaw = process.env.INTERNAL_API_TOKEN;
    if (!envTokenRaw || normalize(envTokenRaw) === '') {
        console.error(`[api/agent/run] rid=${rid} missing INTERNAL_API_TOKEN on server`);
        return res.status(500).json({ error: 'server_misconfig' });
    }
    const envToken = normalize(envTokenRaw);
    const reqToken = normalize(token);
    if (reqToken !== envToken) {
        const reason = reqToken === '' ? 'missing_token' : 'mismatch';
        console.warn(`[api/agent/run] rid=${rid} unauthorized reason=${reason}`);
        res.setHeader('WWW-Authenticate', 'Bearer realm="internal", error="invalid_token"');
        return res.status(401).json({ error: 'unauthorized', reason });
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