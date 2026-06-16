// Server-side session store — keeps CST + X-SECURITY-TOKEN secure, never sent to client
import { paperManagerCapital } from "../paper-trading/paper-singleton";
import {
  capitalCreateSession,
  capitalGetAccounts,
  capitalDeleteSession,
  type SessionResult,
  type AccountInfo,
} from "./capital-com-client";

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
      const creds = JSON.parse(row[0].data) as SavedCredentials;
      console.log(`[capital-com] credentials: using DB for ${creds.identifier}`);
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
    const data = JSON.stringify(creds);
    await db.$executeRawUnsafe(
      `INSERT INTO "CapitalCredentials" (id, data, "updatedAt") VALUES ('singleton', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, "updatedAt" = NOW()`,
      data
    );
    console.log(`[capital-com] credentials saved to DB for ${creds.identifier}`);
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
  const primaryAccount = accountsResult.accounts?.[0];

  global.__capital_session__ = {
    apiKey,
    cst: session.cst!,
    securityToken: session.securityToken!,
    clientId: session.clientId ?? "",
    accountId: session.accountId ?? "",
    accountType: session.accountType ?? "",
    connectedAt: new Date().toISOString(),
    accounts: accountsResult.accounts ?? [],
    balance: primaryAccount?.balance ?? 0,
    currency: primaryAccount?.currency ?? "USD",
  };

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
  await clearCredentials();
}

// Auto-reconnect with mutex + 30s cooldown on FAILED attempts only
// After success: cooldown resets so session can be recovered immediately if it drops again
export async function autoReconnectCapital(): Promise<{ ok: boolean; error?: string }> {
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
      // Update balance from ping
      const primary = result.accounts?.[0];
      if (primary && global.__capital_session__) {
        global.__capital_session__.balance = primary.balance ?? global.__capital_session__.balance;
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
