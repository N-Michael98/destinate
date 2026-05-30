"use client";

import { useState } from "react";
import { markets } from "../data/markets";

type Message = {
  sender: "AI Assistant" | "Michael";
  text: string;
};

function createMarketAnalysis(marketName: string) {
  const market = markets.find((item) => item.name === marketName);

  if (!market) return "Markt wurde nicht gefunden.";

  return `${market.name} Analyse

Direction: ${market.direction}
Score: ${market.score}
Confidence: ${market.confidence}%
Trend: ${market.trend}
Risk: ${market.risk}
Risk/Reward: ${market.riskReward}
AI Rating: ${market.aiRating}

Trading Setup:
Entry: ${market.entry}
Stop Loss: ${market.stopLoss}
Take Profit: ${market.takeProfit}

Analyse:
${market.analysis.map((item) => `• ${item}`).join("\n")}

News:
${market.news.map((item) => `• ${item}`).join("\n")}`;
}

function showBestOpportunity() {
  const bestMarket = [...markets].sort((a, b) => b.score - a.score)[0];

  return `🏆 Beste Trading Chance heute

${bestMarket.name}

Score: ${bestMarket.score}
Confidence: ${bestMarket.confidence}%
Direction: ${bestMarket.direction}
Trend: ${bestMarket.trend}
Risk: ${bestMarket.risk}
Risk/Reward: ${bestMarket.riskReward}
AI Rating: ${bestMarket.aiRating}

Trading Setup:
Entry: ${bestMarket.entry}
Stop Loss: ${bestMarket.stopLoss}
Take Profit: ${bestMarket.takeProfit}

Warum?

${bestMarket.analysis.map((item) => `• ${item}`).join("\n")}`;
}

function compareMarkets(firstMarketName: string, secondMarketName: string) {
  const first = markets.find((item) => item.name === firstMarketName);
  const second = markets.find((item) => item.name === secondMarketName);

  if (!first || !second) return "Einer der Märkte wurde nicht gefunden.";

  const winner = first.score >= second.score ? first : second;

  return `⚔️ Marktvergleich

${first.name} vs ${second.name}

Score:
${first.name}: ${first.score}
${second.name}: ${second.score}

Confidence:
${first.name}: ${first.confidence}%
${second.name}: ${second.confidence}%

Trend:
${first.name}: ${first.trend}
${second.name}: ${second.trend}

Risk:
${first.name}: ${first.risk}
${second.name}: ${second.risk}

Risk/Reward:
${first.name}: ${first.riskReward}
${second.name}: ${second.riskReward}

AI Rating:
${first.name}: ${first.aiRating}
${second.name}: ${second.aiRating}

🏆 Gewinner nach Score: ${winner.name}`;
}

function showMarketRanking() {
  const sortedMarkets = [...markets].sort((a, b) => b.score - a.score);

  return `🏅 Ranking der stärksten Märkte

${sortedMarkets
  .map(
    (market, index) =>
      `#${index + 1} ${market.name}
Score: ${market.score}
Confidence: ${market.confidence}%
Direction: ${market.direction}
Risk: ${market.risk}
Risk/Reward: ${market.riskReward}`
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
        "Wähle eine Schnellanalyse oder stelle später eine eigene Frage.",
    },
  ]);

  const [input, setInput] = useState("");

  function addAIAnalysis(marketName: string) {
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        sender: "Michael",
        text: `Analysiere ${marketName}`,
      },
      {
        sender: "AI Assistant",
        text: createMarketAnalysis(marketName),
      },
    ]);
  }

  function addBestOpportunity() {
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        sender: "Michael",
        text: "Was ist heute die beste Trading Chance?",
      },
      {
        sender: "AI Assistant",
        text: showBestOpportunity(),
      },
    ]);
  }

  function addMarketComparison() {
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        sender: "Michael",
        text: "Vergleiche Gold mit WTI Crude Oil",
      },
      {
        sender: "AI Assistant",
        text: compareMarkets("Gold", "WTI Crude Oil"),
      },
    ]);
  }

  function addMarketRanking() {
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        sender: "Michael",
        text: "Zeige mir die stärksten Märkte",
      },
      {
        sender: "AI Assistant",
        text: showMarketRanking(),
      },
    ]);
  }

  function handleSend() {
    if (!input.trim()) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        sender: "Michael",
        text: input,
      },
      {
        sender: "AI Assistant",
        text:
          "Ich habe deine Frage erhalten. Die echte GPT/Claude-Antwort wird später über die API verbunden.",
      },
    ]);

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
              onClick={addMarketRanking}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-yellow-500"
            >
              🏅 Zeige stärkste Märkte
            </button>

            <button
              onClick={addBestOpportunity}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-green-500"
            >
              🏆 Beste Trading Chance heute
            </button>

            <button
              onClick={addMarketComparison}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-purple-500"
            >
              ⚔️ Vergleiche Gold vs WTI
            </button>

            <button
              onClick={() => addAIAnalysis("Gold")}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              📊 Analysiere Gold
            </button>

            <button
              onClick={() => addAIAnalysis("WTI Crude Oil")}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              🛢️ Analysiere WTI Crude Oil
            </button>

            <button
              onClick={() => addAIAnalysis("NAS100")}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              📈 Analysiere NAS100
            </button>

            <button
              onClick={() => addAIAnalysis("EURUSD")}
              className="w-full text-left bg-black p-3 rounded-lg border border-gray-800 hover:border-blue-500"
            >
              🌍 Analysiere EURUSD
            </button>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">🧠 Beispiel-Fragen</h2>

          <ul className="space-y-3 text-gray-300">
            <li>• Was ist heute die beste Trading Chance?</li>
            <li>• Warum ist Gold aktuell bearish?</li>
            <li>• Wie hoch ist das Risiko bei NAS100?</li>
            <li>• Zeige mir die stärksten Märkte.</li>
            <li>• Vergleiche Gold mit WTI Crude Oil.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}