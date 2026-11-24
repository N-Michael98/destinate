import { cacheGet, cacheSet } from "@/lib/cache/redis-cache";

const REDIS_KEY_TEMP      = "security:blocked_ips";           // 72h, läuft ab
const REDIS_KEY_PERMANENT = "security:blocked_ips_permanent"; // für immer
const REDIS_KEY_WHITELIST = "security:trusted_ips";           // Watchdog blockt diese nie
const TTL_TEMP      = 72 * 60 * 60;
const TTL_PERMANENT = 10 * 365 * 24 * 60 * 60;
const TTL_WHITELIST = 10 * 365 * 24 * 60 * 60;

interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt: string | null; // null = permanent
  permanent: boolean;
}

interface TrustedIP {
  ip: string;
  reason: string;
  addedAt: string;
}

// ── Whitelist (Watchdog-Schutz) ───────────────────────────────────────────────

/**
 * Wildcard-Vergleich: "176.113.69.*" matcht alle IPs mit Präfix "176.113.69."
 * Nur * am Ende erlaubt (Subnetz), exakte IPs matchen exakt.
 */
function ipMatchesPattern(pattern: string, ip: string): boolean {
  if (pattern.endsWith(".*")) {
    return ip.startsWith(pattern.slice(0, -1)); // "176.113.69.*" → Präfix "176.113.69."
  }
  return pattern === ip;
}

export async function whitelistIP(ip: string, reason = "Manuell von Admin"): Promise<void> {
  try {
    const list = (await cacheGet<TrustedIP[]>(REDIS_KEY_WHITELIST)) ?? [];
    if (list.some(e => e.ip === ip)) return;
    list.push({ ip, reason, addedAt: new Date().toISOString() });
    await cacheSet(REDIS_KEY_WHITELIST, list, TTL_WHITELIST);
    console.log(`[ip-blocklist] ✅ IP auf Whitelist: ${ip} — ${reason}`);
  } catch { /* non-fatal */ }
}

export async function isIPWhitelisted(ip: string): Promise<boolean> {
  try {
    const list = (await cacheGet<TrustedIP[]>(REDIS_KEY_WHITELIST)) ?? [];
    return list.some(e => ipMatchesPattern(e.ip, ip));
  } catch {
    return false;
  }
}

export async function unwhitelistIP(ip: string): Promise<void> {
  try {
    const list = (await cacheGet<TrustedIP[]>(REDIS_KEY_WHITELIST)) ?? [];
    await cacheSet(REDIS_KEY_WHITELIST, list.filter(e => e.ip !== ip), TTL_WHITELIST);
    console.log(`[ip-blocklist] 🔓 IP von Whitelist entfernt: ${ip}`);
  } catch { /* non-fatal */ }
}

export async function getWhitelistedIPs(): Promise<TrustedIP[]> {
  try {
    return (await cacheGet<TrustedIP[]>(REDIS_KEY_WHITELIST)) ?? [];
  } catch {
    return [];
  }
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

// ── SEIT WANN IST EINE IP GESPERRT? (24.11.) ────────────────────────────────
//
// `isIPBlocked` sagt nur, ob eine IP JETZT gesperrt ist. Der Watchdog wertete
// damit jedes Ereignis einer gesperrten IP als "Block umgangen" — auch eines,
// das VOR der Sperre protokolliert wurde. Genau das passiert regelmaessig: der
// Watchdog liest die Ereignisse, fragt Claude (Sekunden), und sperrt erst
// DANACH. Was der Angreifer in dieser Zeit schickt, kommt normal durch, wird
// protokolliert und liegt im naechsten Zyklus als "Umgehung" vor — Killswitch.
// So am 24.11. um 02:48, bis zum /reset um 09:43 kein Handel.
//
// Dieselben zwei Listen und dieselbe Lesart wie `isIPBlocked` (permanent, dazu
// nicht abgelaufene temporaere) — zwei Lesarten koennten sich widersprechen.
// Gelesen wird EINMAL je Liste, nicht je IP: der Watchdog fragt fuer bis zu
// 200 IPs.
//
// `seitMs` ist der FRUEHESTE Sperrzeitpunkt aller aktiven Eintraege der IP.
// Ist auch nur einer davon unlesbar, ist `seitMs` null (unbekannt): dann laesst
// sich nicht ausschliessen, dass die Sperre frueher begann. Der Aufrufer wertet
// unbekannt als Umgehung — das bisherige, vorsichtige Verhalten.
//
// Ein Lesefehler gibt `gesperrt: false` — wie `isIPBlocked` ("im Zweifel nicht
// blockieren"). Damit verhaelt sich der Ausfall genau wie bisher.
export interface SperrZeit {
  gesperrt: boolean;
  seitMs: number | null;
}

export async function sperrZeiten(ips: string[]): Promise<Map<string, SperrZeit>> {
  const ergebnis = new Map<string, SperrZeit>();
  for (const ip of ips) ergebnis.set(ip, { gesperrt: false, seitMs: null });
  try {
    const now = Date.now();
    const permanent = (await cacheGet<BlockedIP[]>(REDIS_KEY_PERMANENT)) ?? [];
    const temp = (await cacheGet<BlockedIP[]>(REDIS_KEY_TEMP)) ?? [];
    const aktiv = [
      ...permanent,
      ...temp.filter(e => e.expiresAt != null && new Date(e.expiresAt).getTime() > now),
    ];
    for (const ip of ips) {
      const eintraege = aktiv.filter(e => e.ip === ip);
      if (eintraege.length === 0) continue;
      // `new Date(null)` ist 1970 und ENDLICH — nur eine Zeichenkette zaehlt.
      const zeiten = eintraege.map(e =>
        typeof e.blockedAt === "string" ? new Date(e.blockedAt).getTime() : NaN);
      const seitMs = zeiten.every(z => Number.isFinite(z)) ? Math.min(...zeiten) : null;
      ergebnis.set(ip, { gesperrt: true, seitMs });
    }
    return ergebnis;
  } catch {
    const leer = new Map<string, SperrZeit>();
    for (const ip of ips) leer.set(ip, { gesperrt: false, seitMs: null });
    return leer;
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
