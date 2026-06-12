import { ICMarketsAccountSnapshot, ICMarketsConfig, ICMarketsConnectionStatus, ICMarketsPosition } from "./icmarkets-types";

const CTRADER_BASE = "https://api.spotware.com";

export class ICMarketsClient {
  private config: ICMarketsConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config?: Partial<ICMarketsConfig>) {
    this.config = {
      enabled: true,
      mode: "DEMO",
      readOnly: true,
      allowLiveOrders: false,
      server: process.env.ICMARKETS_SERVER ?? "demo.ctraderapi.com",
      accountId: process.env.ICMARKETS_ACCOUNT_ID,
      apiKey: process.env.ICMARKETS_API_KEY,
      clientId: process.env.ICMARKETS_CLIENT_ID,
      clientSecret: process.env.ICMARKETS_CLIENT_SECRET,
      ...config,
    };
  }

  getConfig(): ICMarketsConfig { return this.config; }

  getStatus(): ICMarketsConnectionStatus {
    if (!this.config.enabled) return "DISCONNECTED";
    if (!this.config.clientId || !this.config.clientSecret || !this.config.accountId) return "PREPARED";
    if (this.accessToken && Date.now() < this.tokenExpiry) return "CONNECTED";
    return "DISCONNECTED";
  }

  private async fetchToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;
    if (!this.config.clientId || !this.config.clientSecret) return null;
    try {
      const res = await fetch(`${CTRADER_BASE}/apps/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      this.accessToken = d.accessToken ?? null;
      this.tokenExpiry = Date.now() + (d.expiresIn ?? 3600) * 1000 - 60000;
      return this.accessToken;
    } catch { return null; }
  }

  async getAccountSnapshot(): Promise<ICMarketsAccountSnapshot> {
    const token = await this.fetchToken();
    if (!token || !this.config.accountId) return this._mockSnapshot();
    try {
      const res = await fetch(`${CTRADER_BASE}/v2/tradingaccounts/${this.config.accountId}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      if (!res.ok) return this._mockSnapshot();
      const d = await res.json();
      return {
        broker: "IC_MARKETS",
        mode: this.config.mode,
        balance: (d.balance ?? 3000000) / 100,
        equity: (d.equity ?? 3000000) / 100,
        margin: (d.usedMargin ?? 0) / 100,
        freeMargin: (d.freeMargin ?? 3000000) / 100,
        currency: d.depositCurrency ?? "USD",
        status: "CONNECTED",
        updatedAt: new Date(),
      };
    } catch { return this._mockSnapshot(); }
  }

  async getOpenPositions(): Promise<ICMarketsPosition[]> {
    const token = await this.fetchToken();
    if (!token || !this.config.accountId) return [];
    try {
      const res = await fetch(`${CTRADER_BASE}/v2/tradingaccounts/${this.config.accountId}/positions`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      if (!res.ok) return [];
      const d = await res.json();
      return (d.position ?? []).map((p: Record<string, unknown>) => ({
        id: String(p.positionId),
        symbol: String((p as Record<string, unknown>).symbolName ?? ""),
        side: p.tradeSide === "SELL" ? "SHORT" : "LONG",
        volume: Number(p.volume ?? 0) / 100,
        entryPrice: Number(p.price ?? 0),
        currentPrice: Number(p.currentPrice ?? 0),
        floatingPnL: Number(p.unrealizedGrossPnl ?? 0) / 100,
        openedAt: new Date(Number((p.tradeData as Record<string, unknown>)?.openTimestamp ?? Date.now())),
      }));
    } catch { return []; }
  }

  private _mockSnapshot(): ICMarketsAccountSnapshot {
    return {
      broker: "IC_MARKETS", mode: this.config.mode,
      balance: 30000, equity: 30000, margin: 0, freeMargin: 30000,
      currency: "USD", status: this.getStatus(), updatedAt: new Date(),
    };
  }
}

export const icMarketsClient = new ICMarketsClient();
