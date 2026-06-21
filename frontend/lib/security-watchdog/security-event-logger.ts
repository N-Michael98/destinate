import { cacheGet, cacheSet } from "@/lib/cache/redis-cache";

export type SecurityEventType =
  | "HONEYPOT_ACCESS"
  | "BRUTE_FORCE"
  | "SQL_INJECTION"
  | "XSS_ATTEMPT"
  | "SUSPICIOUS_UA"
  | "PATH_TRAVERSAL";

export interface SecurityEvent {
  type: SecurityEventType;
  ip: string;
  path: string;
  ua?: string;
  payload?: string;
  ts: number;
}

const REDIS_KEY = "security:events";
const MAX_EVENTS = 200;
const TTL_SECONDS = 60 * 60; // 1 hour

export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    const existing = (await cacheGet<SecurityEvent[]>(REDIS_KEY)) ?? [];
    const updated = [event, ...existing].slice(0, MAX_EVENTS);
    await cacheSet(REDIS_KEY, updated, TTL_SECONDS);
  } catch {
    // non-fatal — never block a request for logging
  }
}

export async function getSecurityEvents(): Promise<SecurityEvent[]> {
  try {
    return (await cacheGet<SecurityEvent[]>(REDIS_KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function clearSecurityEvents(): Promise<void> {
  try {
    await cacheSet(REDIS_KEY, [], TTL_SECONDS);
  } catch { /* non-fatal */ }
}
