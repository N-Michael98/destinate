"use client";

import React, { useEffect, useState } from "react";

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

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toFixed(digits);
}

export default function PaperTradingCenter() {
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

  async function loadPaperData() {
    try {
      setLoading(true);
      setError(null);

      const [accountResponse, ordersResponse, positionsResponse, historyResponse, performanceResponse] =
        await Promise.all([
          fetch("/api/paper/account", { cache: "no-store" }),
          fetch("/api/paper/orders", { cache: "no-store" }),
          fetch("/api/paper/positions", { cache: "no-store" }),
          fetch("/api/paper/history", { cache: "no-store" }),
          fetch("/api/paper/performance", { cache: "no-store" }),
        ]);

      if (!accountResponse.ok) throw new Error("Paper account request failed");
      if (!ordersResponse.ok) throw new Error("Paper orders request failed");
      if (!positionsResponse.ok) throw new Error("Paper positions request failed");
      if (!historyResponse.ok) throw new Error("Paper history request failed");
      if (!performanceResponse.ok) throw new Error("Paper performance request failed");

      const accountPayload = await accountResponse.json();
      const ordersPayload = await ordersResponse.json();
      const positionsPayload = await positionsResponse.json();
      const historyPayload = await historyResponse.json();
      const performancePayload = await performanceResponse.json();

      setAccount(accountPayload.account);
      setOrders(ordersPayload.orders ?? []);
      setPositions(positionsPayload.positions ?? []);
      setHistory(historyPayload.history ?? []);
      setPerformance(performancePayload.performance ?? null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown paper trading error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function createTestTrade(template: TradeTemplate) {
    try {
      setActionLoading(true);
      setMessage(null);
      setError(null);

      const response = await fetch("/api/paper/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(template),
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to create test trade");
      }

      setMarketSymbol(template.symbol);
      setMarketPrice(String(template.entry));
      setMessage(`${template.label} created and filled.`);
      await loadPaperData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown create trade error"
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function updateMarketPrice() {
    try {
      setMarketLoading(true);
      setMessage(null);
      setError(null);

      const response = await fetch("/api/paper/market-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: marketSymbol.toUpperCase(),
          price: Number(marketPrice),
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to update market price");
      }

      setMessage(`${marketSymbol.toUpperCase()} updated to ${marketPrice}.`);
      await loadPaperData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown market update error"
      );
    } finally {
      setMarketLoading(false);
    }
  }

  useEffect(() => {
    loadPaperData();

    const interval = window.setInterval(() => {
      loadPaperData();
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  const currency = account?.currency ?? "USD";
  const openPositions = positions.filter((position) => position.status === "OPEN");
  const latestHistory = [...history].slice(-6).reverse();
  const latestOrders = [...orders].slice(-5).reverse();
  const latestPositions = [...positions].slice(-5).reverse();

  return (
    <section className="bg-gray-900 border border-purple-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black">📄 Paper Trading Center</h2>
          <p className="text-gray-400 text-xl mt-3">
            Zentrale Paper-Trading-Engine für Orders, Positions, History, Performance und Market Simulation.
          </p>
        </div>

        <div className="bg-black border border-purple-800 rounded-2xl p-5 min-w-[190px]">
          <p className="text-gray-400">Center Version</p>
          <p className="text-purple-400 text-2xl font-bold">V10.2.10</p>
        </div>
      </div>

      {loading && (
        <div className="bg-black border border-gray-800 rounded-2xl p-6 mb-8">
          <p className="text-gray-400">Loading paper trading data...</p>
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

      <div className="grid grid-cols-5 gap-6 mb-8">
        <StatCard
          title="Balance"
          value={`${formatNumber(account?.balance)} ${currency}`}
          subtitle="Paper account"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Equity"
          value={`${formatNumber(account?.equity)} ${currency}`}
          subtitle="Live paper equity"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Realized P/L"
          value={`${formatNumber(account?.realizedPnL)} ${currency}`}
          subtitle="Closed trade PnL"
          accent="text-blue-400"
          border="border-blue-900"
        />
        <StatCard
          title="Unrealized P/L"
          value={`${formatNumber(account?.unrealizedPnL)} ${currency}`}
          subtitle="Open position PnL"
          accent={Number(account?.unrealizedPnL ?? 0) >= 0 ? "text-green-400" : "text-red-400"}
          border={Number(account?.unrealizedPnL ?? 0) >= 0 ? "border-green-900" : "border-red-900"}
        />
        <StatCard
          title="Open Positions"
          value={`${openPositions.length}`}
          subtitle="Active simulated trades"
          accent="text-yellow-400"
          border="border-yellow-900"
        />
      </div>

      <div className="bg-black border border-indigo-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">📈 Market Simulation V10.2.10</h3>
            <p className="text-gray-400 mt-2">
              Aktualisiert simulierte Marktpreise über <span className="text-indigo-400">/api/paper/market-update</span> und schreibt Updates in History, Positions und Account.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPaperData}
            className="bg-gray-950 border border-gray-700 rounded-xl px-5 py-3 font-bold text-gray-300 hover:bg-gray-900 transition"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-4 gap-5 items-end">
          <div>
            <label className="text-gray-400 font-bold">Symbol</label>
            <input
              value={marketSymbol}
              onChange={(event) => setMarketSymbol(event.target.value)}
              className="mt-2 w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-700"
              placeholder="EURUSD"
            />
          </div>

          <div>
            <label className="text-gray-400 font-bold">Current Price</label>
            <input
              value={marketPrice}
              onChange={(event) => setMarketPrice(event.target.value)}
              className="mt-2 w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-700"
              placeholder="1.0900"
            />
          </div>

          <button
            type="button"
            onClick={updateMarketPrice}
            disabled={marketLoading}
            className="bg-indigo-950 border border-indigo-800 rounded-xl px-5 py-3 font-bold text-indigo-300 hover:bg-indigo-900 transition disabled:opacity-50"
          >
            {marketLoading ? "Updating..." : "Update Market"}
          </button>

          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400">Target Position</p>
            <p className="text-indigo-400 text-xl font-bold">{marketSymbol.toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="bg-black border border-blue-900 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h3 className="text-3xl font-bold">📊 Performance Analytics</h3>
            <p className="text-gray-400 mt-2">
              Live aus <span className="text-blue-400">/api/paper/performance</span> für Trading-Qualität, Events und Lernmetriken.
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

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <h3 className="text-2xl font-bold">🧪 Create Test Trade</h3>
          <p className="text-gray-400 mt-2">
            Erstellt eine simulierte Order, füllt sie sofort und öffnet eine Paper Position.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            {tradeTemplates.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => createTestTrade(template)}
                disabled={actionLoading}
                className="bg-purple-950 border border-purple-800 rounded-xl px-5 py-4 font-bold text-purple-300 hover:bg-purple-900 transition disabled:opacity-50"
              >
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
            <StatusPill label="Manual Refresh" value="Enabled" accent="text-blue-400" />
          </div>
        </div>
      </div>

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
