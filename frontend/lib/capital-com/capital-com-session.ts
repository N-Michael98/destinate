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
  try {
    const db = await getPrisma();
    const row = await db.$queryRaw<{ data: string }[]>`
      SELECT data FROM "CapitalCredentials" WHERE id = 'singleton' LIMIT 1
    `;
    if (row && row.length > 0) {
      const creds = JSON.parse(row[0].data) as SavedCredentials;
      console.log(`[capital-com] loadCredentials: found credentials for ${creds.identifier}`);
      return creds;
    }
    console.warn("[capital-com] loadCredentials: no credentials in DB (CapitalCredentials table is empty)");
    return null;
  } catch (err) {
    console.error("[capital-com] loadCredentials FAILED:", err);
    return null;
  }
}

async function saveCredentials(creds: SavedCredentials): Promise<boolean> {
  try {
    const db = await getPrisma();
    const data = JSON.stringify(creds);
    await db.$executeRawUnsafe(
      `INSERT INTO "CapitalCredentials" (id, data, "updatedAt") VALUES ('singleton', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, "updatedAt" = NOW()`,
      data
    );
    // Verify it was actually saved
    const verify = await db.$queryRaw<{ data: string }[]>`SELECT data FROM "CapitalCredentials" WHERE id = 'singleton' LIMIT 1`;
    if (!verify || verify.length === 0) {
      console.error("[capital-com] saveCredentials: DB write succeeded but read-back returned nothing!");
      return false;
    }
    console.log(`[capital-com] Credentials saved to DB for ${creds.identifier}`);
    return true;
  } catch (err) {
    console.error("[capital-com] saveCredentials FAILED:", err);
    return false;
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
}
if (global.__capital_session__ === undefined) global.__capital_session__ = null;
if (global.__capital_reconnecting__ === undefined) global.__capital_reconnecting__ = false;

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

  // Save credentials for auto-reconnect on next server start
  const saved = await saveCredentials({ apiKey, identifier, password });
  if (!saved) {
    console.error("[capital-com] WARNING: Connected successfully but credentials could NOT be saved to DB — auto-reconnect will fail after next deploy!");
  }

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

// Called on server startup or status check — restores connection using saved credentials
// Mutex prevents simultaneous reconnect attempts (race condition on page load)
export async function autoReconnectCapital(): Promise<{ ok: boolean; error?: string }> {
  if (global.__capital_session__) return { ok: true };

  // If another request is already reconnecting, wait up to 8s for it to finish
  if (global.__capital_reconnecting__) {
    const deadline = Date.now() + 8000;
    while (global.__capital_reconnecting__ && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 300));
    }
    return global.__capital_session__ ? { ok: true } : { ok: false, error: "Reconnect läuft bereits (Timeout)" };
  }

  global.__capital_reconnecting__ = true;
  try {
    const creds = await loadCredentials();
    if (!creds) return { ok: false, error: "Keine gespeicherten Credentials in DB" };
    const result = await connectCapital(creds.apiKey, creds.identifier, creds.password);
    if (!result.ok) {
      console.error(`[capital-com] Auto-reconnect failed: ${result.error}`);
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } finally {
    global.__capital_reconnecting__ = false;
  }
}

export async function getSavedCredentials(): Promise<{ apiKey: string; identifier: string } | null> {
  const c = await loadCredentials();
  if (!c) return null;
  return { apiKey: c.apiKey, identifier: c.identifier };
}
