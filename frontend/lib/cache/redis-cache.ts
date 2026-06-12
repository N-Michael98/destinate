type CacheEntry = { value: unknown; expiresAt: number };

// In-memory fallback wenn Redis nicht verfügbar
const memCache = new Map<string, CacheEntry>();

async function getRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url });
    client.on("error", () => {});
    await client.connect();
    return client;
  } catch { return null; }
}

let _client: Awaited<ReturnType<typeof getRedisClient>> = null;
let _clientInit = false;

async function getClient() {
  if (!_clientInit) { _client = await getRedisClient(); _clientInit = true; }
  return _client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = await getClient();
  if (client) {
    try {
      const val = await client.get(key);
      return val ? JSON.parse(val) as T : null;
    } catch { /* fall through to mem */ }
  }
  const entry = memCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.value as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 30): Promise<void> {
  const client = await getClient();
  if (client) {
    try { await client.setEx(key, ttlSeconds, JSON.stringify(value)); return; } catch {}
  }
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (memCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of memCache) { if (now > v.expiresAt) memCache.delete(k); }
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = await getClient();
  if (client) { try { await client.del(key); } catch {} }
  memCache.delete(key);
}

export async function cacheGetOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 30,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}
