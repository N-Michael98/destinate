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

    if (savedStartingBalance) {
      setStartingBalance(savedStartingBalance);
      setAccountSize(savedStartingBalance);
    }

    if (savedAccountRiskPercent) {
      setAccountRiskPercent(savedAccountRiskPercent);
      setRiskPercent(savedAccountRiskPercent);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("startingBalance", startingBalance);
    setAccountSize(startingBalance);
  }, [startingBalance]);

  useEffect(() => {
    localStorage.setItem("accountRiskPercent", accountRiskPercent);
    setRiskPercent(accountRiskPercent);
  }, [accountRiskPercent]);

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

  const bestTrade = [...filteredTrades].sort((a, b) => b.profitLoss - a.profitLoss)[0];
  const worstTrade = [...filteredTrades].sort((a, b) => a.profitLoss - b.profitLoss)[0];

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <a href="/" className="inline-block mb-8 text-blue-400 hover:text-blue-300">
        ← Zurück zum Dashboard
      </a>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-4">📈 Trading Journal</h1>
          <p className="text-gray-400">
            V4.7: Trading Journal mit Account Equity, Account Risk %, Risk Management und Max Drawdown.
          </p>
        </div>

        <button
          onClick={exportYearlyReportPDF}
          className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl font-bold"
        >
          📄 Jahresreport PDF exportieren
        </button>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl border border-green-800 mb-8">
        <h2 className="text-2xl font-bold mb-4">💼 Account Settings V4.7.1</h2>

        <div className="grid grid-cols-4 gap-4">
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
              Neue Trades nutzen automatisch diese Account Size und Risk %.
            </p>
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
        <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-800">
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

        <div className="grid grid-cols-2 gap-6 mb-8">
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
              <div>Account</div>
              <div>Risk %</div>
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