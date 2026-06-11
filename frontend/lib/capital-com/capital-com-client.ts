// Capital.com Demo REST API client — READ ONLY, no order execution
const DEMO_BASE = "https://demo-api-capital.backend.capital/api/v1";

export interface SessionResult {
  ok: boolean;
  cst?: string;
  securityToken?: string;
  clientId?: string;
  accountId?: string;
  accountType?: string;
  currency?: string;
  balance?: number;
  error?: string;
}

export interface AccountInfo {
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  balance: number;
  deposit: number;
  profitLoss: number;
  available: number;
}

export interface MarketPrice {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  updateTime: string;
}

export async function capitalCreateSession(
  apiKey: string,
  login: string,
  password: string
): Promise<SessionResult> {
  try {
    const res = await fetch(`${DEMO_BASE}/session`, {
      method: "POST",
      headers: {
        "X-CAP-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ encryptedPassword: false, login, password }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg: string = (errBody as Record<string,string>).errorCode ?? `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }

    const cst = res.headers.get("CST") ?? "";
    const securityToken = res.headers.get("X-SECURITY-TOKEN") ?? "";
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    return {
      ok: true,
      cst,
      securityToken,
      clientId: String(data.clientId ?? ""),
      accountId: String(data.currentAccountId ?? ""),
      accountType: String(data.accountType ?? ""),
      currency: String(data.currency ?? ""),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function capitalGetAccounts(
  apiKey: string,
  cst: string,
  securityToken: string
): Promise<{ ok: boolean; accounts?: AccountInfo[]; error?: string }> {
  try {
    const res = await fetch(`${DEMO_BASE}/accounts`, {
      headers: {
        "X-CAP-API-KEY": apiKey,
        CST: cst,
        "X-SECURITY-TOKEN": securityToken,
      },
    });

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const data = (await res.json()) as { accounts: Record<string, unknown>[] };
    const accounts: AccountInfo[] = (data.accounts ?? []).map((a) => ({
      accountId: String(a.accountId ?? ""),
      accountName: String(a.accountName ?? ""),
      accountType: String(a.accountType ?? ""),
      currency: String(a.currency ?? "USD"),
      balance: Number(a.balance ?? 0),
      deposit: Number(a.deposit ?? 0),
      profitLoss: Number(a.profitLoss ?? 0),
      available: Number(a.available ?? 0),
    }));
    return { ok: true, accounts };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Capital.com epic names for our symbols
const EPIC_MAP: Record<string, string> = {
  XAUUSD: "GOLD",
  EURUSD: "EURUSD",
  NAS100: "US100",
  USOIL: "OIL_CRUDE",
  BTCUSD: "BITCOIN",
  SPX500: "US500",
};

export async function capitalGetPrices(
  apiKey: string,
  cst: string,
  securityToken: string,
  symbols: string[] = ["XAUUSD", "EURUSD", "NAS100", "USOIL", "BTCUSD", "SPX500"]
): Promise<{ ok: boolean; prices?: MarketPrice[]; error?: string }> {
  try {
    const prices: MarketPrice[] = [];

    for (const symbol of symbols) {
      const epic = EPIC_MAP[symbol];
      if (!epic) continue;

      const res = await fetch(`${DEMO_BASE}/markets/${epic}`, {
        headers: {
          "X-CAP-API-KEY": apiKey,
          CST: cst,
          "X-SECURITY-TOKEN": securityToken,
        },
      });

      if (!res.ok) continue;

      const data = (await res.json()) as Record<string, unknown>;
      const snapshot = (data.snapshot ?? {}) as Record<string, unknown>;
      const bid = Number(snapshot.bid ?? 0);
      const offer = Number(snapshot.offer ?? 0);

      prices.push({
        symbol,
        bid,
        ask: offer,
        spread: Number((offer - bid).toFixed(5)),
        updateTime: String(snapshot.updateTime ?? new Date().toISOString()),
      });
    }

    return { ok: true, prices };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function capitalDeleteSession(
  apiKey: string,
  cst: string,
  securityToken: string
): Promise<void> {
  await fetch(`${DEMO_BASE}/session`, {
    method: "DELETE",
    headers: {
      "X-CAP-API-KEY": apiKey,
      CST: cst,
      "X-SECURITY-TOKEN": securityToken,
    },
  }).catch(() => {});
}
