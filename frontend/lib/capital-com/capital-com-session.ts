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
  // Railway Variables override DB credentials
  const envKey = process.env.CAPITAL_API_KEY;
  const envId = process.env.CAPITAL_IDENTIFIER;
  const envPw = process.env.CAPITAL_PASSWORD;
  if (envKey && envId && envPw) {
    return { apiKey: envKey, identifier: envId, password: envPw };
  }
  try {
    const db = await getPrisma();
    const row = await db.$queryRaw<{ data: string }[]>`
      SELECT data FROM "CapitalCredentials" WHERE id = 'singleton' LIMIT 1
    `;
    if (row && row.length > 0) return JSON.parse(row[0].data) as SavedCredentials;
  } catch { /* DB not ready */ }
  return null;
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
  } catch { /* non-fatal */ }
}

async function clearCredentials(): Promise<void> {
  try {
    const db = await getPrisma();
    await db.$executeRawUnsafe(`DELETE FROM "CapitalCredentials" WHERE id = 'singleton'`);
  } catch { /* non-fatal */ }
}

declare global { var __capital_session__: ActiveSession | null | undefined; }
if (global.__capital_session__ === undefined) global.__capital_session__ = null;

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

  global.__capital_session__ = {
    apiKey,
    cst: session.cst!,
    securityToken: session.securityToken!,
    clientId: session.clientId ?? "",
    accountId: session.accountId ?? "",
    accountType: session.accountType ?? "",
    connectedAt: new Date().toISOString(),
    accounts: accountsResult.accounts ?? [],
  };

  // Save credentials for auto-reconnect on next server start
  await saveCredentials({ apiKey, identifier, password });

  const primaryAccount = global.__capital_session__.accounts[0];

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

// Called on server startup — restores connection using saved credentials
export async function autoReconnectCapital(): Promise<boolean> {
  if (global.__capital_session__) return true;
  const creds = await loadCredentials();
  if (!creds) return false;
  const result = await connectCapital(creds.apiKey, creds.identifier, creds.password);
  if (!result.ok) {
    console.error(`[capital-com] Auto-reconnect failed: ${result.error}`);
  }
  return result.ok;
}

export async function getSavedCredentials(): Promise<{ apiKey: string; identifier: string } | null> {
  const c = await loadCredentials();
  if (!c) return null;
  return { apiKey: c.apiKey, identifier: c.identifier };
}
