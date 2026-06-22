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

  // cTrader MCP wraps errors in {content:[{type:"text",text:"..."}], isError:true}
  const raw = data as Record<string, unknown>;
  if (raw.isError === true) {
    const content = raw.content as Array<{ type: string; text?: string }> | undefined;
    const errorText = content?.find((c) => c.type === "text")?.text ?? "MCP tool error";
    throw new Error(errorText.slice(0, 300));
  }

  const result = data.result ?? {};
  if (Array.isArray(result.content)) {
    const textItem = (result.content as Array<{ type: string; text?: string }>).find((c) => c.type === "text");
    if (textItem?.text) {
      // Check if the text content is itself an error message
      if (textItem.text.startsWith("HTTP 4") || textItem.text.startsWith("HTTP 5") || textItem.text.includes("isError")) {
        throw new Error(textItem.text.slice(0, 300));
      }
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

// ── Symbol ID lookup (cTrader needs numeric symbolId, not name) ───────────────

// In-memory cache: symbol name → numeric symbolId
const symbolIdCache: Map<string, number> = new Map();

/** Search cached symbols by keyword — returns matching {name: id} pairs */
export function icSearchSymbols(keyword: string): Record<string, number> {
  const kw = keyword.toLowerCase();
  const results: Record<string, number> = {};
  for (const [name, id] of symbolIdCache.entries()) {
    if (name.toLowerCase().includes(kw)) results[name] = id;
  }
  return results;
}

export async function icGetSymbolId(symbolName: string): Promise<number | null> {
  if (symbolIdCache.has(symbolName)) return symbolIdCache.get(symbolName)!;
  try {
    // Try get_symbols tool first
    const result = await mcpCall("get_symbols", {}).catch(() => null);
    if (result) {
      const symbols = (result.symbols ?? result.data ?? result) as Array<Record<string, unknown>>;
      if (Array.isArray(symbols)) {
        console.log(`[IC Markets] get_symbols returned ${symbols.length} symbols, first 3:`, JSON.stringify(symbols.slice(0, 3)));
        for (const s of symbols) {
          const name = String(s.symbolName ?? s.name ?? s.symbol ?? "");
          const id = Number(s.symbolId ?? s.id ?? 0);
          if (name && id) symbolIdCache.set(name, id);
        }
        console.log(`[IC Markets] symbolIdCache keys (first 10):`, [...symbolIdCache.keys()].slice(0, 10).join(", "));
        if (symbolIdCache.has(symbolName)) return symbolIdCache.get(symbolName)!;
      } else {
        console.log(`[IC Markets] get_symbols result (not array):`, JSON.stringify(result).slice(0, 300));
      }
    }
    // Fallback: try find_symbol
    const r2 = await mcpCall("find_symbol", { symbolName }).catch(() => null);
    if (r2) {
      console.log(`[IC Markets] find_symbol(${symbolName}) result:`, JSON.stringify(r2).slice(0, 200));
      const id = Number(r2.symbolId ?? r2.id ?? 0);
      if (id) { symbolIdCache.set(symbolName, id); return id; }
    }
  } catch { /* fall through */ }
  console.warn(`[IC Markets] Could not resolve symbolId for ${symbolName}`);
  return null;
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
    // cTrader MCP requires numeric symbolId, not symbol name string
    const symbolId = await icGetSymbolId(symbol);
    if (!symbolId) {
      return { ok: false, error: `Could not resolve symbolId for ${symbol} — check cTrader symbol list` };
    }

    // cTrader MCP: absolute SL/TP not supported on MARKET orders at order time.
    // Place without SL/TP, then amend_position after fill.
    const params: Record<string, unknown> = {
      symbolId,
      tradeSide: direction,
      volume,
      orderType: "MARKET",
    };

    console.log(`[IC Markets MCP] create_order params: symbolId=${symbolId} (${symbol}) ${direction} vol=${volume}`);
    const result = await mcpCall("create_order", params);
    console.log("[IC Markets MCP] create_order raw:", JSON.stringify(result).slice(0, 300));

    // create_order may return orderId instead of positionId for market orders
    let positionId = String(result.positionId ?? result.dealId ?? result.id ?? "");
    const orderId = String(result.orderId ?? "");
    console.log(`[IC Markets MCP] create_order ids: positionId="${positionId}" orderId="${orderId}"`);

    // Amend SL/TP: need real positionId (not orderId). If empty, fetch from get_positions.
    if ((stopLoss || takeProfit)) {
      try {
        // Short wait for market order to fill
        await new Promise((r) => setTimeout(r, 1500));

        // If we don't have a positionId yet, find the newest position for this symbolId
        if (!positionId) {
          const posRes = await mcpCall("get_positions", {});
          const positions = (posRes.positions as Array<Record<string, unknown>>) ?? [];
          // Find newest position for this symbol
          const match = positions
            .filter((p) => Number(p.symbolId) === Number(symbolId))
            .sort((a, b) => Number(b.positionId ?? 0) - Number(a.positionId ?? 0))[0];
          if (match?.positionId) {
            positionId = String(match.positionId);
            console.log(`[IC Markets MCP] resolved positionId from get_positions: ${positionId}`);
          }
        }

        if (positionId) {
          const amendParams: Record<string, unknown> = { positionId: Number(positionId) };
          if (stopLoss) amendParams.stopLoss = stopLoss;
          if (takeProfit) amendParams.takeProfit = takeProfit;
          const amendResult = await mcpCall("amend_position", amendParams);
          console.log("[IC Markets MCP] amend_position raw:", JSON.stringify(amendResult).slice(0, 200));
        } else {
          console.warn("[IC Markets] Could not get positionId for amend — SL/TP not set");
        }
      } catch (amendErr) {
        console.warn("[IC Markets] amend_position failed (non-fatal):", amendErr instanceof Error ? amendErr.message : amendErr);
      }
    }

    return { ok: true, positionId };
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
