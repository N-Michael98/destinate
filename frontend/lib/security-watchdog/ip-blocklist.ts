import { cacheGet, cacheSet } from "@/lib/cache/redis-cache";

const REDIS_KEY_TEMP      = "security:blocked_ips";           // 72h, läuft ab
const REDIS_KEY_PERMANENT = "security:blocked_ips_permanent"; // für immer
const TTL_TEMP      = 72 * 60 * 60;          // 72 Stunden
const TTL_PERMANENT = 10 * 365 * 24 * 60 * 60; // 10 Jahre (wird bei jedem Zugriff erneuert)

interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt: string | null; // null = permanent
  permanent: boolean;
}

export async function blockIP(ip: string, reason: string, permanent = false): Promise<void> {
  try {
    const key = permanent ? REDIS_KEY_PERMANENT : REDIS_KEY_TEMP;
    const ttl = permanent ? TTL_PERMANENT : TTL_TEMP;
    const list = (await cacheGet<BlockedIP[]>(key)) ?? [];
    if (list.some(e => e.ip === ip)) return; // bereits geblockt
    const now = new Date();
    const expiresAt = permanent ? null : new Date(now.getTime() + TTL_TEMP * 1000).toISOString();
    list.push({ ip, reason, blockedAt: now.toISOString(), expiresAt, permanent });
    await cacheSet(key, list, ttl);
    const label = permanent ? "PERMANENT" : "72h";
    console.log(`[ip-blocklist] 🚫 IP geblockt (${label}): ${ip} — ${reason}`);
  } catch { /* non-fatal */ }
}

export async function isIPBlocked(ip: string): Promise<boolean> {
  try {
    const now = Date.now();

    // Permanente Blocks zuerst prüfen
    const permanent = (await cacheGet<BlockedIP[]>(REDIS_KEY_PERMANENT)) ?? [];
    if (permanent.some(e => e.ip === ip)) return true;

    // Temporäre Blocks prüfen (nicht abgelaufene)
    const temp = (await cacheGet<BlockedIP[]>(REDIS_KEY_TEMP)) ?? [];
    return temp.some(e => e.ip === ip && e.expiresAt != null && new Date(e.expiresAt).getTime() > now);
  } catch {
    return false; // Im Zweifel nicht blockieren
  }
}

export async function getBlockedIPs(): Promise<BlockedIP[]> {
  try {
    const now = Date.now();
    const permanent = (await cacheGet<BlockedIP[]>(REDIS_KEY_PERMANENT)) ?? [];
    const temp = (await cacheGet<BlockedIP[]>(REDIS_KEY_TEMP)) ?? [];
    const activTemp = temp.filter(e => e.expiresAt != null && new Date(e.expiresAt).getTime() > now);
    return [...permanent, ...activTemp];
  } catch {
    return [];
  }
}

export async function unblockIP(ip: string): Promise<void> {
  try {
    // Aus beiden Listen entfernen
    const permanent = (await cacheGet<BlockedIP[]>(REDIS_KEY_PERMANENT)) ?? [];
    const updatedPerm = permanent.filter(e => e.ip !== ip);
    await cacheSet(REDIS_KEY_PERMANENT, updatedPerm, TTL_PERMANENT);

    const temp = (await cacheGet<BlockedIP[]>(REDIS_KEY_TEMP)) ?? [];
    const updatedTemp = temp.filter(e => e.ip !== ip);
    await cacheSet(REDIS_KEY_TEMP, updatedTemp, TTL_TEMP);

    console.log(`[ip-blocklist] ✅ IP freigegeben: ${ip}`);
  } catch { /* non-fatal */ }
}
