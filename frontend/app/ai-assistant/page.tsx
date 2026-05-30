"use client";

import { useState } from "react";
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

type Message = {
  sender: "AI Assistant" | "Michael";
  text: string;
};

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
        "Du kannst jetzt auch direkt schreiben: Daily Briefing, AI Watchlist, Kaufchancen, Verkaufschancen, Analysiere Gold oder Vergleiche Gold mit WTI.",
    },
  ]);

  const [input, setInput] = useState("");

  function addMessage(userText: string, aiText: string) {
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

  function handleSend() {
    if (!input.trim()) return;

    const userInput = input;
    const aiResponse = processSmartPrompt(userInput);

    addMessage(userInput, aiResponse);
    setInput("");
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
        Zentrale AI-Steuerung für Marktanalysen, Trading-Ideen und
        zukünftige GPT-Integrationen.
      </p>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">GPT Status</h2>
          <p className="text-yellow-400">Offline</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">Claude Status</h2>
          <p className="text-yellow-400">Offline</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">Sandbox</h2>
          <p className="text-yellow-400">Nicht verbunden</p>
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
            placeholder="Frage den AI Assistant..."
            className="flex-1 bg-black border border-gray-800 rounded-xl px-4 py-3"
          />

          <button
            onClick={handleSend}
            className="bg-blue-600 hover:bg-blue-700 px-6 rounded-xl"
          >
            Senden
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">⚡ Quick Actions</h2>

          <div className="space-y-3">
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
                addMessage("Warum ist Gold bearish?", explainMarket("Gold"))
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
              onClick={() => addMessage("Analysiere Gold", createMarketAnalysis("Gold"))}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              📊 Analysiere Gold
            </button>

            <button
              onClick={() =>
                addMessage(
                  "Analysiere WTI Crude Oil",
                  createMarketAnalysis("WTI Crude Oil")
                )
              }
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              🛢️ Analysiere WTI Crude Oil
            </button>

            <button
              onClick={() => addMessage("Analysiere NAS100", createMarketAnalysis("NAS100"))}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              📈 Analysiere NAS100
            </button>

            <button
              onClick={() => addMessage("Analysiere EURUSD", createMarketAnalysis("EURUSD"))}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              🌍 Analysiere EURUSD
            </button>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">🧠 Beispiel-Fragen</h2>

          <ul className="space-y-3 text-gray-300">
            <li>• Daily Briefing</li>
            <li>• AI Watchlist</li>
            <li>• Zeige Kaufchancen</li>
            <li>• Zeige Verkaufschancen</li>
            <li>• Analysiere Gold</li>
            <li>• Analysiere WTI</li>
            <li>• Warum ist Gold bearish?</li>
            <li>• Zeige mir die stärksten Märkte</li>
            <li>• Vergleiche Gold mit WTI</li>
          </ul>
        </div>
      </div>
    </main>
  );
}