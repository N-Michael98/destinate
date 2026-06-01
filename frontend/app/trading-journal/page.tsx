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
  const [journalTrades, setJournalTrades] = useState<Trade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState("All");

  const [market, setMarket] = useState("");
  const [direction, setDirection] = useState("LONG");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  const filteredTrades =
    selectedMarket === "All"
      ? journalTrades
      : journalTrades.filter((trade) => trade.market === selectedMarket);

  async function createTrade() {
    if (!market || !entry || !stopLoss || !takeProfit) {
      alert("Bitte Market, Entry, Stop Loss und Take Profit ausfüllen.");
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
      setNotes("");

      alert("Trade erfolgreich in SQLite gespeichert.");
    } catch (error) {
      console.error(error);
      alert("Fehler beim Speichern des Trades.");
    } finally {
      setIsSaving(false);
    }
  }

  function closeTrade() {
    alert("V4.1: Trade schließen wird als Nächstes direkt über SQLite implementiert.");
  }

  function reopenTrade() {
    alert("V4.1: Reopen wird als Nächstes direkt über SQLite implementiert.");
  }

  function resetJournal() {
    alert("V4.1: Reset wird später direkt über SQLite implementiert.");
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
            V4.1: Trading Journal liest aus SQLite und kann neue Trades direkt speichern.
          </p>
        </div>

        <button
          onClick={exportYearlyReportPDF}
          className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl font-bold"
        >
          📄 Jahresreport PDF exportieren
        </button>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-8">
        <h2 className="text-2xl font-bold mb-4">➕ Neuer Trade</h2>

        <div className="grid grid-cols-3 gap-4">
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
          Journal zurücksetzen
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
              <div>{new Date(trade.date).toLocaleDateString("de-CH")}</div>
              <div>{trade.market}</div>

              <div className={trade.direction === "LONG" ? "text-green-400" : "text-red-400"}>
                {trade.direction}
              </div>

              <div>{trade.entry}</div>
              <div>{trade.stopLoss}</div>
              <div>{trade.takeProfit}</div>

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
                      onClick={closeTrade}
                      className="bg-green-700 hover:bg-green-800 px-3 py-1 rounded text-sm"
                    >
                      WIN
                    </button>

                    <button
                      onClick={closeTrade}
                      className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm"
                    >
                      LOSS
                    </button>
                  </>
                ) : (
                  <button
                    onClick={reopenTrade}
                    className="bg-gray-700 hover:bg-gray-800 px-3 py-1 rounded text-sm"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}