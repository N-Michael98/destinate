// Server-side session store — keeps CST + X-SECURITY-TOKEN secure, never sent to client
import crypto from "crypto";
import { paperManagerCapital } from "../paper-trading/paper-singleton";
import { isKillswitchActive } from "../killswitch/killswitch-engine";
import {
  capitalCreateSession,
  capitalGetAccounts,
  capitalDeleteSession,
  type SessionResult,
  type AccountInfo,
} from "./capital-com-client";

// ── Credentials-Verschlüsselung (Audit-Fund #3, 27.07.) ──────────────────────
// CREDENTIALS_ENCRYPTION_KEY nicht gesetzt -> Klartext wie bisher (fail-safe).
// Format-Marker "v2:" unterscheidet neu (verschlüsselt) von alt (rohes JSON,
// beginnt immer mit "{") — kein Rätselraten beim Lesen nötig.
const ENC_PREFIX = "v2:";

function getEncryptionKey(): Buffer | null {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest(); // immer exakt 32 Bytes
}

function encryptCredentials(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function decryptCredentials(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored; // altes Klartext-Format
  const key = getEncryptionKey();
  if (!key) throw new Error("CREDENTIALS_ENCRYPTION_KEY fehlt — gespeicherte Credentials sind verschlüsselt, können aber nicht entschlüsselt werden");
  const raw = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
// ──────────────────────────────────────────────────────────────────────────

// ── Redis session persistence ──────────────────────────────────────────────
// Stores Capital.com session tokens in Redis so Cold Start can restore them
// without a new login. TTL = 8 min (keep-alive runs every 2 min, Capital.com
// expires sessions after 10 min of inactivity).
const REDIS_KEY = "capital:session";
const REDIS_TTL_SEC = 480; // 8 minutes

declare global {
  var __redis_client__: import("redis").RedisClientType | null | undefined;
}

async function getRedis(): Promise<import("redis").RedisClientType | null> {
  const url = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
  if (!url) return null;
  try {
    if (global.__redis_client__) return global.__redis_client__;
    const { createClient } = await import("redis");
    const client = createClient({ url }) as import("redis").RedisClientType;
    await client.connect();
    global.__redis_client__ = client;
    console.log("[capital-com] Redis connected");
    return client;
  } catch (err) {
    console.warn("[capital-com] Redis unavailable:", err);
    return null;
  }
}

async function saveSessionToRedis(session: ActiveSession): Promise<void> {
  try {
    const r = await getRedis();
    if (!r) return;
    await r.set(REDIS_KEY, JSON.stringify(session), { EX: REDIS_TTL_SEC });
  } catch { /* non-fatal */ }
}

async function loadSessionFromRedis(): Promise<ActiveSession | null> {
  try {
    const r = await getRedis();
    if (!r) return null;
    const raw = await r.get(REDIS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveSession;
  } catch { return null; }
}

async function clearSessionFromRedis(): Promise<void> {
  try {
    const r = await getRedis();
    if (!r) return;
    await r.del(REDIS_KEY);
  } catch { /* non-fatal */ }
}
// ──────────────────────────────────────────────────────────────────────────

interface ActiveSession {
  apiKey: string;
  cst: string;
  securityToken: string;
  clientId: string;
  accountId: string;
  accountType: string;
  connectedAt: string;
  accounts: AccountInfo[];
  balance: number;
  currency: string;
}

interface SavedCredentials {
  apiKey: string;
  identifier: string;
  password: string;
}

async function getPrisma() {
  const { getPrisma: gp } = await import("../../app/lib/prisma");
  return gp();
}

async function loadCredentials(): Promise<SavedCredentials | null> {
  // 1. Railway Variables — always available after deploy (like GPT/Claude)
  const envKey = process.env.CAPITAL_API_KEY;
  const envId  = process.env.CAPITAL_IDENTIFIER;
  const envPw  = process.env.CAPITAL_PASSWORD;
  if (envKey && envId && envPw && envKey.length > 5 && envPw.length > 3) {
    console.log(`[capital-com] credentials: using Railway Variables for ${envId}`);
    return { apiKey: envKey, identifier: envId, password: envPw };
  }
  // 2. Fallback: PostgreSQL DB
  try {
    const db = await getPrisma();
    const row = await db.$queryRaw<{ data: string }[]>`
      SELECT data FROM "CapitalCredentials" WHERE id = 'singleton' LIMIT 1
    `;
    if (row && row.length > 0) {
      const json = decryptCredentials(row[0].data);
      const creds = JSON.parse(json) as SavedCredentials;
      console.log(`[capital-com] credentials: using DB for ${creds.identifier}`);
      // Opportunistische Migration: altes Klartext-Format bei nächster Gelegenheit
      // verschlüsselt neu speichern, sobald ein Key gesetzt ist. Non-blocking,
      // non-fatal — verzögert oder blockiert das Lesen nie.
      if (!row[0].data.startsWith(ENC_PREFIX) && getEncryptionKey()) {
        saveCredentials(creds).catch(() => {});
      }
      return creds;
    }
    console.warn("[capital-com] credentials: not found in env vars or DB");
    return null;
  } catch (err) {
    console.error("[capital-com] loadCredentials FAILED:", err);
    return null;
  }
}

async function saveCredentials(creds: SavedCredentials): Promise<void> {
  try {
    const db = await getPrisma();
    const data = encryptCredentials(JSON.stringify(creds));
    await db.$executeRawUnsafe(
      `INSERT INTO "CapitalCredentials" (id, data, "updatedAt") VALUES ('singleton', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, "updatedAt" = NOW()`,
      data
    );
    console.log(`[capital-com] credentials saved to DB for ${creds.identifier}${data.startsWith(ENC_PREFIX) ? " (verschlüsselt)" : ""}`);
  } catch (err) {
    console.error("[capital-com] saveCredentials FAILED:", err);
  }
}

async function clearCredentials(): Promise<void> {
  try {
    const db = await getPrisma();
    await db.$executeRawUnsafe(`DELETE FROM "CapitalCredentials" WHERE id = 'singleton'`);
  } catch { /* non-fatal */ }
}

declare global {
  var __capital_session__: ActiveSession | null | undefined;
  var __capital_reconnecting__: boolean | undefined;
  var __capital_last_error__: string | null | undefined;
  var __capital_last_attempt__: number | undefined;
}
if (global.__capital_session__ === undefined) global.__capital_session__ = null;
if (global.__capital_reconnecting__ === undefined) global.__capital_reconnecting__ = false;
if (global.__capital_last_error__ === undefined) global.__capital_last_error__ = null;
if (global.__capital_last_attempt__ === undefined) global.__capital_last_attempt__ = 0;

export function getLastReconnectError(): string | null {
  return global.__capital_last_error__ ?? null;
}

export function getCapitalSession(): ActiveSession | null {
  return global.__capital_session__ ?? null;
}

export function isCapitalConnected(): boolean {
  return global.__capital_session__ !== null;
}

export async function connectCapital(
  apiKey: string,
  identifier: string,
  password: string
): Promise<{ ok: boolean; accountId?: string; accountType?: string; balance?: number; accounts?: AccountInfo[]; error?: string }> {
  if (global.__capital_session__) {
    await capitalDeleteSession(global.__capital_session__.apiKey, global.__capital_session__.cst, global.__capital_session__.securityToken).catch(() => {});
    global.__capital_session__ = null;
  }

  const session: SessionResult = await capitalCreateSession(apiKey, identifier, password, false);
  if (!session.ok) return { ok: false, error: session.error };

  const accountsResult = await capitalGetAccounts(apiKey, session.cst!, session.securityToken!);

  // ── EIN AUSFALL DARF SICH NICHT ALS VERBINDUNG AUSGEBEN (29.09.) ─────────
  //
  // Hier wurde das Ergebnis von `capitalGetAccounts` NICHT geprueft. Schlug
  // die Kontoabfrage fehl (HTTP-Fehler, Zeitgrenze, Netz), war
  // `accountsResult.accounts` undefiniert — und die Sitzung wurde trotzdem
  // gespeichert, mit `balance: 0`, `accounts: []` und `return { ok: true }`.
  //
  // WAS DARAUS FOLGT, nachgerechnet am 29.09. mit den echten Funktionen:
  //   * `isCapitalConnected()` prueft nur `!== null` und meldet "verbunden".
  //   * Der Orchestrator bricht nur bei NICHT verbunden ab (Zeile 740), laeuft
  //     hier also weiter — mit Kontostand 0.
  //   * Dort stand bis heute `session.balance > 0 ? session.balance : 10000`.
  //     Aus "unbekannt" wurden 10000 ERFUNDENE Einheiten.
  //   * `checkTotalDrawdownLimit(10000, …)` sieht einen neuen Hoechststand und
  //     schreibt 10000 nach Redis — mit einem Jahr Haltbarkeit und ohne jeden
  //     Weg, ihn zurueckzusetzen.
  //   * Der naechste Zyklus mit dem ECHTEN Stand meldet dann
  //     "-84.63% vom Hoechststand 10000" und sperrt jeden weiteren Trade.
  //
  // WIE DIE SPERRE VOM 28.09. WIRKLICH ENTSTAND — nachgereicht (29.09.):
  // NICHT so. Der Hoechststand von 10000 war ECHT. Der Nutzer hatte das
  // Demokonto vor langer Zeit von 10000 auf 2000 HERUNTERGESETZT, um zu
  // sehen, wie das Programm mit kleinen Summen handelt. Kein Geld verloren —
  // eine Auszahlung, die die Grenze als Verlust las.
  //
  // Der hier beschriebene Weg bleibt trotzdem ein Loch, und er ist
  // nachgerechnet erreichbar. Er war nur nicht die Ursache jenes Tages.
  // Deshalb: keine Sitzung ohne Kontostand.
  //
  // Die eben erzeugte Broker-Sitzung wird dabei wieder abgeraeumt, sonst
  // bliebe sie bei Capital.com offen stehen.
  if (!accountsResult.ok || !accountsResult.accounts || accountsResult.accounts.length === 0) {
    const grund = accountsResult.error ?? "Kontoabfrage lieferte keine Konten";
    console.error(`[capital-com] ⛔ Anmeldung erfolgreich, aber KEIN Kontostand (${grund}) — `
      + `Sitzung wird NICHT gespeichert. Ohne Kontostand rechnet keine Verlustgrenze richtig.`);
    await capitalDeleteSession(apiKey, session.cst!, session.securityToken!).catch(() => {});
    return { ok: false, error: `Kontoabfrage fehlgeschlagen: ${grund}` };
  }

  const primaryAccount = accountsResult.accounts[0];

  // Und der Wert selbst muss eine ZAHL sein. `?? 0` stand hier und machte aus
  // einem fehlenden Feld eine Null — dieselbe Luege eine Ebene tiefer. Eine
  // echte Null (Konto leergelaufen) ist dagegen eine Messung und bleibt
  // erlaubt; deshalb `Number.isFinite` statt `> 0`.
  if (!Number.isFinite(primaryAccount?.balance)) {
    console.error(`[capital-com] ⛔ Konto ${primaryAccount?.accountId ?? "?"} liefert keinen lesbaren `
      + `Kontostand (${JSON.stringify(primaryAccount?.balance)}) — Sitzung wird NICHT gespeichert.`);
    await capitalDeleteSession(apiKey, session.cst!, session.securityToken!).catch(() => {});
    return { ok: false, error: "Kontostand nicht lesbar" };
  }

  global.__capital_session__ = {
    apiKey,
    cst: session.cst!,
    securityToken: session.securityToken!,
    clientId: session.clientId ?? "",
    accountId: session.accountId ?? "",
    accountType: session.accountType ?? "",
    connectedAt: new Date().toISOString(),
    accounts: accountsResult.accounts,
    balance: primaryAccount.balance,
    currency: primaryAccount.currency ?? "USD",
  };

  // Persist session to Redis — survives Cold Start restarts
  await saveSessionToRedis(global.__capital_session__);
  await saveCredentials({ apiKey, identifier, password });

  if (primaryAccount?.balance != null) {
    paperManagerCapital.syncBalance(primaryAccount.balance, primaryAccount.currency ?? "USD");
  }

  return {
    ok: true,
    accountId: global.__capital_session__.accountId,
    accountType: global.__capital_session__.accountType,
    balance: primaryAccount?.balance,
    accounts: global.__capital_session__.accounts,
  };
}

export async function disconnectCapital(): Promise<void> {
  if (global.__capital_session__) {
    await capitalDeleteSession(global.__capital_session__.apiKey, global.__capital_session__.cst, global.__capital_session__.securityToken).catch(() => {});
    global.__capital_session__ = null;
  }
  await clearSessionFromRedis();
  await clearCredentials();
}

/** Nur für den Killswitch (28.07.): trennt die Broker-Session, lässt aber die
 *  gespeicherten Credentials UNANGETASTET — im Gegensatz zu disconnectCapital(),
 *  das clearCredentials() aufruft und damit ein späteres /reset unmöglich machen
 *  würde. Schliesst KEINE offenen Positionen (User-Vorgabe): die bleiben mit
 *  ihren Broker-seitigen SL/TP bestehen. */
export async function killswitchDisconnectCapital(): Promise<void> {
  const s = global.__capital_session__;
  if (s) {
    await capitalDeleteSession(s.apiKey, s.cst, s.securityToken).catch(() => {});
    global.__capital_session__ = null;
  }
  await clearSessionFromRedis();
  global.__capital_last_error__ = null;
  global.__capital_last_attempt__ = 0;
  console.log("[killswitch] Capital.com-Session getrennt (Credentials bleiben erhalten)");
}

// Auto-reconnect with mutex + 30s cooldown on FAILED attempts only
// After success: cooldown resets so session can be recovered immediately if it drops again
export async function autoReconnectCapital(): Promise<{ ok: boolean; error?: string }> {
  // Killswitch-Sperre (28.07.): solange aktiv, darf sich das System NICHT
  // wieder verbinden — sonst wäre die Verbindung nach spätestens 2 Minuten
  // (Keep-Alive) von selbst zurück. Nach resetKillswitch() greift das wieder normal.
  if (isKillswitchActive()) {
    return { ok: false, error: "Killswitch aktiv — Reconnect gesperrt (/reset zum Entsperren)" };
  }
  if (global.__capital_session__) return { ok: true };

  // Wait if another reconnect is in progress
  if (global.__capital_reconnecting__) {
    const deadline = Date.now() + 8000;
    while (global.__capital_reconnecting__ && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    return global.__capital_session__ ? { ok: true } : { ok: false, error: "Reconnect timeout" };
  }

  // Cooldown only applies after a FAILED attempt (prevents rate limiting)
  const now = Date.now();
  const timeSinceLastAttempt = now - (global.__capital_last_attempt__ ?? 0);
  const hadRecentFailure = !!global.__capital_last_error__ && timeSinceLastAttempt < 30_000;
  if (hadRecentFailure) {
    return { ok: false, error: global.__capital_last_error__ ?? "Cooldown nach Fehler" };
  }

  global.__capital_last_attempt__ = now;
  global.__capital_reconnecting__ = true;
  try {
    // 1. Try Redis first — instant restore without a new Capital.com login
    const cached = await loadSessionFromRedis();
    if (cached) {
      console.log(`[capital-com] restored session from Redis ⚡ account=${cached.accountId}`);
      global.__capital_session__ = cached;
      // Validate immediately — ping Capital.com to confirm tokens are still valid
      const ping = await capitalGetAccounts(cached.apiKey, cached.cst, cached.securityToken);
      if (ping.ok) {
        // ── DER PING WURDE NUR GELOGGT, NICHT UEBERNOMMEN (29.09.) ────────
        //
        // Hier stand `console.log(… ping.accounts?.[0]?.balance)` — der
        // frische Kontostand ging in die Logzeile und sonst nirgendwohin.
        // Die Sitzung behielt den Stand von der letzten Speicherung.
        //
        // Das zaehlt, weil die Verlust- und Drawdown-Grenzen genau diesen
        // Wert rechnen. Nach einem Neustart lief der erste Zyklus damit auf
        // einem alten Kontostand — und ein alter Stand, der einmal 0 war,
        // kam so immer wieder zurueck.
        //
        // `Number.isFinite`: liefert der Ping keinen lesbaren Wert, bleibt
        // der gespeicherte stehen — ein unbekannter Wert darf einen bekannten
        // nicht ueberschreiben.
        const frisch = ping.accounts?.[0];
        if (Number.isFinite(frisch?.balance)) {
          cached.balance = frisch!.balance;
          cached.currency = frisch!.currency ?? cached.currency;
        }
        if (ping.accounts && ping.accounts.length > 0) cached.accounts = ping.accounts;
        global.__capital_session__ = cached;
        // Refresh TTL in Redis
        await saveSessionToRedis(cached);
        global.__capital_last_error__ = null;
        global.__capital_last_attempt__ = 0;
        console.log(`[capital-com] Redis session valid ✅ balance=${cached.balance}`);
        return { ok: true };
      } else {
        // Tokens expired — clear Redis, fall through to fresh login
        console.warn("[capital-com] Redis session expired — doing fresh login");
        global.__capital_session__ = null;
        await clearSessionFromRedis();
      }
    }

    // 2. Fresh login with credentials
    const creds = await loadCredentials();
    if (!creds) {
      global.__capital_last_error__ = "Keine Credentials (Railway Variables oder DB leer)";
      return { ok: false, error: global.__capital_last_error__ };
    }
    const result = await connectCapital(creds.apiKey, creds.identifier, creds.password);
    if (!result.ok) {
      global.__capital_last_error__ = result.error ?? "Verbindungsfehler";
      console.error(`[capital-com] reconnect failed: ${result.error}`);
      return { ok: false, error: result.error };
    }
    // Success — reset error + cooldown so next drop reconnects immediately
    global.__capital_last_error__ = null;
    global.__capital_last_attempt__ = 0;
    console.log(`[capital-com] reconnected ✅ account=${result.accountId}`);
    return { ok: true };
  } finally {
    global.__capital_reconnecting__ = false;
  }
}

// Keep-alive: ping Capital.com with GET /accounts every 2min to prevent session expiry
// Called from instrumentation heartbeat
export async function keepAliveCapital(): Promise<void> {
  if (isKillswitchActive()) return; // Killswitch aktiv — keine Verbindung halten/aufbauen
  const session = global.__capital_session__;
  if (!session) {
    await autoReconnectCapital().catch(() => {});
    return;
  }
  try {
    const { capitalGetAccounts } = await import("./capital-com-client");
    const result = await capitalGetAccounts(session.apiKey, session.cst, session.securityToken);
    if (!result.ok) {
      // Session expired — clear and reconnect
      console.warn("[capital-com] keep-alive ping failed — session expired, reconnecting...");
      global.__capital_session__ = null;
      global.__capital_last_error__ = null;
      global.__capital_last_attempt__ = 0;
      await autoReconnectCapital().catch(() => {});
    } else {
      // Update balance from ping and refresh Redis TTL
      const primary = result.accounts?.[0];
      if (primary && global.__capital_session__) {
        global.__capital_session__.balance = primary.balance ?? global.__capital_session__.balance;
      }
      if (global.__capital_session__) {
        await saveSessionToRedis(global.__capital_session__);
      }
      console.log(`[capital-com] keep-alive ✅ balance=${result.accounts?.[0]?.balance}`);
    }
  } catch {
    // Network error — clear session so reconnect happens next time
    global.__capital_session__ = null;
    global.__capital_last_attempt__ = 0;
  }
}

export async function getSavedCredentials(): Promise<{ apiKey: string; identifier: string } | null> {
  const c = await loadCredentials();
  if (!c) return null;
  return { apiKey: c.apiKey, identifier: c.identifier };
}
