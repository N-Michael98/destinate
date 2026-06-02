"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { markets } from "./data/markets";

function createSlug(name: string) {
  return name.toLowerCase().replaceAll(" ", "-");
}

function formatCHF(value: number) {
  return new Intl.NumberFormat("de-CH", {
    maximumFractionDigits: 2,
  })
    .format(value)
    .replaceAll("’", "'");
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

  const claudeRiskScore =
    paperMaxDrawdownPercent <= 3 && riskExposure <= 100 && openPaperOrders.length <= 3
      ? 88
      : paperMaxDrawdownPercent <= 6 && riskExposure <= 250
        ? 70
        : 45;

  const claudeRiskVerdict =
    claudeRiskScore >= 80
      ? "Risk Controlled"
      : claudeRiskScore >= 60
        ? "Moderate Risk"
        : "High Risk";

  const claudeRiskRecommendation =
    claudeRiskScore >= 80
      ? "Risk bleibt kontrolliert. Positionsgrösse stabil halten und keine unnötige Exposure erhöhen."
      : claudeRiskScore >= 60
        ? "Risk ist moderat. Neue Positionen nur mit hoher Confidence und klarem R/R eröffnen."
        : "Risk ist erhöht. Neue Trades vermeiden, Exposure reduzieren und Drawdown priorisieren.";

  const positionSizingStatus =
    riskExposure <= 100
      ? "Healthy"
      : riskExposure <= 250
        ? "Watch"
        : "Too High";

  const drawdownStatus =
    paperMaxDrawdownPercent <= 3
      ? "Safe"
      : paperMaxDrawdownPercent <= 6
        ? "Warning"
        : "Danger";

  const signalEngineScore =
    topOpportunity.confidence >= 85 && paperProfitFactor >= 1.5
      ? 90
      : topOpportunity.confidence >= 70
        ? 74
        : 55;

  const multiAIConsensusScore = Math.round(
    gptTradeAnalystScore * 0.35 +
      claudeRiskScore * 0.35 +
      signalEngineScore * 0.3
  );

  const finalAIDecision =
    multiAIConsensusScore >= 90 && claudeRiskScore >= 75
      ? "STRONG BUY"
      : multiAIConsensusScore >= 75 && claudeRiskScore >= 65
        ? "BUY"
        : multiAIConsensusScore >= 60
          ? "WAIT"
          : "BLOCK";

  const executionPermission =
    finalAIDecision === "STRONG BUY" || finalAIDecision === "BUY"
      ? "ALLOWED"
      : finalAIDecision === "WAIT"
        ? "WAIT"
        : "BLOCKED";

  const consensusHealth =
    multiAIConsensusScore >= 80 && claudeRiskScore >= 70
      ? "Aligned"
      : multiAIConsensusScore >= 60
        ? "Mixed"
        : "Conflict";

  const aiReadinessScore = Math.round(
    (gptTradeAnalystScore + claudeRiskScore + multiAIConsensusScore) / 3
  );

  const riskReadinessScore = claudeRiskScore;

  const executionReadinessScore =
    paperOrders.length > 0 || openPaperOrders.length > 0 || closedPaperOrders.length > 0
      ? 85
      : 65;

  const brokerReadinessScore = 0;
  const apiReadinessScore = 0;

  const liveTradingReadinessScore = Math.round(
    aiReadinessScore * 0.25 +
      riskReadinessScore * 0.25 +
      executionReadinessScore * 0.25 +
      brokerReadinessScore * 0.15 +
      apiReadinessScore * 0.1
  );

  const liveTradingPermission =
    liveTradingReadinessScore >= 85 &&
    brokerReadinessScore >= 70 &&
    apiReadinessScore >= 70
      ? "LIVE READY"
      : liveTradingReadinessScore >= 60
        ? "PAPER ONLY"
        : "LOCKED";

  const liveTradingMode =
    liveTradingPermission === "LIVE READY"
      ? "Live Trading Ready"
      : liveTradingPermission === "PAPER ONLY"
        ? "Paper Trading Only"
        : "Simulation Locked";

  const capitalComConnectorScore = 12;

  const capitalComConnectorStatus = "Disconnected";
  const capitalComApiStatus = "Not configured";
  const capitalComAccountMode = "Demo later";
  const capitalComTradingPermission = "Locked";

  const icMarketsConnectorScore = 10;
  const icMarketsConnectorStatus = "Disconnected";
  const icMarketsApiStatus = "Not configured";
  const icMarketsAccountMode = "Demo later";
  const icMarketsTradingPermission = "Locked";
  const icMarketsPlatform = "MT5 / cTrader later";

  const brokerApiLayerScore = 22;
  const brokerApiLayerStatus = "Prepared";
  const brokerApiLayerMode = "Simulation";
  const brokerApiLayerPermission = "No Live Orders";
  const brokerApiLayerSafety = "Credentials blocked";

  const demoAuthScore = 28;
  const demoAuthStatus = "Prepared";
  const demoAuthMode = "Demo credentials later";
  const demoAuthPermission = "Test Only";
  const demoAuthSafety = "Environment variables only";
  const capitalDemoAuthStatus = "Not connected";
  const capitalDemoCredentialStatus = "Not configured";
  const capitalDemoTestStatus = "Locked";
  const icMarketsDemoAuthStatus = "Not connected";
  const icMarketsDemoServerStatus = "Not configured";
  const icMarketsDemoBridgeStatus = "Not connected";

  const marketDataBridgeScore = 34;
  const marketDataBridgeStatus = "Prepared";
  const marketDataProviderStatus = "Simulation";
  const priceFeedStatus = "Mock Feed";
  const marketCacheStatus = "Ready";
  const dataFreshnessStatus = "Local Snapshot";
  const trackedMarketCount = 8;
  const aiLearningBridgeStatus = "Forward Learning Ready";

  const intelligenceLayerScore = 39;
  const intelligenceLayerStatus = "Prepared";
  const newsFeedStatus = "Mock News";
  const macroCalendarStatus = "Prepared";
  const sentimentEngineStatus = "Simulation";
  const highImpactEventCount = 5;
  const aiIntelligenceStatus = "Resource Ready";

  const forwardTestingScore = 44;
  const forwardTestingStatus = "Prepared";
  const forwardTestingMode = "Planning Only";
  const plannedForwardTests = 3;
  const completedForwardTests = 0;
  const strategyLearningStatus = "Memory later";
  const demoExecutionStatus = "Locked";

  const aiMemoryScore = 49;
  const aiMemoryStatus = "Prepared";
  const tradeMemoryStatus = "Ready";
  const strategyMemoryStatus = "Ready";
  const marketMemoryStatus = "Ready";
  const memoryEntriesCount = 0;
  const learningLoopStatus = "Prepared";

  const strategyEvolutionScore = 55;
  const strategyEvolutionStatus = "Prepared";
  const strategyRankingStatus = "Ready";
  const confidenceEngineStatus = "Simulation";
  const marketAdaptationStatus = "Prepared";
  const topEvolvingStrategy = "Risk-Off Trend";
  const evolutionMode = "Ranking Only";
  const autonomousAgentStatus = "Locked";

  const demoAgentScore = 61;
  const demoAgentStatus = "Prepared";
  const agentMode = "Planning Only";
  const agentDecisionStatus = "Mock Decision";
  const agentConsensusStatus = "Approved";
  const agentTradePlans = 3;
  const agentLiveExecutionStatus = "Locked";
  const agentNextPhase = "V8.1 Demo Execution";

  const demoExecutionEngineScore = 67;
  const demoExecutionEngineStatus = "Prepared";
  const executionMode = "Paper Only";
  const generatedDemoOrders = 3;
  const openDemoExecutions = 0;
  const executionSafetyStatus = "Locked to Demo";
  const paperOrderBridgeStatus = "Prepared";
  const liveOrderFirewallStatus = "Active";

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
              <a className="block hover:text-blue-400 py-1" href="#claude-risk-analyst">🛡 Claude Risk Analyst</a>
              <a className="block hover:text-blue-400 py-1" href="#multi-ai-consensus">⚡ Multi-AI Consensus</a>
              <a className="block hover:text-blue-400 py-1" href="#ai-consensus">🧠 AI Consensus</a>
              <a className="block hover:text-blue-400 py-1" href="#journal-snapshot">⭐ AI Trade Review</a>
            </div>

            <div className="pt-4">
              <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">Execution</p>
              <a className="block hover:text-blue-400 py-1" href="#execution-overview">⚡ Execution Center</a>
              <a className="block hover:text-blue-400 py-1" href="#live-trading-prep">🚀 Live Trading Prep</a>
              <a className="block hover:text-blue-400 py-1" href="#capital-com-connector">🔌 Capital.com Connector</a>
              <a className="block hover:text-blue-400 py-1" href="#ic-markets-connector">🌐 IC Markets Connector</a>
              <a className="block hover:text-blue-400 py-1" href="#broker-api-layer">🧱 Broker API Layer</a>
              <a className="block hover:text-blue-400 py-1" href="#demo-auth-center">🔐 Demo Auth Center</a>
              <a className="block hover:text-blue-400 py-1" href="#market-data-bridge">📈 Market Data Bridge</a>
              <a className="block hover:text-blue-400 py-1" href="#intelligence-layer">📰 Intelligence Layer</a>
              <a className="block hover:text-blue-400 py-1" href="#forward-testing-engine">🚀 Forward Testing</a>
              <a className="block hover:text-blue-400 py-1" href="#ai-learning-memory">🧠 AI Memory</a>
              <a className="block hover:text-blue-400 py-1" href="#strategy-evolution-engine">🧬 Strategy Evolution</a>
              <a className="block hover:text-blue-400 py-1" href="#demo-trading-agent">🤖 Demo Agent</a>
              <a className="block hover:text-blue-400 py-1" href="#demo-execution-engine">⚡ Demo Execution</a>
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
              AI Trading Mission Control · V8.1 Demo Execution Engine
            </p>
          </div>

          <div className="grid grid-cols-5 gap-6 mb-8">
            <div className="bg-gray-900 p-6 rounded-2xl border border-green-900">
              <h3 className="font-bold text-lg">💰 Balance</h3>
              <p className="text-3xl mt-4 text-green-400">{formatCHF(paperBalance)} CHF</p>
              <p className="text-gray-400 mt-2">Paper Account</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-900">
              <h3 className="font-bold text-lg">📈 Equity</h3>
              <p className="text-3xl mt-4 text-cyan-400">{formatCHF(floatingEquity)} CHF</p>
              <p className="text-gray-400 mt-2">Floating Equity</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-blue-900">
              <h3 className="font-bold text-lg">📊 Closed P/L</h3>
              <p className={paperProfitLoss >= 0 ? "text-3xl mt-4 text-green-400" : "text-3xl mt-4 text-red-400"}>
                {formatCHF(paperProfitLoss)} CHF
              </p>
              <p className="text-gray-400 mt-2">Closed paper trades</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-900">
              <h3 className="font-bold text-lg">⚡ Open P/L</h3>
              <p className={floatingProfitLoss >= 0 ? "text-3xl mt-4 text-green-400" : "text-3xl mt-4 text-red-400"}>
                {formatCHF(Number(floatingProfitLoss.toFixed(2)))} CHF
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
                  <span
                    className={
                      finalAIDecision === "STRONG BUY" || finalAIDecision === "BUY"
                        ? "text-green-400 font-bold"
                        : finalAIDecision === "WAIT"
                          ? "text-yellow-400 font-bold"
                          : "text-red-400 font-bold"
                    }
                  >
                    {finalAIDecision}
                  </span>
                </div>

                <div className="bg-purple-950 border border-purple-800 rounded-xl p-4">
                  <p className="text-gray-400">Consensus Score</p>
                  <p className="text-4xl font-bold text-purple-400">{multiAIConsensusScore}%</p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">GPT Trade Analyst</p>
                  <p className="text-2xl font-bold text-cyan-400">{gptTradeAnalystScore}/100</p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Claude Risk Analyst</p>
                  <p className="text-2xl font-bold text-red-400">{claudeRiskScore}/100</p>
                </div>
              </div>
            </div>

            <div id="risk-monitor" className="bg-gray-900 p-6 rounded-2xl border border-red-900">
              <h3 className="text-2xl font-bold mb-5">🛡 Risk Monitor</h3>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Open Risk Exposure</span>
                    <span>{formatCHF(Number(riskExposure.toFixed(2)))}</span>
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
                  <p className="text-yellow-400 font-bold">{formatCHF(paperPeakEquity)} CHF</p>
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

          <div id="multi-ai-consensus" className="bg-gray-900 p-6 rounded-2xl border border-purple-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">⚡ Multi-AI Consensus Engine V6.9</h3>
                <p className="text-gray-400 mt-2">
                  Gemeinsame Entscheidungslogik aus GPT Trade Analyst, Claude Risk Analyst, Signal Engine und Risk-Control.
                </p>
              </div>

              <div className="bg-black border border-purple-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Consensus Mode</p>
                <p className="text-purple-400 font-bold">Simulation</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-6">
              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">GPT Score</h4>
                <p className="text-4xl mt-4 text-cyan-400">{gptTradeAnalystScore}</p>
                <p className="text-gray-400 mt-2">Trade Quality</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Claude Score</h4>
                <p className="text-4xl mt-4 text-red-400">{claudeRiskScore}</p>
                <p className="text-gray-400 mt-2">Risk Quality</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Signal Score</h4>
                <p className="text-4xl mt-4 text-blue-400">{signalEngineScore}</p>
                <p className="text-gray-400 mt-2">Market Opportunity</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Consensus</h4>
                <p className="text-4xl mt-4 text-purple-400">{multiAIConsensusScore}%</p>
                <p className="text-gray-400 mt-2">{consensusHealth}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div
                className={
                  finalAIDecision === "STRONG BUY" || finalAIDecision === "BUY"
                    ? "bg-black border border-green-900 rounded-xl p-5"
                    : finalAIDecision === "WAIT"
                      ? "bg-black border border-yellow-900 rounded-xl p-5"
                      : "bg-black border border-red-900 rounded-xl p-5"
                }
              >
                <h4 className="text-xl font-bold mb-4">🎯 Final Decision</h4>
                <p
                  className={
                    finalAIDecision === "STRONG BUY" || finalAIDecision === "BUY"
                      ? "text-5xl font-bold text-green-400"
                      : finalAIDecision === "WAIT"
                        ? "text-5xl font-bold text-yellow-400"
                        : "text-5xl font-bold text-red-400"
                  }
                >
                  {finalAIDecision}
                </p>
                <p className="text-gray-400 mt-4">Combined AI decision</p>
              </div>

              <div
                className={
                  executionPermission === "ALLOWED"
                    ? "bg-black border border-green-900 rounded-xl p-5"
                    : executionPermission === "WAIT"
                      ? "bg-black border border-yellow-900 rounded-xl p-5"
                      : "bg-black border border-red-900 rounded-xl p-5"
                }
              >
                <h4 className="text-xl font-bold mb-4">🛡 Execution Permission</h4>
                <p
                  className={
                    executionPermission === "ALLOWED"
                      ? "text-5xl font-bold text-green-400"
                      : executionPermission === "WAIT"
                        ? "text-5xl font-bold text-yellow-400"
                        : "text-5xl font-bold text-red-400"
                  }
                >
                  {executionPermission}
                </p>
                <p className="text-gray-400 mt-4">Live execution still locked</p>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📋 AI Voting Panel</h4>

                <div className="space-y-3">
                  <div className="flex justify-between border border-gray-800 bg-gray-950 rounded-lg p-3">
                    <span>GPT</span>
                    <span className={gptTradeAnalystScore >= 75 ? "text-green-400 font-bold" : gptTradeAnalystScore >= 60 ? "text-yellow-400 font-bold" : "text-red-400 font-bold"}>
                      {gptTradeAnalystScore >= 75 ? "BUY" : gptTradeAnalystScore >= 60 ? "WAIT" : "BLOCK"}
                    </span>
                  </div>

                  <div className="flex justify-between border border-gray-800 bg-gray-950 rounded-lg p-3">
                    <span>Claude</span>
                    <span className={claudeRiskScore >= 75 ? "text-green-400 font-bold" : claudeRiskScore >= 60 ? "text-yellow-400 font-bold" : "text-red-400 font-bold"}>
                      {claudeRiskScore >= 75 ? "APPROVE" : claudeRiskScore >= 60 ? "CAUTION" : "BLOCK"}
                    </span>
                  </div>

                  <div className="flex justify-between border border-gray-800 bg-gray-950 rounded-lg p-3">
                    <span>Signal Engine</span>
                    <span className={signalEngineScore >= 75 ? "text-green-400 font-bold" : signalEngineScore >= 60 ? "text-yellow-400 font-bold" : "text-red-400 font-bold"}>
                      {signalEngineScore >= 75 ? "BUY" : signalEngineScore >= 60 ? "WAIT" : "BLOCK"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-purple-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧠 Consensus Explanation</h4>
              <p className="text-gray-300 leading-relaxed">
                Die Engine kombiniert GPT-Performance-Analyse, Claude-Risk-Analyse und das aktuelle Signal.
                Execution wird nur erlaubt, wenn Performance und Risiko gleichzeitig passen.
                Aktuell bleibt alles im Simulationsmodus ohne echte Broker-Ausführung.
              </p>
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

          <div id="claude-risk-analyst" className="bg-gray-900 p-6 rounded-2xl border border-red-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🛡 Claude Risk Analyst V6.8</h3>
                <p className="text-gray-400 mt-2">
                  Lokale Claude-Risk-Simulation: bewertet Drawdown, Exposure, Position Sizing und Risk-Control.
                </p>
              </div>

              <div className="bg-black border border-red-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Risk Mode</p>
                <p className="text-red-400 font-bold">Simulation</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-6">
              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Claude Risk Score</h4>
                <p className="text-4xl mt-4 text-red-400">{claudeRiskScore}/100</p>
                <p className="text-gray-400 mt-2">{claudeRiskVerdict}</p>
              </div>

              <div className="bg-black border border-yellow-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Drawdown Status</h4>
                <p
                  className={
                    drawdownStatus === "Safe"
                      ? "text-3xl mt-4 text-green-400"
                      : drawdownStatus === "Warning"
                        ? "text-3xl mt-4 text-yellow-400"
                        : "text-3xl mt-4 text-red-400"
                  }
                >
                  {drawdownStatus}
                </p>
                <p className="text-gray-400 mt-2">{paperMaxDrawdownPercent}% Max DD</p>
              </div>

              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Position Sizing</h4>
                <p
                  className={
                    positionSizingStatus === "Healthy"
                      ? "text-3xl mt-4 text-green-400"
                      : positionSizingStatus === "Watch"
                        ? "text-3xl mt-4 text-yellow-400"
                        : "text-3xl mt-4 text-red-400"
                  }
                >
                  {positionSizingStatus}
                </p>
                <p className="text-gray-400 mt-2">Risk Exposure {formatCHF(Number(riskExposure.toFixed(2)))}</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Open Exposure</h4>
                <p className="text-4xl mt-4 text-purple-400">{openPaperOrders.length}</p>
                <p className="text-gray-400 mt-2">Open positions</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📉 Drawdown Analysis</h4>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Max Drawdown</span>
                      <span>{paperMaxDrawdownPercent}%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(paperMaxDrawdownPercent * 10, 100)}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Open Risk Exposure</span>
                      <span>{formatCHF(Number(riskExposure.toFixed(2)))}</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min(riskExposure, 100)}%` }} />
                    </div>
                  </div>

                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Floating P/L: <span className={floatingProfitLoss >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                      {formatCHF(Number(floatingProfitLoss.toFixed(2)))} CHF
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🧭 Claude Recommendation</h4>

                <p className="text-gray-300 leading-relaxed">
                  {claudeRiskRecommendation}
                </p>

                <div className="mt-5 border border-red-900 bg-red-950 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Risk Priority</p>
                  <p className="text-red-400 font-bold">
                    {drawdownStatus === "Danger"
                      ? "Reduce Exposure"
                      : drawdownStatus === "Warning"
                        ? "Protect Capital"
                        : "Maintain Discipline"}
                  </p>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🔒 API Status</h4>

                <div className="space-y-3">
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Claude API noch nicht verbunden
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Lokale Risk Analyse aktiv
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    🔒 Live Risk Decisions gesperrt
                  </div>
                </div>

                <p className="text-gray-400 mt-5">
                  Später prüft Claude echte Positionen, Broker-Exposure und Risk-Limits vor jeder Ausführung.
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

          <div id="live-trading-prep" className="bg-gray-900 p-6 rounded-2xl border border-orange-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🚀 Live Trading Preparation Center V7.0</h3>
                <p className="text-gray-400 mt-2">
                  Prüft, wie weit das System von echtem Live Trading entfernt ist. Aktuell bleibt Live Execution gesperrt.
                </p>
              </div>

              <div className="bg-black border border-orange-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Trading Permission</p>
                <p
                  className={
                    liveTradingPermission === "LIVE READY"
                      ? "text-green-400 font-bold"
                      : liveTradingPermission === "PAPER ONLY"
                        ? "text-yellow-400 font-bold"
                        : "text-red-400 font-bold"
                  }
                >
                  {liveTradingPermission}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-orange-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Overall Readiness</h4>
                <p className="text-5xl mt-4 text-orange-400">{liveTradingReadinessScore}%</p>
                <p className="text-gray-400 mt-2">{liveTradingMode}</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">AI Readiness</h4>
                <p className="text-4xl mt-4 text-purple-400">{aiReadinessScore}%</p>
                <p className="text-gray-400 mt-2">GPT + Claude + Consensus</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Risk Readiness</h4>
                <p className="text-4xl mt-4 text-red-400">{riskReadinessScore}%</p>
                <p className="text-gray-400 mt-2">Risk Engine</p>
              </div>

              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Execution</h4>
                <p className="text-4xl mt-4 text-cyan-400">{executionReadinessScore}%</p>
                <p className="text-gray-400 mt-2">Paper Engine</p>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="font-bold text-lg">Broker/API</h4>
                <p className="text-4xl mt-4 text-gray-500">0%</p>
                <p className="text-gray-400 mt-2">Not connected</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">✅ Live Trading Checklist</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Paper Trading Engine</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Position Manager</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Account Equity Engine</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ GPT Trade Analyst</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Claude Risk Analyst</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Multi-AI Consensus</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🔒 Missing Before Live</h4>

                <div className="space-y-3">
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">❌ OpenAI API Connection</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">❌ Claude API Connection</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">❌ Capital.com API</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">❌ IC Markets API</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">❌ Live Order Manager</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">❌ Risk Firewall</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Trading Permission</h4>

                <div
                  className={
                    liveTradingPermission === "LIVE READY"
                      ? "border border-green-900 bg-green-950 rounded-xl p-5"
                      : liveTradingPermission === "PAPER ONLY"
                        ? "border border-yellow-900 bg-yellow-950 rounded-xl p-5"
                        : "border border-red-900 bg-red-950 rounded-xl p-5"
                  }
                >
                  <p
                    className={
                      liveTradingPermission === "LIVE READY"
                        ? "text-4xl font-bold text-green-400"
                        : liveTradingPermission === "PAPER ONLY"
                          ? "text-4xl font-bold text-yellow-400"
                          : "text-4xl font-bold text-red-400"
                    }
                  >
                    {liveTradingPermission}
                  </p>
                  <p className="text-gray-300 mt-3">
                    {liveTradingPermission === "LIVE READY"
                      ? "System wäre bereit für Live Mode."
                      : liveTradingPermission === "PAPER ONLY"
                        ? "Nur Paper Trading erlaubt. Live Trading bleibt gesperrt."
                        : "Live Trading ist gesperrt. Erst APIs und Broker anbinden."}
                  </p>
                </div>

                <div className="mt-5 bg-gray-950 border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400">Next Step</p>
                  <p className="text-orange-400 font-bold">V8.1 Demo Execution Engine</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-orange-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧭 Live Trading Roadmap</h4>

              <div className="grid grid-cols-5 gap-4">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.0</h5>
                  <p className="text-gray-300 mt-2">Live Prep Center</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.1</h5>
                  <p className="text-gray-300 mt-2">Capital.com Connector</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.2</h5>
                  <p className="text-gray-300 mt-2">IC Markets Connector</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.3</h5>
                  <p className="text-gray-300 mt-2">Broker API Layer</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.0</h5>
                  <p className="text-gray-300 mt-2">Live Execution</p>
                </div>
              </div>
            </div>
          </div>

          <div id="capital-com-connector" className="bg-gray-900 p-6 rounded-2xl border border-blue-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🔌 Capital.com Connector V7.1</h3>
                <p className="text-gray-400 mt-2">
                  Sichere Broker-Connector-Vorbereitung für Capital.com. Aktuell ohne echte API-Verbindung und ohne Live Orders.
                </p>
              </div>

              <div className="bg-black border border-blue-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Connector Status</p>
                <p className="text-red-400 font-bold">{capitalComConnectorStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Connector Score</h4>
                <p className="text-5xl mt-4 text-blue-400">{capitalComConnectorScore}%</p>
                <p className="text-gray-400 mt-2">Preparation only</p>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="font-bold text-lg">API Status</h4>
                <p className="text-2xl mt-4 text-gray-500">{capitalComApiStatus}</p>
                <p className="text-gray-400 mt-2">No credentials saved</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Account Mode</h4>
                <p className="text-2xl mt-4 text-purple-400">{capitalComAccountMode}</p>
                <p className="text-gray-400 mt-2">Demo first</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Trading</h4>
                <p className="text-2xl mt-4 text-red-400">{capitalComTradingPermission}</p>
                <p className="text-gray-400 mt-2">Live orders blocked</p>
              </div>

              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Next Step</h4>
                <p className="text-2xl mt-4 text-cyan-400">API Layer</p>
                <p className="text-gray-400 mt-2">V7.2/V7.3</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🔐 Capital.com API Setup</h4>

                <div className="space-y-3">
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    API Key: <span className="text-gray-500">Not stored</span>
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    API Password: <span className="text-gray-500">Not stored</span>
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Identifier: <span className="text-gray-500">Not stored</span>
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Credentials werden später nur über Environment Variables gespeichert.
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🧪 Connection Test Plan</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ UI Connector vorbereitet
                  </div>
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">
                    🔵 Demo Account zuerst
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    🔒 Live Account später
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    🔒 Order Placement gesperrt
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Safety Rules</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Keine API Keys im Code
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Kein echtes Order Placement
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Erst Demo-Verbindung testen
                  </div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">
                    🔒 Live Trading bleibt locked
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-blue-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧭 Capital.com Connector Roadmap</h4>

              <div className="grid grid-cols-5 gap-4">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.1</h5>
                  <p className="text-gray-300 mt-2">Connector UI</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.2</h5>
                  <p className="text-gray-300 mt-2">API Route Layer</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.3</h5>
                  <p className="text-gray-300 mt-2">Broker API Layer</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.4</h5>
                  <p className="text-gray-300 mt-2">Market Data</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.5</h5>
                  <p className="text-gray-300 mt-2">Paper-to-Broker Bridge</p>
                </div>
              </div>
            </div>
          </div>

          <div id="ic-markets-connector" className="bg-gray-900 p-6 rounded-2xl border border-purple-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🌐 IC Markets Connector V7.2</h3>
                <p className="text-gray-400 mt-2">
                  Sichere Broker-Connector-Vorbereitung für IC Markets. Aktuell ohne echte API-Verbindung, ohne Login-Daten und ohne Live Orders.
                </p>
              </div>

              <div className="bg-black border border-purple-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Connector Status</p>
                <p className="text-red-400 font-bold">{icMarketsConnectorStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Connector Score</h4>
                <p className="text-5xl mt-4 text-purple-400">{icMarketsConnectorScore}%</p>
                <p className="text-gray-400 mt-2">Preparation only</p>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="font-bold text-lg">API Status</h4>
                <p className="text-2xl mt-4 text-gray-500">{icMarketsApiStatus}</p>
                <p className="text-gray-400 mt-2">No credentials saved</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Platform</h4>
                <p className="text-2xl mt-4 text-blue-400">{icMarketsPlatform}</p>
                <p className="text-gray-400 mt-2">Bridge later</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Account Mode</h4>
                <p className="text-2xl mt-4 text-purple-400">{icMarketsAccountMode}</p>
                <p className="text-gray-400 mt-2">Demo first</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Trading</h4>
                <p className="text-2xl mt-4 text-red-400">{icMarketsTradingPermission}</p>
                <p className="text-gray-400 mt-2">Live orders blocked</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🔐 IC Markets Setup</h4>

                <div className="space-y-3">
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Account ID: <span className="text-gray-500">Not stored</span>
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Server: <span className="text-gray-500">Not configured</span>
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Platform Bridge: <span className="text-gray-500">Not connected</span>
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Credentials werden später nur über Environment Variables gespeichert.
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🧪 Connection Test Plan</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ UI Connector vorbereitet
                  </div>
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">
                    🔵 Demo Account zuerst
                  </div>
                  <div className="border border-purple-900 bg-purple-950 rounded-lg p-3">
                    🌐 MT5 / cTrader Bridge später
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    🔒 Order Placement gesperrt
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Safety Rules</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Keine Login-Daten im Code
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Kein echtes Order Placement
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Erst Demo-Verbindung testen
                  </div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">
                    🔒 Live Trading bleibt locked
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-purple-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧭 IC Markets Connector Roadmap</h4>

              <div className="grid grid-cols-5 gap-4">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.2</h5>
                  <p className="text-gray-300 mt-2">Connector UI</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.3</h5>
                  <p className="text-gray-300 mt-2">Broker API Layer</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.4</h5>
                  <p className="text-gray-300 mt-2">Demo Auth Test</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.5</h5>
                  <p className="text-gray-300 mt-2">Market Data Bridge</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.0</h5>
                  <p className="text-gray-300 mt-2">Live Execution</p>
                </div>
              </div>
            </div>
          </div>


          <div id="broker-api-layer" className="bg-gray-900 p-6 rounded-2xl border border-emerald-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🧱 Broker API Layer V7.3</h3>
                <p className="text-gray-400 mt-2">
                  Gemeinsame Broker-Architektur für Capital.com und IC Markets. Aktuell nur TypeScript-Layer, Simulation und Safety-Preparation.
                </p>
              </div>

              <div className="bg-black border border-emerald-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">API Layer Status</p>
                <p className="text-emerald-400 font-bold">{brokerApiLayerStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-emerald-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Layer Score</h4>
                <p className="text-5xl mt-4 text-emerald-400">{brokerApiLayerScore}%</p>
                <p className="text-gray-400 mt-2">Architecture ready</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Capital.com</h4>
                <p className="text-2xl mt-4 text-blue-400">Connector Stub</p>
                <p className="text-gray-400 mt-2">No real API call</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">IC Markets</h4>
                <p className="text-2xl mt-4 text-purple-400">Connector Stub</p>
                <p className="text-gray-400 mt-2">MT5 / cTrader later</p>
              </div>

              <div className="bg-black border border-yellow-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Mode</h4>
                <p className="text-2xl mt-4 text-yellow-400">{brokerApiLayerMode}</p>
                <p className="text-gray-400 mt-2">Safe testing only</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Permission</h4>
                <p className="text-2xl mt-4 text-red-400">{brokerApiLayerPermission}</p>
                <p className="text-gray-400 mt-2">Live locked</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📁 New File Structure</h4>

                <div className="space-y-3">
                  <div className="border border-emerald-900 bg-emerald-950 rounded-lg p-3">✅ lib/brokers/shared/broker.ts</div>
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">✅ lib/brokers/capital/types.ts</div>
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">✅ lib/brokers/capital/connector.ts</div>
                  <div className="border border-purple-900 bg-purple-950 rounded-lg p-3">✅ lib/brokers/icmarkets/types.ts</div>
                  <div className="border border-purple-900 bg-purple-950 rounded-lg p-3">✅ lib/brokers/icmarkets/connector.ts</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🧠 Unified Broker Interface</h4>

                <div className="space-y-3">
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    connect(): <span className="text-emerald-400">prepared</span>
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    getAccount(): <span className="text-emerald-400">prepared</span>
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    getPositions(): <span className="text-emerald-400">prepared</span>
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    placeOrder(): <span className="text-red-400">blocked</span>
                  </div>
                </div>

                <p className="text-gray-400 mt-5">
                  Der Rest vom System kann später beide Broker gleich ansprechen, ohne separate Logik im Dashboard.
                </p>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Safety Firewall</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Keine API Keys im Code
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Nur Mock Responses
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Environment Variables später
                  </div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">
                    🔒 Order Execution blockiert
                  </div>
                </div>

                <p className="text-gray-400 mt-5">
                  {brokerApiLayerSafety}. Live Trading bleibt bis V8.0 gesperrt.
                </p>
              </div>
            </div>

            <div className="mt-6 bg-black border border-emerald-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧭 Broker API Layer Roadmap</h4>

              <div className="grid grid-cols-5 gap-4">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.3</h5>
                  <p className="text-gray-300 mt-2">Shared API Layer</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.4</h5>
                  <p className="text-gray-300 mt-2">Demo Auth Test</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.5</h5>
                  <p className="text-gray-300 mt-2">Market Data Bridge</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.6</h5>
                  <p className="text-gray-300 mt-2">Broker Account Sync</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.0</h5>
                  <p className="text-gray-300 mt-2">Live Execution</p>
                </div>
              </div>
            </div>
          </div>


          <div id="demo-auth-center" className="bg-gray-900 p-6 rounded-2xl border border-yellow-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🔐 Demo Authentication Center V7.4</h3>
                <p className="text-gray-400 mt-2">
                  Vorbereitung für sichere Demo-Authentifizierung bei Capital.com und IC Markets. Keine echten API Keys im Code, keine Live Orders.
                </p>
              </div>

              <div className="bg-black border border-yellow-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Demo Auth Status</p>
                <p className="text-yellow-400 font-bold">{demoAuthStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-yellow-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Auth Score</h4>
                <p className="text-5xl mt-4 text-yellow-400">{demoAuthScore}%</p>
                <p className="text-gray-400 mt-2">Prepared only</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Capital.com Demo</h4>
                <p className="text-2xl mt-4 text-blue-400">{capitalDemoAuthStatus}</p>
                <p className="text-gray-400 mt-2">Credential check later</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">IC Markets Demo</h4>
                <p className="text-2xl mt-4 text-purple-400">{icMarketsDemoAuthStatus}</p>
                <p className="text-gray-400 mt-2">Bridge check later</p>
              </div>

              <div className="bg-black border border-emerald-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Mode</h4>
                <p className="text-2xl mt-4 text-emerald-400">{demoAuthMode}</p>
                <p className="text-gray-400 mt-2">No secrets stored</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Permission</h4>
                <p className="text-2xl mt-4 text-red-400">{demoAuthPermission}</p>
                <p className="text-gray-400 mt-2">Live locked</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🔵 Capital.com Demo Auth</h4>
                <div className="space-y-3">
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">API Key: <span className="text-gray-500">{capitalDemoCredentialStatus}</span></div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Identifier: <span className="text-gray-500">{capitalDemoCredentialStatus}</span></div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Demo Test: <span className="text-red-400">{capitalDemoTestStatus}</span></div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">⚠️ Später nur über .env.local verbinden.</div>
                </div>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🌐 IC Markets Demo Auth</h4>
                <div className="space-y-3">
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Server: <span className="text-gray-500">{icMarketsDemoServerStatus}</span></div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Platform: <span className="text-purple-400">MT5 / cTrader later</span></div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Demo Bridge: <span className="text-red-400">{icMarketsDemoBridgeStatus}</span></div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">⚠️ Bridge wird erst später technisch angebunden.</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Auth Safety Rules</h4>
                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Keine Secrets in Git</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Demo zuerst</div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">⚠️ {demoAuthSafety}</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">🔒 Live Auth bleibt blockiert</div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-yellow-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧭 Demo Auth Roadmap</h4>
              <div className="grid grid-cols-5 gap-4">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4"><h5 className="font-bold">V7.4</h5><p className="text-gray-300 mt-2">Demo Auth Center</p></div>
                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4"><h5 className="font-bold">V7.5</h5><p className="text-gray-300 mt-2">Market Data Bridge</p></div>
                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4"><h5 className="font-bold">V7.6</h5><p className="text-gray-300 mt-2">Account Sync</p></div>
                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4"><h5 className="font-bold">V7.7</h5><p className="text-gray-300 mt-2">Position Sync</p></div>
                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4"><h5 className="font-bold">V8.0</h5><p className="text-gray-300 mt-2">Live Execution</p></div>
              </div>
            </div>
          </div>


          <div id="market-data-bridge" className="bg-gray-900 p-6 rounded-2xl border border-green-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">📈 Market Data Bridge V7.5</h3>
                <p className="text-gray-400 mt-2">
                  Offene Market-Data-Architektur für Broker-Preise, TradingView, Yahoo Finance, News, technische Analyse, Fundamentals und späteren AI Forward-Learning-Loop.
                </p>
              </div>

              <div className="bg-black border border-green-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Market Data Status</p>
                <p className="text-green-400 font-bold">{marketDataBridgeStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-green-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Bridge Score</h4>
                <p className="text-5xl mt-4 text-green-400">{marketDataBridgeScore}%</p>
                <p className="text-gray-400 mt-2">Architecture ready</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Provider</h4>
                <p className="text-2xl mt-4 text-blue-400">{marketDataProviderStatus}</p>
                <p className="text-gray-400 mt-2">Broker + external later</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Price Feed</h4>
                <p className="text-2xl mt-4 text-purple-400">{priceFeedStatus}</p>
                <p className="text-gray-400 mt-2">No live feed yet</p>
              </div>

              <div className="bg-black border border-yellow-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Tracked Markets</h4>
                <p className="text-5xl mt-4 text-yellow-400">{trackedMarketCount}</p>
                <p className="text-gray-400 mt-2">Watchlist prepared</p>
              </div>

              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">AI Learning</h4>
                <p className="text-2xl mt-4 text-cyan-400">{aiLearningBridgeStatus}</p>
                <p className="text-gray-400 mt-2">Forward testing later</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📡 Data Sources Roadmap</h4>

                <div className="space-y-3">
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">🔵 Capital.com Price + News later</div>
                  <div className="border border-purple-900 bg-purple-950 rounded-lg p-3">🌐 IC Markets Price Bridge later</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">📊 TradingView Technical Signals later</div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">🟡 Yahoo Finance Fundamentals later</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">📰 News + Macro Calendar later</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🧠 AI Resource Pipeline</h4>

                <div className="space-y-3">
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Market Prices → GPT Trade Analyst</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">News Events → Claude Risk Analyst</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Technical Signals → Consensus Engine</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Fundamentals → Trade Quality Score</div>
                  <div className="border border-cyan-900 bg-cyan-950 rounded-lg p-3">Forward Results → AI Learning Memory</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🧪 Feed Safety Rules</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Mock feed first</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ No live orders from feed</div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">⚠️ Provider API keys later via .env.local</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">🔒 Live execution remains blocked</div>
                </div>

                <div className="mt-5 border border-cyan-900 bg-cyan-950 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Data Freshness</p>
                  <p className="text-cyan-400 font-bold">{dataFreshnessStatus}</p>
                </div>

                <div className="mt-3 border border-green-900 bg-green-950 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Cache Status</p>
                  <p className="text-green-400 font-bold">{marketCacheStatus}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-green-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">👁 Market Watchlist Snapshot</h4>

              <div className="grid grid-cols-4 gap-4">
                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold text-blue-400">NAS100</h5>
                  <p className="text-gray-300 mt-2">Index · AI favourite</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold text-yellow-400">XAUUSD</h5>
                  <p className="text-gray-300 mt-2">Gold · Risk sentiment</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold text-orange-400">USOIL</h5>
                  <p className="text-gray-300 mt-2">Crude Oil · Macro driver</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold text-green-400">EURUSD</h5>
                  <p className="text-gray-300 mt-2">Forex · ECB/Fed</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-cyan-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🔁 Forward Learning Connection</h4>
              <p className="text-gray-300 leading-relaxed">
                V7.5 bereitet die Datenbasis vor, damit spätere AI-Agenten nicht nur Backtests lesen, sondern kommende Demo-Zeiträume planen können.
                Preise, News, technische Signale und Fundamentals werden später mit Demo-Trades, Ergebnissen und Strategie-Performance verbunden.
              </p>

              <div className="grid grid-cols-5 gap-4 mt-5">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.5</h5>
                  <p className="text-gray-300 mt-2">Market Data</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.6</h5>
                  <p className="text-gray-300 mt-2">News Resources</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.7</h5>
                  <p className="text-gray-300 mt-2">Forward Testing</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.8</h5>
                  <p className="text-gray-300 mt-2">AI Memory</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.0</h5>
                  <p className="text-gray-300 mt-2">Demo Agent</p>
                </div>
              </div>
            </div>
          </div>


          <div id="intelligence-layer" className="bg-gray-900 p-6 rounded-2xl border border-red-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">📰 News & Intelligence Resource Layer V7.6</h3>
                <p className="text-gray-400 mt-2">
                  Vorbereitung für professionelle Nachrichten-, Macro-, Sentiment- und Analysequellen. Später greifen GPT, Claude und AI-Agenten auf diese Ressourcen zu.
                </p>
              </div>

              <div className="bg-black border border-red-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Intelligence Status</p>
                <p className="text-red-400 font-bold">{intelligenceLayerStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Layer Score</h4>
                <p className="text-5xl mt-4 text-red-400">{intelligenceLayerScore}%</p>
                <p className="text-gray-400 mt-2">Resource architecture</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">News Feed</h4>
                <p className="text-2xl mt-4 text-blue-400">{newsFeedStatus}</p>
                <p className="text-gray-400 mt-2">Real providers later</p>
              </div>

              <div className="bg-black border border-yellow-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Macro Calendar</h4>
                <p className="text-2xl mt-4 text-yellow-400">{macroCalendarStatus}</p>
                <p className="text-gray-400 mt-2">CPI · NFP · FOMC</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Sentiment</h4>
                <p className="text-2xl mt-4 text-purple-400">{sentimentEngineStatus}</p>
                <p className="text-gray-400 mt-2">AI scoring later</p>
              </div>

              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">High Impact</h4>
                <p className="text-5xl mt-4 text-cyan-400">{highImpactEventCount}</p>
                <p className="text-gray-400 mt-2">Events tracked</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🌍 Professional Sources Roadmap</h4>
                <div className="space-y-3">
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">🔵 Yahoo Finance News + Fundamentals later</div>
                  <div className="border border-cyan-900 bg-cyan-950 rounded-lg p-3">📊 Capital.com News + Analysis later</div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">📅 Economic Calendar later</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">📰 Reuters / Bloomberg / FT style sources later</div>
                  <div className="border border-purple-900 bg-purple-950 rounded-lg p-3">📈 TradingView Ideas + Technical context later</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🧠 AI Intelligence Pipeline</h4>
                <div className="space-y-3">
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">News → Event Impact Score</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Macro → Risk Regime Detection</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Sentiment → Market Bias</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Fundamentals → Trade Quality Filter</div>
                  <div className="border border-cyan-900 bg-cyan-950 rounded-lg p-3">Results → AI Learning Memory</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Intelligence Safety Rules</h4>
                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Mock intelligence first</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Source attribution later</div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">⚠️ API keys only via .env.local</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">🔒 News cannot trigger live orders alone</div>
                </div>

                <div className="mt-5 border border-red-900 bg-red-950 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">AI Intelligence</p>
                  <p className="text-red-400 font-bold">{aiIntelligenceStatus}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-yellow-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">📅 Macro Event Snapshot</h4>

              <div className="grid grid-cols-5 gap-4">
                <div className="border border-red-900 bg-red-950 rounded-lg p-4">
                  <h5 className="font-bold">FOMC</h5>
                  <p className="text-gray-300 mt-2">USD rate risk</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">CPI</h5>
                  <p className="text-gray-300 mt-2">Inflation shock</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">NFP</h5>
                  <p className="text-gray-300 mt-2">Labor market</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">ECB</h5>
                  <p className="text-gray-300 mt-2">EUR risk</p>
                </div>

                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">Oil Inventories</h5>
                  <p className="text-gray-300 mt-2">USOIL driver</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-cyan-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🔁 Connection to Forward Learning</h4>
              <p className="text-gray-300 leading-relaxed">
                V7.6 verbindet Nachrichten, Macro Events, Sentiment und externe Analysequellen mit der späteren Forward Testing Engine.
                Die AI soll dadurch lernen, welche News- und Macro-Bedingungen bestimmte Strategien verbessern oder blockieren.
              </p>

              <div className="grid grid-cols-5 gap-4 mt-5">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.6</h5>
                  <p className="text-gray-300 mt-2">Intelligence</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.7</h5>
                  <p className="text-gray-300 mt-2">Forward Testing</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.8</h5>
                  <p className="text-gray-300 mt-2">AI Memory</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.9</h5>
                  <p className="text-gray-300 mt-2">Strategy Evolution</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.0</h5>
                  <p className="text-gray-300 mt-2">Demo Agent</p>
                </div>
              </div>
            </div>
          </div>


          <div id="forward-testing-engine" className="bg-gray-900 p-6 rounded-2xl border border-fuchsia-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🚀 Forward Testing Engine V7.7</h3>
                <p className="text-gray-400 mt-2">
                  Vorbereitung für AI-Forward-Tests: kommende Tage, Wochen oder Monate planen, Demo-Trades später auswerten und erfolgreiche Strategien für zukünftige Entscheidungen speichern.
                </p>
              </div>

              <div className="bg-black border border-fuchsia-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Forward Testing Status</p>
                <p className="text-fuchsia-400 font-bold">{forwardTestingStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-fuchsia-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Engine Score</h4>
                <p className="text-5xl mt-4 text-fuchsia-400">{forwardTestingScore}%</p>
                <p className="text-gray-400 mt-2">Forward architecture</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Mode</h4>
                <p className="text-2xl mt-4 text-blue-400">{forwardTestingMode}</p>
                <p className="text-gray-400 mt-2">Demo execution later</p>
              </div>

              <div className="bg-black border border-yellow-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Planned Tests</h4>
                <p className="text-5xl mt-4 text-yellow-400">{plannedForwardTests}</p>
                <p className="text-gray-400 mt-2">Mock plans ready</p>
              </div>

              <div className="bg-black border border-green-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Completed</h4>
                <p className="text-5xl mt-4 text-green-400">{completedForwardTests}</p>
                <p className="text-gray-400 mt-2">Results later</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Demo Execution</h4>
                <p className="text-2xl mt-4 text-red-400">{demoExecutionStatus}</p>
                <p className="text-gray-400 mt-2">No real orders</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📋 Forward Test Plans</h4>

                <div className="space-y-3">
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">
                    NAS100 · Momentum Breakout · LONG · 83% Confidence
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    XAUUSD · Risk-Off Trend · LONG · 78% Confidence
                  </div>
                  <div className="border border-orange-900 bg-orange-950 rounded-lg p-3">
                    USOIL · Inventory Reaction · SHORT · 71% Confidence
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Planung für morgen, nächste Woche oder nächsten Monat später möglich.
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🧠 Learning Loop Logic</h4>

                <div className="space-y-3">
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">AI plant Setup</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Demo Trade wird später ausgeführt</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Resultat wird analysiert</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Strategie-Score wird aktualisiert</div>
                  <div className="border border-cyan-900 bg-cyan-950 rounded-lg p-3">Beste Logiken gehen in AI Memory</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Forward Safety Rules</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Nur Planung in V7.7</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Keine Live Orders</div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">⚠️ Demo Execution erst später</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">🔒 Live Execution bleibt blockiert</div>
                </div>

                <div className="mt-5 border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Strategy Learning</p>
                  <p className="text-purple-400 font-bold">{strategyLearningStatus}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-fuchsia-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">📊 Strategy Score Preview</h4>

              <div className="grid grid-cols-4 gap-4">
                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">Momentum Breakout</h5>
                  <p className="text-gray-300 mt-2">Score later · NAS100</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">Risk-Off Trend</h5>
                  <p className="text-gray-300 mt-2">Score later · XAUUSD</p>
                </div>

                <div className="border border-orange-900 bg-orange-950 rounded-lg p-4">
                  <h5 className="font-bold">Inventory Reaction</h5>
                  <p className="text-gray-300 mt-2">Score later · USOIL</p>
                </div>

                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">Macro Momentum</h5>
                  <p className="text-gray-300 mt-2">Score later · Forex</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-cyan-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🔁 Roadmap to AI Learning</h4>
              <p className="text-gray-300 leading-relaxed">
                V7.7 erstellt die Grundlage, damit AI-Agenten nicht nur alte Daten auswerten, sondern zukünftige Demo-Zeiträume planen können.
                Später werden Ergebnisse, Marktbedingungen, News, technische Signale und Fundamentals gespeichert und in Strategy Evolution genutzt.
              </p>

              <div className="grid grid-cols-5 gap-4 mt-5">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.7</h5>
                  <p className="text-gray-300 mt-2">Forward Testing</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.8</h5>
                  <p className="text-gray-300 mt-2">AI Memory</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.9</h5>
                  <p className="text-gray-300 mt-2">Strategy Evolution</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.0</h5>
                  <p className="text-gray-300 mt-2">Demo Agent</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V9.0</h5>
                  <p className="text-gray-300 mt-2">Controlled Live</p>
                </div>
              </div>
            </div>
          </div>


          <div id="ai-learning-memory" className="bg-gray-900 p-6 rounded-2xl border border-cyan-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🧠 AI Learning Memory V7.8</h3>
                <p className="text-gray-400 mt-2">
                  Vorbereitung für den Lernspeicher: Trade-Ergebnisse, Strategie-Performance, Marktverhalten und erfolgreiche AI-Logiken werden später gespeichert und für zukünftige Entscheidungen genutzt.
                </p>
              </div>

              <div className="bg-black border border-cyan-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Memory Status</p>
                <p className="text-cyan-400 font-bold">{aiMemoryStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Memory Score</h4>
                <p className="text-5xl mt-4 text-cyan-400">{aiMemoryScore}%</p>
                <p className="text-gray-400 mt-2">Learning architecture</p>
              </div>

              <div className="bg-black border border-green-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Trade Memory</h4>
                <p className="text-2xl mt-4 text-green-400">{tradeMemoryStatus}</p>
                <p className="text-gray-400 mt-2">Results later</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Strategy Memory</h4>
                <p className="text-2xl mt-4 text-purple-400">{strategyMemoryStatus}</p>
                <p className="text-gray-400 mt-2">Ranking later</p>
              </div>

              <div className="bg-black border border-yellow-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Market Memory</h4>
                <p className="text-2xl mt-4 text-yellow-400">{marketMemoryStatus}</p>
                <p className="text-gray-400 mt-2">Behavior later</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Entries</h4>
                <p className="text-5xl mt-4 text-blue-400">{memoryEntriesCount}</p>
                <p className="text-gray-400 mt-2">Empty for now</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📚 Memory Types</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    Trade Memory · Entry, Result, Market, Strategy
                  </div>
                  <div className="border border-purple-900 bg-purple-950 rounded-lg p-3">
                    Strategy Memory · Winrate, Average Return, Confidence
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    Market Memory · Best Strategy, Market Behavior, Conditions
                  </div>
                  <div className="border border-cyan-900 bg-cyan-950 rounded-lg p-3">
                    Learning Manager · verbindet alles für AI Decisions
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🔁 Learning Feedback Loop</h4>

                <div className="space-y-3">
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Forward Test wird geplant</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Demo Resultat wird gespeichert</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Strategie wird bewertet</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">Marktverhalten wird dokumentiert</div>
                  <div className="border border-cyan-900 bg-cyan-950 rounded-lg p-3">AI nutzt Memory für nächste Planung</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Memory Safety Rules</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Memory Layer vorbereitet</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Keine automatischen Live Orders</div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">⚠️ Persistente DB später</div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">🔒 Live Execution bleibt blockiert</div>
                </div>

                <div className="mt-5 border border-cyan-900 bg-cyan-950 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Learning Loop</p>
                  <p className="text-cyan-400 font-bold">{learningLoopStatus}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-cyan-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧩 Memory Example Preview</h4>

              <div className="grid grid-cols-4 gap-4">
                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">NAS100</h5>
                  <p className="text-gray-300 mt-2">Momentum Breakout · result later</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">XAUUSD</h5>
                  <p className="text-gray-300 mt-2">Risk-Off Trend · result later</p>
                </div>

                <div className="border border-orange-900 bg-orange-950 rounded-lg p-4">
                  <h5 className="font-bold">USOIL</h5>
                  <p className="text-gray-300 mt-2">Inventory Reaction · result later</p>
                </div>

                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">EURUSD</h5>
                  <p className="text-gray-300 mt-2">Macro Momentum · result later</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-purple-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🚀 Roadmap to Strategy Evolution</h4>
              <p className="text-gray-300 leading-relaxed">
                V7.8 bereitet den Speicher vor, damit spätere Forward-Test-Ergebnisse dauerhaft genutzt werden können.
                Gewinner-Strategien werden später höher gewichtet, schwache Setups werden reduziert und neue Marktbedingungen werden automatisch dokumentiert.
              </p>

              <div className="grid grid-cols-5 gap-4 mt-5">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.8</h5>
                  <p className="text-gray-300 mt-2">AI Memory</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.9</h5>
                  <p className="text-gray-300 mt-2">Strategy Evolution</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.0</h5>
                  <p className="text-gray-300 mt-2">Demo Agent</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.5</h5>
                  <p className="text-gray-300 mt-2">Learning Reports</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V9.0</h5>
                  <p className="text-gray-300 mt-2">Controlled Live</p>
                </div>
              </div>
            </div>
          </div>


          <div id="strategy-evolution-engine" className="bg-gray-900 p-6 rounded-2xl border border-lime-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🧬 Strategy Evolution Engine V7.9</h3>
                <p className="text-gray-400 mt-2">
                  Vorbereitung für dynamisches Strategie-Ranking: Gewinner-Strategien werden höher gewichtet, schwache Setups zurückgestuft und Marktbedingungen später automatisch angepasst.
                </p>
              </div>

              <div className="bg-black border border-lime-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Evolution Status</p>
                <p className="text-lime-400 font-bold">{strategyEvolutionStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-lime-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Evolution Score</h4>
                <p className="text-5xl mt-4 text-lime-400">{strategyEvolutionScore}%</p>
                <p className="text-gray-400 mt-2">Ranking architecture</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Top Strategy</h4>
                <p className="text-2xl mt-4 text-purple-400">{topEvolvingStrategy}</p>
                <p className="text-gray-400 mt-2">Mock leader</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Ranking</h4>
                <p className="text-2xl mt-4 text-blue-400">{strategyRankingStatus}</p>
                <p className="text-gray-400 mt-2">Leaderboard later</p>
              </div>

              <div className="bg-black border border-yellow-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Confidence</h4>
                <p className="text-2xl mt-4 text-yellow-400">{confidenceEngineStatus}</p>
                <p className="text-gray-400 mt-2">Score adjustment</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Agent</h4>
                <p className="text-2xl mt-4 text-red-400">{autonomousAgentStatus}</p>
                <p className="text-gray-400 mt-2">V8.0 later</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🏆 Strategy Leaderboard Preview</h4>

                <div className="space-y-3">
                  <div className="border border-lime-900 bg-lime-950 rounded-lg p-3">
                    1. Risk-Off Trend · 86 Evolution Score · XAUUSD
                  </div>
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">
                    2. Momentum Breakout · 78 Evolution Score · NAS100
                  </div>
                  <div className="border border-orange-900 bg-orange-950 rounded-lg p-3">
                    3. Inventory Reaction · 69 Evolution Score · USOIL
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Dynamic ranking wird später aus echten Forward-Test-Resultaten berechnet.
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🌍 Market Adaptation</h4>

                <div className="space-y-3">
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">
                    NAS100 → Momentum Breakout
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    XAUUSD → Risk-Off Trend
                  </div>
                  <div className="border border-orange-900 bg-orange-950 rounded-lg p-3">
                    USOIL → Inventory Reaction
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    EURUSD → Macro Momentum
                  </div>
                  <div className="border border-cyan-900 bg-cyan-950 rounded-lg p-3">
                    Market Adaptation: {marketAdaptationStatus}
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Evolution Safety Rules</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Nur Ranking in V7.9
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Keine autonomen Orders
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Demo Agent kommt erst V8.0
                  </div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">
                    🔒 Live Execution bleibt blockiert
                  </div>
                </div>

                <div className="mt-5 border border-lime-900 bg-lime-950 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Evolution Mode</p>
                  <p className="text-lime-400 font-bold">{evolutionMode}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-purple-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧠 Confidence Engine Preview</h4>

              <div className="grid grid-cols-4 gap-4">
                <div className="border border-lime-900 bg-lime-950 rounded-lg p-4">
                  <h5 className="font-bold">Winrate</h5>
                  <p className="text-gray-300 mt-2">höhere Gewichtung bei stabilen Ergebnissen</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">Average Return</h5>
                  <p className="text-gray-300 mt-2">Strategien mit besserem Return steigen</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">Market Fit</h5>
                  <p className="text-gray-300 mt-2">Strategie wird pro Markt angepasst</p>
                </div>

                <div className="border border-red-900 bg-red-950 rounded-lg p-4">
                  <h5 className="font-bold">Risk Filter</h5>
                  <p className="text-gray-300 mt-2">schwache Setups werden reduziert</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-cyan-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🚀 Roadmap to Demo Trading Agent</h4>
              <p className="text-gray-300 leading-relaxed">
                V7.9 bildet die Entscheidungslogik für V8.0. Der spätere Demo Trading Agent soll nicht zufällig handeln,
                sondern anhand von Strategie-Ranking, Marktanpassung, Confidence Score, News, Fundamentals und Risk-Filter entscheiden.
              </p>

              <div className="grid grid-cols-5 gap-4 mt-5">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V7.9</h5>
                  <p className="text-gray-300 mt-2">Strategy Evolution</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.0</h5>
                  <p className="text-gray-300 mt-2">Demo Agent</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.1</h5>
                  <p className="text-gray-300 mt-2">Demo Execution</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.5</h5>
                  <p className="text-gray-300 mt-2">Learning Reports</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V9.0</h5>
                  <p className="text-gray-300 mt-2">Controlled Live</p>
                </div>
              </div>
            </div>
          </div>


          <div id="demo-trading-agent" className="bg-gray-900 p-6 rounded-2xl border border-indigo-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">🤖 Demo Trading Agent V8.0</h3>
                <p className="text-gray-400 mt-2">
                  Zentraler AI-Agent-Kern: verbindet GPT Analyst, Claude Risk, Consensus Engine, Forward Testing, AI Memory und Strategy Evolution zu einem Demo-Trading-Planer.
                </p>
              </div>

              <div className="bg-black border border-indigo-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Agent Status</p>
                <p className="text-indigo-400 font-bold">{demoAgentStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-indigo-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Agent Score</h4>
                <p className="text-5xl mt-4 text-indigo-400">{demoAgentScore}%</p>
                <p className="text-gray-400 mt-2">AI brain architecture</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Mode</h4>
                <p className="text-2xl mt-4 text-blue-400">{agentMode}</p>
                <p className="text-gray-400 mt-2">No execution yet</p>
              </div>

              <div className="bg-black border border-purple-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Decision</h4>
                <p className="text-2xl mt-4 text-purple-400">{agentDecisionStatus}</p>
                <p className="text-gray-400 mt-2">AI plan later</p>
              </div>

              <div className="bg-black border border-green-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Consensus</h4>
                <p className="text-2xl mt-4 text-green-400">{agentConsensusStatus}</p>
                <p className="text-gray-400 mt-2">GPT + Claude</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Live Execution</h4>
                <p className="text-2xl mt-4 text-red-400">{agentLiveExecutionStatus}</p>
                <p className="text-gray-400 mt-2">Safety first</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🧠 Agent Brain</h4>

                <div className="space-y-3">
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">
                    Market: NAS100
                  </div>
                  <div className="border border-purple-900 bg-purple-950 rounded-lg p-3">
                    Strategy: Momentum Breakout
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    Direction: LONG
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    Confidence: 83%
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    AI decision is mock/planning only in V8.0.
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">⚡ Agent Consensus</h4>

                <div className="space-y-3">
                  <div className="border border-cyan-900 bg-cyan-950 rounded-lg p-3">
                    GPT Vote: LONG
                  </div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">
                    Claude Risk Vote: LONG
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    Agreement: 100%
                  </div>
                  <div className="border border-purple-900 bg-purple-950 rounded-lg p-3">
                    Result: APPROVED
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Execution still locked until V8.1+.
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Agent Safety Rules</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Planning only in V8.0
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ No broker order placement
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Demo execution starts later
                  </div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">
                    🔒 Live trading remains blocked
                  </div>
                </div>

                <div className="mt-5 border border-indigo-900 bg-indigo-950 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Next Phase</p>
                  <p className="text-indigo-400 font-bold">{agentNextPhase}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-indigo-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">📋 Demo Trade Plans Preview</h4>

              <div className="grid grid-cols-3 gap-4">
                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">PLAN-001 · NAS100</h5>
                  <p className="text-gray-300 mt-2">Momentum Breakout · LONG · 83%</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">PLAN-002 · XAUUSD</h5>
                  <p className="text-gray-300 mt-2">Risk-Off Trend · LONG · 78%</p>
                </div>

                <div className="border border-orange-900 bg-orange-950 rounded-lg p-4">
                  <h5 className="font-bold">PLAN-003 · USOIL</h5>
                  <p className="text-gray-300 mt-2">Inventory Reaction · SHORT · 71%</p>
                </div>
              </div>

              <div className="mt-5 border border-indigo-900 bg-indigo-950 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Planned Agent Trades</p>
                <p className="text-indigo-400 text-3xl font-bold">{agentTradePlans}</p>
              </div>
            </div>

            <div className="mt-6 bg-black border border-cyan-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🔁 Full AI Agent Pipeline</h4>
              <p className="text-gray-300 leading-relaxed">
                V8.0 verbindet alle bisherigen Module zu einem zentralen Agenten. Der Agent kann Märkte, Strategien, Memory, Intelligence, Consensus und Risk-Status lesen,
                aber in dieser Version noch keine Orders ausführen. Demo-Ausführung kommt erst mit V8.1.
              </p>

              <div className="grid grid-cols-5 gap-4 mt-5">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">GPT</h5>
                  <p className="text-gray-300 mt-2">Trade Analyst</p>
                </div>

                <div className="border border-red-900 bg-red-950 rounded-lg p-4">
                  <h5 className="font-bold">Claude</h5>
                  <p className="text-gray-300 mt-2">Risk Analyst</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">Memory</h5>
                  <p className="text-gray-300 mt-2">Learning Data</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">Evolution</h5>
                  <p className="text-gray-300 mt-2">Strategy Ranking</p>
                </div>

                <div className="border border-indigo-900 bg-indigo-950 rounded-lg p-4">
                  <h5 className="font-bold">Agent</h5>
                  <p className="text-gray-300 mt-2">Demo Planner</p>
                </div>
              </div>
            </div>
          </div>


          <div id="demo-execution-engine" className="bg-gray-900 p-6 rounded-2xl border border-orange-900 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold">⚡ Demo Execution Engine V8.1</h3>
                <p className="text-gray-400 mt-2">
                  Sichere Demo-Ausführungsschicht: Agent-Pläne werden in Paper/Demo Orders übersetzt. Keine Live Orders, keine echten Broker-Trades.
                </p>
              </div>

              <div className="bg-black border border-orange-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Execution Status</p>
                <p className="text-orange-400 font-bold">{demoExecutionEngineStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div className="bg-black border border-orange-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Execution Score</h4>
                <p className="text-5xl mt-4 text-orange-400">{demoExecutionEngineScore}%</p>
                <p className="text-gray-400 mt-2">Demo architecture</p>
              </div>

              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Mode</h4>
                <p className="text-2xl mt-4 text-cyan-400">{executionMode}</p>
                <p className="text-gray-400 mt-2">Paper engine only</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Generated Orders</h4>
                <p className="text-5xl mt-4 text-blue-400">{generatedDemoOrders}</p>
                <p className="text-gray-400 mt-2">Mock execution plans</p>
              </div>

              <div className="bg-black border border-green-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Open Executions</h4>
                <p className="text-5xl mt-4 text-green-400">{openDemoExecutions}</p>
                <p className="text-gray-400 mt-2">Execution later</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Live Firewall</h4>
                <p className="text-2xl mt-4 text-red-400">{liveOrderFirewallStatus}</p>
                <p className="text-gray-400 mt-2">Broker orders blocked</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📦 Demo Order Generator</h4>

                <div className="space-y-3">
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">
                    NAS100 · LONG · Momentum Breakout · Confidence 83%
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    XAUUSD · LONG · Risk-Off Trend · Confidence 78%
                  </div>
                  <div className="border border-orange-900 bg-orange-950 rounded-lg p-3">
                    USOIL · SHORT · Inventory Reaction · Confidence 71%
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Orders are generated for demo/paper mode only.
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🔗 Paper Order Bridge</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    Agent Plan → Demo Order
                  </div>
                  <div className="border border-cyan-900 bg-cyan-950 rounded-lg p-3">
                    Demo Order → Paper Engine
                  </div>
                  <div className="border border-purple-900 bg-purple-950 rounded-lg p-3">
                    Paper Engine → Position Manager
                  </div>
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">
                    Result → AI Learning Memory
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    Bridge Status: {paperOrderBridgeStatus}
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡 Execution Safety Rules</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Demo/Paper only
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ No broker execution
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Real broker bridge stays disconnected
                  </div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">
                    🔒 Live order placement blocked
                  </div>
                </div>

                <div className="mt-5 border border-orange-900 bg-orange-950 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Execution Safety</p>
                  <p className="text-orange-400 font-bold">{executionSafetyStatus}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-orange-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧾 Execution Ticket Preview</h4>

              <div className="grid grid-cols-3 gap-4">
                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">DEMO-001 · NAS100</h5>
                  <p className="text-gray-300 mt-2">LONG · SL 120 pts · TP 300 pts · Paper only</p>
                </div>

                <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-4">
                  <h5 className="font-bold">DEMO-002 · XAUUSD</h5>
                  <p className="text-gray-300 mt-2">LONG · SL 25 pts · TP 60 pts · Paper only</p>
                </div>

                <div className="border border-orange-900 bg-orange-950 rounded-lg p-4">
                  <h5 className="font-bold">DEMO-003 · USOIL</h5>
                  <p className="text-gray-300 mt-2">SHORT · SL 1.2 · TP 2.8 · Paper only</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-black border border-cyan-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🔁 Execution Learning Pipeline</h4>
              <p className="text-gray-300 leading-relaxed">
                V8.1 verbindet den Demo Agent mit einer sicheren Paper-Execution-Schicht. Später werden Demo-Orders ausgeführt,
                Positionen verfolgt, Ergebnisse analysiert und zurück in AI Memory sowie Strategy Evolution geschrieben.
              </p>

              <div className="grid grid-cols-5 gap-4 mt-5">
                <div className="border border-indigo-900 bg-indigo-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.0</h5>
                  <p className="text-gray-300 mt-2">Demo Agent</p>
                </div>

                <div className="border border-orange-900 bg-orange-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.1</h5>
                  <p className="text-gray-300 mt-2">Demo Execution</p>
                </div>

                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.2</h5>
                  <p className="text-gray-300 mt-2">Performance Tracker</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.3</h5>
                  <p className="text-gray-300 mt-2">Feedback Engine</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V8.5</h5>
                  <p className="text-gray-300 mt-2">Learning Reports</p>
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
              <p className="text-orange-400 text-2xl font-bold">API Layer Prepared</p>
              <p className="text-gray-400 mt-3">Capital.com · IC Markets · Shared broker interface ready.</p>
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
                <p className="text-blue-400 mt-2">Connector UI V7.1 ready</p>
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