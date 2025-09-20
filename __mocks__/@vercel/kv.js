// Jest auto-mock for @vercel/kv to avoid ESM/uncrypto issues during tests
const store = new Map();

const kv = {
  async get(key) {
    return store.get(key);
  },
  async set(key, value, opts) {
    store.set(key, typeof value === "string" ? value : JSON.stringify(value));
    return "OK";
  },
  async del(key) {
    store.delete(key);
    return 1;
  },
  async incr(key) {
    const v = Number(store.get(key) || 0) + 1;
    store.set(key, String(v));
    return v;
  },
  async expire(key, seconds) {
    // no-op in tests
    return true;
  },
  async lpush(key, value) {
    const arr = JSON.parse(store.get(key) || "[]");
    arr.unshift(value);
    store.set(key, JSON.stringify(arr));
    return arr.length;
  },
  async ltrim(key, start, end) {
    const arr = JSON.parse(store.get(key) || "[]");
    const trimmed = arr.slice(start, end + 1);
    store.set(key, JSON.stringify(trimmed));
    return "OK";
  },
  async lrange(key, start, end) {
    const arr = JSON.parse(store.get(key) || "[]");
    const normalizedEnd = end < 0 ? arr.length + end + 1 : end + 1;
    return arr.slice(start, normalizedEnd);
  },
};

module.exports = { kv };
