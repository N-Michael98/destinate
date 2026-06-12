// Server-side session store — keeps CST + X-SECURITY-TOKEN secure, never sent to client
import fs from "fs";
import path from "path";
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

// Persist credentials (NOT session tokens) so user doesn't re-enter after reload
interface SavedCredentials {
  apiKey: string;
  identifier: string;
  password: string;
}

const CRED_PATH = path.join(process.cwd(), ".capital-credentials.json");

function loadCredentials(): SavedCredentials | null {
  try {
    if (fs.existsSync(CRED_PATH)) {
      return JSON.parse(fs.readFileSync(CRED_PATH, "utf-8")) as SavedCredentials;
    }
  } catch { /* ignore */ }
  return null;
}

function saveCredentials(creds: SavedCredentials): void {
  try { fs.writeFileSync(CRED_PATH, JSON.stringify(creds, null, 2), "utf-8"); } catch { /* non-fatal */ }
}

function clearCredentials(): void {
  try { if (fs.existsSync(CRED_PATH)) fs.unlinkSync(CRED_PATH); } catch { /* ignore */ }
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
  // Disconnect existing session first
  if (global.__capital_session__) {
    await capitalDeleteSession(global.__capital_session__.apiKey, global.__capital_session__.cst, global.__capital_session__.securityToken);
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
  saveCredentials({ apiKey, identifier, password });

  const primaryAccount = global.__capital_session__.accounts[0];

  // Sync paper trading balance with real broker balance
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
    await capitalDeleteSession(global.__capital_session__.apiKey, global.__capital_session__.cst, global.__capital_session__.securityToken);
    global.__capital_session__ = null;
  }
  clearCredentials();
}

// Called on server startup — restores connection using saved credentials
export async function autoReconnectCapital(): Promise<boolean> {
  if (global.__capital_session__) return true; // already connected
  const creds = loadCredentials();
  if (!creds) return false;
  const result = await connectCapital(creds.apiKey, creds.identifier, creds.password);
  return result.ok;
}

export function getSavedCredentials(): { apiKey: string; identifier: string } | null {
  const c = loadCredentials();
  if (!c) return null;
  return { apiKey: c.apiKey, identifier: c.identifier }; // never expose password to client
}
