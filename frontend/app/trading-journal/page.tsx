"use client";

import { useEffect, useState } from "react";
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

type Trade = (typeof trades)[number];

const STORAGE_KEY = "ai-trading-journal-trades";

function getTotalProfit(data: Trade[]) {
  return data.reduce((sum, trade) => sum + trade.profitLoss, 0);
}

function getWinrate(data: Trade[]) {
  const closed = data.filter((trade) => trade.status === "CLOSED");
  if (closed.length === 0) return 0;

  const wins = closed.filter((trade) => trade.result === "WIN").length;
  return Math.round((wins / closed.length) * 100);
}

function getAverageWinner(data: Trade[]) {
  const winners = data.filter((trade) => trade.profitLoss > 0);
  if (winners.length === 0) return 0;

  return Math.round(
    winners.reduce((sum, trade) => sum + trade.profitLoss, 0) / winners.length
  );
}

function getAverageLoser(data: Trade[]) {
  const losers = data.filter((trade) => trade.profitLoss < 0);
  if (losers.length === 0) return 0;

  return Math.round(
    losers.reduce((sum, trade) => sum + trade.profitLoss, 0) / losers.length
  );
}

function getProfitFactor(data: Trade[]) {
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

function buildEquityCurve(data: Trade[]) {
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

function buildPeriodPerformance(data: Trade[]) {
  const weeklyProfit = getTotalProfit(data.slice(-3));
  const monthlyProfit = getTotalProfit(data);
  const yearlyProfit = getTotalProfit(data);

  return [
    { name: "Woche", value: weeklyProfit },
    { name: "Monat", value: monthlyProfit },
    { name: "Jahr", value: yearlyProfit },
  ];
}

function buildMarketPerformance(data: Trade[]) {
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
  const [journalTrades, setJournalTrades] = useState<Trade[]>(trades);
  const [isLoaded, setIsLoaded] = useState(false);

  const markets = ["All", ...new Set(journalTrades.map((trade) => trade.market))];
  const [selectedMarket, setSelectedMarket] = useState("All");

  useEffect(() => {
    const savedTrades = localStorage.getItem(STORAGE_KEY);

    if (savedTrades) {
      try {
        setJournalTrades(JSON.parse(savedTrades));
      } catch {
        setJournalTrades(trades);
      }
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(journalTrades));
  }, [journalTrades, isLoaded]);

  const filteredTrades =
    selectedMarket === "All"
      ? journalTrades
      : journalTrades.filter((trade) => trade.market === selectedMarket);

  function closeTrade(tradeId: number, result: "WIN" | "LOSS") {
    const input = window.prompt(
      result === "WIN" ? "Gewinn in CHF eingeben:" : "Verlust in CHF eingeben:"
    );

    if (!input) return;

    const value = Number(input);

    if (Number.isNaN(value)) {
      alert("Bitte eine gültige Zahl eingeben.");
      return;
    }

    const finalProfitLoss = result === "WIN" ? Math.abs(value) : -Math.abs(value);

    setJournalTrades((currentTrades) =>
      currentTrades.map((trade) =>
        trade.id === tradeId
          ? {
              ...trade,
              status: "CLOSED",
              result,
              profitLoss: finalProfitLoss,
            }
          : trade
      )
    );
  }

  function reopenTrade(tradeId: number) {
    setJournalTrades((currentTrades) =>
      currentTrades.map((trade) =>
        trade.id === tradeId
          ? {
              ...trade,
              status: "OPEN",
              result: "OPEN",
              profitLoss: 0,
            }
          : trade
      )
    );
  }

  function resetJournal() {
    const confirmed = window.confirm(
      "Willst du das Trading Journal wirklich auf die Demo-Daten zurücksetzen?"
    );

    if (!confirmed) return;

    setJournalTrades(trades);
    localStorage.removeItem(STORAGE_KEY);
  }

  const totalProfit = getTotalProfit(filteredTrades);
  const openTrades = filteredTrades.filter((trade) => trade.status === "OPEN");
  const closedTrades = filteredTrades.filter((trade) => trade.status === "CLOSED");

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

      <h1 className="text-4xl font-bold mb-4">📈 Trading Journal</h1>

      <p className="text-gray-400 mb-8">
        Trading Journal mit dauerhafter Speicherung im Browser, Equity Curve,
        Market-Filter, Kennzahlen und Trade Management.
      </p>

      <div className="mb-8 flex gap-4 items-end">
        <div>
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

        <button
          onClick={resetJournal}
          className="bg-red-700 hover:bg-red-800 px-4 py-3 rounded-xl"
        >
          Journal zurücksetzen
        </button>

        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-gray-300">
          V3.5: Änderungen bleiben nach Browser-Reload gespeichert.
        </div>
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
          <p className="text-2xl mt-2 text-blue-400">{profitFactor}</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Average Winner</h2>
          <p className="text-2xl mt-2 text-green-400">{averageWinner} CHF</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Average Loser</h2>
          <p className="text-2xl mt-2 text-red-400">{averageLoser} CHF</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="font-bold">Closed Trades</h2>
          <p className="text-2xl mt-2">{closedTrades.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">📈 Equity Curve</h2>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
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
          <h2 className="text-xl font-bold mb-4">📊 Profit / Loss pro Trade</h2>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={equityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="profitLoss" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">📅 Zeitraum Performance</h2>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">🎯 Performance nach Market</h2>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="market" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#a855f7" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">🏆 Best Trade</h2>

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
          <h2 className="text-xl font-bold mb-4">⚠️ Worst Trade</h2>

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
        <h2 className="text-xl font-bold mb-4">🧾 Trade Historie</h2>

        <div className="grid grid-cols-9 gap-4 p-4 bg-gray-800 font-bold rounded-t-xl">
          <div>Date</div>
          <div>Market</div>
          <div>Direction</div>
          <div>Entry</div>
          <div>SL</div>
          <div>TP</div>
          <div>Status</div>
          <div>P/L</div>
          <div>Actions</div>
        </div>

        {filteredTrades.map((trade) => (
          <div
            key={trade.id}
            className="grid grid-cols-9 gap-4 p-4 border-t border-gray-800 items-center"
          >
            <div>{trade.date}</div>
            <div>{trade.market}</div>

            <div
              className={
                trade.direction === "LONG" ? "text-green-400" : "text-red-400"
              }
            >
              {trade.direction}
            </div>

            <div>{trade.entry}</div>
            <div>{trade.stopLoss}</div>
            <div>{trade.takeProfit}</div>

            <div
              className={
                trade.status === "OPEN" ? "text-yellow-400" : "text-green-400"
              }
            >
              {trade.status}
            </div>

            <div
              className={
                trade.profitLoss >= 0 ? "text-green-400" : "text-red-400"
              }
            >
              {trade.profitLoss} CHF
            </div>

            <div className="flex flex-col gap-2">
              {trade.status === "OPEN" ? (
                <>
                  <button
                    onClick={() => closeTrade(trade.id, "WIN")}
                    className="bg-green-700 hover:bg-green-800 px-3 py-1 rounded text-sm"
                  >
                    WIN
                  </button>

                  <button
                    onClick={() => closeTrade(trade.id, "LOSS")}
                    className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm"
                  >
                    LOSS
                  </button>
                </>
              ) : (
                <button
                  onClick={() => reopenTrade(trade.id)}
                  className="bg-gray-700 hover:bg-gray-800 px-3 py-1 rounded text-sm"
                >
                  Reopen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-gray-900 p-6 rounded-xl border border-gray-800">
        <h2 className="text-xl font-bold mb-3">📄 Jahresreport</h2>
        <p className="text-gray-400">
          Wochen- und Monatsreport lassen wir weg. Später bauen wir nur einen
          Jahresreport als PDF mit Equity Curve, Kennzahlen und Trade Historie.
        </p>
      </div>
    </main>
  );
}