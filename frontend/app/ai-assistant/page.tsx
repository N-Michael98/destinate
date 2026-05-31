"use client";

import { useEffect, useRef, useState } from "react";
import {
  compareMarkets,
  createMarketAnalysis,
  explainMarket,
  processSmartPrompt,
  showAIWatchlist,
  showBestOpportunity,
  showBuyOpportunities,
  showDailyBriefing,
  showMarketRanking,
  showSellOpportunities,
} from "./helpers";
import { askOpenAI } from "../services/openai";
import {
  showOpenTrades,
  showTradeSummary,
} from "../data/tradeUtils";

type Message = {
  sender: "AI Assistant" | "Michael";
  text: string;
};

type CapturedTrade = {
  id: number;
  market: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  status: "OPEN";
};

function detectMarket(input: string) {
  const prompt = input.toLowerCase();

  if (prompt.includes("gold")) return "Gold";
  if (prompt.includes("wti") || prompt.includes("crude")) return "WTI Crude Oil";
  if (prompt.includes("nas100")) return "NAS100";
  if (prompt.includes("eurusd")) return "EURUSD";

  return null;
}

function getMarketData(marketName: string) {
  const marketMap: Record<string, any> = {
    Gold: {
      confidence: 91,
      risk: "Low",
      news: ["USD aktuell stark", "Gold unter Verkaufsdruck"],
      setup: {
        entry: "3345",
        stopLoss: "3365",
        takeProfit: "3290",
      },
    },

    "WTI Crude Oil": {
      confidence: 94,
      risk: "Medium",
      news: ["Ölnachfrage steigt", "Angebotsrisiken unterstützen Preise"],
      setup: {
        entry: "58.20",
        stopLoss: "57.40",
        takeProfit: "60.10",
      },
    },

    NAS100: {
      confidence: 89,
      risk: "Medium",
      news: ["Positive Tech-Stimmung", "Starke US-Unternehmenszahlen"],
      setup: {
        entry: "21250",
        stopLoss: "21120",
        takeProfit: "21500",
      },
    },

    EURUSD: {
      confidence: 64,
      risk: "High",
      news: ["Wichtige Zentralbankdaten erwartet", "Hohe Volatilität möglich"],
      setup: {
        entry: "-",
        stopLoss: "-",
        takeProfit: "-",
      },
    },
  };

  return marketMap[marketName];
}

function isLocalTradingPrompt(input: string) {
  const prompt = input.toLowerCase();

  return (
    prompt.includes("daily") ||
    prompt.includes("briefing") ||
    prompt.includes("watchlist") ||
    prompt.includes("kaufchancen") ||
    prompt.includes("buy") ||
    prompt.includes("verkaufschancen") ||
    prompt.includes("sell") ||
    prompt.includes("ranking") ||
    prompt.includes("stärkste") ||
    prompt.includes("beste chance") ||
    prompt.includes("top opportunity") ||
    prompt.includes("vergleich") ||
    prompt.includes("vergleiche") ||
    prompt.includes("warum") ||
    prompt.includes("offene trades") ||
    prompt.includes("open trades") ||
    prompt.includes("trade summary") ||
    prompt.includes("summary") ||
    prompt.includes("trades") ||
    prompt.includes("gold") ||
    prompt.includes("wti") ||
    prompt.includes("crude") ||
    prompt.includes("nas100") ||
    prompt.includes("eurusd")
  );
}

function parseTradeInput(input: string): Omit<CapturedTrade, "id" | "status"> | null {
  const text = input.toLowerCase();

  const isLong = text.includes("long");
  const isShort = text.includes("short");

  if (!isLong && !isShort) return null;

  const market = detectMarket(input);
  if (!market) return null;

  const entryMatch = text.match(/entry\s*[:=]?\s*(\d+(\.\d+)?)/);
  const slMatch = text.match(/sl\s*[:=]?\s*(\d+(\.\d+)?)/);
  const tpMatch = text.match(/tp\s*[:=]?\s*(\d+(\.\d+)?)/);

  if (!entryMatch || !slMatch || !tpMatch) return null;

  return {
    market,
    direction: isLong ? "LONG" : "SHORT",
    entry: Number(entryMatch[1]),
    stopLoss: Number(slMatch[1]),
    takeProfit: Number(tpMatch[1]),
  };
}

function formatCapturedTrade(trade: CapturedTrade) {
  return `✅ Trade erkannt und in dieser Session gespeichert

#${trade.id} ${trade.direction} ${trade.market}

Entry: ${trade.entry}
Stop Loss: ${trade.stopLoss}
Take Profit: ${trade.takeProfit}
Status: ${trade.status}

Hinweis:
Aktuell ist dieser Trade nur im Browser-State gespeichert. Dauerhafte Speicherung bauen wir als Nächstes mit einer API-Route.`;
}

function showSessionTrades(trades: CapturedTrade[]) {
  if (trades.length === 0) {
    return "In dieser Session wurden noch keine neuen Trades erfasst.";
  }

  return `🧾 Neue Trades in dieser Session

${trades
  .map(
    (trade) =>
      `#${trade.id} ${trade.direction} ${trade.market}

Entry: ${trade.entry}
Stop Loss: ${trade.stopLoss}
Take Profit: ${trade.takeProfit}
Status: ${trade.status}`
  )
  .join("\n\n")}`;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "AI Assistant",
      text:
        "Hallo Michael 👋\nIch bin bereit für Marktanalysen, Trading-Setups und AI-Auswertungen.",
    },
    {
      sender: "AI Assistant",
      text:
        "V3.1 ist aktiv: Du kannst Trades im Chat erfassen. Beispiel: Long Gold Entry 3345 SL 3330 TP 3380",
    },
  ]);

  const [input, setInput] = useState("");
  const [lastMarket, setLastMarket] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [capturedTrades, setCapturedTrades] = useState<CapturedTrade[]>([]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function addMessage(userText: string, aiText: string, marketMemory?: string) {
    if (marketMemory) {
      setLastMarket(marketMemory);
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        sender: "Michael",
        text: userText,
      },
      {
        sender: "AI Assistant",
        text: aiText,
      },
    ]);
  }

  async function handleSend() {
    if (!input.trim() || isLoading) return;

    const userInput = input;
    const detectedMarket = detectMarket(userInput);
    const prompt = userInput.toLowerCase();

    setInput("");
    setIsLoading(true);

    let aiResponse = "";
    const contextData = lastMarket ? getMarketData(lastMarket) : null;

    const parsedTrade = parseTradeInput(userInput);

    if (parsedTrade) {
      const newTrade: CapturedTrade = {
        id: capturedTrades.length + 1,
        ...parsedTrade,
        status: "OPEN",
      };

      setCapturedTrades((currentTrades) => [...currentTrades, newTrade]);
      aiResponse = formatCapturedTrade(newTrade);
    } else if (
      prompt.includes("session trades") ||
      prompt.includes("neue trades")
    ) {
      aiResponse = showSessionTrades(capturedTrades);
    } else if (
      prompt.includes("offene trades") ||
      prompt.includes("open trades")
    ) {
      aiResponse = showOpenTrades();
    } else if (
      prompt.includes("trade summary") ||
      prompt.includes("summary")
    ) {
      aiResponse = showTradeSummary();
    } else if (prompt.includes("confidence") && lastMarket && contextData) {
      aiResponse = `${lastMarket} Confidence: ${contextData.confidence}%`;
    } else if (prompt.includes("risiko") && lastMarket && contextData) {
      aiResponse = `${lastMarket} Risiko: ${contextData.risk}`;
    } else if (prompt.includes("risk") && lastMarket && contextData) {
      aiResponse = `${lastMarket} Risk: ${contextData.risk}`;
    } else if (prompt.includes("news") && lastMarket && contextData) {
      aiResponse = `${lastMarket} News

${contextData.news.map((item: string) => `• ${item}`).join("\n")}`;
    } else if (prompt.includes("setup") && lastMarket && contextData) {
      aiResponse = `${lastMarket} Trading Setup

Entry: ${contextData.setup.entry}
Stop Loss: ${contextData.setup.stopLoss}
Take Profit: ${contextData.setup.takeProfit}`;
    } else if (prompt.includes("warum") && !detectedMarket && lastMarket) {
      aiResponse = explainMarket(lastMarket);
    } else if (isLocalTradingPrompt(userInput)) {
      aiResponse = processSmartPrompt(userInput);
    } else {
      aiResponse = await askOpenAI(userInput);
    }

    addMessage(userInput, aiResponse, detectedMarket ?? undefined);
    setIsLoading(false);
  }

  async function testAPIConnection() {
    if (isLoading) return;

    setIsLoading(true);

    const reply = await askOpenAI("API Test vom AI Trading Assistant");

    addMessage("Teste API Verbindung", reply);

    setIsLoading(false);
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <a
        href="/"
        className="inline-block mb-8 text-blue-400 hover:text-blue-300"
      >
        ← Zurück zum Dashboard
      </a>

      <h1 className="text-4xl font-bold mb-4">
        🤖 AI Trading Assistant
      </h1>

      <p className="text-gray-400 mb-8">
        Smart Prompt Engine mit Market Context Memory, API-Verbindung und AI Trade Capture.
      </p>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">GPT Status</h2>
          <p className="text-yellow-400">API vorbereitet</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">Claude Status</h2>
          <p className="text-yellow-400">Noch nicht verbunden</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">Session Trades</h2>
          <p className="text-green-400">{capturedTrades.length} erfasst</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">Memory</h2>
          <p className="text-cyan-400">
            {lastMarket ? lastMarket : "Noch leer"}
          </p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">💬 AI Chat</h2>

        <div className="bg-black border border-gray-800 rounded-xl p-4 h-96 overflow-y-auto whitespace-pre-line">
          {messages.map((message, index) => (
            <div key={index} className="mb-6">
              <p
                className={
                  message.sender === "AI Assistant"
                    ? "text-cyan-400 font-bold"
                    : "text-green-400 font-bold"
                }
              >
                {message.sender}
              </p>

              <p className="text-gray-300">{message.text}</p>
            </div>
          ))}

          {isLoading && (
            <div className="mb-6">
              <p className="text-cyan-400 font-bold">AI Assistant</p>
              <p className="text-gray-300">Verarbeite Anfrage...</p>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSend();
              }
            }}
            placeholder="Beispiel: Long Gold Entry 3345 SL 3330 TP 3380"
            className="flex-1 bg-black border border-gray-800 rounded-xl px-4 py-3"
          />

          <button
            onClick={handleSend}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-6 rounded-xl"
          >
            {isLoading ? "..." : "Senden"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">⚡ Quick Actions</h2>

          <div className="space-y-3">
            <button
              onClick={() =>
                addMessage("Zeige Session Trades", showSessionTrades(capturedTrades))
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-purple-500"
            >
              🧾 Session Trades
            </button>

            <button
              onClick={() =>
                addMessage("Zeige offene Trades", showOpenTrades())
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-cyan-500"
            >
              📈 Offene Trades
            </button>

            <button
              onClick={() =>
                addMessage("Zeige Trade Summary", showTradeSummary())
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-green-500"
            >
              📊 Trade Summary
            </button>

            <button
              onClick={testAPIConnection}
              disabled={isLoading}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-green-500 disabled:opacity-50"
            >
              🧪 API Verbindung testen
            </button>

            <button
              onClick={() =>
                addMessage("Erstelle ein Daily Market Briefing", showDailyBriefing())
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-cyan-500"
            >
              📊 Daily Market Briefing
            </button>

            <button
              onClick={() =>
                addMessage("Zeige mir die AI Watchlist", showAIWatchlist())
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-pink-500"
            >
              ⭐ AI Watchlist
            </button>

            <button
              onClick={() =>
                addMessage("Zeige mir Kaufchancen", showBuyOpportunities())
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-orange-500"
            >
              🔥 Zeige Kaufchancen
            </button>

            <button
              onClick={() =>
                addMessage("Zeige mir Verkaufschancen", showSellOpportunities())
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-red-500"
            >
              🚨 Zeige Verkaufschancen
            </button>

            <button
              onClick={() =>
                addMessage("Warum ist Gold bearish?", explainMarket("Gold"), "Gold")
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-red-500"
            >
              🧠 Warum ist Gold bearish?
            </button>

            <button
              onClick={() =>
                addMessage("Zeige mir die stärksten Märkte", showMarketRanking())
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-yellow-500"
            >
              🏅 Zeige stärkste Märkte
            </button>

            <button
              onClick={() =>
                addMessage("Was ist heute die beste Trading Chance?", showBestOpportunity())
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-green-500"
            >
              🏆 Beste Trading Chance heute
            </button>

            <button
              onClick={() =>
                addMessage(
                  "Vergleiche Gold mit WTI Crude Oil",
                  compareMarkets("Gold", "WTI Crude Oil")
                )
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-purple-500"
            >
              ⚔️ Vergleiche Gold vs WTI
            </button>

            <button
              onClick={() =>
                addMessage("Analysiere Gold", createMarketAnalysis("Gold"), "Gold")
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              📊 Analysiere Gold
            </button>

            <button
              onClick={() =>
                addMessage(
                  "Analysiere WTI Crude Oil",
                  createMarketAnalysis("WTI Crude Oil"),
                  "WTI Crude Oil"
                )
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              🛢️ Analysiere WTI Crude Oil
            </button>

            <button
              onClick={() =>
                addMessage("Analysiere NAS100", createMarketAnalysis("NAS100"), "NAS100")
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              📈 Analysiere NAS100
            </button>

            <button
              onClick={() =>
                addMessage("Analysiere EURUSD", createMarketAnalysis("EURUSD"), "EURUSD")
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              🌍 Analysiere EURUSD
            </button>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">📘 V3.1 Trade Capture Tests</h2>

          <ul className="space-y-3 text-gray-300">
            <li>1. Schreibe: Long Gold Entry 3345 SL 3330 TP 3380</li>
            <li>2. Schreibe: Short EURUSD Entry 1.085 SL 1.09 TP 1.075</li>
            <li>3. Klicke: Session Trades</li>
            <li>4. Bestehende Demo-Trades: Offene Trades</li>
            <li>5. Summary: Trade Summary</li>
          </ul>

          <div className="mt-6 bg-black p-4 rounded-lg border border-gray-800 text-gray-300">
            V3.1 speichert neue Trades nur in der aktuellen Browser-Session.
            Dauerhafte Speicherung bauen wir als V3.2 mit API-Route.
          </div>
        </div>
      </div>
    </main>
  );
}