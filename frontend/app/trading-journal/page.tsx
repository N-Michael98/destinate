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
  return weekKey.replace("-W", " · Woche ");
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

  const [market, setMarket] = useState("");
  const [direction, setDirection] = useState("LONG");
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
    if (!market || !entry || !stopLoss || !takeProfit || !accountSize || !riskPercent) {
      alert("Bitte Market, Entry, Stop Loss, Take Profit, Account Size und Risk % ausfüllen.");
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
      !editEntry ||
      !editStopLoss ||
      !editTakeProfit ||
      !editAccountSize ||
      !editRiskPercent
    ) {
      alert("Bitte Market, Entry, Stop Loss, Take Profit, Account Size und Risk % ausfüllen.");
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
      alert("Bitte eine gültige Zahl eingeben.");
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
      alert("Fehler beim Schließen des Trades.");
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
        alert("Trade konnte nicht wieder geöffnet werden.");
        return;
      }

      await loadTrades();
    } catch (error) {
      console.error(error);
      alert("Fehler beim Wiederöffnen des Trades.");
    }
  }

  async function deleteTrade(tradeId: number) {
    const confirmed = window.confirm("Diesen Trade wirklich löschen?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/trades/${tradeId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        alert("Trade konnte nicht gelöscht werden.");
        return;
      }

      await loadTrades();
    } catch (error) {
      console.error(error);
      alert("Fehler beim Löschen des Trades.");
    }
  }

  async function resetJournal() {
    const confirmed = window.confirm(
      "Wirklich ALLE Trades aus der SQLite-Datenbank löschen?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/trades", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        alert("Datenbank konnte nicht zurückgesetzt werden.");
        return;
      }

      setSelectedMarket("All");
      await loadTrades();
      alert("Alle Trades wurden gelöscht.");
    } catch (error) {
      console.error(error);
      alert("Fehler beim Zurücksetzen der Datenbank.");
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
        ← Zurück zum Dashboard
      </a>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-4">📈 Trading Journal</h1>
          <p className="text-gray-400">
            V5.3.1: Trading Journal mit Dashboard Navigation, Weekly/Monthly Statistics, Performance Analytics und Prop Firm Rules.
          </p>
        </div>

        <button
          onClick={exportYearlyReportPDF}
          className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl font-bold"
        >
          📄 Jahresreport PDF exportieren
        </button>
      </div>

      <div className="mb-8 bg-gray-950 border border-gray-800 rounded-2xl p-4 sticky top-0 z-20">
        <div className="flex flex-wrap gap-3">
          {[
            { id: "overview", label: "📊 Overview" },
            { id: "trading", label: "➕ Trading" },
            { id: "performance", label: "🧠 Performance Analytics" },
            { id: "time", label: "📅 Weekly / Monthly" },
            { id: "charts", label: "📈 Charts Center" },
            { id: "history", label: "🧾 Trade History" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() =>
                scrollToSection(
                  item.id as
                    | "overview"
                    | "trading"
                    | "performance"
                    | "time"
                    | "charts"
                    | "history"
                )
              }
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

      <div ref={tradingSectionRef} className="grid grid-cols-2 gap-6 mb-8 scroll-mt-28">
        <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
          <h2 className="text-2xl font-bold mb-4">💼 Account Settings V5.3.1</h2>

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
          <h2 className="text-2xl font-bold mb-4">⚙️ Prop Firm Settings V5.3.1</h2>

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
        <div className="bg-gray-900 p-6 rounded-xl border border-blue-700 mb-8">
          <h2 className="text-2xl font-bold mb-4">✏️ Trade bearbeiten #{editingTrade.id}</h2>

          <div className="grid grid-cols-4 gap-4">
            <input
              placeholder="Market"
              value={editMarket}
              onChange={(event) => setEditMarket(event.target.value)}
              className="bg-black border border-gray-700 p-3 rounded-xl"
            />

            <select
              value={editDirection}
              onChange={(event) => setEditDirection(event.target.value)}
              className="bg-black border border-gray-700 p-3 rounded-xl"
            >
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>

            <input
              placeholder="Entry"
              value={editEntry}
              onChange={(event) => setEditEntry(event.target.value)}
              className="bg-black border border-gray-700 p-3 rounded-xl"
            />

            <input
              placeholder="Stop Loss"
              value={editStopLoss}
              onChange={(event) => setEditStopLoss(event.target.value)}
              className="bg-black border border-gray-700 p-3 rounded-xl"
            />

            <input
              placeholder="Take Profit"
              value={editTakeProfit}
              onChange={(event) => setEditTakeProfit(event.target.value)}
              className="bg-black border border-gray-700 p-3 rounded-xl"
            />

            <input
              placeholder="Account Size"
              value={editAccountSize}
              onChange={(event) => setEditAccountSize(event.target.value)}
              className="bg-black border border-gray-700 p-3 rounded-xl"
            />

            <input
              placeholder="Risk %"
              value={editRiskPercent}
              onChange={(event) => setEditRiskPercent(event.target.value)}
              className="bg-black border border-gray-700 p-3 rounded-xl"
            />

            <input
              placeholder="Notizen"
              value={editNotes}
              onChange={(event) => setEditNotes(event.target.value)}
              className="bg-black border border-gray-700 p-3 rounded-xl"
            />
          </div>

          <div className="flex gap-4 mt-4">
            <button
              onClick={saveEditedTrade}
              disabled={isEditing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-5 py-3 rounded-xl font-bold"
            >
              {isEditing ? "Speichert..." : "💾 Änderungen speichern"}
            </button>

            <button
              onClick={cancelEditTrade}
              className="bg-gray-700 hover:bg-gray-800 px-5 py-3 rounded-xl font-bold"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-8">
        <h2 className="text-2xl font-bold mb-4">➕ Neuer Trade</h2>

        <div className="grid grid-cols-4 gap-4">
          <input
            placeholder="Market, z.B. Gold"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          />

          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          >
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>

          <input
            placeholder="Entry"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          />

          <input
            placeholder="Stop Loss"
            value={stopLoss}
            onChange={(event) => setStopLoss(event.target.value)}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          />

          <input
            placeholder="Take Profit"
            value={takeProfit}
            onChange={(event) => setTakeProfit(event.target.value)}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          />

          <input
            placeholder="Account Size"
            value={accountSize}
            onChange={(event) => setAccountSize(event.target.value)}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          />

          <input
            placeholder="Risk %"
            value={riskPercent}
            onChange={(event) => setRiskPercent(event.target.value)}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          />

          <input
            placeholder="Notizen"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="bg-black border border-gray-700 p-3 rounded-xl"
          />
        </div>

        <button
          onClick={createTrade}
          disabled={isSaving}
          className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 px-5 py-3 rounded-xl font-bold"
        >
          {isSaving ? "Speichert..." : "💾 Trade speichern"}
        </button>
      </div>

      <div className="mb-8 flex gap-4 items-end">
        <div>
          <label className="block mb-2 text-gray-400">Market auswählen</label>

          <select
            value={selectedMarket}
            onChange={(event) => setSelectedMarket(event.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
          >
            {markets.map((marketItem) => (
              <option key={marketItem}>{marketItem}</option>
            ))}
          </select>
        </div>

        <button
          onClick={resetJournal}
          className="bg-red-700 hover:bg-red-800 px-4 py-3 rounded-xl"
        >
          Datenbank zurücksetzen
        </button>

        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-gray-300">
          {isLoaded ? "SQLite Verbindung aktiv" : "Lade Datenbank..."}
        </div>
      </div>

      <div ref={reportRef} data-pdf-report className="bg-black text-white">
        <div ref={overviewSectionRef} className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-800 scroll-mt-28">
          <h2 className="text-2xl font-bold mb-2">📄 Jahresreport</h2>
          <p className="text-gray-400">
            AI Trading Journal Jahresübersicht · Filter: {selectedMarket}
          </p>
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

        <div ref={timeSectionRef} className="mb-8 bg-gray-900 p-6 rounded-xl border border-blue-800 scroll-mt-28">
          <h2 className="text-2xl font-bold mb-2">📅 Weekly Statistics V5.2</h2>
          <p className="text-gray-400">
            Wöchentliche Performance, beste/schlechteste Wochen und Wochen-Winrate.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
            <h2 className="font-bold">Best Week</h2>
            <p className="text-2xl mt-2 text-green-400">
              {weeklyStats.bestWeek.profitLoss} CHF
            </p>
            <p className="text-sm mt-2 text-gray-400">
              {weeklyStats.bestWeek.label}
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
            <h2 className="font-bold">Worst Week</h2>
            <p className="text-2xl mt-2 text-red-400">
              {weeklyStats.worstWeek.profitLoss} CHF
            </p>
            <p className="text-sm mt-2 text-gray-400">
              {weeklyStats.worstWeek.label}
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-blue-800">
            <h2 className="font-bold">Average Week</h2>
            <p
              className={
                weeklyStats.averageWeek >= 0
                  ? "text-2xl mt-2 text-green-400"
                  : "text-2xl mt-2 text-red-400"
              }
            >
              {weeklyStats.averageWeek} CHF
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-cyan-800">
            <h2 className="font-bold">Weekly Winrate</h2>
            <p className="text-2xl mt-2 text-cyan-400">
              {weeklyStats.weeklyWinrate}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
            <h2 className="font-bold">Positive Weeks</h2>
            <p className="text-2xl mt-2 text-green-400">
              {weeklyStats.positiveWeeks}
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
            <h2 className="font-bold">Negative Weeks</h2>
            <p className="text-2xl mt-2 text-red-400">
              {weeklyStats.negativeWeeks}
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-blue-800 col-span-2">
            <h2 className="font-bold mb-2">Weekly Summary</h2>
            <p className="text-gray-400">
              Du hast aktuell {weeklyStats.weeklyPerformance.length} ausgewertete Wochen im Journal.
            </p>
          </div>
        </div>

        <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-indigo-800">
          <h2 className="text-2xl font-bold mb-2">📆 Monthly Statistics V5.1</h2>
          <p className="text-gray-400">
            Monatliche Performance, beste/schlechteste Monate und Monats-Winrate.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
            <h2 className="font-bold">Best Month</h2>
            <p className="text-2xl mt-2 text-green-400">
              {monthlyStats.bestMonth.profitLoss} CHF
            </p>
            <p className="text-sm mt-2 text-gray-400">
              {monthlyStats.bestMonth.label}
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
            <h2 className="font-bold">Worst Month</h2>
            <p className="text-2xl mt-2 text-red-400">
              {monthlyStats.worstMonth.profitLoss} CHF
            </p>
            <p className="text-sm mt-2 text-gray-400">
              {monthlyStats.worstMonth.label}
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-blue-800">
            <h2 className="font-bold">Average Month</h2>
            <p
              className={
                monthlyStats.averageMonth >= 0
                  ? "text-2xl mt-2 text-green-400"
                  : "text-2xl mt-2 text-red-400"
              }
            >
              {monthlyStats.averageMonth} CHF
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-cyan-800">
            <h2 className="font-bold">Monthly Winrate</h2>
            <p className="text-2xl mt-2 text-cyan-400">
              {monthlyStats.monthlyWinrate}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
            <h2 className="font-bold">Positive Months</h2>
            <p className="text-2xl mt-2 text-green-400">
              {monthlyStats.positiveMonths}
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
            <h2 className="font-bold">Negative Months</h2>
            <p className="text-2xl mt-2 text-red-400">
              {monthlyStats.negativeMonths}
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-indigo-800 col-span-2">
            <h2 className="font-bold mb-2">Monthly Summary</h2>
            <p className="text-gray-400">
              Du hast aktuell {monthlyStats.monthlyPerformance.length} ausgewertete Monate im Journal.
            </p>
          </div>
        </div>

        <div ref={performanceSectionRef} className="mb-8 bg-gray-900 p-6 rounded-xl border border-purple-800 scroll-mt-28">
          <h2 className="text-2xl font-bold mb-2">🧠 Performance Analytics V5.0</h2>
          <p className="text-gray-400">
            Analyse deiner Strategie: Expectancy, R-Multiple, Streaks und Trading-Tage.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-purple-800">
            <h2 className="font-bold">Expectancy</h2>
            <p className={expectancyR >= 0 ? "text-2xl mt-2 text-green-400" : "text-2xl mt-2 text-red-400"}>
              {expectancyR}R
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-cyan-800">
            <h2 className="font-bold">Average R</h2>
            <p className={averageRMultiple >= 0 ? "text-2xl mt-2 text-cyan-400" : "text-2xl mt-2 text-red-400"}>
              {averageRMultiple}R
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-blue-800">
            <h2 className="font-bold">Average Trade</h2>
            <p className={averageTrade >= 0 ? "text-2xl mt-2 text-green-400" : "text-2xl mt-2 text-red-400"}>
              {averageTrade} CHF
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-yellow-800">
            <h2 className="font-bold">Performance Score</h2>
            <p className="text-2xl mt-2 text-yellow-400">
              {performanceScore}/100
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
            <h2 className="font-bold">Winning Streak</h2>
            <p className="text-2xl mt-2 text-green-400">
              {winningStreak} Trades
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
            <h2 className="font-bold">Losing Streak</h2>
            <p className="text-2xl mt-2 text-red-400">
              {losingStreak} Trades
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
            <h2 className="font-bold">Best Trading Day</h2>
            <p className="text-2xl mt-2 text-green-400">
              {bestTradingDay.value} CHF
            </p>
            <p className="text-sm mt-2 text-gray-400">{bestTradingDay.date}</p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
            <h2 className="font-bold">Worst Trading Day</h2>
            <p className="text-2xl mt-2 text-red-400">
              {worstTradingDay.value} CHF
            </p>
            <p className="text-sm mt-2 text-gray-400">{worstTradingDay.date}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
            <h2 className="font-bold">Starting Balance</h2>
            <p className="text-2xl mt-2 text-green-400">
              {numericStartingBalance} CHF
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-cyan-800">
            <h2 className="font-bold">Current Equity</h2>
            <p className="text-2xl mt-2 text-cyan-400">
              {accountStats.currentEquity} CHF
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-blue-800">
            <h2 className="font-bold">Growth %</h2>
            <p className={accountStats.growthPercent >= 0 ? "text-2xl mt-2 text-green-400" : "text-2xl mt-2 text-red-400"}>
              {accountStats.growthPercent}%
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-yellow-800">
            <h2 className="font-bold">Risk pro Trade</h2>
            <p className="text-2xl mt-2 text-yellow-400">
              {plannedRiskAmount} CHF
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-yellow-800">
            <h2 className="font-bold">Account Risk %</h2>
            <p className="text-2xl mt-2 text-yellow-400">
              {accountRiskPercent}%
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
            <h2 className="font-bold">Historical Total Risk</h2>
            <p className="text-2xl mt-2 text-red-400">{totalRiskAmount} CHF</p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-orange-800">
            <h2 className="font-bold">Open Trade Risk</h2>
            <p className="text-2xl mt-2 text-orange-400">{openRiskAmount} CHF</p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-cyan-800">
            <h2 className="font-bold">Avg. R/R</h2>
            <p className="text-2xl mt-2 text-cyan-400">{averageRiskReward}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-cyan-800">
            <h2 className="font-bold">Today Loss</h2>
            <p className="text-2xl mt-2 text-cyan-400">
              {propFirmStats.todayLoss} CHF
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-yellow-800">
            <h2 className="font-bold">Daily Limit</h2>
            <p className="text-2xl mt-2 text-yellow-400">
              {propFirmStats.dailyLossLimit} CHF
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
            <h2 className="font-bold">Overall DD Limit</h2>
            <p className="text-2xl mt-2 text-red-400">
              {propFirmStats.overallDrawdownLimit} CHF
            </p>
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
                ? "PASS ✅"
                : propFirmStats.status === "WARNING"
                  ? "WARNING ⚠️"
                  : "VIOLATION ❌"}
            </p>
          </div>
        </div>

        
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-cyan-800">
            <h2 className="font-bold">Today's P/L</h2>
            <p className="text-2xl mt-2 text-cyan-400">{todaysPL} CHF</p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
            <h2 className="font-bold">Today's Loss</h2>
            <p className="text-2xl mt-2 text-red-400">{todaysLoss} CHF</p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-yellow-800">
            <h2 className="font-bold">Remaining Daily Limit</h2>
            <p className="text-2xl mt-2 text-yellow-400">{remainingDailyLimit} CHF</p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-blue-800">
            <h2 className="font-bold">Daily Status</h2>
            <p className="text-2xl mt-2 text-blue-400">{dailyStatus}</p>
          </div>
        </div>

<div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-red-800">
            <h2 className="font-bold">Max Drawdown</h2>
            <p className="text-2xl mt-2 text-red-400">
              {accountStats.maxDrawdown} CHF
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-yellow-800">
            <h2 className="font-bold">Max DD %</h2>
            <p className="text-2xl mt-2 text-yellow-400">
              {accountStats.maxDrawdownPercent}%
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-blue-800">
            <h2 className="font-bold">Current Drawdown</h2>
            <p className="text-2xl mt-2 text-blue-400">
              {accountStats.currentDrawdown} CHF
            </p>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-green-800">
            <h2 className="font-bold">Peak Account Value</h2>
            <p className="text-2xl mt-2 text-green-400">
              {accountStats.peakAccountEquity} CHF
            </p>
          </div>
        </div>

        {isLoaded && (
          <>
            <div ref={chartsSectionRef} className="mb-8 bg-gray-900 p-6 rounded-xl border border-cyan-800 scroll-mt-28">
              <h2 className="text-2xl font-bold mb-2">📈 Charts Center V5.3.1</h2>
              <p className="text-gray-400">Alle Diagramme gesammelt: Equity, Account Equity, Drawdown, Daily, Weekly, Monthly und Market Performance.</p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-900 p-6 rounded-xl min-h-96">
                <h2 className="text-xl font-bold mb-4">📈 Equity Curve</h2>

                <div className="h-80 min-h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-xl min-h-96">
                <h2 className="text-xl font-bold mb-4">📊 Profit / Loss pro Trade</h2>

                <div className="h-80 min-h-80">
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

            <div className="bg-gray-900 p-6 rounded-xl min-h-96 mb-8">
              <h2 className="text-xl font-bold mb-4">💼 Account Equity Curve</h2>

              <div className="h-80 min-h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={accountStats.accountEquityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="accountEquity"
                      stroke="#22d3ee"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl min-h-96 mb-8">
              <h2 className="text-xl font-bold mb-4">📉 Max Drawdown Curve</h2>

              <div className="h-80 min-h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={accountStats.accountEquityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="drawdown"
                      stroke="#ef4444"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl min-h-96 mb-8">
              <h2 className="text-xl font-bold mb-4">📅 Weekly Performance</h2>

              <div className="h-80 min-h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyStats.weeklyPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="profitLoss" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl min-h-96 mb-8">
              <h2 className="text-xl font-bold mb-4">📆 Monthly Performance</h2>

              <div className="h-80 min-h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyStats.monthlyPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="profitLoss" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl min-h-96 mb-8">
              <h2 className="text-xl font-bold mb-4">📆 Daily Performance</h2>

              <div className="h-80 min-h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={buildDailyPerformance(filteredTrades)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-900 p-6 rounded-xl min-h-96">
                <h2 className="text-xl font-bold mb-4">📅 Zeitraum Performance</h2>

                <div className="h-80 min-h-80">
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

              <div className="bg-gray-900 p-6 rounded-xl min-h-96">
                <h2 className="text-xl font-bold mb-4">🎯 Performance nach Market</h2>

                <div className="h-80 min-h-80">
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
          </>
        )}

        <div ref={historySectionRef} className="grid grid-cols-2 gap-6 mb-8 scroll-mt-28">
          <div className="bg-gray-900 p-6 rounded-xl">
            <h2 className="text-xl font-bold mb-4">🏆 Best Trade</h2>

            {bestTrade ? (
              <div className="space-y-2">
                <p className="text-2xl font-bold text-green-400">{bestTrade.market}</p>
                <p>Date: {new Date(bestTrade.date).toLocaleDateString("de-CH")}</p>
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
                <p className="text-2xl font-bold text-red-400">{worstTrade.market}</p>
                <p>Date: {new Date(worstTrade.date).toLocaleDateString("de-CH")}</p>
                <p>Direction: {worstTrade.direction}</p>
                <p>Profit: {worstTrade.profitLoss} CHF</p>
              </div>
            ) : (
              <p className="text-gray-400">Keine Trades vorhanden.</p>
            )}
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl overflow-x-auto mb-8">
          <h2 className="text-xl font-bold mb-4">📅 Weekly Statistics Table</h2>

          <div className="min-w-[900px]">
            <div className="grid grid-cols-6 gap-4 p-4 bg-gray-800 font-bold rounded-t-xl">
              <div>Week</div>
              <div>P/L</div>
              <div>Trades</div>
              <div>Wins</div>
              <div>Losses</div>
              <div>Winrate</div>
            </div>

            {weeklyStats.weeklyPerformance.map((week) => (
              <div
                key={week.week}
                className="grid grid-cols-6 gap-4 p-4 border-t border-gray-800 items-center"
              >
                <div>{week.label}</div>
                <div className={week.profitLoss >= 0 ? "text-green-400" : "text-red-400"}>
                  {week.profitLoss} CHF
                </div>
                <div>{week.trades}</div>
                <div className="text-green-400">{week.wins}</div>
                <div className="text-red-400">{week.losses}</div>
                <div className="text-cyan-400">{week.winrate}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl overflow-x-auto mb-8">
          <h2 className="text-xl font-bold mb-4">📆 Monthly Statistics Table</h2>

          <div className="min-w-[900px]">
            <div className="grid grid-cols-6 gap-4 p-4 bg-gray-800 font-bold rounded-t-xl">
              <div>Month</div>
              <div>P/L</div>
              <div>Trades</div>
              <div>Wins</div>
              <div>Losses</div>
              <div>Winrate</div>
            </div>

            {monthlyStats.monthlyPerformance.map((month) => (
              <div
                key={month.month}
                className="grid grid-cols-6 gap-4 p-4 border-t border-gray-800 items-center"
              >
                <div>{month.label}</div>
                <div className={month.profitLoss >= 0 ? "text-green-400" : "text-red-400"}>
                  {month.profitLoss} CHF
                </div>
                <div>{month.trades}</div>
                <div className="text-green-400">{month.wins}</div>
                <div className="text-red-400">{month.losses}</div>
                <div className="text-cyan-400">{month.winrate}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl overflow-x-auto">
          <h2 className="text-xl font-bold mb-4">🧾 Trade Historie</h2>

          <div className="min-w-[1700px]">
            <div className="grid grid-cols-16 gap-4 p-4 bg-gray-800 font-bold rounded-t-xl">
              <div>Date</div>
              <div>Market</div>
              <div>Direction</div>
              <div>Entry</div>
              <div>SL</div>
              <div>TP</div>
              <div>Risk</div>
              <div>R/R</div>
              <div>Size</div>
              <div>Status</div>
              <div>P/L</div>
              <div>Actions</div>
              <div>Edit</div>
              <div>Delete</div>
              <div>Entry Account</div>
              <div>Entry Risk %</div>
            </div>

            {filteredTrades.map((trade) => (
              <div
                key={trade.id}
                className="grid grid-cols-16 gap-4 p-4 border-t border-gray-800 items-center"
              >
                <div>{new Date(trade.date).toLocaleDateString("de-CH")}</div>
                <div>{trade.market}</div>

                <div className={trade.direction === "LONG" ? "text-green-400" : "text-red-400"}>
                  {trade.direction}
                </div>

                <div>{trade.entry}</div>
                <div>{trade.stopLoss}</div>
                <div>{trade.takeProfit}</div>

                <div className="text-red-400">{trade.riskAmount ?? 0} CHF</div>
                <div className="text-cyan-400">{trade.riskReward ?? 0}</div>
                <div className="text-blue-400">{trade.positionSize ?? 0}</div>

                <div className={trade.status === "OPEN" ? "text-yellow-400" : "text-green-400"}>
                  {trade.status}
                </div>

                <div className={trade.profitLoss >= 0 ? "text-green-400" : "text-red-400"}>
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

                <button
                  onClick={() => startEditTrade(trade)}
                  className="bg-blue-700 hover:bg-blue-800 px-3 py-2 rounded text-sm"
                >
                  Edit
                </button>

                <button
                  onClick={() => deleteTrade(trade.id)}
                  className="bg-red-900 hover:bg-red-950 px-3 py-2 rounded text-sm"
                >
                  Löschen
                </button>

                <div>{trade.accountSize ?? 30000}</div>
                <div>{trade.riskPercent ?? 1}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}