// Server-side session store — keeps CST + X-SECURITY-TOKEN secure, never sent to client
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

let _session: ActiveSession | null = null;

export function getCapitalSession(): ActiveSession | null {
  return _session;
}

export function isCapitalConnected(): boolean {
  return _session !== null;
}

export async function connectCapital(
  apiKey: string,
  login: string,
  password: string
): Promise<{ ok: boolean; accountId?: string; accountType?: string; balance?: number; accounts?: AccountInfo[]; error?: string }> {
  // Disconnect existing session first
  if (_session) {
    await capitalDeleteSession(_session.apiKey, _session.cst, _session.securityToken);
    _session = null;
  }

  const session: SessionResult = await capitalCreateSession(apiKey, login, password);
  if (!session.ok) return { ok: false, error: session.error };

  const accountsResult = await capitalGetAccounts(apiKey, session.cst!, session.securityToken!);

  _session = {
    apiKey,
    cst: session.cst!,
    securityToken: session.securityToken!,
    clientId: session.clientId ?? "",
    accountId: session.accountId ?? "",
    accountType: session.accountType ?? "",
    connectedAt: new Date().toISOString(),
    accounts: accountsResult.accounts ?? [],
  };

  const primaryAccount = _session.accounts[0];
  return {
    ok: true,
    accountId: _session.accountId,
    accountType: _session.accountType,
    balance: primaryAccount?.balance,
    accounts: _session.accounts,
  };
}

export async function disconnectCapital(): Promise<void> {
  if (_session) {
    await capitalDeleteSession(_session.apiKey, _session.cst, _session.securityToken);
    _session = null;
  }
}
