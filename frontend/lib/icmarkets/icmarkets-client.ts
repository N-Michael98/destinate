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
    "Accept": "application/json, text/event-stream",
  };
}

let mcpSessionId: string | null = null;

// Parse SSE response body — server sends "event: message\ndata: {...}\n\n"
async function parseSseOrJson(res: Response): Promise<{ result?: Record<string, unknown>; error?: { message: string } }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    // Extract all data: lines and find the one with jsonrpc result
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) {
        const json = line.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        try {
          return JSON.parse(json) as { result?: Record<string, unknown>; error?: { message: string } };
        } catch { /* try next line */ }
      }
    }
    throw new Error(`MCP SSE: no valid data line found in response`);
  }
  return res.json() as Promise<{ result?: Record<string, unknown>; error?: { message: string } }>;
}

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

  mcpSessionId = res.headers.get("mcp-session-id") ?? res.headers.get("x-session-id") ?? "active";

  const data = await parseSseOrJson(res);
  if (data.error) throw new Error(`MCP initialize error: ${data.error.message}`);
}

async function mcpCall(toolName: string, toolArgs: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
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
    if (text.includes("session")) {
      mcpSessionId = null;
      await mcpInitialize();
      return mcpCall(toolName, toolArgs);
    }
    throw new Error(`IC Markets MCP error: HTTP ${res.status}${text ? " — " + text.slice(0, 200) : ""}`);
  }

  const data = await parseSseOrJson(res);
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

// ── Discover available tools ──────────────────────────────────────────────────

export async function icListTools(): Promise<string[]> {
  try {
    if (!mcpSessionId) await mcpInitialize();
    const headers: Record<string, string> = { ...authHeaders() };
    if (mcpSessionId && mcpSessionId !== "active") headers["mcp-session-id"] = mcpSessionId;

    const res = await fetch(MCP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/list", params: {} }),
    });
    if (!res.ok) return [];
    const data = await parseSseOrJson(res);
    const toolsList = (data.result as { tools?: Array<{ name: string }> })?.tools ?? [];
    return toolsList.map((t) => t.name);
  } catch { return []; }
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
    // cTrader MCP tool is "get_balance" (discovered via tools/list)
    const result = await mcpCall("get_balance");
    console.log("[IC Markets MCP] get_balance raw:", JSON.stringify(result));

    // cTrader returns balance in cents (e.g. 2000000 = CHF 20,000.00)
    const rawBalance = Number(result.balance ?? result.cash ?? result.moneyBalance ?? result.availableForTrading ?? 0);
    const rawEquity  = Number(result.equity ?? result.netEquity ?? rawBalance);
    const balance = rawBalance > 10000 ? rawBalance / 100 : rawBalance;
    const equity  = rawEquity  > 10000 ? rawEquity  / 100 : rawEquity;

    return {
      ok: true,
      balance,
      equity,
      currency: String(result.currency ?? result.depositCurrency ?? result.currencyCode ?? "CHF"),
      accountId: String(result.accountId ?? result.ctidTraderAccountId ?? result.id ?? ""),
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
    const result = await mcpCall("get_positions");
    console.log("[IC Markets MCP] get_positions raw:", JSON.stringify(result).slice(0, 500));
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

    const result = await mcpCall("create_order", params);
    console.log("[IC Markets MCP] create_order raw:", JSON.stringify(result).slice(0, 300));
    return {
      ok: true,
      positionId: String(result.positionId ?? result.orderId ?? result.dealId ?? result.id ?? ""),
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
    await mcpCall("amend_position", params);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Close Position ────────────────────────────────────────────────────────────

export async function icClosePosition(positionId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await mcpCall("close_position", { positionId });
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
    const result = await mcpCall("get_spot_prices", { symbols: [symbol] });
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
