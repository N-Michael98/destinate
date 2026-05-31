"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trades } from "../data/trades";

function getTotalProfit(data: typeof trades) {
  return data.reduce((sum, trade) => sum + trade.profitLoss, 0);
}

function getWinrate(data: typeof trades) {
  const closed = data.filter((trade) => trade.status === "CLOSED");
  if (closed.length === 0) return 0;

  const wins = closed.filter((trade) => trade.result === "WIN").length;
  return Math.round((wins / closed.length) * 100);
}

function getAverageWinner(data: typeof trades) {
  const winners = data.filter((trade) => trade.profitLoss > 0);
  if (winners.length === 0) return 0;

  return Math.round(
    winners.reduce((sum, trade) => sum + trade.profitLoss, 0) /
      winners.length
  );
}

function getAverageLoser(data: typeof trades) {
  const losers = data.filter((trade) => trade.profitLoss < 0);
  if (losers.length === 0) return 0;

  return Math.round(
    losers.reduce((sum, trade) => sum + trade.profitLoss, 0) /
      losers.length
  );
}

function getProfitFactor(data: typeof trades) {
  const grossProfit = data
    .filter((trade) => trade.profitLoss > 0)
    .reduce((sum, trade) => sum + trade.profitLoss, 0);

  const grossLoss = Math.abs(
    data
      .filter((trade) => trade.profitLoss < 0)
      .reduce((sum, trade) => sum + trade.profitLoss, 0)
  );

  if (grossLoss === 0) return grossProfit > 0 ? grossProfit : 0;

  return Number((grossProfit / grossLoss).toFixed(2));
}

function buildEquityCurve(data: typeof trades) {
  let equity = 0;

  return data.map((trade) => {
    equity += trade.profitLoss;

    return {
      name: `#${trade.id}`,
      date: trade.date,
      market: trade.market,
      profitLoss: trade.profitLoss,
      equity,
    };
  });
}

function buildPeriodPerformance(data: typeof trades) {
  const weeklyProfit = getTotalProfit(data.slice(-3));
  const monthlyProfit = getTotalProfit(data);
  const yearlyProfit = getTotalProfit(data);

  return [
    {
      name: "Woche",
      value: weeklyProfit,
    },
    {
      name: "Monat",
      value: monthlyProfit,
    },
    {
      name: "Jahr",
      value: yearlyProfit,
    },
  ];
}

function buildMarketPerformance(data: typeof trades) {
  const marketMap = new Map<string, number>();

  data.forEach((trade) => {
    const currentValue = marketMap.get(trade.market) ?? 0;
    marketMap.set(trade.market, currentValue + trade.profitLoss);
  });

  return Array.from(marketMap.entries()).map(([market, value]) => ({
    market,
    value,
  }));
}

export default function TradingJournal() {
  const markets = ["All", ...new Set(trades.map((trade) => trade.market))];

  const [selectedMarket, setSelectedMarket] = useState("All");

  const filteredTrades =
    selectedMarket === "All"
      ? trades
      : trades.filter((trade) => trade.market === selectedMarket);

  const totalProfit = getTotalProfit(filteredTrades);
  const openTrades = filteredTrades.filter((trade) => trade.status === "OPEN");
  const closedTrades = filteredTrades.filter(
    (trade) => trade.status === "CLOSED"
  );

  const winrate = getWinrate(filteredTrades);
  const averageWinner = getAverageWinner(filteredTrades);
  const averageLoser = getAverageLoser(filteredTrades);
  const profitFactor = getProfitFactor(filteredTrades);

  const equityData = buildEquityCurve(filteredTrades);
  const periodData = buildPeriodPerformance(filteredTrades);
  const marketPerformanceData = buildMarketPerformance(filteredTrades);

  const bestTrade = [...filteredTrades].sort(
    (a, b) => b.profitLoss - a.profitLoss
  )[0];

  const worstTrade = [...filteredTrades].sort(
    (a, b) => a.profitLoss - b.profitLoss
  )[0];

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <a
        href="/"
        className="inline-block mb-8 text-blue-400 hover:text-blue-300"
      >
        ← Zurück zum Dashboard
      </a>

      <h1 className="text-4xl font-bold mb-4">
        📈 Trading Journal
      </h1>

      <p className="text-gray-400 mb-8">
        Professionelles Trading Journal mit Equity Curve,
        Zeitraum-Performance, Market-Filter und Kennzahlen.
      </p>

      <div className="mb-8">
        <label className="block mb-2 text-gray-400">
          Market auswählen
        </label>

        <select
          value={selectedMarket}
          onChange={(event) => setSelectedMarket(event.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
        >
          {markets.map((market) => (
            <option key={market}>{market}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Total Trades</h2>
          <p className="text-2xl mt-2">{filteredTrades.length}</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Open Trades</h2>
          <p className="text-2xl mt-2">{openTrades.length}</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Winrate</h2>
          <p className="text-2xl mt-2 text-cyan-400">
            {winrate}%
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Profit / Loss</h2>
          <p
            className={
              totalProfit >= 0
                ? "text-2xl mt-2 text-green-400"
                : "text-2xl mt-2 text-red-400"
            }
          >
            {totalProfit} CHF
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Profit Factor</h2>
          <p className="text-2xl mt-2 text-blue-400">
            {profitFactor}
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Average Winner</h2>
          <p className="text-2xl mt-2 text-green-400">
            {averageWinner} CHF
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Average Loser</h2>
          <p className="text-2xl mt-2 text-red-400">
            {averageLoser} CHF
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Closed Trades</h2>
          <p className="text-2xl mt-2">
            {closedTrades.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">
            📈 Equity Curve
          </h2>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    color: "#ffffff",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="equity"
                  stroke="#22c55e"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">
            📊 Profit / Loss pro Trade
          </h2>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={equityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    color: "#ffffff",
                  }}
                />
                <Bar dataKey="profitLoss" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">
            📅 Zeitraum Performance
          </h2>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    color: "#ffffff",
                  }}
                />
                <Bar dataKey="value" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">
            🎯 Performance nach Market
          </h2>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="market" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    color: "#ffffff",
                  }}
                />
                <Bar dataKey="value" fill="#a855f7" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">
            🏆 Best Trade
          </h2>

          {bestTrade ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold text-green-400">
                {bestTrade.market}
              </p>
              <p>Date: {bestTrade.date}</p>
              <p>Direction: {bestTrade.direction}</p>
              <p>Profit: {bestTrade.profitLoss} CHF</p>
            </div>
          ) : (
            <p className="text-gray-400">Keine Trades vorhanden.</p>
          )}
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">
            ⚠️ Worst Trade
          </h2>

          {worstTrade ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold text-red-400">
                {worstTrade.market}
              </p>
              <p>Date: {worstTrade.date}</p>
              <p>Direction: {worstTrade.direction}</p>
              <p>Profit: {worstTrade.profitLoss} CHF</p>
            </div>
          ) : (
            <p className="text-gray-400">Keine Trades vorhanden.</p>
          )}
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl">
        <h2 className="text-xl font-bold mb-4">
          🧾 Trade Historie
        </h2>

        <div className="grid grid-cols-8 gap-4 p-4 bg-gray-800 font-bold rounded-t-xl">
          <div>Date</div>
          <div>Market</div>
          <div>Direction</div>
          <div>Entry</div>
          <div>SL</div>
          <div>TP</div>
          <div>Status</div>
          <div>P/L</div>
        </div>

        {filteredTrades.map((trade) => (
          <div
            key={trade.id}
            className="grid grid-cols-8 gap-4 p-4 border-t border-gray-800"
          >
            <div>{trade.date}</div>
            <div>{trade.market}</div>

            <div
              className={
                trade.direction === "LONG"
                  ? "text-green-400"
                  : "text-red-400"
              }
            >
              {trade.direction}
            </div>

            <div>{trade.entry}</div>
            <div>{trade.stopLoss}</div>
            <div>{trade.takeProfit}</div>
            <div>{trade.status}</div>

            <div
              className={
                trade.profitLoss >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }
            >
              {trade.profitLoss} CHF
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}