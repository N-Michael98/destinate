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

// ── Listen, ATOMAR (15.09.) ──────────────────────────────────────────────────
//
// WOZU. `cacheGet` + `cacheSet` sind zwei Netzanfragen. Wer damit an eine Liste
// anhaengt (lesen, vorne einfuegen, zurueckschreiben), verliert bei
// gleichzeitigen Aufrufen Eintraege: beide lesen denselben Stand, der zweite
// Schreiber ueberschreibt den ersten. Bewiesen am 15.09. mit den echten
// Sicherheitsereignissen: 20 gleichzeitige Ereignisse von 20 IPs -> 1
// gespeichert. Die Eskalation "koordinierter Angriff" konnte so nie greifen.
//
// Hier laufen die Listenbefehle in EINEM Redis-MULTI — Redis fuehrt ihn
// ununterbrochen aus. Die bestehenden Funktionen oben bleiben unveraendert.
//
// RUECKFALL OHNE REDIS: auf `global`, nicht modul-scoped. Der Schreiber sitzt
// im Proxy, der Leser in der Watchdog-Schleife — verschiedene Modulkopien,
// derselbe Prozess (dieselbe Fehlerklasse wie Killswitch 28.07.). Im Speicher
// ist jede Operation ohne `await` dazwischen und damit ebenfalls ungeteilt.
//
// Die Eintraege werden als JSON-Zeichenkette gespeichert und auch so
// zurueckgegeben: `cacheListeEntfernen` braucht die GENAUE Zeichenkette, um
// genau die gelesenen Eintraege zu loeschen und keine anderen.

declare global {
  // eslint-disable-next-line no-var
  var __speicher_listen__: Map<string, { werte: string[]; expiresAt: number }> | undefined;
}

function speicherListen(): Map<string, { werte: string[]; expiresAt: number }> {
  global.__speicher_listen__ ??= new Map();
  return global.__speicher_listen__;
}

/** Vorne anhaengen, auf `max` kuerzen, Ablauf erneuern — ungeteilt. */
export async function cacheListePush(key: string, wert: unknown, max: number, ttlSeconds: number): Promise<void> {
  const roh = JSON.stringify(wert);
  const client = await getClient();
  if (client) {
    try {
      await client.multi().lPush(key, roh).lTrim(key, 0, max - 1).expire(key, ttlSeconds).exec();
      return;
    } catch { /* fall through to mem */ }
  }
  const listen = speicherListen();
  const jetzt = Date.now();
  let eintrag = listen.get(key);
  if (!eintrag || jetzt > eintrag.expiresAt) {
    eintrag = { werte: [], expiresAt: 0 };
    listen.set(key, eintrag);
  }
  eintrag.werte.unshift(roh);
  if (eintrag.werte.length > max) eintrag.werte.length = max;
  eintrag.expiresAt = jetzt + ttlSeconds * 1000;
}

/** Die neuesten `anzahl` Eintraege als JSON-Zeichenketten (neueste zuerst). */
export async function cacheListeLesen(key: string, anzahl: number): Promise<string[]> {
  const client = await getClient();
  if (client) {
    try { return await client.lRange(key, 0, anzahl - 1); } catch { /* fall through to mem */ }
  }
  const eintrag = speicherListen().get(key);
  if (!eintrag || Date.now() > eintrag.expiresAt) return [];
  return eintrag.werte.slice(0, anzahl);
}

/**
 * Genau diese Eintraege entfernen — je einen, vom ALTEN Ende her.
 *
 * Wer nach dem Lesen neu dazukam, bleibt stehen. Genau das war der Fehler im
 * Watchdog: er setzte die Liste nach der Analyse auf `[]` und loeschte damit
 * auch alles, was WAEHREND der Analyse eingetroffen war — ungeprueft.
 */
export async function cacheListeEntfernen(key: string, rohWerte: string[]): Promise<void> {
  if (rohWerte.length === 0) return;
  const client = await getClient();
  if (client) {
    try {
      const m = client.multi();
      for (const r of rohWerte) m.lRem(key, -1, r);
      await m.exec();
      return;
    } catch { /* fall through to mem */ }
  }
  const eintrag = speicherListen().get(key);
  if (!eintrag) return;
  for (const r of rohWerte) {
    const i = eintrag.werte.lastIndexOf(r);
    if (i >= 0) eintrag.werte.splice(i, 1);
  }
}
