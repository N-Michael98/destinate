/**
 * IC Markets session state — persisted in Redis like Capital.com.
 * Survives server restarts and Railway redeploys.
 */

interface ICMarketsSession {
  accountId: string;
  balance: number;
  equity: number;
  currency: string;
  connectedAt: string;
  leverage: number;
}

const REDIS_KEY = "icmarkets:session";
const REDIS_TTL_SEC = 60 * 60 * 24 * 30; // 30 days — only expires on Disconnect

declare global {
  var __redis_client__: import("redis").RedisClientType | null | undefined;
  var __icmarkets_session__: ICMarketsSession | null | undefined;
}

if (global.__icmarkets_session__ === undefined) global.__icmarkets_session__ = null;

async function getRedis(): Promise<import("redis").RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    if (global.__redis_client__) return global.__redis_client__;
    const { createClient } = await import("redis");
    const client = createClient({ url }) as import("redis").RedisClientType;
    await client.connect();
    global.__redis_client__ = client;
    return client;
  } catch { return null; }
}

async function saveToRedis(s: ICMarketsSession): Promise<void> {
  try {
    const r = await getRedis();
    if (r) await r.set(REDIS_KEY, JSON.stringify(s), { EX: REDIS_TTL_SEC });
  } catch { /* non-fatal */ }
}

async function loadFromRedis(): Promise<ICMarketsSession | null> {
  try {
    const r = await getRedis();
    if (!r) return null;
    const raw = await r.get(REDIS_KEY);
    return raw ? (JSON.parse(raw) as ICMarketsSession) : null;
  } catch { return null; }
}

async function clearFromRedis(): Promise<void> {
  try {
    const r = await getRedis();
    if (r) await r.del(REDIS_KEY);
  } catch { /* non-fatal */ }
}

export function getICMarketsSession(): ICMarketsSession | null {
  return global.__icmarkets_session__ ?? null;
}

export async function setICMarketsSession(s: ICMarketsSession): Promise<void> {
  global.__icmarkets_session__ = s;
  await saveToRedis(s);
  console.log(`[IC Markets] Session saved to Redis — balance: ${s.currency} ${s.balance}`);
}

export async function clearICMarketsSession(): Promise<void> {
  global.__icmarkets_session__ = null;
  await clearFromRedis();
  console.log("[IC Markets] Session cleared from Redis");
}

export function isICMarketsConnected(): boolean {
  return global.__icmarkets_session__ !== null;
}

/** Called on server startup — restores session from Redis if available */
export async function restoreICMarketsSessionFromRedis(): Promise<boolean> {
  if (global.__icmarkets_session__) return true;
  const session = await loadFromRedis();
  if (session) {
    global.__icmarkets_session__ = session;
    console.log(`[IC Markets] Redis session restored ⚡ balance: ${session.currency} ${session.balance}`);
    return true;
  }
  return false;
}

/** Auto-reconnect using ICMARKETS_MCP_TOKEN from env — like Capital.com autoReconnect */
export async function autoReconnectICMarkets(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { icGetAccount, isICMarketsConfigured } = await import("./icmarkets-client");
    if (!isICMarketsConfigured()) {
      return { ok: false, error: "ICMARKETS_MCP_TOKEN not set in Railway env vars" };
    }
    const account = await icGetAccount();
    if (!account.ok) return { ok: false, error: account.error };
    const leverage = Number(process.env.ICMARKETS_LEVERAGE ?? 500);
    await setICMarketsSession({
      accountId: account.accountId ?? "",
      balance: account.balance ?? 0,
      equity: account.equity ?? 0,
      currency: account.currency ?? "CHF",
      connectedAt: new Date().toISOString(),
      leverage,
    });
    console.log(`[IC Markets] Auto-reconnected ⚡ balance: ${account.currency} ${account.balance}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Keep-alive ping — refreshes balance + re-initializes MCP session if dropped */
export async function keepAliveICMarkets(): Promise<void> {
  try {
    const { icGetAccount, isICMarketsConfigured } = await import("./icmarkets-client");
    if (!isICMarketsConfigured()) return;
    const account = await icGetAccount();
    if (!account.ok) {
      console.warn(`[IC Markets] Keep-alive failed (${account.error}) — attempting reconnect`);
      await autoReconnectICMarkets();
      return;
    }
    // Update balance in session
    if (global.__icmarkets_session__) {
      global.__icmarkets_session__.balance = account.balance ?? global.__icmarkets_session__.balance;
      global.__icmarkets_session__.equity = account.equity ?? global.__icmarkets_session__.equity;
      await saveToRedis(global.__icmarkets_session__);
    }
    console.log(`[IC Markets] keep-alive ✅ balance=${account.balance}`);
  } catch { /* non-fatal */ }
}
