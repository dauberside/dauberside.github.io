import handler from '@/pages/api/kb/search';

// Mock searchKB to avoid hitting embeddings/OpenAI in tests
jest.mock('@/lib/kb/index', () => ({
  searchKB: async (_q: string, _opts?: any) => [{ text: 'mock', score: 0.99 }],
}));

type MockReq = Partial<import('next').NextApiRequest> & { query?: any; body?: any; method?: string };

type JsonBody = any;

function createRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let jsonBody: JsonBody | undefined;
  const res: any = {};
  res.status = (code: number) => { statusCode = code; return res; };
  res.setHeader = (k: string, v: string) => { headers[k.toLowerCase()] = v; };
  res.getHeader = (k: string) => headers[k.toLowerCase()];
  res.json = (body: any) => { jsonBody = body; return res; };
  Object.defineProperty(res, 'result', {
    get() { return { statusCode, headers, json: jsonBody }; },
  });
  return res;
}

describe('/api/kb/search', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete (global as any).fetch;
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('GET uses local search by default', async () => {
    const req: MockReq = { method: 'GET', query: { q: 'hello', topK: '2' } };
    const res = createRes();
    // @ts-ignore
    await handler(req as any, res as any);
    const out = res.result;
    expect(out.statusCode).toBe(200);
    expect(out.json?.hits?.length).toBeGreaterThan(0);
    // No proxy header expected when not proxying
    expect(out.headers['x-kb-proxy']).toBeUndefined();
  });

  test('GET proxies to kb-api when KB_API_URL is set', async () => {
    process.env.KB_API_URL = 'http://127.0.0.1:4040';
    // mock fetch for kb-api
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ hits: [{ text: 'via-proxy', score: 0.88 }] }),
    }));
    const req: MockReq = { method: 'GET', query: { q: 'hello', topK: '2' } };
    const res = createRes();
    // @ts-ignore
    await handler(req as any, res as any);
    const out = res.result;
    expect(out.statusCode).toBe(200);
    expect(out.json?.hits?.[0]?.text).toBe('via-proxy');
    expect(out.headers['x-kb-proxy']).toBe('kb-api');
  });

  test('POST falls back to local on proxy failure', async () => {
    process.env.KB_API_URL = 'http://127.0.0.1:4040';
    (global as any).fetch = jest.fn(async () => ({ ok: false, status: 502 }));
    const req: MockReq = { method: 'POST', body: { query: 'hello', topK: 2 } };
    const res = createRes();
    // @ts-ignore
    await handler(req as any, res as any);
    const out = res.result;
    expect(out.statusCode).toBe(200);
    expect(out.json?.hits?.[0]?.text).toBe('mock'); // from mocked local search
    expect(out.headers['x-kb-proxy']).toBe('fallback-local');
  });
});
