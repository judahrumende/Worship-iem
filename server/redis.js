let client = null;

if (process.env.REDIS_URL) {
  const Redis = require('ioredis');
  client = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  client.connect().catch(() => {
    console.warn('[redis] could not connect — falling back to in-memory cache');
    client = null;
  });
}

// Simple in-memory fallback
const memCache = new Map();
const TTL_MS = 24 * 60 * 60 * 1000;

const cache = {
  async set(key, value) {
    if (client) {
      await client.set(key, JSON.stringify(value), 'EX', 86400).catch(() => {});
    } else {
      memCache.set(key, { value, expires: Date.now() + TTL_MS });
    }
  },

  async get(key) {
    if (client) {
      const raw = await client.get(key).catch(() => null);
      return raw ? JSON.parse(raw) : null;
    }
    const entry = memCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) { memCache.delete(key); return null; }
    return entry.value;
  },

  async del(key) {
    if (client) {
      await client.del(key).catch(() => {});
    } else {
      memCache.delete(key);
    }
  },
};

module.exports = cache;
