"use client";

import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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

type Trade = {
  id: number;
  date: string;
  market: string;
  direction: string;
  strategy: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;

  accountSize: number;
  riskPercent: number;
  riskAmount: number;
  riskReward: number;
  positionSize: number;

  status: string;
  result: string;
  profitLoss: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

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

function getAverageRiskReward(data: Trade[]) {
  const tradesWithRisk = data.filter((trade) => trade.riskReward > 0);
  if (tradesWithRisk.length === 0) return 0;

  const total = tradesWithRisk.reduce((sum, trade) => sum + trade.riskReward, 0);
  return Number((total / tradesWithRisk.length).toFixed(2));
}

function getTotalRiskAmount(data: Trade[]) {
  return data.reduce((sum, trade) => sum + (trade.riskAmount ?? 0), 0);
}

function buildEquityCurve(data: Trade[]) {
  let equity = 0;

  return [...data]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .map((trade) => {
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

// ===== Account Equity System V4.7.1 =====

function buildAccountEquityCurve(data: Trade[], startingBalance: number) {
  let accountEquity = startingBalance;
  let peakAccountEquity = startingBalance;

  return [...data]
    .filter((trade) => trade.status === "CLOSED")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .map((trade) => {
      accountEquity += trade.profitLoss;

      if (accountEquity > peakAccountEquity) {
        peakAccountEquity = accountEquity;
      }

      const drawdown = accountEquity - peakAccountEquity;
      const drawdownPercent =
        peakAccountEquity > 0
          ? Number(((Math.abs(drawdown) / peakAccountEquity) * 100).toFixed(2))
          : 0;

      return {
        name: `#${trade.id}`,
        date: trade.date,
        market: trade.market,
        profitLoss: trade.profitLoss,
        accountEquity: Number(accountEquity.toFixed(2)),
        peakAccountEquity: Number(peakAccountEquity.toFixed(2)),
        drawdown: Number(drawdown.toFixed(2)),
        drawdownPercent,
      };
    });
}

function getAccountEquityStats(data: Trade[], startingBalance: number) {
  const accountEquityData = buildAccountEquityCurve(data, startingBalance);
  const totalProfit = getTotalProfit(data);
  const currentEquity = startingBalance + totalProfit;
  const growthPercent =
    startingBalance > 0 ? (totalProfit / startingBalance) * 100 : 0;

  const peakAccountEquity = accountEquityData.reduce(
    (highest, item) => Math.max(highest, item.peakAccountEquity),
    startingBalance
  );

  let maxDrawdown = 0;
  let currentDrawdown = 0;
  let maxDrawdownPercent = 0;

  accountEquityData.forEach((item) => {
    currentDrawdown = item.drawdown;

    if (item.drawdown < maxDrawdown) {
      maxDrawdown = item.drawdown;
      maxDrawdownPercent = item.drawdownPercent;
    }
  });

  return {
    currentEquity: Number(currentEquity.toFixed(2)),
    growthPercent: Number(growthPercent.toFixed(2)),
    peakAccountEquity: Number(peakAccountEquity.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    currentDrawdown: Number(currentDrawdown.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    accountEquityData,
  };
}


// ===== Prop Firm Risk Rules V4.8 =====

function getDateKey(dateValue: string) {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getPropFirmRiskStats(input: {
  trades: Trade[];
  startingBalance: number;
  maxDailyLossPercent: number;
  maxOverallDrawdownPercent: number;
}) {
  const dailyLossLimit = Number(
    ((input.startingBalance * input.maxDailyLossPercent) / 100).toFixed(2)
  );

  const overallDrawdownLimit = Number(
    ((input.startingBalance * input.maxOverallDrawdownPercent) / 100).toFixed(2)
  );

  const todayKey = getTodayKey();

  const todaysClosedTrades = input.trades.filter(
    (trade) => trade.status === "CLOSED" && getDateKey(trade.date) === todayKey
  );

  const todayLoss = Math.abs(
    todaysClosedTrades
      .filter((trade) => trade.profitLoss < 0)
      .reduce((sum, trade) => sum + trade.profitLoss, 0)
  );

  const accountEquityData = buildAccountEquityCurve(
    input.trades,
    input.startingBalance
  );

  const lowestAccountEquity = accountEquityData.reduce(
    (lowest, item) => Math.min(lowest, item.accountEquity),
    input.startingBalance
  );

  const overallDrawdownUsed = Math.max(
    0,
    Number((input.startingBalance - lowestAccountEquity).toFixed(2))
  );

  const dailyUsagePercent =
    dailyLossLimit > 0 ? (todayLoss / dailyLossLimit) * 100 : 0;

  const overallUsagePercent =
    overallDrawdownLimit > 0
      ? (overallDrawdownUsed / overallDrawdownLimit) * 100
      : 0;

  const isViolation =
    todayLoss > dailyLossLimit || overallDrawdownUsed > overallDrawdownLimit;

  const isWarning =
    !isViolation && (dailyUsagePercent >= 80 || overallUsagePercent >= 80);

  const status = isViolation ? "VIOLATION" : isWarning ? "WARNING" : "PASS";

  return {
    dailyLossLimit,
    overallDrawdownLimit,
    todayLoss: Number(todayLoss.toFixed(2)),
    overallDrawdownUsed,
    remainingDailyLoss: Number((dailyLossLimit - todayLoss).toFixed(2)),
    remainingOverallDrawdown: Number(
      (overallDrawdownLimit - overallDrawdownUsed).toFixed(2)
    ),
    dailyUsagePercent: Number(dailyUsagePercent.toFixed(2)),
    overallUsagePercent: Number(overallUsagePercent.toFixed(2)),
    status,
  };
}

// ===== Max Drawdown System V4.6 =====

function getMaxDrawdownStats(data: Trade[]) {
  const closedTrades = [...data]
    .filter((trade) => trade.status === "CLOSED")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  let maxDrawdownPercent = 0;

  const drawdownData = closedTrades.map((trade) => {
    equity += trade.profitLoss;

    if (equity > peak) {
      peak = equity;
    }

    currentDrawdown = equity - peak;

    if (currentDrawdown < maxDrawdown) {
      maxDrawdown = currentDrawdown;
      maxDrawdownPercent = peak > 0 ? (Math.abs(maxDrawdown) / peak) * 100 : 0;
    }

    return {
      name: `#${trade.id}`,
      equity,
      peak,
      drawdown: currentDrawdown,
    };
  });

  return {
    maxDrawdown: Math.round(maxDrawdown),
    currentDrawdown: Math.round(currentDrawdown),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    peakEquity: Math.round(peak),
    drawdownData,
  };
}









// ===== Bot Readiness Center V5.9 =====

type BotReadinessResult = {
  score: number;
  phase: "Training Phase" | "Validation Phase" | "Bot Ready";
  verdict: string;
  missingTrades: number;
  checklist: {
    label: string;
    status: "READY" | "BUILDING" | "LOCKED";
    value: string;
  }[];
  connections: {
    name: string;
    status: "Ready" | "Coming Soon" | "Locked";
  }[];
};

function getBotReadinessResult(input: {
  closedTrades: number;
  winrate: number;
  profitFactor: number;
  expectancyR: number;
  maxDrawdownPercent: number;
  journalIntelligenceScore: number;
  performanceScore: number;
  signalConfidence: number;
}) {
  let score = 0;

  if (input.closedTrades >= 25) score += 10;
  if (input.closedTrades >= 100) score += 10;
  if (input.closedTrades >= 250) score += 10;

  if (input.winrate >= 50) score += 10;
  if (input.winrate >= 60) score += 10;

  if (input.profitFactor >= 1.2) score += 10;
  if (input.profitFactor >= 1.5) score += 10;

  if (input.expectancyR > 0) score += 10;
  if (input.maxDrawdownPercent <= 10) score += 10;
  if (input.journalIntelligenceScore >= 60) score += 5;
  if (input.performanceScore >= 60) score += 5;
  if (input.signalConfidence >= 60) score += 10;

  score = Math.min(score, 100);

  const missingTrades = Math.max(0, 500 - input.closedTrades);

  const phase =
    score >= 80 && input.closedTrades >= 250
      ? "Bot Ready"
      : score >= 55 && input.closedTrades >= 100
        ? "Validation Phase"
        : "Training Phase";

  const verdict =
    phase === "Bot Ready"
      ? "System ist nahe an Bot-Bereitschaft. Broker-Integration kann vorbereitet werden."
      : phase === "Validation Phase"
        ? "System ist in der Validierungsphase. Mehr Daten und stabile Kennzahlen sammeln."
        : "Noch nicht bereit fr Live Auto Trading. Erst mehr Trades und stabile Performance sammeln.";

  return {
    score,
    phase,
    verdict,
    missingTrades,
    checklist: [
      {
        label: "Data Collection",
        status: input.closedTrades >= 25 ? "READY" : "BUILDING",
        value: `${input.closedTrades} Closed Trades`,
      },
      {
        label: "Journal Analytics",
        status: input.journalIntelligenceScore >= 50 ? "READY" : "BUILDING",
        value: `${input.journalIntelligenceScore}/100`,
      },
      {
        label: "Strategy Builder",
        status: "READY",
        value: "V5.7 active",
      },
      {
        label: "Signal Engine",
        status: input.signalConfidence >= 60 ? "READY" : "BUILDING",
        value: `${input.signalConfidence}% Confidence`,
      },
      {
        label: "AI Trade Review",
        status: "READY",
        value: "V5.6 active",
      },
      {
        label: "Broker Integration",
        status: "LOCKED",
        value: "V6.0",
      },
      {
        label: "GPT / OpenAI Integration",
        status: "LOCKED",
        value: "Coming Soon",
      },
      {
        label: "Claude Integration",
        status: "LOCKED",
        value: "Coming Soon",
      },
      {
        label: "Auto Execution",
        status: "LOCKED",
        value: "Final Stage",
      },
    ],
    connections: [
      { name: "OpenAI GPT", status: "Coming Soon" },
      { name: "Claude", status: "Coming Soon" },
      { name: "Capital.com", status: "Coming Soon" },
      { name: "IC Markets", status: "Coming Soon" },
      { name: "MetaTrader 5", status: "Coming Soon" },
      { name: "TradingView", status: "Coming Soon" },
    ],
  } satisfies BotReadinessResult;
}

// ===== Signal Engine V5.8 =====

type SignalEngineResult = {
  confidenceScore: number;
  setupQuality: "A+" | "A" | "B" | "C" | "D";
  recommendation: "TRADE" | "WAIT" | "AVOID";
  riskStatus: "PASS" | "WARNING" | "FAIL";
  strategyStatus: "PASS" | "WARNING" | "FAIL";
  marketStatus: "PASS" | "WARNING" | "FAIL";
  checks: {
    label: string;
    status: "PASS" | "WARNING" | "FAIL";
  }[];
  distribution: {
    signal: string;
    count: number;
  }[];
};

function getSignalEngineResult(input: {
  selectedStrategy: string;
  selectedMarket: string;
  plannedRiskAmount: number;
  riskReward: number;
  winrate: number;
  profitFactor: number;
  expectancyR: number;
  propFirmStatus: string;
  remainingDailyLimit: number;
  strategyStats: ReturnType<typeof getStrategyStats>;
  marketIntelligence: ReturnType<typeof getMarketIntelligence>;
  aiTradeReviewStats: ReturnType<typeof getAITradeReviewStats>;
}): SignalEngineResult {
  const selectedStrategyStats = input.strategyStats.strategyStats.find(
    (item) => item.strategy === input.selectedStrategy
  );

  const selectedMarketStats = input.marketIntelligence.marketStats.find(
    (item) => item.market === input.selectedMarket
  );

  const strategyProfit = selectedStrategyStats?.profitLoss ?? 0;
  const strategyWinrate = selectedStrategyStats?.winrate ?? 0;
  const marketProfit = selectedMarketStats?.profitLoss ?? 0;
  const marketWinrate = selectedMarketStats?.winrate ?? 0;

  let confidenceScore = 0;

  if (input.winrate >= 50) confidenceScore += 15;
  if (input.winrate >= 60) confidenceScore += 10;

  if (input.profitFactor >= 1.2) confidenceScore += 15;
  if (input.profitFactor >= 2) confidenceScore += 10;

  if (input.expectancyR > 0) confidenceScore += 15;
  if (input.expectancyR >= 0.5) confidenceScore += 10;

  if (strategyProfit > 0) confidenceScore += 15;
  if (strategyWinrate >= 60) confidenceScore += 5;

  if (marketProfit > 0) confidenceScore += 10;
  if (marketWinrate >= 60) confidenceScore += 5;

  if (input.riskReward >= 2) confidenceScore += 10;
  if (input.riskReward >= 3) confidenceScore += 5;

  if (input.propFirmStatus === "PASS") confidenceScore += 10;
  if (input.remainingDailyLimit >= input.plannedRiskAmount) confidenceScore += 5;

  confidenceScore = Math.min(confidenceScore, 100);

  const setupQuality =
    confidenceScore >= 90
      ? "A+"
      : confidenceScore >= 75
        ? "A"
        : confidenceScore >= 60
          ? "B"
          : confidenceScore >= 40
            ? "C"
            : "D";

  const recommendation =
    confidenceScore >= 75 && input.propFirmStatus === "PASS"
      ? "TRADE"
      : confidenceScore >= 60 && input.propFirmStatus !== "VIOLATION"
        ? "WAIT"
        : "AVOID";

  const riskStatus =
    input.propFirmStatus === "PASS" && input.remainingDailyLimit >= input.plannedRiskAmount
      ? "PASS"
      : input.propFirmStatus === "WARNING"
        ? "WARNING"
        : "FAIL";

  const strategyStatus =
    strategyProfit > 0 && strategyWinrate >= 50
      ? "PASS"
      : strategyProfit >= 0
        ? "WARNING"
        : "FAIL";

  const marketStatus =
    marketProfit > 0 && marketWinrate >= 50
      ? "PASS"
      : marketProfit >= 0
        ? "WARNING"
        : "FAIL";

  const reviews = input.aiTradeReviewStats.reviews;
  const distribution = [
    {
      signal: "Strong Buy",
      count: reviews.filter((review) => review.score >= 90).length,
    },
    {
      signal: "Good Setup",
      count: reviews.filter((review) => review.score >= 75 && review.score < 90).length,
    },
    {
      signal: "Medium Setup",
      count: reviews.filter((review) => review.score >= 60 && review.score < 75).length,
    },
    {
      signal: "Avoid",
      count: reviews.filter((review) => review.score < 60).length,
    },
  ];

  return {
    confidenceScore,
    setupQuality,
    recommendation,
    riskStatus,
    strategyStatus,
    marketStatus,
    checks: [
      {
        label: "Risk unter Daily Limit",
        status: input.remainingDailyLimit >= input.plannedRiskAmount ? "PASS" : "FAIL",
      },
      {
        label: "Prop Firm Rules",
        status:
          input.propFirmStatus === "PASS"
            ? "PASS"
            : input.propFirmStatus === "WARNING"
              ? "WARNING"
              : "FAIL",
      },
      {
        label: "Risk/Reward mindestens 2",
        status: input.riskReward >= 2 ? "PASS" : input.riskReward >= 1.5 ? "WARNING" : "FAIL",
      },
      {
        label: "Strategy historisch positiv",
        status: strategyStatus,
      },
      {
        label: "Market historisch positiv",
        status: marketStatus,
      },
      {
        label: "Expectancy positiv",
        status: input.expectancyR > 0 ? "PASS" : "WARNING",
      },
    ],
    distribution,
  };
}

// ===== Strategy Builder V5.7 =====

function getStrategyStats(data: Trade[]) {
  const closedTrades = data.filter((trade) => trade.status === "CLOSED");

  const strategyMap = new Map<
    string,
    {
      strategy: string;
      profitLoss: number;
      trades: number;
      wins: number;
      losses: number;
    }
  >();

  closedTrades.forEach((trade) => {
    const strategyName = trade.strategy || "Unclassified";

    const current =
      strategyMap.get(strategyName) ??
      {
        strategy: strategyName,
        profitLoss: 0,
        trades: 0,
        wins: 0,
        losses: 0,
      };

    current.profitLoss += trade.profitLoss;
    current.trades += 1;

    if (trade.profitLoss > 0) current.wins += 1;
    if (trade.profitLoss < 0) current.losses += 1;

    strategyMap.set(strategyName, current);
  });

  const strategyStats = Array.from(strategyMap.values())
    .map((item) => ({
      ...item,
      profitLoss: Number(item.profitLoss.toFixed(2)),
      winrate: item.trades > 0 ? Math.round((item.wins / item.trades) * 100) : 0,
    }))
    .sort((a, b) => b.profitLoss - a.profitLoss);

  return {
    strategyStats,
    bestStrategy: strategyStats[0] ?? {
      strategy: "-",
      profitLoss: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      winrate: 0,
    },
    worstStrategy: strategyStats[strategyStats.length - 1] ?? {
      strategy: "-",
      profitLoss: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      winrate: 0,
    },
  };
}

// ===== AI Trade Review V5.6 =====

type TradeReview = {
  tradeId: number;
  market: string;
  direction: string;
  grade: "A+" | "A" | "B" | "C" | "D";
  score: number;
  scoreValue: number;
  verdict: string;
  profitLoss: number;
  riskReward: number;
  riskAmount: number;
  checks: {
    label: string;
    status: "PASS" | "WARNING" | "FAIL";
  }[];
};

function getTradeReview(trade: Trade): TradeReview {
  let score = 0;

  const isClosed = trade.status === "CLOSED";
  const isWin = trade.profitLoss > 0;
  const isLoss = trade.profitLoss < 0;
  const hasGoodRR = trade.riskReward >= 2;
  const hasExcellentRR = trade.riskReward >= 3;
  const hasRisk = trade.riskAmount > 0;
  const lossWithinRisk =
    !isLoss || (hasRisk && Math.abs(trade.profitLoss) <= trade.riskAmount * 1.2);

  if (isClosed) score += 10;
  if (hasRisk) score += 15;
  if (trade.riskReward >= 1.5) score += 15;
  if (hasGoodRR) score += 15;
  if (hasExcellentRR) score += 10;
  if (isWin) score += 25;
  if (lossWithinRisk) score += 10;

  if (isLoss && !lossWithinRisk) score -= 20;
  if (trade.riskReward < 1) score -= 15;

  const finalScore = Math.max(0, Math.min(score, 100));

  let grade: TradeReview["grade"] = "D";
  let verdict = "Needs Improvement";

  if (finalScore >= 90) {
    grade = "A+";
    verdict = "Excellent Trade";
  } else if (finalScore >= 75) {
    grade = "A";
    verdict = "High Quality Trade";
  } else if (finalScore >= 60) {
    grade = "B";
    verdict = "Good Trade";
  } else if (finalScore >= 40) {
    grade = "C";
    verdict = "Risk Controlled but Weak";
  }

  const scoreValue =
    grade === "A+" ? 5 : grade === "A" ? 4 : grade === "B" ? 3 : grade === "C" ? 2 : 1;

  return {
    tradeId: trade.id,
    market: trade.market,
    direction: trade.direction,
    grade,
    score: finalScore,
    scoreValue,
    verdict,
    profitLoss: trade.profitLoss,
    riskReward: trade.riskReward,
    riskAmount: trade.riskAmount,
    checks: [
      {
        label: "Trade abgeschlossen",
        status: isClosed ? "PASS" : "WARNING",
      },
      {
        label: "Risk definiert",
        status: hasRisk ? "PASS" : "FAIL",
      },
      {
        label: "R/R mindestens 1.5",
        status: trade.riskReward >= 1.5 ? "PASS" : "WARNING",
      },
      {
        label: "R/R mindestens 2.0",
        status: hasGoodRR ? "PASS" : "WARNING",
      },
      {
        label: "Profitabel",
        status: isWin ? "PASS" : isLoss ? "FAIL" : "WARNING",
      },
      {
        label: "Loss innerhalb Risiko",
        status: lossWithinRisk ? "PASS" : "FAIL",
      },
    ],
  };
}

function buildTradeReviews(data: Trade[]) {
  return [...data]
    .filter((trade) => trade.status === "CLOSED")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .map((trade) => getTradeReview(trade));
}

function getAITradeReviewStats(data: Trade[]) {
  const reviews = buildTradeReviews(data);

  if (reviews.length === 0) {
    return {
      reviews,
      averageScore: 0,
      averageGrade: "-",
      bestReview: null as TradeReview | null,
      worstReview: null as TradeReview | null,
      distribution: [
        { grade: "A+", count: 0 },
        { grade: "A", count: 0 },
        { grade: "B", count: 0 },
        { grade: "C", count: 0 },
        { grade: "D", count: 0 },
      ],
      scoreHistory: [],
    };
  }

  const averageScore = Number(
    (reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length).toFixed(2)
  );

  const averageGradeValue =
    reviews.reduce((sum, review) => sum + review.scoreValue, 0) / reviews.length;

  const averageGrade =
    averageGradeValue >= 4.5
      ? "A+"
      : averageGradeValue >= 3.5
        ? "A"
        : averageGradeValue >= 2.5
          ? "B"
          : averageGradeValue >= 1.5
            ? "C"
            : "D";

  const distribution = ["A+", "A", "B", "C", "D"].map((grade) => ({
    grade,
    count: reviews.filter((review) => review.grade === grade).length,
  }));

  const scoreHistory = [...reviews]
    .reverse()
    .map((review) => ({
      trade: `#${review.tradeId}`,
      score: review.score,
      scoreValue: review.scoreValue,
    }));

  return {
    reviews,
    averageScore,
    averageGrade,
    bestReview: [...reviews].sort((a, b) => b.score - a.score)[0],
    worstReview: [...reviews].sort((a, b) => a.score - b.score)[0],
    distribution,
    scoreHistory,
  };
}

// ===== Journal Intelligence V5.5 =====

function getDirectionStats(data: Trade[]) {
  const closedTrades = data.filter((trade) => trade.status === "CLOSED");

  const longTrades = closedTrades.filter((trade) => trade.direction === "LONG");
  const shortTrades = closedTrades.filter((trade) => trade.direction === "SHORT");

  const longWins = longTrades.filter((trade) => trade.profitLoss > 0).length;
  const shortWins = shortTrades.filter((trade) => trade.profitLoss > 0).length;

  const longProfit = longTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);
  const shortProfit = shortTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);

  return {
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
    longWinrate:
      longTrades.length > 0 ? Math.round((longWins / longTrades.length) * 100) : 0,
    shortWinrate:
      shortTrades.length > 0 ? Math.round((shortWins / shortTrades.length) * 100) : 0,
    longProfit: Number(longProfit.toFixed(2)),
    shortProfit: Number(shortProfit.toFixed(2)),
    bestDirection: longProfit >= shortProfit ? "LONG" : "SHORT",
  };
}

function getMarketIntelligence(data: Trade[]) {
  const closedTrades = data.filter((trade) => trade.status === "CLOSED");
  const marketMap = new Map<
    string,
    {
      market: string;
      profitLoss: number;
      trades: number;
      wins: number;
      losses: number;
    }
  >();

  closedTrades.forEach((trade) => {
    const current =
      marketMap.get(trade.market) ??
      {
        market: trade.market,
        profitLoss: 0,
        trades: 0,
        wins: 0,
        losses: 0,
      };

    current.profitLoss += trade.profitLoss;
    current.trades += 1;

    if (trade.profitLoss > 0) current.wins += 1;
    if (trade.profitLoss < 0) current.losses += 1;

    marketMap.set(trade.market, current);
  });

  const marketStats = Array.from(marketMap.values())
    .map((item) => ({
      ...item,
      profitLoss: Number(item.profitLoss.toFixed(2)),
      winrate: item.trades > 0 ? Math.round((item.wins / item.trades) * 100) : 0,
    }))
    .sort((a, b) => b.profitLoss - a.profitLoss);

  return {
    marketStats,
    bestMarket: marketStats[0] ?? {
      market: "-",
      profitLoss: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      winrate: 0,
    },
    worstMarket: marketStats[marketStats.length - 1] ?? {
      market: "-",
      profitLoss: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      winrate: 0,
    },
  };
}

function getWeekdayIntelligence(data: Trade[]) {
  const closedTrades = data.filter((trade) => trade.status === "CLOSED");
  const weekdayMap = new Map<
    string,
    {
      weekday: string;
      profitLoss: number;
      trades: number;
      wins: number;
      losses: number;
    }
  >();

  closedTrades.forEach((trade) => {
    const weekday = new Date(trade.date).toLocaleDateString("de-CH", {
      weekday: "long",
    });

    const current =
      weekdayMap.get(weekday) ??
      {
        weekday,
        profitLoss: 0,
        trades: 0,
        wins: 0,
        losses: 0,
      };

    current.profitLoss += trade.profitLoss;
    current.trades += 1;

    if (trade.profitLoss > 0) current.wins += 1;
    if (trade.profitLoss < 0) current.losses += 1;

    weekdayMap.set(weekday, current);
  });

  const weekdayStats = Array.from(weekdayMap.values())
    .map((item) => ({
      ...item,
      profitLoss: Number(item.profitLoss.toFixed(2)),
      winrate: item.trades > 0 ? Math.round((item.wins / item.trades) * 100) : 0,
    }))
    .sort((a, b) => b.profitLoss - a.profitLoss);

  return {
    weekdayStats,
    bestWeekday: weekdayStats[0] ?? {
      weekday: "-",
      profitLoss: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      winrate: 0,
    },
    worstWeekday: weekdayStats[weekdayStats.length - 1] ?? {
      weekday: "-",
      profitLoss: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      winrate: 0,
    },
  };
}

function getJournalIntelligenceScore(input: {
  winrate: number;
  profitFactor: number;
  expectancyR: number;
  maxDrawdownPercent: number;
  closedTrades: number;
}) {
  let score = 0;

  if (input.closedTrades >= 5) score += 10;
  if (input.closedTrades >= 20) score += 10;

  if (input.winrate >= 50) score += 20;
  if (input.winrate >= 60) score += 10;

  if (input.profitFactor >= 1.2) score += 15;
  if (input.profitFactor >= 2) score += 10;

  if (input.expectancyR > 0) score += 15;
  if (input.maxDrawdownPercent <= 5) score += 10;

  return Math.min(score, 100);
}

function getJournalIntelligenceVerdict(input: {
  score: number;
  expectancyR: number;
  profitFactor: number;
  winrate: number;
}) {
  if (input.score >= 80) {
    return "Strong Edge";
  }

  if (input.score >= 60) {
    return "Developing Edge";
  }

  if (input.expectancyR > 0 && input.profitFactor >= 1) {
    return "Promising";
  }

  if (input.winrate === 0) {
    return "Needs Data";
  }

  return "Needs Improvement";
}

// ===== Weekly Statistics V5.2 =====

function getWeekKey(dateValue: string) {
  const date = new Date(dateValue);
  const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = tempDate.getUTCDay() || 7;

  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  return `${tempDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function getWeekLabel(weekKey: string) {
  return weekKey.replace("-W", "  Woche ");
}

function buildWeeklyPerformance(data: Trade[]) {
  const weekMap = new Map<
    string,
    {
      week: string;
      label: string;
      profitLoss: number;
      trades: number;
      wins: number;
      losses: number;
    }
  >();

  data
    .filter((trade) => trade.status === "CLOSED")
    .forEach((trade) => {
      const weekKey = getWeekKey(trade.date);
      const currentWeek =
        weekMap.get(weekKey) ??
        {
          week: weekKey,
          label: getWeekLabel(weekKey),
          profitLoss: 0,
          trades: 0,
          wins: 0,
          losses: 0,
        };

      currentWeek.profitLoss += trade.profitLoss;
      currentWeek.trades += 1;

      if (trade.profitLoss > 0) currentWeek.wins += 1;
      if (trade.profitLoss < 0) currentWeek.losses += 1;

      weekMap.set(weekKey, currentWeek);
    });

  return Array.from(weekMap.values())
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((item) => ({
      ...item,
      profitLoss: Number(item.profitLoss.toFixed(2)),
      winrate:
        item.trades > 0 ? Math.round((item.wins / item.trades) * 100) : 0,
    }));
}

function getWeeklyStats(data: Trade[]) {
  const weeklyPerformance = buildWeeklyPerformance(data);

  if (weeklyPerformance.length === 0) {
    return {
      bestWeek: { label: "-", profitLoss: 0 },
      worstWeek: { label: "-", profitLoss: 0 },
      averageWeek: 0,
      positiveWeeks: 0,
      negativeWeeks: 0,
      weeklyWinrate: 0,
      weeklyPerformance,
    };
  }

  const bestWeek = [...weeklyPerformance].sort(
    (a, b) => b.profitLoss - a.profitLoss
  )[0];

  const worstWeek = [...weeklyPerformance].sort(
    (a, b) => a.profitLoss - b.profitLoss
  )[0];

  const totalWeeklyProfit = weeklyPerformance.reduce(
    (sum, week) => sum + week.profitLoss,
    0
  );

  const positiveWeeks = weeklyPerformance.filter(
    (week) => week.profitLoss > 0
  ).length;

  const negativeWeeks = weeklyPerformance.filter(
    (week) => week.profitLoss < 0
  ).length;

  const weeklyWinrate =
    weeklyPerformance.length > 0
      ? Math.round((positiveWeeks / weeklyPerformance.length) * 100)
      : 0;

  return {
    bestWeek,
    worstWeek,
    averageWeek: Number((totalWeeklyProfit / weeklyPerformance.length).toFixed(2)),
    positiveWeeks,
    negativeWeeks,
    weeklyWinrate,
    weeklyPerformance,
  };
}

// ===== Monthly Statistics V5.1 =====

function getMonthKey(dateValue: string) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("de-CH", {
    month: "long",
    year: "numeric",
  });
}

function buildMonthlyPerformance(data: Trade[]) {
  const monthMap = new Map<
    string,
    {
      month: string;
      label: string;
      profitLoss: number;
      trades: number;
      wins: number;
      losses: number;
    }
  >();

  data
    .filter((trade) => trade.status === "CLOSED")
    .forEach((trade) => {
      const monthKey = getMonthKey(trade.date);
      const currentMonth =
        monthMap.get(monthKey) ??
        {
          month: monthKey,
          label: getMonthLabel(monthKey),
          profitLoss: 0,
          trades: 0,
          wins: 0,
          losses: 0,
        };

      currentMonth.profitLoss += trade.profitLoss;
      currentMonth.trades += 1;

      if (trade.profitLoss > 0) currentMonth.wins += 1;
      if (trade.profitLoss < 0) currentMonth.losses += 1;

      monthMap.set(monthKey, currentMonth);
    });

  return Array.from(monthMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      ...item,
      profitLoss: Number(item.profitLoss.toFixed(2)),
      winrate:
        item.trades > 0 ? Math.round((item.wins / item.trades) * 100) : 0,
    }));
}

function getMonthlyStats(data: Trade[]) {
  const monthlyPerformance = buildMonthlyPerformance(data);

  if (monthlyPerformance.length === 0) {
    return {
      bestMonth: { label: "-", profitLoss: 0 },
      worstMonth: { label: "-", profitLoss: 0 },
      averageMonth: 0,
      positiveMonths: 0,
      negativeMonths: 0,
      monthlyWinrate: 0,
      monthlyPerformance,
    };
  }

  const bestMonth = [...monthlyPerformance].sort(
    (a, b) => b.profitLoss - a.profitLoss
  )[0];

  const worstMonth = [...monthlyPerformance].sort(
    (a, b) => a.profitLoss - b.profitLoss
  )[0];

  const totalMonthlyProfit = monthlyPerformance.reduce(
    (sum, month) => sum + month.profitLoss,
    0
  );

  const positiveMonths = monthlyPerformance.filter(
    (month) => month.profitLoss > 0
  ).length;

  const negativeMonths = monthlyPerformance.filter(
    (month) => month.profitLoss < 0
  ).length;

  const monthlyWinrate =
    monthlyPerformance.length > 0
      ? Math.round((positiveMonths / monthlyPerformance.length) * 100)
      : 0;

  return {
    bestMonth,
    worstMonth,
    averageMonth: Number(
      (totalMonthlyProfit / monthlyPerformance.length).toFixed(2)
    ),
    positiveMonths,
    negativeMonths,
    monthlyWinrate,
    monthlyPerformance,
  };
}

// ===== Performance Analytics V5.0 =====

function getAverageTrade(data: Trade[]) {
  const closedTrades = data.filter((trade) => trade.status === "CLOSED");
  if (closedTrades.length === 0) return 0;

  const total = closedTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);
  return Number((total / closedTrades.length).toFixed(2));
}

function getExpectancyR(data: Trade[]) {
  const closedTrades = data.filter(
    (trade) => trade.status === "CLOSED" && trade.riskAmount > 0
  );

  if (closedTrades.length === 0) return 0;

  const totalR = closedTrades.reduce((sum, trade) => {
    return sum + trade.profitLoss / trade.riskAmount;
  }, 0);

  return Number((totalR / closedTrades.length).toFixed(2));
}

function getAverageRMultiple(data: Trade[]) {
  return getExpectancyR(data);
}

function getWinningStreak(data: Trade[]) {
  const closedTrades = [...data]
    .filter((trade) => trade.status === "CLOSED")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  let currentStreak = 0;
  let bestStreak = 0;

  closedTrades.forEach((trade) => {
    if (trade.profitLoss > 0) {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  return bestStreak;
}

function getLosingStreak(data: Trade[]) {
  const closedTrades = [...data]
    .filter((trade) => trade.status === "CLOSED")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  let currentStreak = 0;
  let worstStreak = 0;

  closedTrades.forEach((trade) => {
    if (trade.profitLoss < 0) {
      currentStreak += 1;
      worstStreak = Math.max(worstStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  return worstStreak;
}

function buildDailyPerformance(data: Trade[]) {
  const dayMap = new Map<string, number>();

  data
    .filter((trade) => trade.status === "CLOSED")
    .forEach((trade) => {
      const dayKey = new Date(trade.date).toLocaleDateString("de-CH");
      const currentValue = dayMap.get(dayKey) ?? 0;
      dayMap.set(dayKey, currentValue + trade.profitLoss);
    });

  return Array.from(dayMap.entries()).map(([date, value]) => ({
    date,
    value: Number(value.toFixed(2)),
  }));
}

function getBestTradingDay(data: Trade[]) {
  const dailyPerformance = buildDailyPerformance(data);
  if (dailyPerformance.length === 0) {
    return { date: "-", value: 0 };
  }

  return [...dailyPerformance].sort((a, b) => b.value - a.value)[0];
}

function getWorstTradingDay(data: Trade[]) {
  const dailyPerformance = buildDailyPerformance(data);
  if (dailyPerformance.length === 0) {
    return { date: "-", value: 0 };
  }

  return [...dailyPerformance].sort((a, b) => a.value - b.value)[0];
}

function getPerformanceScore(input: {
  expectancyR: number;
  winrate: number;
  profitFactor: number;
  maxDrawdownPercent: number;
}) {
  let score = 0;

  if (input.expectancyR > 0) score += 30;
  if (input.expectancyR >= 0.5) score += 10;

  if (input.winrate >= 50) score += 20;
  if (input.winrate >= 60) score += 10;

  if (input.profitFactor >= 1.2) score += 15;
  if (input.profitFactor >= 2) score += 10;

  if (input.maxDrawdownPercent <= 5) score += 5;

  return Math.min(score, 100);
}

// ===============================

function buildPeriodPerformance(data: Trade[]) {
  return [
    { name: "Woche", value: getTotalProfit(data.slice(-3)) },
    { name: "Monat", value: getTotalProfit(data) },
    { name: "Jahr", value: getTotalProfit(data) },
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
  const [journalTrades, setJournalTrades] = useState<Trade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState("All");
  const [activeSection, setActiveSection] = useState("overview");
  const [signalStrategy, setSignalStrategy] = useState("Liquidity Sweep");
  const [signalMarket, setSignalMarket] = useState("All");
  const [signalRiskReward, setSignalRiskReward] = useState("2");

  const [market, setMarket] = useState("");
  const [direction, setDirection] = useState("LONG");
  const [strategy, setStrategy] = useState("Liquidity Sweep");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [accountSize, setAccountSize] = useState("30000");
  const [riskPercent, setRiskPercent] = useState("1");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [startingBalance, setStartingBalance] = useState("30000");
  const [accountRiskPercent, setAccountRiskPercent] = useState("1");
  const [maxDailyLossPercent, setMaxDailyLossPercent] = useState("5");
  const [maxOverallDrawdownPercent, setMaxOverallDrawdownPercent] = useState("10");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [editMarket, setEditMarket] = useState("");
  const [editDirection, setEditDirection] = useState("LONG");
  const [editStrategy, setEditStrategy] = useState("Liquidity Sweep");
  const [editEntry, setEditEntry] = useState("");
  const [editStopLoss, setEditStopLoss] = useState("");
  const [editTakeProfit, setEditTakeProfit] = useState("");
  const [editAccountSize, setEditAccountSize] = useState("30000");
  const [editRiskPercent, setEditRiskPercent] = useState("1");
  const [editNotes, setEditNotes] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const reportRef = useRef<HTMLDivElement | null>(null);
  const tradingSectionRef = useRef<HTMLDivElement | null>(null);
  const overviewSectionRef = useRef<HTMLDivElement | null>(null);
  const performanceSectionRef = useRef<HTMLDivElement | null>(null);
  const timeSectionRef = useRef<HTMLDivElement | null>(null);
  const chartsSectionRef = useRef<HTMLDivElement | null>(null);
  const historySectionRef = useRef<HTMLDivElement | null>(null);

  const markets = ["All", ...new Set(journalTrades.map((trade) => trade.market))];

  const strategies = [
    "Liquidity Sweep",
    "Breakout",
    "Trend Continuation",
    "Support Resistance",
    "ICT Model",
    "SMC Model",
    "News Trade",
    "Custom",
  ];

  async function loadTrades() {
    try {
      const response = await fetch("/api/trades");
      const data = await response.json();

      if (data.success) {
        setJournalTrades(data.trades);
      }
    } catch (error) {
      console.error("Trades konnten nicht geladen werden:", error);
    }

    setIsLoaded(true);
  }

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    const savedStartingBalance = localStorage.getItem("startingBalance");
    const savedAccountRiskPercent = localStorage.getItem("accountRiskPercent");
    const savedMaxDailyLossPercent = localStorage.getItem("maxDailyLossPercent");
    const savedMaxOverallDrawdownPercent = localStorage.getItem("maxOverallDrawdownPercent");

    if (savedStartingBalance) {
      setStartingBalance(savedStartingBalance);
      setAccountSize(savedStartingBalance);
    }

    if (savedAccountRiskPercent) {
      setAccountRiskPercent(savedAccountRiskPercent);
      setRiskPercent(savedAccountRiskPercent);
    }

    if (savedMaxDailyLossPercent) {
      setMaxDailyLossPercent(savedMaxDailyLossPercent);
    }

    if (savedMaxOverallDrawdownPercent) {
      setMaxOverallDrawdownPercent(savedMaxOverallDrawdownPercent);
    }

    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    localStorage.setItem("startingBalance", startingBalance);
    setAccountSize(startingBalance);
  }, [startingBalance, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;

    localStorage.setItem("accountRiskPercent", accountRiskPercent);
    setRiskPercent(accountRiskPercent);
  }, [accountRiskPercent, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;

    localStorage.setItem("maxDailyLossPercent", maxDailyLossPercent);
  }, [maxDailyLossPercent, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;

    localStorage.setItem(
      "maxOverallDrawdownPercent",
      maxOverallDrawdownPercent
    );
  }, [maxOverallDrawdownPercent, settingsLoaded]);

  const filteredTrades =
    selectedMarket === "All"
      ? journalTrades
      : journalTrades.filter((trade) => trade.market === selectedMarket);

  async function createTrade() {
    if (!market || !strategy || !entry || !stopLoss || !takeProfit || !accountSize || !riskPercent) {
      alert("Bitte Market, Strategy, Entry, Stop Loss, Take Profit, Account Size und Risk % ausfllen.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          market,
          direction,
          strategy,
          entry,
          stopLoss,
          takeProfit,
          accountSize,
          riskPercent,
          notes,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert("Trade konnte nicht gespeichert werden.");
        return;
      }

      await loadTrades();

      setMarket("");
      setDirection("LONG");
      setStrategy("Liquidity Sweep");
      setEntry("");
      setStopLoss("");
      setTakeProfit("");
      setAccountSize(startingBalance);
      setRiskPercent(accountRiskPercent);
      setNotes("");

      alert("Trade erfolgreich in SQLite gespeichert.");
    } catch (error) {
      console.error(error);
      alert("Fehler beim Speichern des Trades.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEditTrade(trade: Trade) {
    setEditingTrade(trade);
    setEditMarket(trade.market);
    setEditDirection(trade.direction);
    setEditStrategy(trade.strategy || "Liquidity Sweep");
    setEditEntry(String(trade.entry));
    setEditStopLoss(String(trade.stopLoss));
    setEditTakeProfit(String(trade.takeProfit));
    setEditAccountSize(String(trade.accountSize ?? 30000));
    setEditRiskPercent(String(trade.riskPercent ?? 1));
    setEditNotes(trade.notes ?? "");
  }

  function cancelEditTrade() {
    setEditingTrade(null);
    setEditMarket("");
    setEditDirection("LONG");
    setEditStrategy("Liquidity Sweep");
    setEditEntry("");
    setEditStopLoss("");
    setEditTakeProfit("");
    setEditAccountSize("30000");
    setEditRiskPercent("1");
    setEditNotes("");
  }

  async function saveEditedTrade() {
    if (!editingTrade) return;

    if (
      !editMarket ||
      !editStrategy ||
      !editEntry ||
      !editStopLoss ||
      !editTakeProfit ||
      !editAccountSize ||
      !editRiskPercent
    ) {
      alert("Bitte Market, Strategy, Entry, Stop Loss, Take Profit, Account Size und Risk % ausfllen.");
      return;
    }

    setIsEditing(true);

    try {
      const response = await fetch(`/api/trades/${editingTrade.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          market: editMarket,
          direction: editDirection,
          strategy: editStrategy,
          entry: editEntry,
          stopLoss: editStopLoss,
          takeProfit: editTakeProfit,
          accountSize: editAccountSize,
          riskPercent: editRiskPercent,
          notes: editNotes,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert("Trade konnte nicht bearbeitet werden.");
        return;
      }

      await loadTrades();
      cancelEditTrade();
    } catch (error) {
      console.error(error);
      alert("Fehler beim Bearbeiten des Trades.");
    } finally {
      setIsEditing(false);
    }
  }

  async function closeTrade(tradeId: number, result: "WIN" | "LOSS") {
    const input = window.prompt(
      result === "WIN" ? "Gewinn in CHF eingeben:" : "Verlust in CHF eingeben:"
    );

    if (!input) return;

    const value = Number(input);

    if (Number.isNaN(value)) {
      alert("Bitte eine gltige Zahl eingeben.");
      return;
    }

    const profitLoss = result === "WIN" ? Math.abs(value) : -Math.abs(value);

    try {
      const response = await fetch(`/api/trades/${tradeId}`, {
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
        alert("Trade konnte nicht geschlossen werden.");
        return;
      }

      await loadTrades();
    } catch (error) {
      console.error(error);
      alert("Fehler beim Schlieen des Trades.");
    }
  }

  async function reopenTrade(tradeId: number) {
    try {
      const response = await fetch(`/api/trades/${tradeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "OPEN",
          result: "OPEN",
          profitLoss: 0,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert("Trade konnte nicht wieder geffnet werden.");
        return;
      }

      await loadTrades();
    } catch (error) {
      console.error(error);
      alert("Fehler beim Wiederffnen des Trades.");
    }
  }

  async function deleteTrade(tradeId: number) {
    const confirmed = window.confirm("Diesen Trade wirklich lschen?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/trades/${tradeId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        alert("Trade konnte nicht gelscht werden.");
        return;
      }

      await loadTrades();
    } catch (error) {
      console.error(error);
      alert("Fehler beim Lschen des Trades.");
    }
  }

  async function resetJournal() {
    const confirmed = window.confirm(
      "Wirklich ALLE Trades aus der SQLite-Datenbank lschen?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/trades", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        alert("Datenbank konnte nicht zurckgesetzt werden.");
        return;
      }

      setSelectedMarket("All");
      await loadTrades();
      alert("Alle Trades wurden gelscht.");
    } catch (error) {
      console.error(error);
      alert("Fehler beim Zurcksetzen der Datenbank.");
    }
  }

  async function exportYearlyReportPDF() {
    if (!reportRef.current) return;

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      backgroundColor: "#000000",
      useCORS: true,
      onclone: (clonedDocument) => {
        const report = clonedDocument.querySelector("[data-pdf-report]");
        if (!report) return;

        const allElements = report.querySelectorAll("*");

        allElements.forEach((element) => {
          const htmlElement = element as HTMLElement;
          const className = htmlElement.className.toString();

          htmlElement.style.color = "#ffffff";
          htmlElement.style.borderColor = "#374151";

          if (className.includes("bg-gray-900")) htmlElement.style.backgroundColor = "#111827";
          if (className.includes("bg-gray-800")) htmlElement.style.backgroundColor = "#1f2937";
          if (className.includes("bg-black")) htmlElement.style.backgroundColor = "#000000";
          if (className.includes("text-green-400")) htmlElement.style.color = "#4ade80";
          if (className.includes("text-red-400")) htmlElement.style.color = "#f87171";
          if (className.includes("text-cyan-400")) htmlElement.style.color = "#22d3ee";
          if (className.includes("text-blue-400")) htmlElement.style.color = "#60a5fa";
          if (className.includes("text-yellow-400")) htmlElement.style.color = "#facc15";
          if (className.includes("text-gray-400")) htmlElement.style.color = "#9ca3af";
        });
      },
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save("jahresreport-trading-journal.pdf");
  }

  const numericStartingBalance = Number(startingBalance) || 0;
  const numericAccountRiskPercent = Number(accountRiskPercent) || 0;
  const numericMaxDailyLossPercent = Number(maxDailyLossPercent) || 0;
  const numericMaxOverallDrawdownPercent =
    Number(maxOverallDrawdownPercent) || 0;

  const plannedRiskAmount =
    numericStartingBalance > 0
      ? Number(((numericStartingBalance * numericAccountRiskPercent) / 100).toFixed(2))
      : 0;

  const totalProfit = getTotalProfit(filteredTrades);
  const openTrades = filteredTrades.filter((trade) => trade.status === "OPEN");
  const closedTrades = filteredTrades.filter((trade) => trade.status === "CLOSED");

  const winrate = getWinrate(filteredTrades);
  const averageWinner = getAverageWinner(filteredTrades);
  const averageLoser = getAverageLoser(filteredTrades);
  const profitFactor = getProfitFactor(filteredTrades);

  const totalRiskAmount = getTotalRiskAmount(filteredTrades);
  const openRiskAmount = getTotalRiskAmount(openTrades);
  const averageRiskReward = getAverageRiskReward(filteredTrades);

  const equityData = buildEquityCurve(filteredTrades);
  const periodData = buildPeriodPerformance(filteredTrades);
  const marketPerformanceData = buildMarketPerformance(filteredTrades);

  const drawdownStats = getMaxDrawdownStats(filteredTrades);
  const accountStats = getAccountEquityStats(
    filteredTrades,
    numericStartingBalance
  );

  
  const propFirmStats = getPropFirmRiskStats({
    trades: filteredTrades,
    startingBalance: numericStartingBalance,
    maxDailyLossPercent: numericMaxDailyLossPercent,
    maxOverallDrawdownPercent: numericMaxOverallDrawdownPercent,
  });

  const todayKey = new Date().toISOString().slice(0, 10);

  const todaysTrades = filteredTrades.filter(
    (trade) =>
      trade.status === "CLOSED" &&
      new Date(trade.date).toISOString().slice(0, 10) === todayKey
  );

  const todaysPL = Number(
    todaysTrades.reduce((sum, trade) => sum + trade.profitLoss, 0).toFixed(2)
  );

  const todaysLoss = Math.abs(
    Number(
      todaysTrades
        .filter((trade) => trade.profitLoss < 0)
        .reduce((sum, trade) => sum + trade.profitLoss, 0)
        .toFixed(2)
    )
  );

  const remainingDailyLimit = Number(
    (propFirmStats.dailyLossLimit - todaysLoss).toFixed(2)
  );

  const dailyStatus =
    todaysLoss > propFirmStats.dailyLossLimit
      ? "VIOLATION"
      : todaysLoss >= propFirmStats.dailyLossLimit * 0.8
        ? "WARNING"
        : "PASS";


  const bestTrade = [...filteredTrades].sort((a, b) => b.profitLoss - a.profitLoss)[0];
  const worstTrade = [...filteredTrades].sort((a, b) => a.profitLoss - b.profitLoss)[0];

  const averageTrade = getAverageTrade(filteredTrades);
  const expectancyR = getExpectancyR(filteredTrades);
  const averageRMultiple = getAverageRMultiple(filteredTrades);
  const winningStreak = getWinningStreak(filteredTrades);
  const losingStreak = getLosingStreak(filteredTrades);
  const bestTradingDay = getBestTradingDay(filteredTrades);
  const worstTradingDay = getWorstTradingDay(filteredTrades);
  const performanceScore = getPerformanceScore({
    expectancyR,
    winrate,
    profitFactor,
    maxDrawdownPercent: accountStats.maxDrawdownPercent,
  });

  const monthlyStats = getMonthlyStats(filteredTrades);
  const weeklyStats = getWeeklyStats(filteredTrades);
  const strategyStats = getStrategyStats(filteredTrades);
  const directionStats = getDirectionStats(filteredTrades);
  const marketIntelligence = getMarketIntelligence(filteredTrades);
  const weekdayIntelligence = getWeekdayIntelligence(filteredTrades);
  const journalIntelligenceScore = getJournalIntelligenceScore({
    winrate,
    profitFactor,
    expectancyR,
    maxDrawdownPercent: accountStats.maxDrawdownPercent,
    closedTrades: closedTrades.length,
  });
  const journalIntelligenceVerdict = getJournalIntelligenceVerdict({
    score: journalIntelligenceScore,
    expectancyR,
    profitFactor,
    winrate,
  });

  const aiTradeReviewStats = getAITradeReviewStats(filteredTrades);

  const signalEngineResult = getSignalEngineResult({
    selectedStrategy: signalStrategy,
    selectedMarket: signalMarket,
    plannedRiskAmount,
    riskReward: Number(signalRiskReward) || 0,
    winrate,
    profitFactor,
    expectancyR,
    propFirmStatus: propFirmStats.status,
    remainingDailyLimit,
    strategyStats,
    marketIntelligence,
    aiTradeReviewStats,
  });

  const botReadinessResult = getBotReadinessResult({
    closedTrades: closedTrades.length,
    winrate,
    profitFactor,
    expectancyR,
    maxDrawdownPercent: accountStats.maxDrawdownPercent,
    journalIntelligenceScore,
    performanceScore,
    signalConfidence: signalEngineResult.confidenceScore,
  });

  function scrollToSection(
    section:
      | "overview"
      | "trading"
      | "performance"
      | "time"
      | "charts"
      | "history"
  ) {
    setActiveSection(section);

    const sectionMap = {
      overview: overviewSectionRef,
      trading: tradingSectionRef,
      performance: performanceSectionRef,
      time: timeSectionRef,
      charts: chartsSectionRef,
      history: historySectionRef,
    };

    sectionMap[section].current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <a href="/" className="inline-block mb-8 text-blue-400 hover:text-blue-300">
         Zurck zum Dashboard
      </a>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-4"> Trading Journal</h1>
          <p className="text-gray-400">
            V5.9: Trading Journal mit Bot Readiness Center, Signal Engine, Strategy Builder und AI Trade Review.
          </p>
        </div>

        <button
          onClick={exportYearlyReportPDF}
          className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl font-bold"
        >
           Jahresreport PDF exportieren
        </button>
      </div>

      <div className="mb-8 bg-gray-950 border border-gray-800 rounded-2xl p-4 sticky top-0 z-20">
        <div className="flex flex-wrap gap-3">
          {[
            { id: "overview", label: " Overview" },
            { id: "trading", label: " Neuer Trade" },
            { id: "reports", label: " Reports & Time" },
            { id: "performance", label: " Performance Analytics" },
            { id: "intelligence", label: " Journal Intelligence" },
            { id: "strategy", label: " Strategy Builder" },
            { id: "tradeReview", label: " AI Trade Review" },
            { id: "signal", label: " Signal Engine" },
            { id: "bot", label: " Bot Readiness" },
            { id: "charts", label: " Charts Center" },
            { id: "history", label: " Trade History" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={
                activeSection === item.id
                  ? "bg-blue-600 text-white px-4 py-3 rounded-xl font-bold"
                  : "bg-gray-900 text-gray-300 hover:bg-gray-800 px-4 py-3 rounded-xl font-bold border border-gray-800"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={reportRef} data-pdf-report className="bg-black text-white">
        {activeSection === "overview" && (
          <div className="space-y-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-blue-800">
              <h2 className="text-2xl font-bold mb-2"> Overview Dashboard V5.3.2</h2>
              <p className="text-gray-400">
                Wichtigste Trading- und Risk-Kennzahlen auf einen Blick.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-xl">
                <h2 className="font-bold">Total Trades</h2>
                <p className="text-2xl mt-2">{filteredTrades.length}</p>
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

              <div className="bg-gray-900 p-6 rounded-xl border border-cyan-800">
                <h2 className="font-bold">Current Equity</h2>
                <p className="text-2xl mt-2 text-cyan-400">
                  {accountStats.currentEquity} CHF
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
                <h2 className="font-bold">Growth %</h2>
                <p className="text-2xl mt-2 text-green-400">
                  {accountStats.growthPercent}%
                </p>
              </div>

              <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
                <h2 className="font-bold">Max Drawdown</h2>
                <p className="text-2xl mt-2 text-red-400">
                  {accountStats.maxDrawdown} CHF
                </p>
              </div>

              <div className="bg-gray-900 p-6 rounded-xl border border-yellow-800">
                <h2 className="font-bold">Daily Status</h2>
                <p className="text-2xl mt-2 text-yellow-400">{dailyStatus}</p>
              </div>

              <div
                className={
                  propFirmStats.status === "PASS"
                    ? "bg-gray-900 p-6 rounded-xl border border-green-800"
                    : propFirmStats.status === "WARNING"
                      ? "bg-gray-900 p-6 rounded-xl border border-yellow-800"
                      : "bg-gray-900 p-6 rounded-xl border border-red-800"
                }
              >
                <h2 className="font-bold">Risk Status</h2>
                <p
                  className={
                    propFirmStats.status === "PASS"
                      ? "text-2xl mt-2 text-green-400"
                      : propFirmStats.status === "WARNING"
                        ? "text-2xl mt-2 text-yellow-400"
                        : "text-2xl mt-2 text-red-400"
                  }
                >
                  {propFirmStats.status === "PASS"
                    ? "PASS "
                    : propFirmStats.status === "WARNING"
                      ? "WARNING "
                      : "VIOLATION "}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === "trading" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
                <h2 className="text-2xl font-bold mb-4"> Account Settings V5.3.2</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-gray-400">Starting Balance</label>
                    <input
                      placeholder="z.B. 30000"
                      value={startingBalance}
                      onChange={(event) => setStartingBalance(event.target.value)}
                      className="w-full bg-black border border-gray-700 p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-gray-400">Account Risk %</label>
                    <input
                      placeholder="z.B. 1"
                      value={accountRiskPercent}
                      onChange={(event) => setAccountRiskPercent(event.target.value)}
                      className="w-full bg-black border border-gray-700 p-3 rounded-xl"
                    />
                  </div>

                  <div className="bg-black border border-gray-800 p-4 rounded-xl">
                    <h3 className="font-bold text-gray-300">Risk pro Trade</h3>
                    <p className="text-2xl mt-2 text-red-400">{plannedRiskAmount} CHF</p>
                  </div>

                  <div className="bg-black border border-gray-800 p-4 rounded-xl">
                    <h3 className="font-bold text-gray-300">Auto Trade Values</h3>
                    <p className="text-sm mt-2 text-gray-400">
                      Neue Trades nutzen diese Account Size und Risk % automatisch.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-xl border border-yellow-800">
                <h2 className="text-2xl font-bold mb-4"> Prop Firm Settings V5.3.2</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-gray-400">Max Daily Loss %</label>
                    <input
                      placeholder="z.B. 5"
                      value={maxDailyLossPercent}
                      onChange={(event) => setMaxDailyLossPercent(event.target.value)}
                      className="w-full bg-black border border-gray-700 p-3 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-gray-400">Max Overall Drawdown %</label>
                    <input
                      placeholder="z.B. 10"
                      value={maxOverallDrawdownPercent}
                      onChange={(event) =>
                        setMaxOverallDrawdownPercent(event.target.value)
                      }
                      className="w-full bg-black border border-gray-700 p-3 rounded-xl"
                    />
                  </div>

                  <div className="bg-black border border-gray-800 p-4 rounded-xl">
                    <h3 className="font-bold text-gray-300">Daily Limit</h3>
                    <p className="text-2xl mt-2 text-yellow-400">
                      {propFirmStats.dailyLossLimit} CHF
                    </p>
                  </div>

                  <div className="bg-black border border-gray-800 p-4 rounded-xl">
                    <h3 className="font-bold text-gray-300">Overall Limit</h3>
                    <p className="text-2xl mt-2 text-red-400">
                      {propFirmStats.overallDrawdownLimit} CHF
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {editingTrade && (
              <div className="bg-gray-900 p-6 rounded-xl border border-blue-700">
                <h2 className="text-2xl font-bold mb-4"> Trade bearbeiten #{editingTrade.id}</h2>

                <div className="grid grid-cols-4 gap-4">
                  <input placeholder="Market" value={editMarket} onChange={(event) => setEditMarket(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                  <select value={editDirection} onChange={(event) => setEditDirection(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl">
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </select>
                  <select value={editStrategy} onChange={(event) => setEditStrategy(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl">
                    {strategies.map((strategyItem) => (
                      <option key={strategyItem} value={strategyItem}>
                        {strategyItem}
                      </option>
                    ))}
                  </select>
                  <input placeholder="Entry" value={editEntry} onChange={(event) => setEditEntry(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                  <input placeholder="Stop Loss" value={editStopLoss} onChange={(event) => setEditStopLoss(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                  <input placeholder="Take Profit" value={editTakeProfit} onChange={(event) => setEditTakeProfit(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                  <input placeholder="Account Size" value={editAccountSize} onChange={(event) => setEditAccountSize(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                  <input placeholder="Risk %" value={editRiskPercent} onChange={(event) => setEditRiskPercent(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                  <input placeholder="Notizen" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                </div>

                <div className="flex gap-4 mt-4">
                  <button onClick={saveEditedTrade} disabled={isEditing} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-5 py-3 rounded-xl font-bold">
                    {isEditing ? "Speichert..." : " nderungen speichern"}
                  </button>
                  <button onClick={cancelEditTrade} className="bg-gray-700 hover:bg-gray-800 px-5 py-3 rounded-xl font-bold">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
              <h2 className="text-2xl font-bold mb-4"> Neuer Trade</h2>

              <div className="grid grid-cols-4 gap-4">
                <input placeholder="Market, z.B. Gold" value={market} onChange={(event) => setMarket(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                <select value={direction} onChange={(event) => setDirection(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl">
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
                <select value={strategy} onChange={(event) => setStrategy(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl">
                  {strategies.map((strategyItem) => (
                    <option key={strategyItem} value={strategyItem}>
                      {strategyItem}
                    </option>
                  ))}
                </select>
                <input placeholder="Entry" value={entry} onChange={(event) => setEntry(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                <input placeholder="Stop Loss" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                <input placeholder="Take Profit" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                <input placeholder="Account Size" value={accountSize} onChange={(event) => setAccountSize(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                <input placeholder="Risk %" value={riskPercent} onChange={(event) => setRiskPercent(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
                <input placeholder="Notizen" value={notes} onChange={(event) => setNotes(event.target.value)} className="bg-black border border-gray-700 p-3 rounded-xl" />
              </div>

              <button onClick={createTrade} disabled={isSaving} className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 px-5 py-3 rounded-xl font-bold">
                {isSaving ? "Speichert..." : " Trade speichern"}
              </button>
            </div>

            <div className="flex gap-4 items-end">
              <div>
                <label className="block mb-2 text-gray-400">Market auswhlen</label>
                <select value={selectedMarket} onChange={(event) => setSelectedMarket(event.target.value)} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                  {markets.map((marketItem) => (
                    <option key={marketItem}>{marketItem}</option>
                  ))}
                </select>
              </div>

              <button onClick={resetJournal} className="bg-red-700 hover:bg-red-800 px-4 py-3 rounded-xl">
                Datenbank zurcksetzen
              </button>

              <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-gray-300">
                {isLoaded ? "SQLite Verbindung aktiv" : "Lade Datenbank..."}
              </div>
            </div>
          </div>
        )}

        {activeSection === "reports" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8 rounded-2xl border border-indigo-800">
              <h2 className="text-3xl font-bold mb-2"> Reports & Time Analytics V5.4.2</h2>
              <p className="text-gray-400">
                Zeitliche Performance im professionellen Dashboard-Stil: Daily, Weekly, Monthly und Jahresreport.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-blue-900">
                <h2 className="font-bold">Best Week</h2>
                <p className="text-3xl mt-3 text-green-400">{weeklyStats.bestWeek.profitLoss} CHF</p>
                <p className="text-sm mt-2 text-gray-400">{weeklyStats.bestWeek.label}</p>
              </div>
              <div className="bg-gray-900 p-6 rounded-2xl border border-red-900">
                <h2 className="font-bold">Worst Week</h2>
                <p className="text-3xl mt-3 text-red-400">{weeklyStats.worstWeek.profitLoss} CHF</p>
                <p className="text-sm mt-2 text-gray-400">{weeklyStats.worstWeek.label}</p>
              </div>
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-900">
                <h2 className="font-bold">Best Month</h2>
                <p className="text-3xl mt-3 text-green-400">{monthlyStats.bestMonth.profitLoss} CHF</p>
                <p className="text-sm mt-2 text-gray-400">{monthlyStats.bestMonth.label}</p>
              </div>
              <div className="bg-gray-900 p-6 rounded-2xl border border-red-900">
                <h2 className="font-bold">Worst Month</h2>
                <p className="text-3xl mt-3 text-red-400">{monthlyStats.worstMonth.profitLoss} CHF</p>
                <p className="text-sm mt-2 text-gray-400">{monthlyStats.worstMonth.label}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-900">
                <h2 className="font-bold">Weekly Winrate</h2>
                <p className="text-3xl mt-3 text-cyan-400">{weeklyStats.weeklyWinrate}%</p>
                <div className="mt-5 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(weeklyStats.weeklyWinrate, 100)}%` }} />
                </div>
              </div>
              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-900">
                <h2 className="font-bold">Monthly Winrate</h2>
                <p className="text-3xl mt-3 text-cyan-400">{monthlyStats.monthlyWinrate}%</p>
                <div className="mt-5 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(monthlyStats.monthlyWinrate, 100)}%` }} />
                </div>
              </div>
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-900">
                <h2 className="font-bold">Positive Weeks</h2>
                <p className="text-3xl mt-3 text-green-400">{weeklyStats.positiveWeeks}</p>
              </div>
              <div className="bg-gray-900 p-6 rounded-2xl border border-red-900">
                <h2 className="font-bold">Negative Weeks</h2>
                <p className="text-3xl mt-3 text-red-400">{weeklyStats.negativeWeeks}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-green-900">
                <h2 className="text-xl font-bold mb-4"> Daily Performance Board</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buildDailyPerformance(filteredTrades)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#22c55e" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-blue-900">
                <h2 className="text-xl font-bold mb-4"> Weekly Performance Board</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyStats.weeklyPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="profitLoss" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-indigo-900">
                <h2 className="text-xl font-bold mb-4"> Monthly Performance Board</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyStats.monthlyPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="profitLoss" fill="#6366f1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-cyan-900">
                <h2 className="text-xl font-bold mb-4"> Zeitraum Performance Board</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={periodData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}


        {activeSection === "performance" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8 rounded-2xl border border-purple-800">
              <h2 className="text-3xl font-bold mb-2"> Performance Analytics V5.4.2</h2>
              <p className="text-gray-400">
                Professionelles Performance-Board mit Expectancy, Score, R-Multiple, Streaks und Market-Analyse.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-purple-800">
                <h2 className="font-bold mb-4">Expectancy Gauge</h2>
                <div className="flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border-[14px] border-purple-500 flex items-center justify-center bg-black">
                    <div className="text-center">
                      <p className={expectancyR >= 0 ? "text-3xl font-bold text-purple-400" : "text-3xl font-bold text-red-400"}>{expectancyR}R</p>
                      <p className="text-xs text-gray-400">per Trade</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-800">
                <h2 className="font-bold mb-4">Performance Score</h2>
                <div className="flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border-[14px] border-yellow-500 flex items-center justify-center bg-black">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-yellow-400">{performanceScore}</p>
                      <p className="text-xs text-gray-400">/100</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-800">
                <h2 className="font-bold">Average R</h2>
                <p className={averageRMultiple >= 0 ? "text-3xl mt-4 text-cyan-400" : "text-3xl mt-4 text-red-400"}>{averageRMultiple}R</p>
                <div className="mt-6 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(Math.abs(averageRMultiple) * 40, 100)}%` }} />
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-blue-800">
                <h2 className="font-bold">Average Trade</h2>
                <p className={averageTrade >= 0 ? "text-3xl mt-4 text-green-400" : "text-3xl mt-4 text-red-400"}>{averageTrade} CHF</p>
                <div className="mt-6 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className={averageTrade >= 0 ? "h-full bg-green-400 rounded-full" : "h-full bg-red-400 rounded-full"} style={{ width: "70%" }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-800">
                <h2 className="font-bold">Winning Streak</h2>
                <p className="text-3xl mt-4 text-green-400">{winningStreak}</p>
                <p className="text-gray-400 mt-2">Trades</p>
              </div>
              <div className="bg-gray-900 p-6 rounded-2xl border border-red-800">
                <h2 className="font-bold">Losing Streak</h2>
                <p className="text-3xl mt-4 text-red-400">{losingStreak}</p>
                <p className="text-gray-400 mt-2">Trades</p>
              </div>
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-800">
                <h2 className="font-bold">Best Trading Day</h2>
                <p className="text-3xl mt-4 text-green-400">{bestTradingDay.value} CHF</p>
                <p className="text-gray-400 mt-2">{bestTradingDay.date}</p>
              </div>
              <div className="bg-gray-900 p-6 rounded-2xl border border-red-800">
                <h2 className="font-bold">Worst Trading Day</h2>
                <p className="text-3xl mt-4 text-red-400">{worstTradingDay.value} CHF</p>
                <p className="text-gray-400 mt-2">{worstTradingDay.date}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-purple-900">
                <h2 className="text-xl font-bold mb-4"> Performance nach Market</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marketPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="market" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#a855f7" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-green-900">
                <h2 className="text-xl font-bold mb-4"> Daily Performance</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buildDailyPerformance(filteredTrades)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#22c55e" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}


        {activeSection === "intelligence" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8 rounded-2xl border border-cyan-800">
              <h2 className="text-3xl font-bold mb-2"> Journal Intelligence V5.5</h2>
              <p className="text-gray-400">
                Erste echte Intelligenz-Schicht: beste Mrkte, schlechteste Mrkte, Richtungsvorteil, Wochentage und Strategy Edge Score.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-800">
                <h2 className="font-bold mb-4">Intelligence Score</h2>
                <div className="flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border-[14px] border-cyan-500 flex items-center justify-center bg-black">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-cyan-400">{journalIntelligenceScore}</p>
                      <p className="text-xs text-gray-400">/100</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-purple-800">
                <h2 className="font-bold">System Verdict</h2>
                <p
                  className={
                    journalIntelligenceScore >= 80
                      ? "text-3xl mt-6 text-green-400"
                      : journalIntelligenceScore >= 60
                        ? "text-3xl mt-6 text-yellow-400"
                        : "text-3xl mt-6 text-red-400"
                  }
                >
                  {journalIntelligenceVerdict}
                </p>
                <p className="text-gray-400 mt-3">Strategy Health</p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-green-800">
                <h2 className="font-bold">Best Market</h2>
                <p className="text-3xl mt-6 text-green-400">{marketIntelligence.bestMarket.market}</p>
                <p className="text-gray-400 mt-2">
                  {marketIntelligence.bestMarket.profitLoss} CHF  {marketIntelligence.bestMarket.winrate}% WR
                </p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-red-800">
                <h2 className="font-bold">Worst Market</h2>
                <p className="text-3xl mt-6 text-red-400">{marketIntelligence.worstMarket.market}</p>
                <p className="text-gray-400 mt-2">
                  {marketIntelligence.worstMarket.profitLoss} CHF  {marketIntelligence.worstMarket.winrate}% WR
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-800">
                <h2 className="font-bold">Best Direction</h2>
                <p className="text-3xl mt-6 text-green-400">{directionStats.bestDirection}</p>
                <p className="text-gray-400 mt-2">
                  LONG {directionStats.longWinrate}%  SHORT {directionStats.shortWinrate}%
                </p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-blue-800">
                <h2 className="font-bold">LONG Performance</h2>
                <p className={directionStats.longProfit >= 0 ? "text-3xl mt-6 text-green-400" : "text-3xl mt-6 text-red-400"}>
                  {directionStats.longProfit} CHF
                </p>
                <p className="text-gray-400 mt-2">{directionStats.longTrades} Trades</p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-orange-800">
                <h2 className="font-bold">SHORT Performance</h2>
                <p className={directionStats.shortProfit >= 0 ? "text-3xl mt-6 text-green-400" : "text-3xl mt-6 text-red-400"}>
                  {directionStats.shortProfit} CHF
                </p>
                <p className="text-gray-400 mt-2">{directionStats.shortTrades} Trades</p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-800">
                <h2 className="font-bold">Best Weekday</h2>
                <p className="text-3xl mt-6 text-yellow-400">{weekdayIntelligence.bestWeekday.weekday}</p>
                <p className="text-gray-400 mt-2">
                  {weekdayIntelligence.bestWeekday.profitLoss} CHF  {weekdayIntelligence.bestWeekday.winrate}% WR
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-purple-900">
                <h2 className="text-xl font-bold mb-4"> Market Intelligence</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marketIntelligence.marketStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="market" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="profitLoss" fill="#a855f7" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-yellow-900">
                <h2 className="text-xl font-bold mb-4"> Weekday Intelligence</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekdayIntelligence.weekdayStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="weekday" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="profitLoss" fill="#facc15" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-800">
              <h2 className="text-xl font-bold mb-4"> Intelligence Notes</h2>
              <div className="grid grid-cols-2 gap-6 text-gray-300">
                <div className="bg-black border border-gray-800 rounded-xl p-5">
                  <h3 className="font-bold text-green-400 mb-2">What works best</h3>
                  <p>
                    Aktuell performt <span className="text-green-400">{marketIntelligence.bestMarket.market}</span> am strksten.
                    Die beste Richtung ist <span className="text-green-400">{directionStats.bestDirection}</span>.
                  </p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-5">
                  <h3 className="font-bold text-red-400 mb-2">What needs attention</h3>
                  <p>
                    Schwchster Markt ist <span className="text-red-400">{marketIntelligence.worstMarket.market}</span>.
                    Beobachte Drawdown, Profit Factor und Expectancy bevor du Risiko erhhst.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "strategy" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8 rounded-2xl border border-green-800">
              <h2 className="text-3xl font-bold mb-2"> Strategy Builder V5.7</h2>
              <p className="text-gray-400">
                Strategie-Analyse als Grundlage fr den spteren AI Trading Bot: Welche Setups funktionieren wirklich?
              </p>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-800">
                <h2 className="font-bold">Best Strategy</h2>
                <p className="text-3xl mt-6 text-green-400">{strategyStats.bestStrategy.strategy}</p>
                <p className="text-gray-400 mt-2">
                  {strategyStats.bestStrategy.profitLoss} CHF  {strategyStats.bestStrategy.winrate}% WR
                </p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-red-800">
                <h2 className="font-bold">Worst Strategy</h2>
                <p className="text-3xl mt-6 text-red-400">{strategyStats.worstStrategy.strategy}</p>
                <p className="text-gray-400 mt-2">
                  {strategyStats.worstStrategy.profitLoss} CHF  {strategyStats.worstStrategy.winrate}% WR
                </p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-800">
                <h2 className="font-bold">Tracked Strategies</h2>
                <p className="text-3xl mt-6 text-cyan-400">{strategyStats.strategyStats.length}</p>
                <p className="text-gray-400 mt-2">aktive Strategien</p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-800">
                <h2 className="font-bold">Bot Readiness</h2>
                <p className="text-3xl mt-6 text-yellow-400">
                  {strategyStats.strategyStats.length >= 3
                    ? "High"
                    : strategyStats.strategyStats.length >= 1
                      ? "Building"
                      : "Needs Data"}
                </p>
                <p className="text-gray-400 mt-2">Strategy Dataset</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-green-900">
                <h2 className="text-xl font-bold mb-4"> Strategy Performance</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strategyStats.strategyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="strategy" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="profitLoss" fill="#22c55e" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-cyan-900">
                <h2 className="text-xl font-bold mb-4"> Strategy Winrate</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strategyStats.strategyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="strategy" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="winrate" fill="#22d3ee" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl overflow-x-auto border border-gray-800">
              <h2 className="text-xl font-bold mb-4"> Strategy Table</h2>
              <div className="min-w-[1000px]">
                <div className="grid grid-cols-6 gap-4 p-4 bg-gray-800 font-bold rounded-t-xl">
                  <div>Strategy</div>
                  <div>P/L</div>
                  <div>Trades</div>
                  <div>Wins</div>
                  <div>Losses</div>
                  <div>Winrate</div>
                </div>

                {strategyStats.strategyStats.map((item) => (
                  <div
                    key={item.strategy}
                    className="grid grid-cols-6 gap-4 p-4 border-t border-gray-800 items-center"
                  >
                    <div>{item.strategy}</div>
                    <div className={item.profitLoss >= 0 ? "text-green-400" : "text-red-400"}>
                      {item.profitLoss} CHF
                    </div>
                    <div>{item.trades}</div>
                    <div className="text-green-400">{item.wins}</div>
                    <div className="text-red-400">{item.losses}</div>
                    <div className="text-cyan-400">{item.winrate}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-green-800">
              <h2 className="text-xl font-bold mb-4"> Bot Logic Preview</h2>
              <p className="text-gray-300">
                Spter kann der Bot neue Setups mit deinen besten Strategien vergleichen.
                Beispiel: Wenn ein Setup zu <span className="text-green-400">{strategyStats.bestStrategy.strategy}</span> passt,
                kann GPT/Claude eine hhere Confidence geben.
              </p>
            </div>
          </div>
        )}

        {activeSection === "tradeReview" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8 rounded-2xl border border-yellow-800">
              <h2 className="text-3xl font-bold mb-2"> AI Trade Review V5.6</h2>
              <p className="text-gray-400">
                Automatische Trade-Bewertung als Grundlage fr den spteren AI Trading Bot.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-800">
                <h2 className="font-bold mb-4">Average Trade Score</h2>
                <div className="flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border-[14px] border-yellow-500 flex items-center justify-center bg-black">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-yellow-400">
                        {aiTradeReviewStats.averageScore}
                      </p>
                      <p className="text-xs text-gray-400">/100</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-800">
                <h2 className="font-bold">Average Grade</h2>
                <p className="text-5xl mt-8 text-cyan-400">{aiTradeReviewStats.averageGrade}</p>
                <p className="text-gray-400 mt-3">Trade Quality</p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-green-800">
                <h2 className="font-bold">Best Rated Trade</h2>
                <p className="text-4xl mt-8 text-green-400">
                  {aiTradeReviewStats.bestReview?.grade ?? "-"}
                </p>
                <p className="text-gray-400 mt-3">
                  {aiTradeReviewStats.bestReview
                    ? `#${aiTradeReviewStats.bestReview.tradeId}  ${aiTradeReviewStats.bestReview.market}`
                    : "Keine Trades"}
                </p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-red-800">
                <h2 className="font-bold">Worst Rated Trade</h2>
                <p className="text-4xl mt-8 text-red-400">
                  {aiTradeReviewStats.worstReview?.grade ?? "-"}
                </p>
                <p className="text-gray-400 mt-3">
                  {aiTradeReviewStats.worstReview
                    ? `#${aiTradeReviewStats.worstReview.tradeId}  ${aiTradeReviewStats.worstReview.market}`
                    : "Keine Trades"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-yellow-900">
                <h2 className="text-xl font-bold mb-4"> Trade Quality Distribution</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aiTradeReviewStats.distribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="grade" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#facc15" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-cyan-900">
                <h2 className="text-xl font-bold mb-4"> Trade Score Development</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aiTradeReviewStats.scoreHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="trade" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={4} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {aiTradeReviewStats.reviews.map((review) => (
                <div
                  key={review.tradeId}
                  className="bg-gray-900 p-6 rounded-2xl border border-gray-800"
                >
                  <div className="flex justify-between items-start gap-6">
                    <div>
                      <h2 className="text-2xl font-bold">
                        Trade #{review.tradeId}  {review.market}
                      </h2>
                      <p className="text-gray-400 mt-2">
                        {review.direction}  P/L {review.profitLoss} CHF  R/R {review.riskReward}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={
                          review.grade === "A+" || review.grade === "A"
                            ? "text-5xl font-bold text-green-400"
                            : review.grade === "B"
                              ? "text-5xl font-bold text-yellow-400"
                              : "text-5xl font-bold text-red-400"
                        }
                      >
                        {review.grade}
                      </p>
                      <p className="text-gray-400 mt-2">{review.score}/100</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-black border border-gray-800 rounded-xl p-4">
                      <h3 className="font-bold text-cyan-400">AI Verdict</h3>
                      <p className="text-gray-300 mt-2">{review.verdict}</p>
                    </div>

                    <div className="bg-black border border-gray-800 rounded-xl p-4">
                      <h3 className="font-bold text-yellow-400">Risk Check</h3>
                      <p className="text-gray-300 mt-2">
                        Risk Amount: {review.riskAmount} CHF
                      </p>
                    </div>

                    <div className="bg-black border border-gray-800 rounded-xl p-4">
                      <h3 className="font-bold text-purple-400">Bot Relevance</h3>
                      <p className="text-gray-300 mt-2">
                        Spter kann dieser Score mit GPT/Claude als Entscheidungsfilter genutzt werden.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-6">
                    {review.checks.map((check) => (
                      <div
                        key={check.label}
                        className={
                          check.status === "PASS"
                            ? "bg-green-950 border border-green-800 rounded-xl p-3"
                            : check.status === "WARNING"
                              ? "bg-yellow-950 border border-yellow-800 rounded-xl p-3"
                              : "bg-red-950 border border-red-800 rounded-xl p-3"
                        }
                      >
                        <p className="font-bold">
                          {check.status === "PASS"
                            ? " "
                            : check.status === "WARNING"
                              ? " "
                              : " "}
                          {check.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {aiTradeReviewStats.reviews.length === 0 && (
                <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
                  <p className="text-gray-400">
                    Noch keine geschlossenen Trades fr AI Trade Review vorhanden.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === "signal" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8 rounded-2xl border border-orange-800">
              <h2 className="text-3xl font-bold mb-2"> Signal Engine V5.8</h2>
              <p className="text-gray-400">
                Erste Entscheidungslogik: Confidence Score, Trade Recommendation, Risk Validation und Bot-Signal-Vorschau.
              </p>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
              <h2 className="text-xl font-bold mb-4"> Signal Input</h2>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block mb-2 text-gray-400">Market</label>
                  <select
                    value={signalMarket}
                    onChange={(event) => setSignalMarket(event.target.value)}
                    className="w-full bg-black border border-gray-700 p-3 rounded-xl"
                  >
                    {markets.map((marketItem) => (
                      <option key={marketItem} value={marketItem}>
                        {marketItem}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 text-gray-400">Strategy</label>
                  <select
                    value={signalStrategy}
                    onChange={(event) => setSignalStrategy(event.target.value)}
                    className="w-full bg-black border border-gray-700 p-3 rounded-xl"
                  >
                    {strategies.map((strategyItem) => (
                      <option key={strategyItem} value={strategyItem}>
                        {strategyItem}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 text-gray-400">Planned R/R</label>
                  <input
                    value={signalRiskReward}
                    onChange={(event) => setSignalRiskReward(event.target.value)}
                    className="w-full bg-black border border-gray-700 p-3 rounded-xl"
                    placeholder="z.B. 2"
                  />
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-4">
                  <h3 className="font-bold text-gray-300">Planned Risk</h3>
                  <p className="text-2xl mt-2 text-red-400">{plannedRiskAmount} CHF</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-orange-800">
                <h2 className="font-bold mb-4">Confidence Score</h2>
                <div className="flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border-[14px] border-orange-500 flex items-center justify-center bg-black">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-400">
                        {signalEngineResult.confidenceScore}%
                      </p>
                      <p className="text-xs text-gray-400">Confidence</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-800">
                <h2 className="font-bold">Setup Quality</h2>
                <p
                  className={
                    signalEngineResult.setupQuality === "A+" || signalEngineResult.setupQuality === "A"
                      ? "text-5xl mt-8 text-green-400"
                      : signalEngineResult.setupQuality === "B"
                        ? "text-5xl mt-8 text-yellow-400"
                        : "text-5xl mt-8 text-red-400"
                  }
                >
                  {signalEngineResult.setupQuality}
                </p>
                <p className="text-gray-400 mt-3">Quality Grade</p>
              </div>

              <div
                className={
                  signalEngineResult.recommendation === "TRADE"
                    ? "bg-gray-900 p-6 rounded-2xl border border-green-800"
                    : signalEngineResult.recommendation === "WAIT"
                      ? "bg-gray-900 p-6 rounded-2xl border border-yellow-800"
                      : "bg-gray-900 p-6 rounded-2xl border border-red-800"
                }
              >
                <h2 className="font-bold">Recommendation</h2>
                <p
                  className={
                    signalEngineResult.recommendation === "TRADE"
                      ? "text-5xl mt-8 text-green-400"
                      : signalEngineResult.recommendation === "WAIT"
                        ? "text-5xl mt-8 text-yellow-400"
                        : "text-5xl mt-8 text-red-400"
                  }
                >
                  {signalEngineResult.recommendation}
                </p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-purple-800">
                <h2 className="font-bold">Bot Mode</h2>
                <p className="text-4xl mt-8 text-purple-400">SIM</p>
                <p className="text-gray-400 mt-3">Simulation only</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div
                className={
                  signalEngineResult.riskStatus === "PASS"
                    ? "bg-gray-900 p-6 rounded-2xl border border-green-800"
                    : signalEngineResult.riskStatus === "WARNING"
                      ? "bg-gray-900 p-6 rounded-2xl border border-yellow-800"
                      : "bg-gray-900 p-6 rounded-2xl border border-red-800"
                }
              >
                <h2 className="font-bold">Risk Status</h2>
                <p className="text-3xl mt-6">{signalEngineResult.riskStatus}</p>
              </div>

              <div
                className={
                  signalEngineResult.strategyStatus === "PASS"
                    ? "bg-gray-900 p-6 rounded-2xl border border-green-800"
                    : signalEngineResult.strategyStatus === "WARNING"
                      ? "bg-gray-900 p-6 rounded-2xl border border-yellow-800"
                      : "bg-gray-900 p-6 rounded-2xl border border-red-800"
                }
              >
                <h2 className="font-bold">Strategy Status</h2>
                <p className="text-3xl mt-6">{signalEngineResult.strategyStatus}</p>
              </div>

              <div
                className={
                  signalEngineResult.marketStatus === "PASS"
                    ? "bg-gray-900 p-6 rounded-2xl border border-green-800"
                    : signalEngineResult.marketStatus === "WARNING"
                      ? "bg-gray-900 p-6 rounded-2xl border border-yellow-800"
                      : "bg-gray-900 p-6 rounded-2xl border border-red-800"
                }
              >
                <h2 className="font-bold">Market Status</h2>
                <p className="text-3xl mt-6">{signalEngineResult.marketStatus}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-orange-900">
                <h2 className="text-xl font-bold mb-4"> Signal Distribution</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={signalEngineResult.distribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="signal" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#fb923c" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-800">
                <h2 className="text-xl font-bold mb-4"> Signal Validation Checklist</h2>

                <div className="grid grid-cols-1 gap-3">
                  {signalEngineResult.checks.map((check) => (
                    <div
                      key={check.label}
                      className={
                        check.status === "PASS"
                          ? "bg-green-950 border border-green-800 rounded-xl p-4"
                          : check.status === "WARNING"
                            ? "bg-yellow-950 border border-yellow-800 rounded-xl p-4"
                            : "bg-red-950 border border-red-800 rounded-xl p-4"
                      }
                    >
                      <p className="font-bold">
                        {check.status === "PASS"
                          ? " "
                          : check.status === "WARNING"
                            ? " "
                            : " "}
                        {check.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-orange-800">
              <h2 className="text-xl font-bold mb-4"> AI Signal Panel</h2>
              <div className="grid grid-cols-2 gap-6 text-gray-300">
                <div className="bg-black border border-gray-800 rounded-xl p-5">
                  <h3 className="font-bold text-orange-400 mb-2">Signal Summary</h3>
                  <p>
                    Market: <span className="text-cyan-400">{signalMarket}</span>
                    <br />
                    Strategy: <span className="text-green-400">{signalStrategy}</span>
                    <br />
                    Confidence: <span className="text-orange-400">{signalEngineResult.confidenceScore}%</span>
                    <br />
                    Recommendation: <span className="text-yellow-400">{signalEngineResult.recommendation}</span>
                  </p>
                </div>

                <div className="bg-black border border-gray-800 rounded-xl p-5">
                  <h3 className="font-bold text-purple-400 mb-2">Bot Preparation</h3>
                  <p>
                    Diese Engine luft aktuell im Simulationsmodus. Spter kann sie als Filter vor
                    OpenAI/Claude und Broker-Ausfhrung ber Capital.com oder IC Markets genutzt werden.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "bot" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8 rounded-2xl border border-purple-800">
              <h2 className="text-3xl font-bold mb-2"> Bot Readiness Center V5.9</h2>
              <p className="text-gray-400">
                Brcke vom Trading Journal zum professionellen Trading Bot: System Score, Deployment Status und zuknftige API-Verbindungen.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-purple-800">
                <h2 className="font-bold mb-4">Bot Readiness Score</h2>
                <div className="flex items-center justify-center">
                  <div className="w-40 h-40 rounded-full border-[16px] border-purple-500 flex items-center justify-center bg-black">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-purple-400">
                        {botReadinessResult.score}
                      </p>
                      <p className="text-xs text-gray-400">/100</p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={
                  botReadinessResult.phase === "Bot Ready"
                    ? "bg-gray-900 p-6 rounded-2xl border border-green-800"
                    : botReadinessResult.phase === "Validation Phase"
                      ? "bg-gray-900 p-6 rounded-2xl border border-yellow-800"
                      : "bg-gray-900 p-6 rounded-2xl border border-blue-800"
                }
              >
                <h2 className="font-bold">Current Phase</h2>
                <p
                  className={
                    botReadinessResult.phase === "Bot Ready"
                      ? "text-3xl mt-8 text-green-400"
                      : botReadinessResult.phase === "Validation Phase"
                        ? "text-3xl mt-8 text-yellow-400"
                        : "text-3xl mt-8 text-blue-400"
                  }
                >
                  {botReadinessResult.phase}
                </p>
                <p className="text-gray-400 mt-3">Development Stage</p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-800">
                <h2 className="font-bold">Closed Trades</h2>
                <p className="text-4xl mt-8 text-cyan-400">{closedTrades.length}</p>
                <p className="text-gray-400 mt-3">Target: 500</p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-orange-800">
                <h2 className="font-bold">Missing Trades</h2>
                <p className="text-4xl mt-8 text-orange-400">{botReadinessResult.missingTrades}</p>
                <p className="text-gray-400 mt-3">until strong dataset</p>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-purple-800">
              <h2 className="text-xl font-bold mb-4"> AI Readiness Verdict</h2>
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <p className="text-gray-300 text-lg">{botReadinessResult.verdict}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-800">
                <h2 className="font-bold">Winrate</h2>
                <p className="text-3xl mt-5 text-cyan-400">{winrate}%</p>
                <div className="mt-5 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(winrate, 100)}%` }} />
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-800">
                <h2 className="font-bold">Profit Factor</h2>
                <p className="text-3xl mt-5 text-yellow-400">{profitFactor}</p>
                <div className="mt-5 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min(profitFactor * 25, 100)}%` }} />
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-red-800">
                <h2 className="font-bold">Max Drawdown %</h2>
                <p className="text-3xl mt-5 text-red-400">{accountStats.maxDrawdownPercent}%</p>
                <div className="mt-5 h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(accountStats.maxDrawdownPercent * 10, 100)}%` }} />
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
              <h2 className="text-xl font-bold mb-4"> Deployment Status</h2>

              <div className="grid grid-cols-3 gap-4">
                {botReadinessResult.checklist.map((item) => (
                  <div
                    key={item.label}
                    className={
                      item.status === "READY"
                        ? "bg-green-950 border border-green-800 rounded-xl p-4"
                        : item.status === "BUILDING"
                          ? "bg-yellow-950 border border-yellow-800 rounded-xl p-4"
                          : "bg-gray-950 border border-gray-800 rounded-xl p-4"
                    }
                  >
                    <h3 className="font-bold">
                      {item.status === "READY"
                        ? " "
                        : item.status === "BUILDING"
                          ? " "
                          : " "}
                      {item.label}
                    </h3>
                    <p className="text-gray-400 mt-2">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-purple-900">
                <h2 className="text-xl font-bold mb-4"> Bot Readiness Progress</h2>
                <div className="space-y-5 mt-8">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Data Collection</span>
                      <span>{Math.min(Math.round((closedTrades.length / 500) * 100), 100)}%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(Math.round((closedTrades.length / 500) * 100), 100)}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Analytics Maturity</span>
                      <span>{journalIntelligenceScore}%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(journalIntelligenceScore, 100)}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Signal Engine</span>
                      <span>{signalEngineResult.confidenceScore}%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min(signalEngineResult.confidenceScore, 100)}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Overall Bot Readiness</span>
                      <span>{botReadinessResult.score}%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-400 rounded-full" style={{ width: `${botReadinessResult.score}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-blue-900">
                <h2 className="text-xl font-bold mb-4"> Future Connections</h2>
                <div className="grid grid-cols-2 gap-4">
                  {botReadinessResult.connections.map((connection) => (
                    <div
                      key={connection.name}
                      className="bg-black border border-gray-800 rounded-xl p-4"
                    >
                      <h3 className="font-bold text-blue-400">{connection.name}</h3>
                      <p className="text-gray-400 mt-2">
                        {connection.status === "Coming Soon"
                          ? " Coming Soon"
                          : connection.status}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl border border-purple-800">
              <h2 className="text-xl font-bold mb-4"> Next Bot Steps</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-black border border-gray-800 rounded-xl p-5">
                  <h3 className="font-bold text-cyan-400">V6.0</h3>
                  <p className="text-gray-300 mt-2">Broker Integration Layer vorbereiten.</p>
                </div>
                <div className="bg-black border border-gray-800 rounded-xl p-5">
                  <h3 className="font-bold text-green-400">V6.1</h3>
                  <p className="text-gray-300 mt-2">OpenAI/Claude Signal Review anbinden.</p>
                </div>
                <div className="bg-black border border-gray-800 rounded-xl p-5">
                  <h3 className="font-bold text-orange-400">V6.2</h3>
                  <p className="text-gray-300 mt-2">Paper Trading Execution Engine bauen.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "charts" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8 rounded-2xl border border-cyan-800">
              <h2 className="text-3xl font-bold mb-2"> Professional Charts Center V5.4.2</h2>
              <p className="text-gray-400">
                Kompakte Analytics-Zentrale im Dashboard-Stil: Gauges, Equity, Drawdown, Daily, Weekly, Monthly und Market Performance.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-800 shadow-lg">
                <h2 className="font-bold mb-4">Growth Gauge</h2>
                <div className="flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border-[14px] border-green-500 flex items-center justify-center bg-black shadow-inner">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-400">
                        {accountStats.growthPercent}%
                      </p>
                      <p className="text-xs text-gray-400">Growth</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-800 shadow-lg">
                <h2 className="font-bold mb-4">Performance Score</h2>
                <div className="flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border-[14px] border-yellow-500 flex items-center justify-center bg-black shadow-inner">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-yellow-400">
                        {performanceScore}
                      </p>
                      <p className="text-xs text-gray-400">/100</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-red-800 shadow-lg">
                <h2 className="font-bold mb-4">Max DD Gauge</h2>
                <div className="flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border-[14px] border-red-500 flex items-center justify-center bg-black shadow-inner">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-400">
                        {accountStats.maxDrawdownPercent}%
                      </p>
                      <p className="text-xs text-gray-400">Drawdown</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-800 shadow-lg">
                <h2 className="font-bold mb-4">Expectancy</h2>
                <div className="flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border-[14px] border-cyan-500 flex items-center justify-center bg-black shadow-inner">
                    <div className="text-center">
                      <p className={expectancyR >= 0 ? "text-3xl font-bold text-cyan-400" : "text-3xl font-bold text-red-400"}>
                        {expectancyR}R
                      </p>
                      <p className="text-xs text-gray-400">per Trade</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-900">
                <h2 className="font-bold">Current Equity</h2>
                <p className="text-3xl mt-3 text-cyan-400">{accountStats.currentEquity} CHF</p>
                <div className="mt-5 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: "75%" }} />
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-blue-900">
                <h2 className="font-bold">Peak Account Value</h2>
                <p className="text-3xl mt-3 text-green-400">{accountStats.peakAccountEquity} CHF</p>
                <div className="mt-5 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full" style={{ width: "90%" }} />
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-red-900">
                <h2 className="font-bold">Max Drawdown</h2>
                <p className="text-3xl mt-3 text-red-400">{accountStats.maxDrawdown} CHF</p>
                <div className="mt-5 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(accountStats.maxDrawdownPercent * 10, 100)}%` }} />
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-900">
                <h2 className="font-bold">Risk Status</h2>
                <p
                  className={
                    propFirmStats.status === "PASS"
                      ? "text-3xl mt-3 text-green-400"
                      : propFirmStats.status === "WARNING"
                        ? "text-3xl mt-3 text-yellow-400"
                        : "text-3xl mt-3 text-red-400"
                  }
                >
                  {propFirmStats.status}
                </p>
                <div className="mt-5 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={
                      propFirmStats.status === "PASS"
                        ? "h-full bg-green-400 rounded-full"
                        : propFirmStats.status === "WARNING"
                          ? "h-full bg-yellow-400 rounded-full"
                          : "h-full bg-red-400 rounded-full"
                    }
                    style={{ width: propFirmStats.status === "PASS" ? "35%" : propFirmStats.status === "WARNING" ? "70%" : "100%" }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-green-900 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold"> Equity Curve</h2>
                  <span className="text-sm text-green-400">{totalProfit} CHF</span>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={4} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-cyan-900 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold"> Account Equity Curve</h2>
                  <span className="text-sm text-cyan-400">{accountStats.currentEquity} CHF</span>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={accountStats.accountEquityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="accountEquity" stroke="#22d3ee" strokeWidth={4} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-blue-900 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold"> Profit / Loss pro Trade</h2>
                  <span className="text-sm text-blue-400">{closedTrades.length} Closed</span>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={equityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="profitLoss" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-red-900 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold"> Max Drawdown Curve</h2>
                  <span className="text-sm text-red-400">{accountStats.maxDrawdown} CHF</span>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={accountStats.accountEquityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={4} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-900 shadow-lg">
                <h2 className="text-xl font-bold mb-4"> Daily Performance</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buildDailyPerformance(filteredTrades)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#22c55e" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-blue-900 shadow-lg">
                <h2 className="text-xl font-bold mb-4"> Weekly Performance</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyStats.weeklyPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="profitLoss" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-indigo-900 shadow-lg">
                <h2 className="text-xl font-bold mb-4"> Monthly Performance</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyStats.monthlyPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="profitLoss" fill="#6366f1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-purple-900 shadow-lg">
                <h2 className="text-xl font-bold mb-4"> Market Performance</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marketPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="market" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#a855f7" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-900 shadow-lg">
                <h2 className="text-xl font-bold mb-4"> Zeitraum Performance</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={periodData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-900 shadow-lg">
                <h2 className="text-xl font-bold mb-4"> Risk Usage</h2>
                <div className="space-y-5 mt-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Daily Usage</span>
                      <span>{propFirmStats.dailyUsagePercent}%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min(propFirmStats.dailyUsagePercent, 100)}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Overall DD Usage</span>
                      <span>{propFirmStats.overallUsagePercent}%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(propFirmStats.overallUsagePercent, 100)}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Winrate</span>
                      <span>{winrate}%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(winrate, 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "history" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8 rounded-2xl border border-gray-700">
              <h2 className="text-3xl font-bold mb-2"> Trade History Analytics V5.4.2</h2>
              <p className="text-gray-400">
                Trade-Historie mit Best/Worst Trade, Trade-Verteilung und Profit/Loss bersicht.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl border border-green-800">
                <h2 className="font-bold">Best Trade</h2>
                {bestTrade ? (
                  <>
                    <p className="text-3xl mt-4 text-green-400">{bestTrade.profitLoss} CHF</p>
                    <p className="text-gray-400 mt-2">{bestTrade.market}</p>
                  </>
                ) : (
                  <p className="text-gray-400 mt-4">Keine Trades.</p>
                )}
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-red-800">
                <h2 className="font-bold">Worst Trade</h2>
                {worstTrade ? (
                  <>
                    <p className="text-3xl mt-4 text-red-400">{worstTrade.profitLoss} CHF</p>
                    <p className="text-gray-400 mt-2">{worstTrade.market}</p>
                  </>
                ) : (
                  <p className="text-gray-400 mt-4">Keine Trades.</p>
                )}
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-cyan-800">
                <h2 className="font-bold">Closed Trades</h2>
                <p className="text-3xl mt-4 text-cyan-400">{closedTrades.length}</p>
                <p className="text-gray-400 mt-2">abgeschlossene Trades</p>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl border border-yellow-800">
                <h2 className="font-bold">Open Trades</h2>
                <p className="text-3xl mt-4 text-yellow-400">{openTrades.length}</p>
                <p className="text-gray-400 mt-2">laufende Trades</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-blue-900">
                <h2 className="text-xl font-bold mb-4"> Profit / Loss pro Trade</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={equityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="profitLoss" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-2xl min-h-96 border border-purple-900">
                <h2 className="text-xl font-bold mb-4"> Trades nach Market</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marketPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="market" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#a855f7" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl overflow-x-auto border border-gray-800">
              <h2 className="text-xl font-bold mb-4"> Trade Historie</h2>
              <div className="min-w-[1700px]">
                <div className="grid grid-cols-17 gap-4 p-4 bg-gray-800 font-bold rounded-t-xl">
                  <div>Date</div><div>Market</div><div>Direction</div><div>Strategy</div><div>Entry</div><div>SL</div><div>TP</div><div>Risk</div><div>R/R</div><div>Size</div><div>Status</div><div>P/L</div><div>Actions</div><div>Edit</div><div>Delete</div><div>Entry Account</div><div>Entry Risk %</div>
                </div>

                {filteredTrades.map((trade) => (
                  <div key={trade.id} className="grid grid-cols-17 gap-4 p-4 border-t border-gray-800 items-center">
                    <div>{new Date(trade.date).toLocaleDateString("de-CH")}</div>
                    <div>{trade.market}</div>
                    <div className={trade.direction === "LONG" ? "text-green-400" : "text-red-400"}>{trade.direction}</div>
                    <div>{trade.strategy || "Unclassified"}</div>
                    <div>{trade.entry}</div>
                    <div>{trade.stopLoss}</div>
                    <div>{trade.takeProfit}</div>
                    <div className="text-red-400">{trade.riskAmount ?? 0} CHF</div>
                    <div className="text-cyan-400">{trade.riskReward ?? 0}</div>
                    <div className="text-blue-400">{trade.positionSize ?? 0}</div>
                    <div className={trade.status === "OPEN" ? "text-yellow-400" : "text-green-400"}>{trade.status}</div>
                    <div className={trade.profitLoss >= 0 ? "text-green-400" : "text-red-400"}>{trade.profitLoss} CHF</div>
                    <div className="flex flex-col gap-2">
                      {trade.status === "OPEN" ? (
                        <>
                          <button onClick={() => closeTrade(trade.id, "WIN")} className="bg-green-700 hover:bg-green-800 px-3 py-1 rounded text-sm">WIN</button>
                          <button onClick={() => closeTrade(trade.id, "LOSS")} className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm">LOSS</button>
                        </>
                      ) : (
                        <button onClick={() => reopenTrade(trade.id)} className="bg-gray-700 hover:bg-gray-800 px-3 py-1 rounded text-sm">Reopen</button>
                      )}
                    </div>
                    <button onClick={() => startEditTrade(trade)} className="bg-blue-700 hover:bg-blue-800 px-3 py-2 rounded text-sm">Edit</button>
                    <button onClick={() => deleteTrade(trade.id)} className="bg-red-900 hover:bg-red-950 px-3 py-2 rounded text-sm">Lschen</button>
                    <div>{trade.accountSize ?? 30000}</div>
                    <div>{trade.riskPercent ?? 1}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
