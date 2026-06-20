/**
 * IC Markets cTrader MCP Client
 * Connects to cTrader Remote MCP Server for account info, positions, and order execution.
 * Uses Bearer token authentication.
 */

const MCP_URL = process.env.ICMARKETS_MCP_URL ?? "https://mcp.ctrader.com/trading/mcp";
const MCP_TOKEN = process.env.ICMARKETS_MCP_TOKEN ?? "";

function authHeaders() {
  return {
    "Authorization": `Bearer ${MCP_TOKEN}`,
    "Content-Type": "application/json",
  };
}

let mcpSessionId: string | null = null;

async function mcpInitialize(): Promise<void> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "destinate-trading", version: "1.0.0" },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MCP initialize failed: HTTP ${res.status}${text ? " — " + text.slice(0, 200) : ""}`);
  }

  // Session-ID aus Header lesen falls vorhanden
  mcpSessionId = res.headers.get("mcp-session-id") ?? res.headers.get("x-session-id") ?? "active";

  const data = await res.json() as { result?: Record<string, unknown>; error?: { message: string } };
  if (data.error) throw new Error(`MCP initialize error: ${data.error.message}`);
}

async function mcpCall(toolName: string, toolArgs: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  // Initialize session first if needed
  if (!mcpSessionId) await mcpInitialize();

  const headers: Record<string, string> = { ...authHeaders() };
  if (mcpSessionId && mcpSessionId !== "active") headers["mcp-session-id"] = mcpSessionId;

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: toolArgs },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Session expired — reset and retry once
    if (res.status === 400 && text.includes("session")) {
      mcpSessionId = null;
      await mcpInitialize();
      return mcpCall(toolName, toolArgs);
    }
    throw new Error(`IC Markets MCP error: HTTP ${res.status}${text ? " — " + text.slice(0, 200) : ""}`);
  }

  const data = await res.json() as { result?: Record<string, unknown>; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);

  const result = data.result ?? {};
  if (Array.isArray(result.content)) {
    const textItem = (result.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text");
    if (textItem?.text) {
      try { return JSON.parse(textItem.text) as Record<string, unknown>; } catch { /* return raw */ }
    }
  }
  return result;
}

// ── Account ───────────────────────────────────────────────────────────────────

export async function icGetAccount(): Promise<{
  ok: boolean;
  balance?: number;
  equity?: number;
  currency?: string;
  accountId?: string;
  error?: string;
}> {
  try {
    const result = await mcpCall("getAccount");
    return {
      ok: true,
      balance: Number(result.balance ?? result.cash ?? 0),
      equity: Number(result.equity ?? 0),
      currency: String(result.currency ?? "CHF"),
      accountId: String(result.accountId ?? result.id ?? ""),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Positions ─────────────────────────────────────────────────────────────────

export interface ICPosition {
  positionId: string;
  symbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  profitLoss: number;
  openTime: string;
}

export async function icGetPositions(): Promise<{ ok: boolean; positions?: ICPosition[]; error?: string }> {
  try {
    const result = await mcpCall("getPositions");
    const raw = Array.isArray(result.positions) ? result.positions as Record<string, unknown>[] : [];
    const positions: ICPosition[] = raw.map((p) => ({
      positionId: String(p.positionId ?? p.id ?? ""),
      symbol: String(p.symbol ?? p.symbolName ?? ""),
      direction: String(p.tradeSide ?? p.direction ?? "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY",
      volume: Number(p.volume ?? p.quantity ?? 0),
      openPrice: Number(p.entryPrice ?? p.openPrice ?? 0),
      stopLoss: p.stopLoss != null ? Number(p.stopLoss) : null,
      takeProfit: p.takeProfit != null ? Number(p.takeProfit) : null,
      profitLoss: Number(p.netProfit ?? p.profitLoss ?? p.unrealizedPnl ?? 0),
      openTime: String(p.openTime ?? p.createTime ?? new Date().toISOString()),
    }));
    return { ok: true, positions };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Place Order ───────────────────────────────────────────────────────────────

export interface ICOrderResult {
  ok: boolean;
  positionId?: string;
  error?: string;
}

export async function icPlaceOrder(
  symbol: string,
  direction: "BUY" | "SELL",
  volume: number,
  stopLoss?: number,
  takeProfit?: number,
): Promise<ICOrderResult> {
  try {
    const params: Record<string, unknown> = {
      symbol,
      tradeSide: direction,
      volume,
      orderType: "MARKET",
    };
    if (stopLoss) params.stopLoss = stopLoss;
    if (takeProfit) params.takeProfit = takeProfit;

    const result = await mcpCall("placeOrder", params);
    return {
      ok: true,
      positionId: String(result.positionId ?? result.orderId ?? ""),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Update Position SL/TP ─────────────────────────────────────────────────────

export async function icUpdatePosition(
  positionId: string,
  stopLoss: number,
  takeProfit?: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const params: Record<string, unknown> = { positionId, stopLoss };
    if (takeProfit) params.takeProfit = takeProfit;
    await mcpCall("modifyPosition", params);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Close Position ────────────────────────────────────────────────────────────

export async function icClosePosition(positionId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await mcpCall("closePosition", { positionId });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Market Price ──────────────────────────────────────────────────────────────

export async function icGetPrice(symbol: string): Promise<{
  ok: boolean;
  bid?: number;
  ask?: number;
  spread?: number;
  error?: string;
}> {
  try {
    const result = await mcpCall("getSymbolPrice", { symbol });
    const bid = Number(result.bid ?? 0);
    const ask = Number(result.ask ?? result.offer ?? 0);
    return { ok: true, bid, ask, spread: Number((ask - bid).toFixed(5)) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Connection Check ──────────────────────────────────────────────────────────

export function isICMarketsConfigured(): boolean {
  return MCP_TOKEN.length > 20;
}
