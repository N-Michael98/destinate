import { cacheGet, cacheSet } from "@/lib/cache/redis-cache";

const REDIS_KEY = "security:blocked_ips";
const TTL = 24 * 60 * 60; // 24 Stunden

interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt: string;
}

export async function blockIP(ip: string, reason: string): Promise<void> {
  try {
    const list = (await cacheGet<BlockedIP[]>(REDIS_KEY)) ?? [];
    if (list.some(e => e.ip === ip)) return; // bereits geblockt
    const now = new Date();
    const expires = new Date(now.getTime() + TTL * 1000);
    list.push({ ip, reason, blockedAt: now.toISOString(), expiresAt: expires.toISOString() });
    await cacheSet(REDIS_KEY, list, TTL);
    console.log(`[ip-blocklist] 🚫 IP geblockt: ${ip} — ${reason}`);
  } catch { /* non-fatal */ }
}

export async function isIPBlocked(ip: string): Promise<boolean> {
  try {
    const list = (await cacheGet<BlockedIP[]>(REDIS_KEY)) ?? [];
    const now = Date.now();
    return list.some(e => e.ip === ip && new Date(e.expiresAt).getTime() > now);
  } catch {
    return false; // Im Zweifel nicht blockieren
  }
}

export async function getBlockedIPs(): Promise<BlockedIP[]> {
  try {
    const list = (await cacheGet<BlockedIP[]>(REDIS_KEY)) ?? [];
    const now = Date.now();
    return list.filter(e => new Date(e.expiresAt).getTime() > now);
  } catch {
    return [];
  }
}

export async function unblockIP(ip: string): Promise<void> {
  try {
    const list = (await cacheGet<BlockedIP[]>(REDIS_KEY)) ?? [];
    const updated = list.filter(e => e.ip !== ip);
    await cacheSet(REDIS_KEY, updated, TTL);
    console.log(`[ip-blocklist] ✅ IP freigegeben: ${ip}`);
  } catch { /* non-fatal */ }
}
