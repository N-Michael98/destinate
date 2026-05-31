"use client";

import { useState } from "react";
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

function SimpleBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const width = Math.min(Math.abs(value), 500) / 5;

  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span>{label}</span>
        <span className={value >= 0 ? "text-green-400" : "text-red-400"}>
          {value} CHF
        </span>
      </div>

      <div className="h-4 bg-black rounded">
        <div
          className={value >= 0 ? "h-4 bg-green-500 rounded" : "h-4 bg-red-500 rounded"}
          style={{ width: `${Math.max(width, 5)}%` }}
        />
      </div>
    </div>
  );
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
  const closedTrades = filteredTrades.filter((trade) => trade.status === "CLOSED");
  const winrate = getWinrate(filteredTrades);

  const weeklyProfit = getTotalProfit(filteredTrades.slice(-3));
  const monthlyProfit = getTotalProfit(filteredTrades);
  const yearlyProfit = getTotalProfit(filteredTrades);

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <a href="/" className="inline-block mb-8 text-blue-400 hover:text-blue-300">
        ← Zurück zum Dashboard
      </a>

      <h1 className="text-4xl font-bold mb-4">📈 Trading Journal</h1>

      <p className="text-gray-400 mb-8">
        Trade Historie, Statistik, Wochen-/Monats-/Jahresübersicht und Market-Filter.
      </p>

      <div className="mb-8">
        <label className="block mb-2 text-gray-400">Market auswählen</label>
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
          <p className="text-2xl mt-2 text-cyan-400">{winrate}%</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Profit / Loss</h2>
          <p className={totalProfit >= 0 ? "text-2xl mt-2 text-green-400" : "text-2xl mt-2 text-red-400"}>
            {totalProfit} CHF
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">📊 Gesamt Performance</h2>

          {filteredTrades.map((trade) => (
            <SimpleBar
              key={trade.id}
              label={`${trade.date} · ${trade.market}`}
              value={trade.profitLoss}
            />
          ))}
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">📅 Zeitraum Performance</h2>

          <SimpleBar label="Diese Woche" value={weeklyProfit} />
          <SimpleBar label="Dieser Monat" value={monthlyProfit} />
          <SimpleBar label="Dieses Jahr" value={yearlyProfit} />
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl">
        <h2 className="text-xl font-bold mb-4">🧾 Trade Historie</h2>

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
            <div className={trade.direction === "LONG" ? "text-green-400" : "text-red-400"}>
              {trade.direction}
            </div>
            <div>{trade.entry}</div>
            <div>{trade.stopLoss}</div>
            <div>{trade.takeProfit}</div>
            <div>{trade.status}</div>
            <div className={trade.profitLoss >= 0 ? "text-green-400" : "text-red-400"}>
              {trade.profitLoss} CHF
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}