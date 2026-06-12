"use client";

import React, { useEffect, useState } from "react";

type BrokerSlot = "capital" | "broker2";

type PaperAccount = {
  balance: number;
  equity: number;
  realizedPnL: number;
  unrealizedPnL: number;
  currency?: string;
};

type PaperOrder = {
  id: string;
  symbol: string;
  direction: string;
  status: string;
  entry: number;
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  confidence?: number;
  reason?: string;
  createdAt?: string;
};

type PaperPosition = {
  id: string;
  orderId?: string;
  symbol: string;
  direction: string;
  status: string;
  entry: number;
  currentPrice?: number;
  size?: number;
  unrealizedPnL?: number;
  openedAt?: string;
};

type PaperHistoryEvent = {
  id?: string;
  type?: string;
  entity?: string;
  event?: string;
  timestamp?: string;
  payload?: unknown;
};

type PaperPerformance = {
  version: string;
  totalEvents: number;
  totalTrades: number;
  orderCreated: number;
  orderFilled: number;
  openPositions: number;
  positionUpdates: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  realizedPnL: number;
  unrealizedPnL: number;
  profitFactor: number;
  averageRR: number;
  bestTrade: unknown;
  worstTrade: unknown;
  status: string;
  updatedAt: string;
};

type TradeTemplate = {
  label: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  confidence: number;
  reason: string;
  size: number;
};

const tradeTemplates: TradeTemplate[] = [
  {
    label: "EURUSD LONG",
    symbol: "EURUSD",
    direction: "LONG",
    entry: 1.085,
    stopLoss: 1.08,
    takeProfit1: 1.09,
    takeProfit2: 1.095,
    confidence: 82,
    reason: "V10.2 Paper Trading Center test trade",
    size: 1,
  },
  {
    label: "XAUUSD SHORT",
    symbol: "XAUUSD",
    direction: "SHORT",
    entry: 2350,
    stopLoss: 2365,
    takeProfit1: 2330,
    takeProfit2: 2315,
    confidence: 78,
    reason: "V10.2 Paper Trading Center gold test trade",
    size: 1,
  },
];

const BROKER_LABELS: Record<BrokerSlot, { label: string; icon: string; color: string }> = {
  capital: { label: "Capital.com", icon: "🏦", color: "#6366f1" },
  broker2: { label: "Broker 2", icon: "🏢", color: "#10b981" },
};

function StatCard({
  title,
  value,
  subtitle,
  accent = "text-blue-400",
  border = "border-blue-900",
}: {
  title: string;
  value: string;
  subtitle: string;
  accent?: string;
  border?: string;
}) {
  return (
    <div className={`bg-gray-950 ${border} border rounded-2xl p-6 min-h-[145px]`}>
      <h3 className="font-bold text-lg text-white">{title}</h3>
      <p className={`text-3xl mt-5 font-semibold ${accent}`}>{value}</p>
      <p className="text-gray-400 mt-3">{subtitle}</p>
    </div>
  );
}

function StatusPill({
  label,
  value,
  accent = "text-green-400",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-black border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
      <span className="text-gray-300 truncate">{label}</span>
      <span className={`font-bold ${accent}`}>{value}</span>
    </div>
  );
}

function formatNumber(value: unknown, digits = 2) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "0";
  return number.toFixed(digits);
}

export default function PaperTradingCenter() {
  const [activeBroker, setActiveBroker] = useState<BrokerSlot>("capital");
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [history, setHistory] = useState<PaperHistoryEvent[]>([]);
  const [performance, setPerformance] = useState<PaperPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [marketSymbol, setMarketSymbol] = useState("EURUSD");
  const [marketPrice, setMarketPrice] = useState("1.0900");

  function url(path: string) {
    return `${path}?broker=${activeBroker}`;
  }

  async function loadPaperData() {
    try {
      setLoading(true);
      setError(null);

      const [accountRes, ordersRes, positionsRes, historyRes, perfRes] = await Promise.all([
        fetch(url("/api/paper/account"), { cache: "no-store" }),
        fetch(url("/api/paper/orders"), { cache: "no-store" }),
        fetch(url("/api/paper/positions"), { cache: "no-store" }),
        fetch(url("/api/paper/history"), { cache: "no-store" }),
        fetch(url("/api/paper/performance"), { cache: "no-store" }),
      ]);

      if (!accountRes.ok) throw new Error("Paper account request failed");

      const [aData, oData, pData, hData, perfData] = await Promise.all([
        accountRes.json(), ordersRes.json(), positionsRes.json(), historyRes.json(), perfRes.json(),
      ]);

      setAccount(aData.account);
      setOrders(oData.orders ?? []);
      setPositions(pData.positions ?? []);
      setHistory(hData.history ?? []);
      setPerformance(perfData.performance ?? null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unknown paper trading error");
    } finally {
      setLoading(false);
    }
  }

  async function createTestTrade(template: TradeTemplate) {
    try {
      setActionLoading(true);
      setMessage(null);
      setError(null);

      const response = await fetch(url("/api/paper/orders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Failed to create test trade");

      setMarketSymbol(template.symbol);
      setMarketPrice(String(template.entry));
      setMessage(`${template.label} created and filled.`);
      await loadPaperData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unknown create trade error");
    } finally {
      setActionLoading(false);
    }
  }

  async function updateMarketPrice() {
    try {
      setMarketLoading(true);
      setMessage(null);
      setError(null);

      const response = await fetch(url("/api/paper/market-update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: marketSymbol.toUpperCase(), price: Number(marketPrice) }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Failed to update market price");

      setMessage(`${marketSymbol.toUpperCase()} updated to ${marketPrice}.`);
      await loadPaperData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unknown market update error");
    } finally {
      setMarketLoading(false);
    }
  }

  useEffect(() => {
    loadPaperData();
    const interval = window.setInterval(() => loadPaperData(), 15000);
    return () => window.clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBroker]);

  const currency = account?.currency ?? "USD";
  const openPositions = positions.filter((p) => p.status === "OPEN");
  const latestHistory = [...history].slice(-6).reverse();
  const latestOrders = [...orders].slice(-5).reverse();
  const latestPositions = [...positions].slice(-5).reverse();

  const brokerMeta = BROKER_LABELS[activeBroker];

  return (
    <section className="bg-gray-900 border border-purple-900 rounded-2xl p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h2 className="text-4xl font-black">📄 Paper Trading Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Zentrale Paper-Trading-Engine für Orders, Positions, History, Performance und Market Simulation.
          </p>
        </div>
        <div className="bg-black border border-purple-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Center Version</p>
          <p className="text-purple-400 text-2xl font-bold">V10.3.0</p>
        </div>
      </div>

      {/* Broker Tab Selector */}
      <div className="flex gap-3 mb-8">
        {(["capital", "broker2"] as BrokerSlot[]).map((slot) => {
          const meta = BROKER_LABELS[slot];
          const active = activeBroker === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => { setActiveBroker(slot); setMessage(null); setError(null); }}
              style={{
                padding: "10px 22px",
                borderRadius: "10px",
                border: `1px solid ${active ? meta.color : "rgba(255,255,255,0.1)"}`,
                background: active ? `${meta.color}22` : "rgba(0,0,0,0.3)",
                color: active ? meta.color : "#94a3b8",
                fontFamily: "monospace",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {meta.icon} {meta.label}
              {active && (
                <span style={{
                  marginLeft: "8px", padding: "1px 7px", borderRadius: "4px",
                  background: meta.color, color: "#fff", fontSize: "10px",
                }}>
                  AKTIV
                </span>
              )}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px" }}>
          <span style={{ fontSize: "11px", color: "#64748b" }}>GETRENNTE KONTEN & HISTORY PRO BROKER</span>
        </div>
      </div>

      {loading && (
        <div className="bg-black border border-gray-800 rounded-2xl p-6 mb-8">
          <p className="text-gray-400">Loading paper trading data ({brokerMeta.label})...</p>
        </div>
      )}
      {error && (
        <div className="bg-black border border-red-900 rounded-2xl p-6 mb-8">
          <p className="text-red-400 font-bold">{error}</p>
        </div>
      )}
      {message && (
        <div className="bg-black border border-green-900 rounded-2xl p-6 mb-8">
          <p className="text-green-400 font-bold">{message}</p>
        </div>
      )}

      {/* Balance info banner */}
      <div style={{
        marginBottom: "20px", padding: "10px 18px", borderRadius: "10px",
        background: `${brokerMeta.color}11`, border: `1px solid ${brokerMeta.color}33`,
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <span style={{ fontSize: "18px" }}>{brokerMeta.icon}</span>
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
          <b style={{ color: brokerMeta.color }}>{brokerMeta.label}</b>
          {" — Balance wird beim Verbinden automatisch mit dem echten Broker-Konto synchronisiert."}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard title="Balance" value={`${formatNumber(account?.balance)} ${currency}`} subtitle="Paper account" accent="text-green-400" border="border-green-900" />
        <StatCard title="Equity" value={`${formatNumber(account?.equity)} ${currency}`} subtitle="Live paper equity" accent="text-cyan-400" border="border-cyan-900" />
        <StatCard title="Realized P/L" value={`${formatNumber(account?.realizedPnL)} ${currency}`} subtitle="Closed trade PnL" accent="text-blue-400" border="border-blue-900" />
        <StatCard
          title="Unrealized P/L"
          value={`${formatNumber(account?.unrealizedPnL)} ${currency}`}
          subtitle="Open position PnL"
          accent={Number(account?.unrealizedPnL ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
          border={Number(account?.unrealizedPnL ?? 0) >= 0 ? "border-green-900" : "border-red-900"}
        />
        <StatCard title="Open Positions" value={`${openPositions.length}`} subtitle="Active simulated trades" accent="text-yellow-400" border="border-yellow-900" />
      </div>

      {/* Market Simulation */}
      <div className="bg-black border border-indigo-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">📈 Market Simulation V10.3.0</h3>
            <p className="text-gray-400 mt-2">
              Aktualisiert simulierte Marktpreise über <span className="text-indigo-400">/api/paper/market-update?broker={activeBroker}</span>.
            </p>
          </div>
          <button type="button" onClick={loadPaperData} className="bg-gray-950 border border-gray-700 rounded-xl px-5 py-3 font-bold text-gray-300 hover:bg-gray-900 transition">
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-4 gap-5 items-end">
          <div>
            <label className="text-gray-400 font-bold">Symbol</label>
            <input value={marketSymbol} onChange={(e) => setMarketSymbol(e.target.value)} className="mt-2 w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-700" placeholder="EURUSD" />
          </div>
          <div>
            <label className="text-gray-400 font-bold">Current Price</label>
            <input value={marketPrice} onChange={(e) => setMarketPrice(e.target.value)} className="mt-2 w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-700" placeholder="1.0900" />
          </div>
          <button type="button" onClick={updateMarketPrice} disabled={marketLoading} className="bg-indigo-950 border border-indigo-800 rounded-xl px-5 py-3 font-bold text-indigo-300 hover:bg-indigo-900 transition disabled:opacity-50">
            {marketLoading ? "Updating..." : "Update Market"}
          </button>
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400">Target</p>
            <p className="text-indigo-400 text-xl font-bold">{marketSymbol.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="bg-black border border-blue-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">📊 Performance Analytics</h3>
            <p className="text-gray-400 mt-2">
              Live aus <span className="text-blue-400">/api/paper/performance?broker={activeBroker}</span>.
            </p>
          </div>
          <div className="bg-gray-950 border border-blue-800 rounded-xl p-4 min-w-[170px]">
            <p className="text-gray-400">Analytics</p>
            <p className="text-blue-400 text-2xl font-bold">{performance?.status ?? "Ready"}</p>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-5">
          <StatCard title="Total Trades" value={`${performance?.totalTrades ?? 0}`} subtitle="Filled orders" accent="text-blue-400" border="border-blue-900" />
          <StatCard title="Win Rate" value={`${performance?.winRate ?? 0}%`} subtitle="Based on updates" accent="text-green-400" border="border-green-900" />
          <StatCard title="Events" value={`${performance?.totalEvents ?? 0}`} subtitle="History records" accent="text-purple-400" border="border-purple-900" />
          <StatCard title="Position Updates" value={`${performance?.positionUpdates ?? 0}`} subtitle="Market updates" accent="text-indigo-400" border="border-indigo-900" />
          <StatCard title="Profit Factor" value={`${performance?.profitFactor ?? 0}`} subtitle="Prepared metric" accent="text-yellow-400" border="border-yellow-900" />
          <StatCard title="Average RR" value={`${performance?.averageRR ?? 0}`} subtitle="Prepared metric" accent="text-cyan-400" border="border-cyan-900" />
        </div>
      </div>

      {/* Test Trades + Safety */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🧪 Create Test Trade</h3>
          <p className="text-gray-400 mt-2">Erstellt eine simulierte Order für <b style={{ color: brokerMeta.color }}>{brokerMeta.label}</b> und füllt sie sofort.</p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            {tradeTemplates.map((template) => (
              <button key={template.label} type="button" onClick={() => createTestTrade(template)} disabled={actionLoading}
                className="bg-purple-950 border border-purple-800 rounded-xl px-5 py-4 font-bold text-purple-300 hover:bg-purple-900 transition disabled:opacity-50">
                {actionLoading ? "Creating..." : template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🛡 Safety Rules</h3>
          <div className="space-y-3 mt-5">
            <StatusPill label="Mode" value="Paper Only" accent="text-green-400" />
            <StatusPill label="Broker Execution" value="Blocked" accent="text-red-400" />
            <StatusPill label="Live Orders" value="Disabled" accent="text-red-400" />
            <StatusPill label="Active Broker Slot" value={brokerMeta.label} accent="text-blue-400" />
          </div>
        </div>
      </div>

      {/* Feeds */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">📦 Order Feed</h3>
          <div className="space-y-3 mt-5">
            {latestOrders.map((order) => (
              <div key={order.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-bold text-white">{order.symbol} {order.direction}</p>
                  <p className="text-blue-400 font-bold">{order.status}</p>
                </div>
                <p className="text-gray-400 mt-2">Entry: {order.entry}</p>
                <p className="text-gray-500 mt-1 text-sm">{order.reason ?? "No reason"}</p>
              </div>
            ))}
            {latestOrders.length === 0 && <p className="text-gray-500">No paper orders yet.</p>}
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">📈 Position Feed</h3>
          <div className="space-y-3 mt-5">
            {latestPositions.map((position) => (
              <div key={position.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-bold text-white">{position.symbol} {position.direction}</p>
                  <p className={position.status === "OPEN" ? "text-green-400 font-bold" : "text-gray-400 font-bold"}>{position.status}</p>
                </div>
                <p className="text-gray-400 mt-2">Entry: {position.entry}</p>
                <p className="text-gray-400 mt-1">Current: {position.currentPrice ?? "Not updated"}</p>
                <p className={Number(position.unrealizedPnL ?? 0) >= 0 ? "text-green-400 mt-1" : "text-red-400 mt-1"}>
                  PnL: {formatNumber(position.unrealizedPnL)} {currency}
                </p>
              </div>
            ))}
            {latestPositions.length === 0 && <p className="text-gray-500">No paper positions yet.</p>}
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🧠 History Feed</h3>
          <div className="space-y-3 mt-5">
            {latestHistory.map((item, index) => (
              <div key={item.id ?? `${item.timestamp}-${index}`} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                <p className="font-bold text-purple-400">{item.type ?? item.event ?? "EVENT"}</p>
                <p className="text-gray-400 mt-2">{item.entity ?? "SYSTEM"}</p>
                <p className="text-gray-500 mt-1 text-sm">{item.timestamp ?? "No timestamp"}</p>
              </div>
            ))}
            {latestHistory.length === 0 && <p className="text-gray-500">No history events yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
