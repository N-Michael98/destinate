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
};

type PaperPosition = {
  id: string;
  symbol: string;
  direction: string;
  status: string;
  entry: number;
  currentPrice?: number;
  unrealizedPnL?: number;
};

type PaperHistoryEvent = {
  id?: string;
  type?: string;
  event?: string;
  timestamp?: string;
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
    <div className="bg-black border border-gray-800 rounded-xl p-4 flex items-center justify-between">
      <span className="text-gray-300">{label}</span>
      <span className={`font-bold ${accent}`}>{value}</span>
    </div>
  );
}

export default function PaperTradingDashboardPanel() {
  const [account, setAccount] = useState<PaperAccount | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [history, setHistory] = useState<PaperHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPaperTradingData() {
    try {
      setLoading(true);
      setError(null);

      const [accountResponse, ordersResponse, positionsResponse, historyResponse] =
        await Promise.all([
          fetch("/api/paper/account", { cache: "no-store" }),
          fetch("/api/paper/orders", { cache: "no-store" }),
          fetch("/api/paper/positions", { cache: "no-store" }),
          fetch("/api/paper/history", { cache: "no-store" }),
        ]);

      if (!accountResponse.ok) {
        throw new Error("Paper account request failed");
      }

      if (!ordersResponse.ok) {
        throw new Error("Paper orders request failed");
      }

      if (!positionsResponse.ok) {
        throw new Error("Paper positions request failed");
      }

      if (!historyResponse.ok) {
        throw new Error("Paper history request failed");
      }

      const accountPayload = await accountResponse.json();
      const ordersPayload = await ordersResponse.json();
      const positionsPayload = await positionsResponse.json();
      const historyPayload = await historyResponse.json();

      setAccount(accountPayload.account);
      setOrders(ordersPayload.orders ?? []);
      setPositions(positionsPayload.positions ?? []);
      setHistory(historyPayload.history ?? []);
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

  useEffect(() => {
    loadPaperTradingData();

    const interval = window.setInterval(() => {
      loadPaperTradingData();
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <section className="bg-gray-900 border border-purple-900 rounded-2xl p-7 mb-8">
        <h3 className="text-3xl font-bold">📄 Paper Trading Dashboard V10.2.4</h3>
        <p className="text-gray-400 mt-3">Loading paper trading engine...</p>
      </section>
    );
  }

  if (error || !account) {
    return (
      <section className="bg-gray-900 border border-red-900 rounded-2xl p-7 mb-8">
        <h3 className="text-3xl font-bold">📄 Paper Trading Dashboard V10.2.4</h3>
        <p className="text-red-400 mt-3">
          {error ?? "No paper account data available."}
        </p>
        <button
          type="button"
          onClick={loadPaperTradingData}
          className="mt-5 bg-red-950 border border-red-800 rounded-xl px-5 py-3 font-bold text-red-300"
        >
          Retry
        </button>
      </section>
    );
  }

  const openPositions = positions.filter(
    (position) => position.status === "OPEN"
  ).length;

  const currency = account.currency ?? "USD";

  return (
    <section className="bg-gray-900 border border-purple-900 rounded-2xl p-7 mb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-3xl font-bold">📄 Paper Trading Dashboard V10.2.4</h3>
          <p className="text-gray-400 mt-2">
            Live verbunden mit Paper Account, Orders, Positions und History API.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPaperTradingData}
          className="bg-purple-950 border border-purple-800 rounded-xl px-5 py-3 font-bold text-purple-300 hover:bg-purple-900 transition"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-6">
        <StatCard
          title="Balance"
          value={`${account.balance} ${currency}`}
          subtitle="Paper account"
          accent="text-green-400"
          border="border-green-900"
        />
        <StatCard
          title="Equity"
          value={`${account.equity} ${currency}`}
          subtitle="Live paper equity"
          accent="text-cyan-400"
          border="border-cyan-900"
        />
        <StatCard
          title="Open Positions"
          value={`${openPositions}`}
          subtitle="Paper positions"
          accent="text-yellow-400"
          border="border-yellow-900"
        />
        <StatCard
          title="Orders"
          value={`${orders.length}`}
          subtitle="Created + filled"
          accent="text-blue-400"
          border="border-blue-900"
        />
        <StatCard
          title="History Events"
          value={`${history.length}`}
          subtitle="Trading events"
          accent="text-purple-400"
          border="border-purple-900"
        />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="bg-black border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold">📦 Latest Orders</h4>
          <div className="space-y-3 mt-4">
            {orders.slice(-3).map((order) => (
              <StatusPill
                key={order.id}
                label={`${order.symbol} ${order.direction}`}
                value={order.status}
                accent="text-blue-400"
              />
            ))}

            {orders.length === 0 && (
              <p className="text-gray-500">No paper orders yet.</p>
            )}
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold">📈 Open Positions</h4>
          <div className="space-y-3 mt-4">
            {positions.slice(-3).map((position) => (
              <StatusPill
                key={position.id}
                label={`${position.symbol} ${position.direction}`}
                value={position.status}
                accent={
                  position.status === "OPEN"
                    ? "text-green-400"
                    : "text-gray-400"
                }
              />
            ))}

            {positions.length === 0 && (
              <p className="text-gray-500">No paper positions yet.</p>
            )}
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-5">
          <h4 className="text-xl font-bold">🧠 History Feed</h4>
          <div className="space-y-3 mt-4">
            {history.slice(-3).map((event, index) => (
              <StatusPill
                key={`${event.timestamp ?? "event"}-${index}`}
                label={event.type ?? event.event ?? "EVENT"}
                value="Logged"
                accent="text-purple-400"
              />
            ))}

            {history.length === 0 && (
              <p className="text-gray-500">No history events yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}