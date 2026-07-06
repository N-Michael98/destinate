type CacheEntry = { value: unknown; expiresAt: number };

// In-memory fallback wenn Redis nicht verfügbar
const memCache = new Map<string, CacheEntry>();

async function getRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const { createClient } = await import("redis");
    const client = createClient({
      url,
      // KRITISCH: Ohne disableOfflineQueue werden Befehle bei toter Verbindung
      // endlos gequeued → jeder Request (Middleware!) hängt ~30s → Seite "down".
      // Mit dieser Option scheitern Befehle sofort → Fallback auf memCache.
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries: number) => Math.min(retries * 500, 5000),
      },
    });
    client.on("error", () => {});
    await client.connect();
    return client;
  } catch { return null; }
}

let _client: Awaited<ReturnType<typeof getRedisClient>> = null;
let _clientInit = false;
let _lastInitAttempt = 0;

async function getClient() {
  if (!_clientInit) { _client = await getRedisClient(); _clientInit = true; _lastInitAttempt = Date.now(); }
  // Wenn die Verbindung beim Start scheiterte: alle 60s neu versuchen statt für immer aufgeben
  if (_client === null && Date.now() - _lastInitAttempt > 60_000) {
    _lastInitAttempt = Date.now();
    _client = await getRedisClient();
  }
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
