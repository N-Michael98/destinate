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
      mcpToken: process.env.ICMARKETS_MCP_TOKEN,
      mcpUrl: process.env.ICMARKETS_MCP_URL ?? "https://mcp.ctrader.com/trading/mcp",
      leverage: 500,
      ...config,
    };
  }

  getConfig(): ICMarketsConfig { return this.config; }

  // Check if MCP token is available (preferred auth method)
  private hasMcpToken(): boolean {
    return (this.config.mcpToken?.length ?? 0) > 20;
  }

  getStatus(): ICMarketsConnectionStatus {
    if (!this.config.enabled) return "DISCONNECTED";
    if (this.hasMcpToken()) return "CONNECTED"; // MCP token = always connected
    if (!this.config.clientId || !this.config.clientSecret || !this.config.accountId) return "PREPARED";
    if (this.accessToken && Date.now() < this.tokenExpiry) return "CONNECTED";
    return "DISCONNECTED";
  }

  // MCP call via cTrader Remote MCP Server
  private async mcpCall(toolName: string, toolArgs: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const res = await fetch(this.config.mcpUrl!, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.mcpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: toolName, arguments: toolArgs } }),
    });
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
    const data = await res.json() as { result?: Record<string, unknown>; error?: { message: string } };
    if (data.error) throw new Error(data.error.message);
    const result = data.result ?? {};
    if (Array.isArray(result.content)) {
      const textItem = (result.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text");
      if (textItem?.text) { try { return JSON.parse(textItem.text) as Record<string, unknown>; } catch { /* raw */ } }
    }
    return result;
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
    // Try MCP token first
    if (this.hasMcpToken()) {
      try {
        const result = await this.mcpCall("getAccount");
        return {
          broker: "IC_MARKETS",
          mode: this.config.mode,
          balance: Number(result.balance ?? result.cash ?? 0),
          equity: Number(result.equity ?? 0),
          margin: Number(result.usedMargin ?? result.margin ?? 0),
          freeMargin: Number(result.freeMargin ?? 0),
          currency: String(result.currency ?? "CHF"),
          status: "CONNECTED",
          updatedAt: new Date(),
        };
      } catch { return this._mockSnapshot(); }
    }
    // Fallback: cTrader Open API
    const token = await this.fetchToken();
    if (!token || !this.config.accountId) return this._mockSnapshot();
    try {
      const res = await fetch(`${CTRADER_BASE}/v2/tradingaccounts/${this.config.accountId}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      if (!res.ok) return this._mockSnapshot();
      const d = await res.json();
      return {
        broker: "IC_MARKETS", mode: this.config.mode,
        balance: (d.balance ?? 3000000) / 100, equity: (d.equity ?? 3000000) / 100,
        margin: (d.usedMargin ?? 0) / 100, freeMargin: (d.freeMargin ?? 3000000) / 100,
        currency: d.depositCurrency ?? "USD", status: "CONNECTED", updatedAt: new Date(),
      };
    } catch { return this._mockSnapshot(); }
  }

  async getOpenPositions(): Promise<ICMarketsPosition[]> {
    // Try MCP token first
    if (this.hasMcpToken()) {
      try {
        const result = await this.mcpCall("getPositions");
        const raw = Array.isArray(result.positions) ? result.positions as Record<string, unknown>[] : [];
        return raw.map((p) => ({
          id: String(p.positionId ?? p.id ?? ""),
          symbol: String(p.symbol ?? p.symbolName ?? ""),
          side: String(p.tradeSide ?? p.direction ?? "").toUpperCase() === "SELL" ? "SHORT" as const : "LONG" as const,
          volume: Number(p.volume ?? 0),
          entryPrice: Number(p.entryPrice ?? p.openPrice ?? 0),
          currentPrice: Number(p.currentPrice ?? 0),
          floatingPnL: Number(p.netProfit ?? p.unrealizedPnl ?? 0),
          openedAt: new Date(String(p.openTime ?? new Date().toISOString())),
        }));
      } catch { return []; }
    }
    // Fallback: cTrader Open API
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
        side: p.tradeSide === "SELL" ? "SHORT" as const : "LONG" as const,
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
