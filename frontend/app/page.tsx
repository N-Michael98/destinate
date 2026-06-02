"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { markets } from "./data/markets";

function createSlug(name: string) {
  return name.toLowerCase().replaceAll(" ", "-");
}

const riskValue = {
  Low: 1,
  Medium: 2,
  High: 3,
};

const sortedMarkets = [...markets].sort((a, b) => {
  const riskDiff =
    riskValue[a.risk as keyof typeof riskValue] -
    riskValue[b.risk as keyof typeof riskValue];

  if (riskDiff !== 0) return riskDiff;

  return b.score - a.score;
});

const rankingMarkets = [...markets].sort((a, b) => b.score - a.score);

const topOpportunity = sortedMarkets[0];

const indicesCount = markets.filter((market) => market.category === "Indices").length;
const forexCount = markets.filter((market) => market.category === "Forex").length;
const commoditiesCount = markets.filter((market) => market.category === "Commodities").length;
const cryptoCount = markets.filter((market) => market.category === "Crypto").length;

const buyCount = markets.filter((market) => market.direction === "BUY").length;
const sellCount = markets.filter((market) => market.direction === "SELL").length;
const neutralCount = markets.filter((market) => market.direction === "NEUTRAL").length;


type PaperOrder = {
  id: number;
  market: string;
  direction: string;
  strategy: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  status: string;
  result: string;
  profitLoss: number;
  confidence: number;
  qualityGrade: string;
  aiDecision: string;
  createdAt: string;
};

export default function Home() {
  const [paperOrders, setPaperOrders] = useState<PaperOrder[]>([]);
  const [isSimulatingOrder, setIsSimulatingOrder] = useState(false);

  const openPaperOrders = paperOrders.filter((order) => order.status === "OPEN");
  const closedPaperOrders = paperOrders.filter((order) => order.status === "CLOSED");

  const openPositionExposure = openPaperOrders.reduce(
    (sum, order) => sum + Math.abs(order.entry - order.stopLoss),
    0
  );

  const floatingProfitLoss = openPaperOrders.reduce((sum, order) => {
    const simulatedMove =
      order.direction === "BUY"
        ? order.takeProfit - order.entry
        : order.entry - order.takeProfit;

    return sum + simulatedMove * 0.1;
  }, 0);

  const riskExposure = openPaperOrders.reduce((sum, order) => {
    const riskPerUnit = Math.abs(order.entry - order.stopLoss);
    return sum + riskPerUnit;
  }, 0);

  const positionManagerHealth =
    openPaperOrders.length === 0
      ? "Stable"
      : openPaperOrders.length <= 3
        ? "Controlled"
        : "High Exposure";

  const paperProfitLoss = paperOrders.reduce(
    (sum, order) => sum + Number(order.profitLoss || 0),
    0
  );

  const paperWins = closedPaperOrders.filter((order) => order.profitLoss > 0).length;
  const paperWinrate =
    closedPaperOrders.length > 0
      ? Math.round((paperWins / closedPaperOrders.length) * 100)
      : 0;

  const paperBalance = 30000;
  const paperEquity = paperBalance + paperProfitLoss;
  const floatingEquity = paperEquity + floatingProfitLoss;

  const winningPaperTrades = closedPaperOrders.filter((order) => order.profitLoss > 0);
  const losingPaperTrades = closedPaperOrders.filter((order) => order.profitLoss < 0);

  const grossPaperProfit = winningPaperTrades.reduce(
    (sum, order) => sum + order.profitLoss,
    0
  );

  const grossPaperLoss = Math.abs(
    losingPaperTrades.reduce((sum, order) => sum + order.profitLoss, 0)
  );

  const paperProfitFactor =
    grossPaperLoss > 0
      ? Number((grossPaperProfit / grossPaperLoss).toFixed(2))
      : grossPaperProfit > 0
        ? grossPaperProfit
        : 0;

  const averagePaperWin =
    winningPaperTrades.length > 0
      ? Number((grossPaperProfit / winningPaperTrades.length).toFixed(2))
      : 0;

  const averagePaperLoss =
    losingPaperTrades.length > 0
      ? Number((grossPaperLoss / losingPaperTrades.length).toFixed(2))
      : 0;

  const paperExpectancy =
    closedPaperOrders.length > 0
      ? Number((paperProfitLoss / closedPaperOrders.length).toFixed(2))
      : 0;

  const paperEquityCurve = closedPaperOrders
    .slice()
    .reverse()
    .reduce(
      (curve, order, index) => {
        const previousEquity =
          index === 0 ? paperBalance : curve[index - 1].equity;

        curve.push({
          trade: `#${order.id}`,
          equity: Number((previousEquity + order.profitLoss).toFixed(2)),
        });

        return curve;
      },
      [] as { trade: string; equity: number }[]
    );

  const paperPeakEquity = paperEquityCurve.reduce(
    (peak, point) => Math.max(peak, point.equity),
    paperBalance
  );

  const paperMaxDrawdown = paperEquityCurve.reduce(
    (maxDrawdown, point) => {
      const drawdown = paperPeakEquity - point.equity;
      return Math.max(maxDrawdown, drawdown);
    },
    0
  );

  const paperMaxDrawdownPercent =
    paperPeakEquity > 0
      ? Number(((paperMaxDrawdown / paperPeakEquity) * 100).toFixed(2))
      : 0;

  const equityEngineHealth =
    paperProfitFactor >= 2 && paperExpectancy > 0
      ? "Strong"
      : paperProfitFactor >= 1.2 && paperExpectancy >= 0
        ? "Developing"
        : "Needs Data";

  const gptTradeAnalystScore =
    paperProfitFactor >= 2 && paperExpectancy > 0 && paperWinrate >= 60
      ? 88
      : paperProfitFactor >= 1.2 && paperExpectancy >= 0
        ? 68
        : 42;

  const gptTradeAnalystVerdict =
    gptTradeAnalystScore >= 80
      ? "Strong Trading Profile"
      : gptTradeAnalystScore >= 60
        ? "Developing Edge"
        : "Needs More Data";

  const gptTradeAnalystRecommendation =
    gptTradeAnalystScore >= 80
      ? "Fokus auf die profitabelsten Setups erhöhen und Risiko stabil halten."
      : gptTradeAnalystScore >= 60
        ? "Mehr Paper Trades sammeln, Gewinner-Strategien bestätigen und Drawdown beobachten."
        : "Noch keine klare Edge. Mehr Daten sammeln und Risiko niedrig halten.";

  const bestPaperMarket =
    closedPaperOrders.length > 0
      ? closedPaperOrders.reduce((best, order) =>
          order.profitLoss > best.profitLoss ? order : best
        ).market
      : topOpportunity.name;

  const bestPaperStrategy =
    closedPaperOrders.length > 0
      ? closedPaperOrders.reduce((best, order) =>
          order.profitLoss > best.profitLoss ? order : best
        ).strategy
      : "Liquidity Sweep";

  const worstPaperMarket =
    closedPaperOrders.length > 0
      ? closedPaperOrders.reduce((worst, order) =>
          order.profitLoss < worst.profitLoss ? order : worst
        ).market
      : "-";

  async function loadPaperOrders() {
    try {
      const response = await fetch("/api/paper-orders");
      const data = await response.json();

      if (data.success) {
        setPaperOrders(data.paperOrders);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function simulatePaperOrder() {
    try {
      setIsSimulatingOrder(true);

      const response = await fetch("/api/paper-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          market: "NAS100",
          direction: "BUY",
          strategy: "Liquidity Sweep",
          entry: 18000,
          stopLoss: 17900,
          takeProfit: 18250,
          accountSize: 30000,
          riskPercent: 1,
          confidence: 74,
          qualityGrade: "B",
          aiDecision: "WAIT",
          notes: "V6.4 simulated paper order from dashboard.",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert("Paper Order konnte nicht erstellt werden.");
        return;
      }

      await loadPaperOrders();
    } catch (error) {
      console.error(error);
      alert("Fehler beim Simulieren der Paper Order.");
    } finally {
      setIsSimulatingOrder(false);
    }
  }

  async function closePaperOrder(orderId: number, result: "WIN" | "LOSS") {
    const profitLoss = result === "WIN" ? 220 : -100;

    try {
      const response = await fetch(`/api/paper-orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "CLOSED",
          result,
          profitLoss,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert("Paper Order konnte nicht geschlossen werden.");
        return;
      }

      await loadPaperOrders();
    } catch (error) {
      console.error(error);
      alert("Fehler beim Schliessen der Paper Order.");
    }
  }

  async function resetPaperOrders() {
    const confirmed = confirm("Alle Paper Orders löschen?");

    if (!confirmed) return;

    try {
      const response = await fetch("/api/paper-orders", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        alert("Paper Orders konnten nicht gelöscht werden.");
        return;
      }

      await loadPaperOrders();
    } catch (error) {
      console.error(error);
      alert("Fehler beim Löschen der Paper Orders.");
    }
  }

  useEffect(() => {
    loadPaperOrders();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex">
        <aside className="w-72 min-h-screen bg-gray-950 border-r border-gray-800 p-6 sticky top-0">
          <h1 className="text-3xl font-bold mb-2">AI Trading</h1>
          <h2 className="text-3xl font-bold mb-8">System</h2>

          <nav className="space-y-3 text-lg">
            <Link className="block hover:text-blue-400" href="/">🏠 Dashboard</Link>

            <div className="pt-4">
              <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">Trading</p>
              <Link className="block hover:text-blue-400 py-1" href="/trading-journal">📒 Trading Journal</Link>
              <Link className="block hover:text-blue-400 py-1" href="/trading">📈 Trading Desk</Link>
              <Link className="block hover:text-blue-400 py-1" href="/trading-journal">🎯 Signal Engine</Link>
              <Link className="block hover:text-blue-400 py-1" href="/trading-journal">🧩 Strategy Builder</Link>
            </div>

            <div className="pt-4">
              <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">AI Center</p>
              <Link className="block hover:text-blue-400 py-1" href="/ai-assistant">🤖 AI Assistant</Link>
              <a className="block hover:text-blue-400 py-1" href="#gpt-trade-analyst">🧠 GPT Trade Analyst</a>
              <a className="block hover:text-blue-400 py-1" href="#ai-consensus">🧠 AI Consensus</a>
              <a className="block hover:text-blue-400 py-1" href="#journal-snapshot">⭐ AI Trade Review</a>
            </div>

            <div className="pt-4">
              <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">Execution</p>
              <a className="block hover:text-blue-400 py-1" href="#execution-overview">⚡ Execution Center</a>
              <a className="block hover:text-blue-400 py-1" href="#paper-trading">📝 Paper Trading</a>
              <a className="block hover:text-blue-400 py-1" href="#broker-hub">🔌 Broker Hub</a>
            </div>

            <div className="pt-4">
              <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">Markets</p>
              <Link className="block hover:text-blue-400 py-1" href="/market-intelligence">🌍 Market Intelligence</Link>
              <a className="block hover:text-blue-400 py-1" href="#market-overview">📊 Market Overview</a>
            </div>

            <div className="pt-4">
              <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">System</p>
              <Link className="block hover:text-blue-400 py-1" href="/simulation-lab">🧪 Simulation Lab</Link>
              <Link className="block hover:text-blue-400 py-1" href="/security-center">🛡 Security Center</Link>
              <Link className="block hover:text-blue-400 py-1" href="/settings">⚙️ Settings</Link>
            </div>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <div className="mb-10">
            <h2 className="text-5xl font-bold mb-3">Willkommen Michael 👊</h2>
            <p className="text-gray-400 text-xl">
              AI Trading Mission Control · V6.7 GPT Trade Analyst
            </p>
          </div>

          <div className="grid grid-cols-5 gap-6 mb-8">
            <div className="bg-gray-900 p-6 rounded-2xl border border-green-900">
              <h3 className="font-bold text-lg">💰 Balance</h3>
              <p className="text-3xl mt-4 text-green-400">{paperBalance.toLocaleString("de-CH")} CHF</p>
              <p className="text-gray-400 mt-2">Paper Account</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-900">
              <h3 className="font-bold text-lg">📈 Equity</h3>
              <p className="text-3xl mt-4 text-cyan-400">{floatingEquity.toLocaleString("de-CH")} CHF</p>
              <p className="text-gray-400 mt-2">Floating Equity</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-blue-900">
              <h3 className="font-bold text-lg">📊 Closed P/L</h3>
              <p className={paperProfitLoss >= 0 ? "text-3xl mt-4 text-green-400" : "text-3xl mt-4 text-red-400"}>
                {paperProfitLoss.toLocaleString("de-CH")} CHF
              </p>
              <p className="text-gray-400 mt-2">Closed paper trades</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-900">
              <h3 className="font-bold text-lg">⚡ Open P/L</h3>
              <p className={floatingProfitLoss >= 0 ? "text-3xl mt-4 text-green-400" : "text-3xl mt-4 text-red-400"}>
                {Number(floatingProfitLoss.toFixed(2)).toLocaleString("de-CH")} CHF
              </p>
              <p className="text-gray-400 mt-2">Floating positions</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-purple-900">
              <h3 className="font-bold text-lg">🧠 Engine Health</h3>
              <p className="text-3xl mt-4 text-purple-400">{equityEngineHealth}</p>
              <p className="text-gray-400 mt-2">Account status</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <Link
              href={`/market-intelligence/${createSlug(topOpportunity.name)}`}
              className="bg-gray-900 p-6 rounded-2xl border border-blue-900 hover:border-blue-500 transition"
            >
              <h3 className="text-2xl font-bold mb-5">🎯 Top Opportunity</h3>
              <p className="text-4xl font-bold text-blue-400">{topOpportunity.name}</p>
              <p className="text-gray-400 mt-2">{topOpportunity.category}</p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="bg-black border border-gray-800 rounded-xl p-3">
                  <p className="text-gray-400 text-sm">Direction</p>
                  <p
                    className={
                      topOpportunity.direction === "BUY"
                        ? "text-green-400 font-bold"
                        : topOpportunity.direction === "SELL"
                        ? "text-red-400 font-bold"
                        : "text-yellow-400 font-bold"
                    }
                  >
                    {topOpportunity.direction}
                  </p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-3">
                  <p className="text-gray-400 text-sm">Confidence</p>
                  <p className="text-cyan-400 font-bold">{topOpportunity.confidence}%</p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-3">
                  <p className="text-gray-400 text-sm">Score</p>
                  <p className="text-blue-400 font-bold">{topOpportunity.score}</p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-3">
                  <p className="text-gray-400 text-sm">Risk/Reward</p>
                  <p className="text-yellow-400 font-bold">{topOpportunity.riskReward}</p>
                </div>
              </div>

              <p className="pt-5 text-blue-400 font-semibold">Analyse öffnen →</p>
            </Link>

            <div id="ai-consensus" className="bg-gray-900 p-6 rounded-2xl border border-purple-900">
              <h3 className="text-2xl font-bold mb-5">🤖 AI Consensus</h3>

              <div className="space-y-4">
                <div className="flex justify-between bg-black border border-gray-800 rounded-xl p-4">
                  <span>GPT Analyst</span>
                  <span className="text-yellow-400 font-bold">WAIT</span>
                </div>

                <div className="flex justify-between bg-black border border-gray-800 rounded-xl p-4">
                  <span>Claude Risk Analyst</span>
                  <span className="text-yellow-400 font-bold">WAIT</span>
                </div>

                <div className="flex justify-between bg-black border border-gray-800 rounded-xl p-4">
                  <span>System Decision</span>
                  <span className="text-yellow-400 font-bold">WAIT</span>
                </div>

                <div className="bg-purple-950 border border-purple-800 rounded-xl p-4">
                  <p className="text-gray-400">Consensus Score</p>
                  <p className="text-4xl font-bold text-purple-400">74%</p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">GPT Trade Analyst</p>
                  <p className="text-2xl font-bold text-cyan-400">{gptTradeAnalystScore}/100</p>
                </div>
              </div>
            </div>

            <div id="risk-monitor" className="bg-gray-900 p-6 rounded-2xl border border-red-900">
              <h3 className="text-2xl font-bold mb-5">🛡 Risk Monitor</h3>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Open Risk Exposure</span>
                    <span>{Number(riskExposure.toFixed(2)).toLocaleString("de-CH")}</span>
                  </div>
                  <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min(riskExposure, 100)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span>Max Drawdown</span>
                    <span>{paperMaxDrawdownPercent}%</span>
                  </div>
                  <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(paperMaxDrawdownPercent * 10, 100)}%` }} />
                  </div>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Risk Status</p>
                  <p className="text-3xl font-bold text-green-400">
                    {paperMaxDrawdownPercent < 5 ? "SAFE" : "WARNING"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-900">
              <h3 className="text-2xl font-bold mb-5">📂 Open Positions</h3>

              <div className="space-y-3">
                {openPaperOrders.length === 0 && (
                  <p className="text-gray-500">Keine offenen Paper Positionen.</p>
                )}

                {openPaperOrders.slice(0, 4).map((order) => {
                  const floatingPositionProfit =
                    order.direction === "BUY"
                      ? Number(((order.takeProfit - order.entry) * 0.1).toFixed(2))
                      : Number(((order.entry - order.takeProfit) * 0.1).toFixed(2));

                  return (
                    <div key={order.id} className="bg-black border border-cyan-900 rounded-xl p-4">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-bold">#{order.id} {order.market} {order.direction}</p>
                          <p className="text-gray-400 text-sm">{order.strategy}</p>
                        </div>
                        <p className={floatingPositionProfit >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                          {floatingPositionProfit} CHF
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <a href="#paper-trading" className="inline-block mt-5 text-cyan-400 hover:text-cyan-300">
                Paper Trading öffnen →
              </a>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-blue-900">
              <h3 className="text-2xl font-bold mb-5">📈 Equity Curve Snapshot</h3>

              <div className="h-56 bg-black border border-gray-800 rounded-xl p-5 flex items-end gap-3">
                {[paperBalance, ...paperEquityCurve.map((point) => point.equity)].slice(-8).map((equity, index) => {
                  const minEquity = paperBalance - 500;
                  const maxEquity = paperBalance + 1000;
                  const height = Math.max(12, Math.min(100, ((equity - minEquity) / (maxEquity - minEquity)) * 100));

                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className={equity >= paperBalance ? "w-full bg-green-400 rounded-t" : "w-full bg-red-400 rounded-t"}
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5">
                <div className="bg-black border border-gray-800 rounded-xl p-3">
                  <p className="text-gray-400 text-sm">Peak Equity</p>
                  <p className="text-yellow-400 font-bold">{paperPeakEquity.toLocaleString("de-CH")} CHF</p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-3">
                  <p className="text-gray-400 text-sm">Profit Factor</p>
                  <p className="text-blue-400 font-bold">{paperProfitFactor}</p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-3">
                  <p className="text-gray-400 text-sm">Expectancy</p>
                  <p className={paperExpectancy >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                    {paperExpectancy} CHF
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div id="gpt-trade-analyst" className="bg-gray-900 p-6 rounded-2xl border border-cyan-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🧠 GPT Trade Analyst V6.7</h3>
                <p className="text-gray-400 mt-2">
                  Lokale GPT-Analyse-Simulation: bewertet Paper Trades, Strategien, Märkte und Account-Statistiken.
                </p>
              </div>

              <div className="bg-black border border-cyan-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">AI Mode</p>
                <p className="text-cyan-400 font-bold">Simulation</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-6">
              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">GPT Analyst Score</h4>
                <p className="text-4xl mt-4 text-cyan-400">{gptTradeAnalystScore}/100</p>
                <p className="text-gray-400 mt-2">{gptTradeAnalystVerdict}</p>
              </div>

              <div className="bg-black border border-green-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Best Strategy</h4>
                <p className="text-2xl mt-4 text-green-400">{bestPaperStrategy}</p>
                <p className="text-gray-400 mt-2">Based on Paper Trades</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Best Market</h4>
                <p className="text-2xl mt-4 text-blue-400">{bestPaperMarket}</p>
                <p className="text-gray-400 mt-2">Highest paper P/L</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Weak Market</h4>
                <p className="text-2xl mt-4 text-red-400">{worstPaperMarket}</p>
                <p className="text-gray-400 mt-2">Needs review</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📊 GPT Performance Reading</h4>

                <div className="space-y-3">
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Winrate: <span className="text-green-400 font-bold">{paperWinrate}%</span>
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Profit Factor: <span className="text-yellow-400 font-bold">{paperProfitFactor}</span>
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Expectancy: <span className={paperExpectancy >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{paperExpectancy} CHF</span>
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Drawdown: <span className="text-red-400 font-bold">{paperMaxDrawdownPercent}%</span>
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🧭 GPT Recommendation</h4>

                <p className="text-gray-300 leading-relaxed">
                  {gptTradeAnalystRecommendation}
                </p>

                <div className="mt-5 border border-cyan-900 bg-cyan-950 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Current Focus</p>
                  <p className="text-cyan-400 font-bold">
                    {bestPaperMarket} · {bestPaperStrategy}
                  </p>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🔒 API Status</h4>

                <div className="space-y-3">
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ OpenAI API noch nicht verbunden
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Lokale Analyse aktiv
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    🔒 Live Auto Decisions gesperrt
                  </div>
                </div>

                <p className="text-gray-400 mt-5">
                  Später sendet dieses Modul echte Trade-Daten an GPT und erhält strukturierte Analyse zurück.
                </p>
              </div>
            </div>
          </div>

          <div id="market-overview" className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
              <h3 className="text-2xl font-bold mb-5">🌍 Market Overview</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black border border-gray-800 rounded-xl p-4">📈 Indices: {indicesCount}</div>
                <div className="bg-black border border-gray-800 rounded-xl p-4">💱 Forex: {forexCount}</div>
                <div className="bg-black border border-gray-800 rounded-xl p-4">🛢 Commodities: {commoditiesCount}</div>
                <div className="bg-black border border-gray-800 rounded-xl p-4">₿ Crypto: {cryptoCount}</div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="bg-green-950 border border-green-900 rounded-xl p-4 text-green-400">BUY: {buyCount}</div>
                <div className="bg-red-950 border border-red-900 rounded-xl p-4 text-red-400">SELL: {sellCount}</div>
                <div className="bg-yellow-950 border border-yellow-900 rounded-xl p-4 text-yellow-400">NEUTRAL: {neutralCount}</div>
              </div>

              <Link href="/market-intelligence" className="inline-block mt-5 text-blue-400 hover:text-blue-300">
                Scanner öffnen →
              </Link>
            </div>

            <div id="journal-snapshot" className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
              <h3 className="text-2xl font-bold mb-5">📒 Journal Snapshot</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Closed Trades</p>
                  <p className="text-3xl font-bold">{closedPaperOrders.length}</p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Winrate</p>
                  <p className="text-3xl font-bold text-green-400">{paperWinrate}%</p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Average Win</p>
                  <p className="text-3xl font-bold text-green-400">{averagePaperWin} CHF</p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Average Loss</p>
                  <p className="text-3xl font-bold text-red-400">{averagePaperLoss} CHF</p>
                </div>
              </div>
            </div>
          </div>

          <div id="execution-overview" className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-900 p-6 rounded-2xl border border-purple-900">
              <h3 className="text-2xl font-bold mb-3">🧠 Execution Core</h3>
              <p className="text-purple-400 text-2xl font-bold">Simulation Only</p>
              <p className="text-gray-400 mt-3">Live execution remains locked.</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-900">
              <h3 className="text-2xl font-bold mb-3">📝 Paper Trading</h3>
              <p className="text-cyan-400 text-2xl font-bold">Active</p>
              <p className="text-gray-400 mt-3">Orders, positions and equity engine active.</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-orange-900">
              <h3 className="text-2xl font-bold mb-3">🔌 Broker Hub</h3>
              <p className="text-orange-400 text-2xl font-bold">Disconnected</p>
              <p className="text-gray-400 mt-3">Capital.com and IC Markets later.</p>
            </div>
          </div>

          <details id="paper-trading" className="bg-gray-900 p-6 rounded-2xl mb-8 border border-cyan-900 open:pb-8">
            <summary className="cursor-pointer text-2xl font-bold">
              📝 Paper Trading Engine V6.6 · Details öffnen
            </summary>

            <div className="mt-6 grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📌 Virtual Order Ticket</h4>

                <div className="space-y-3">
                  <input
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-gray-400"
                    value="NAS100"
                    readOnly
                  />
                  <select className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-gray-400" disabled>
                    <option>BUY</option>
                    <option>SELL</option>
                  </select>
                  <input
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-gray-400"
                    value="Liquidity Sweep"
                    readOnly
                  />
                  <button
                    onClick={simulatePaperOrder}
                    disabled={isSimulatingOrder}
                    className="w-full bg-cyan-700 hover:bg-cyan-800 px-4 py-3 rounded-xl font-bold disabled:opacity-50"
                  >
                    {isSimulatingOrder ? "Simulating..." : "Simulate Order"}
                  </button>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📂 Position Manager</h4>

                <div className="space-y-3">
                  {openPaperOrders.length === 0 && (
                    <p className="text-gray-500">Keine offenen Paper Positionen.</p>
                  )}

                  {openPaperOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="border border-cyan-900 bg-cyan-950 rounded-lg p-4">
                      <p className="font-bold">#{order.id} {order.market} {order.direction}</p>
                      <p className="text-gray-300 text-sm">{order.strategy}</p>

                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => closePaperOrder(order.id, "WIN")}
                          className="bg-green-700 hover:bg-green-800 px-3 py-1 rounded text-sm"
                        >
                          Take Profit
                        </button>
                        <button
                          onClick={() => closePaperOrder(order.id, "LOSS")}
                          className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm"
                        >
                          Stop Loss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">✅ Closed Trades</h4>

                <div className="space-y-3">
                  {closedPaperOrders.length === 0 && (
                    <p className="text-gray-500">Noch keine geschlossenen Paper Trades.</p>
                  )}

                  {closedPaperOrders.slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      className={
                        order.profitLoss >= 0
                          ? "border border-green-900 bg-green-950 rounded-lg p-3"
                          : "border border-red-900 bg-red-950 rounded-lg p-3"
                      }
                    >
                      <p className="font-bold">#{order.id} {order.market} {order.direction}</p>
                      <p className="text-gray-300 text-sm">{order.profitLoss} CHF · {order.result}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={resetPaperOrders}
                  className="mt-5 w-full bg-red-900 hover:bg-red-950 px-4 py-3 rounded-xl font-bold"
                >
                  Reset Paper Orders
                </button>
              </div>
            </div>
          </details>

          <details id="broker-hub" className="bg-gray-900 p-6 rounded-2xl mb-8 border border-orange-900">
            <summary className="cursor-pointer text-2xl font-bold">
              🔌 Broker Integration Layer V6.0 · Details öffnen
            </summary>

            <div className="grid grid-cols-3 gap-6 mt-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold">Capital.com</h4>
                <p className="text-red-400 mt-4 font-bold">Disconnected</p>
                <p className="text-gray-500 mt-2">API Key: Not configured</p>
                <p className="text-orange-400 mt-2">Coming Soon</p>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold">IC Markets</h4>
                <p className="text-red-400 mt-4 font-bold">Disconnected</p>
                <p className="text-gray-500 mt-2">Server: Not configured</p>
                <p className="text-orange-400 mt-2">Coming Soon</p>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold">MetaTrader 5</h4>
                <p className="text-red-400 mt-4 font-bold">Disconnected</p>
                <p className="text-gray-500 mt-2">Bridge: Not installed</p>
                <p className="text-orange-400 mt-2">Coming Soon</p>
              </div>
            </div>
          </details>

          <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
            <h3 className="text-2xl font-bold mb-4">🏆 Market Ranking</h3>

            <div className="space-y-3">
              {rankingMarkets.map((market, index) => (
                <Link
                  key={market.name}
                  href={`/market-intelligence/${createSlug(market.name)}`}
                  className="flex justify-between items-center border border-gray-800 rounded-lg p-4 hover:border-blue-500 transition"
                >
                  <div>
                    <p className="font-bold">
                      #{index + 1} {market.name}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {market.category} · {market.timeframe} · {market.risk}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">{market.score}</p>
                    <p
                      className={
                        market.direction === "BUY"
                          ? "text-green-400 text-sm"
                          : market.direction === "SELL"
                          ? "text-red-400 text-sm"
                          : "text-yellow-400 text-sm"
                      }
                    >
                      {market.direction}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}