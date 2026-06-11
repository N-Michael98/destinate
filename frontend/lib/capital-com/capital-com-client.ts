// Capital.com Demo REST API client — DEMO execution enabled, LIVE blocked
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

export interface OrderRequest {
  epic: string;
  direction: "BUY" | "SELL";
  size: number;
  stopLevel?: number;
  profitLevel?: number;
  guaranteedStop?: boolean;
}

export interface OrderResult {
  ok: boolean;
  dealReference?: string;
  dealId?: string;
  status?: string;
  error?: string;
}

export interface OpenPosition {
  dealId: string;
  epic: string;
  symbol: string;
  direction: "BUY" | "SELL";
  size: number;
  openLevel: number;
  stopLevel: number | null;
  profitLevel: number | null;
  profitLoss: number;
  currency: string;
  createdDate: string;
}

// Capital.com epic names for our symbols
export const EPIC_MAP: Record<string, string> = {
  XAUUSD: "GOLD",
  EURUSD: "EURUSD",
  NAS100: "US100",
  USOIL: "OIL_CRUDE",
  BTCUSD: "BITCOIN",
  SPX500: "US500",
};

// Reverse map: epic → symbol
export const EPIC_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(EPIC_MAP).map(([sym, epic]) => [epic, sym])
);

function authHeaders(apiKey: string, cst: string, securityToken: string) {
  return {
    "X-CAP-API-KEY": apiKey,
    CST: cst,
    "X-SECURITY-TOKEN": securityToken,
    "Content-Type": "application/json",
  };
}

export async function capitalCreateSession(
  apiKey: string,
  login: string,
  password: string
): Promise<SessionResult> {
  try {
    const res = await fetch(`${DEMO_BASE}/session`, {
      method: "POST",
      headers: { "X-CAP-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedPassword: false, login, password }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg: string = (errBody as Record<string, string>).errorCode ?? `HTTP ${res.status}`;
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
      headers: authHeaders(apiKey, cst, securityToken),
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
        headers: authHeaders(apiKey, cst, securityToken),
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

// Place a market order on Capital.com DEMO
export async function capitalPlaceOrder(
  apiKey: string,
  cst: string,
  securityToken: string,
  order: OrderRequest
): Promise<OrderResult> {
  try {
    const body: Record<string, unknown> = {
      epic: order.epic,
      direction: order.direction,
      size: order.size,
      guaranteedStop: order.guaranteedStop ?? false,
    };
    if (order.stopLevel != null) body.stopLevel = order.stopLevel;
    if (order.profitLevel != null) body.profitLevel = order.profitLevel;

    const res = await fetch(`${DEMO_BASE}/positions`, {
      method: "POST",
      headers: authHeaders(apiKey, cst, securityToken),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg: string = (errBody as Record<string, string>).errorCode ?? `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      dealReference: String(data.dealReference ?? ""),
      dealId: String(data.dealId ?? data.dealReference ?? ""),
      status: "OPENED",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Get all open positions
export async function capitalGetPositions(
  apiKey: string,
  cst: string,
  securityToken: string
): Promise<{ ok: boolean; positions?: OpenPosition[]; error?: string }> {
  try {
    const res = await fetch(`${DEMO_BASE}/positions`, {
      headers: authHeaders(apiKey, cst, securityToken),
    });

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const data = (await res.json()) as { positions: Record<string, unknown>[] };
    const positions: OpenPosition[] = (data.positions ?? []).map((p) => {
      const pos = (p.position ?? {}) as Record<string, unknown>;
      const market = (p.market ?? {}) as Record<string, unknown>;
      const epic = String(market.epic ?? "");
      return {
        dealId: String(pos.dealId ?? ""),
        epic,
        symbol: EPIC_TO_SYMBOL[epic] ?? epic,
        direction: (pos.direction as "BUY" | "SELL") ?? "BUY",
        size: Number(pos.dealSize ?? pos.size ?? 0),
        openLevel: Number(pos.openLevel ?? 0),
        stopLevel: pos.stopLevel != null ? Number(pos.stopLevel) : null,
        profitLevel: pos.limitLevel != null ? Number(pos.limitLevel) : null,
        profitLoss: Number(pos.upl ?? 0),
        currency: String(pos.currency ?? "USD"),
        createdDate: String(pos.createdDate ?? new Date().toISOString()),
      };
    });

    return { ok: true, positions };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Close a specific position by dealId
export async function capitalClosePosition(
  apiKey: string,
  cst: string,
  securityToken: string,
  dealId: string
): Promise<OrderResult> {
  try {
    const res = await fetch(`${DEMO_BASE}/positions/${dealId}`, {
      method: "DELETE",
      headers: authHeaders(apiKey, cst, securityToken),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg: string = (errBody as Record<string, string>).errorCode ?? `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      dealReference: String(data.dealReference ?? ""),
      status: "CLOSED",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export interface CapitalMarket {
  epic: string;
  instrumentName: string;
  instrumentType: string;
  symbol: string; // derived from epic
  bid: number;
  ask: number;
  spread: number;
  updateTime: string;
}

// Fetch all available markets from Capital.com (by instrument type)
// Returns markets with current bid/ask from Capital.com snapshot
export async function capitalGetAvailableMarkets(
  apiKey: string,
  cst: string,
  securityToken: string,
  instrumentTypes: string[] = ["CURRENCIES", "INDICES", "COMMODITIES", "CRYPTOCURRENCIES"]
): Promise<{ ok: boolean; markets?: CapitalMarket[]; error?: string }> {
  try {
    const all: CapitalMarket[] = [];

    for (const type of instrumentTypes) {
      const res = await fetch(
        `${DEMO_BASE}/markets?instrumentTypes=${type}&limit=50`,
        { headers: authHeaders(apiKey, cst, securityToken) }
      );
      if (!res.ok) continue;

      const data = (await res.json()) as { markets: Record<string, unknown>[] };
      for (const m of data.markets ?? []) {
        const snap = (m.snapshot ?? {}) as Record<string, unknown>;
        const epic = String(m.epic ?? "");
        const bid = Number(snap.bid ?? 0);
        const offer = Number(snap.offer ?? bid);
        all.push({
          epic,
          instrumentName: String(m.instrumentName ?? epic),
          instrumentType: type,
          symbol: EPIC_TO_SYMBOL[epic] ?? epic,
          bid,
          ask: offer,
          spread: Number((offer - bid).toFixed(5)),
          updateTime: String(snap.updateTime ?? new Date().toISOString()),
        });
      }
    }

    return { ok: true, markets: all };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Search markets by term (e.g. "gold", "eur", "bitcoin")
export async function capitalSearchMarkets(
  apiKey: string,
  cst: string,
  securityToken: string,
  searchTerm: string
): Promise<{ ok: boolean; markets?: CapitalMarket[]; error?: string }> {
  try {
    const res = await fetch(
      `${DEMO_BASE}/markets?searchTerm=${encodeURIComponent(searchTerm)}&limit=20`,
      { headers: authHeaders(apiKey, cst, securityToken) }
    );
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const data = (await res.json()) as { markets: Record<string, unknown>[] };
    const markets: CapitalMarket[] = (data.markets ?? []).map((m) => {
      const snap = (m.snapshot ?? {}) as Record<string, unknown>;
      const epic = String(m.epic ?? "");
      const bid = Number(snap.bid ?? 0);
      const offer = Number(snap.offer ?? bid);
      return {
        epic,
        instrumentName: String(m.instrumentName ?? epic),
        instrumentType: String(m.instrumentType ?? ""),
        symbol: EPIC_TO_SYMBOL[epic] ?? epic,
        bid,
        ask: offer,
        spread: Number((offer - bid).toFixed(5)),
        updateTime: String(snap.updateTime ?? new Date().toISOString()),
      };
    });
    return { ok: true, markets };
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
    headers: authHeaders(apiKey, cst, securityToken),
  }).catch(() => {});
}
