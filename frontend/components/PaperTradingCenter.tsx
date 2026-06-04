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
};

type PaperHistoryEvent = {
  id?: string;
  type?: string;
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


type TestTradePayload = {
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
    <div className={`bg-gray-950 ${border} border rounded-2xl p-6 min-h-[150px]`}>
      <h3 className="font-bold text-lg text-white">{title}</h3>
      <p className={`text-4xl mt-5 font-semibold ${accent}`}>{value}</p>
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
      <span className="text-gray-300">{label}</span>
      <span className={`font-bold text-right ${accent}`}>{value}</span>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-900 py-3">
      <span className="text-gray-400">{label}</span>
      <span className="font-bold text-white text-right">{value}</span>
    </div>
  );
}

function formatNumber(value: number | undefined, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

export default function PaperTradingCenter() {
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [history, setHistory] = useState<PaperHistoryEvent[]>([]);
  const [performance, setPerformance] = useState<PaperPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingTrade, setCreatingTrade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  async function loadPaperTradingData() {
    try {
      setLoading(true);
      setError(null);

      const [
        accountResponse,
        ordersResponse,
        positionsResponse,
        historyResponse,
        performanceResponse,
      ] = await Promise.all([
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

  async function createTestTrade(payload: TestTradePayload) {
    try {
      setCreatingTrade(true);
      setError(null);
      setLastAction(null);

      const response = await fetch("/api/paper/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Create paper trade failed: ${response.status}`);
      }

      await response.json();
      setLastAction(`${payload.symbol} ${payload.direction} paper trade created.`);
      await loadPaperTradingData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown create trade error"
      );
    } finally {
      setCreatingTrade(false);
    }
  }

  useEffect(() => {
    loadPaperTradingData();
  }, []);

  const currency = account?.currency ?? "USD";
  const openPositions = positions.filter((position) => position.status === "OPEN");
  const totalUnrealizedPnL = positions.reduce(
    (sum, position) => sum + (position.unrealizedPnL ?? 0),
    0
  );

  return (
    <section className="bg-gray-900 border border-purple-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-4xl font-black">📄 Paper Trading Center V10.2.8</h2>
          <p className="text-gray-400 text-xl mt-3">
            Eigenes Kontrollzentrum für Paper Account, Test Trades, Orders, Positions und History Events.
          </p>
        </div>

        <div className="bg-black border border-purple-800 rounded-2xl p-5 min-w-[210px]">
          <p className="text-gray-400">Engine Status</p>
          <p className="text-purple-400 text-2xl font-bold">
            {error ? "Check" : "Connected"}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-2xl p-5 mb-6">
          <p className="text-red-300 font-bold">{error}</p>
        </div>
      )}

      {lastAction && (
        <div className="bg-green-950 border border-green-800 rounded-2xl p-5 mb-6">
          <p className="text-green-300 font-bold">{lastAction}</p>
        </div>
      )}

      {loading && !account ? (
        <div className="bg-black border border-gray-800 rounded-2xl p-6">
          <p className="text-gray-400">Loading paper trading data...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-6 mb-8">
            <StatCard
              title="Balance"
              value={`${formatNumber(account?.balance)} ${currency}`}
              subtitle="Paper account balance"
              accent="text-green-400"
              border="border-green-900"
            />
            <StatCard
              title="Equity"
              value={`${formatNumber(account?.equity)} ${currency}`}
              subtitle="Paper account equity"
              accent="text-cyan-400"
              border="border-cyan-900"
            />
            <StatCard
              title="Open Positions"
              value={`${openPositions.length}`}
              subtitle="Currently active"
              accent="text-yellow-400"
              border="border-yellow-900"
            />
            <StatCard
              title="Orders"
              value={`${orders.length}`}
              subtitle="Created and filled"
              accent="text-blue-400"
              border="border-blue-900"
            />
            <StatCard
              title="History"
              value={`${history.length}`}
              subtitle="Recorded events"
              accent="text-purple-400"
              border="border-purple-900"
            />
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-black border border-gray-800 rounded-2xl p-6">
              <h3 className="text-2xl font-bold">💰 Account Overview</h3>
              <div className="mt-5">
                <DataRow label="Balance" value={`${formatNumber(account?.balance)} ${currency}`} />
                <DataRow label="Equity" value={`${formatNumber(account?.equity)} ${currency}`} />
                <DataRow label="Realized P/L" value={`${formatNumber(account?.realizedPnL)} ${currency}`} />
                <DataRow label="Unrealized P/L" value={`${formatNumber(account?.unrealizedPnL ?? totalUnrealizedPnL)} ${currency}`} />
              </div>
            </div>

            <div className="bg-black border border-gray-800 rounded-2xl p-6">
              <h3 className="text-2xl font-bold">🧪 Create Test Trade</h3>
              <p className="text-gray-400 mt-3">
                Erstellt direkt einen simulierten Trade über die Paper Orders API.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  disabled={creatingTrade}
                  onClick={() =>
                    createTestTrade({
                      symbol: "EURUSD",
                      direction: "LONG",
                      entry: 1.085,
                      stopLoss: 1.08,
                      takeProfit1: 1.09,
                      takeProfit2: 1.095,
                      confidence: 82,
                      reason: "V10.2.5 Paper Trading Center LONG test",
                      size: 1,
                    })
                  }
                  className="bg-green-950 border border-green-800 rounded-xl px-5 py-4 font-bold text-green-300 hover:bg-green-900 transition disabled:opacity-50"
                >
                  EURUSD LONG
                </button>

                <button
                  type="button"
                  disabled={creatingTrade}
                  onClick={() =>
                    createTestTrade({
                      symbol: "XAUUSD",
                      direction: "SHORT",
                      entry: 2350,
                      stopLoss: 2362,
                      takeProfit1: 2330,
                      takeProfit2: 2315,
                      confidence: 78,
                      reason: "V10.2.5 Paper Trading Center SHORT test",
                      size: 1,
                    })
                  }
                  className="bg-red-950 border border-red-800 rounded-xl px-5 py-4 font-bold text-red-300 hover:bg-red-900 transition disabled:opacity-50"
                >
                  XAUUSD SHORT
                </button>
              </div>

              <button
                type="button"
                onClick={loadPaperTradingData}
                className="mt-4 w-full bg-purple-950 border border-purple-800 rounded-xl px-5 py-4 font-bold text-purple-300 hover:bg-purple-900 transition"
              >
                Refresh Data
              </button>
            </div>

            <div className="bg-black border border-gray-800 rounded-2xl p-6">
              <h3 className="text-2xl font-bold">🔒 Safety Mode</h3>
              <div className="space-y-3 mt-5">
                <StatusPill label="Mode" value="Paper Only" accent="text-green-400" />
                <StatusPill label="Broker Orders" value="Blocked" accent="text-red-400" />
                <StatusPill label="Manual Approval" value="Later" accent="text-yellow-400" />
                <StatusPill label="AI Execution" value="Prepared" accent="text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-black border border-purple-900 rounded-2xl p-6 mb-8">
            <div className="flex items-start justify-between gap-6 mb-6">
              <div>
                <h3 className="text-2xl font-bold">📊 Performance Analytics V10.2.8</h3>
                <p className="text-gray-400 mt-2">
                  Live-Auswertung aus der Paper Performance API. Diese Werte werden später vom AI Learning Loop genutzt.
                </p>
              </div>

              <div className="bg-gray-950 border border-purple-800 rounded-xl p-4 min-w-[180px]">
                <p className="text-gray-400">Analytics Status</p>
                <p className="text-purple-400 text-xl font-bold">
                  {performance?.status ?? "Waiting"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-5 mb-6">
              <StatCard
                title="Total Trades"
                value={`${performance?.totalTrades ?? 0}`}
                subtitle="Filled paper trades"
                accent="text-blue-400"
                border="border-blue-900"
              />
              <StatCard
                title="Win Rate"
                value={`${performance?.winRate ?? 0}%`}
                subtitle="Current paper winrate"
                accent="text-green-400"
                border="border-green-900"
              />
              <StatCard
                title="Open Pos."
                value={`${performance?.openPositions ?? openPositions.length}`}
                subtitle="Active exposure"
                accent="text-yellow-400"
                border="border-yellow-900"
              />
              <StatCard
                title="Events"
                value={`${performance?.totalEvents ?? history.length}`}
                subtitle="History records"
                accent="text-purple-400"
                border="border-purple-900"
              />
              <StatCard
                title="Profit Factor"
                value={`${performance?.profitFactor ?? 0}`}
                subtitle="Needs closed trades"
                accent="text-cyan-400"
                border="border-cyan-900"
              />
              <StatCard
                title="Average RR"
                value={`${performance?.averageRR ?? 0}`}
                subtitle="Risk/reward avg"
                accent="text-orange-400"
                border="border-orange-900"
              />
            </div>

            <div className="grid grid-cols-4 gap-5">
              <StatusPill
                label="Orders Created"
                value={`${performance?.orderCreated ?? 0}`}
                accent="text-blue-400"
              />
              <StatusPill
                label="Orders Filled"
                value={`${performance?.orderFilled ?? 0}`}
                accent="text-green-400"
              />
              <StatusPill
                label="Position Updates"
                value={`${performance?.positionUpdates ?? 0}`}
                accent="text-yellow-400"
              />
              <StatusPill
                label="Updated"
                value={
                  performance?.updatedAt
                    ? new Date(performance.updatedAt).toLocaleTimeString()
                    : "Waiting"
                }
                accent="text-gray-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-black border border-gray-800 rounded-2xl p-6">
              <h3 className="text-2xl font-bold">📦 Order Feed</h3>
              <div className="space-y-3 mt-5 max-h-[420px] overflow-auto pr-1">
                {orders.slice().reverse().map((order) => (
                  <div key={order.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-white">{order.symbol} {order.direction}</p>
                      <p className="text-blue-400 font-bold">{order.status}</p>
                    </div>
                    <p className="text-gray-400 mt-2">Entry: {order.entry}</p>
                    <p className="text-gray-500 text-sm mt-1">{order.reason ?? "Paper order"}</p>
                  </div>
                ))}

                {orders.length === 0 && (
                  <p className="text-gray-500">No paper orders yet.</p>
                )}
              </div>
            </div>

            <div className="bg-black border border-gray-800 rounded-2xl p-6">
              <h3 className="text-2xl font-bold">📈 Position Feed</h3>
              <div className="space-y-3 mt-5 max-h-[420px] overflow-auto pr-1">
                {positions.slice().reverse().map((position) => (
                  <div key={position.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-white">{position.symbol} {position.direction}</p>
                      <p className={position.status === "OPEN" ? "text-green-400 font-bold" : "text-gray-400 font-bold"}>
                        {position.status}
                      </p>
                    </div>
                    <p className="text-gray-400 mt-2">Entry: {position.entry}</p>
                    <p className="text-gray-400 mt-1">Size: {position.size ?? 1}</p>
                    <p className="text-purple-400 mt-1">
                      Unrealized P/L: {formatNumber(position.unrealizedPnL)} {currency}
                    </p>
                  </div>
                ))}

                {positions.length === 0 && (
                  <p className="text-gray-500">No paper positions yet.</p>
                )}
              </div>
            </div>

            <div className="bg-black border border-gray-800 rounded-2xl p-6">
              <h3 className="text-2xl font-bold">🧠 History Feed</h3>
              <div className="space-y-3 mt-5 max-h-[420px] overflow-auto pr-1">
                {history.slice().reverse().map((event, index) => (
                  <div key={`${event.timestamp ?? "event"}-${index}`} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                    <p className="font-bold text-purple-400">{event.type ?? event.event ?? "EVENT"}</p>
                    <p className="text-gray-500 text-sm mt-2">
                      {event.timestamp ?? "No timestamp"}
                    </p>
                  </div>
                ))}

                {history.length === 0 && (
                  <p className="text-gray-500">No history events yet.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
