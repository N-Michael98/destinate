import Link from "next/link";
import { markets } from "../data/markets";

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

export default function MarketIntelligence() {
  return (
    <main className="min-h-screen bg-black text-white p-10">
      <Link
        href="/"
        className="inline-block mb-8 text-blue-400 hover:text-blue-300"
      >
        ← Zurück zum Dashboard
      </Link>

      <h1 className="text-4xl font-bold mb-4">
        📊 Market Intelligence Engine
      </h1>

      <p className="text-gray-400 mb-8">
        AI Analyse, Confidence, Trend und Trading Setup Übersicht.
      </p>

      <div className="space-y-6">
        {sortedMarkets.map((market) => (
          <Link
            key={market.name}
            href={`/market-intelligence/${market.name
              .toLowerCase()
              .replaceAll(" ", "-")}`}
            className="block bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-blue-500 hover:scale-[1.01] transition-all"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{market.name}</h2>

              <span
                className={
                  market.direction === "BUY"
                    ? "text-green-400 font-bold"
                    : market.direction === "SELL"
                    ? "text-red-400 font-bold"
                    : "text-yellow-400 font-bold"
                }
              >
                {market.direction}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-gray-400">Score</p>
                <p>{market.score}</p>
              </div>

              <div>
                <p className="text-gray-400">Confidence</p>
                <p className="text-cyan-400">{market.confidence}%</p>
              </div>

              <div>
                <p className="text-gray-400">Trend</p>
                <p>{market.trend}</p>
              </div>

              <div>
                <p className="text-gray-400">Risk</p>
                <p>{market.risk}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-400">AI Rating</p>
                <p>{market.aiRating}</p>
              </div>

              <div>
                <p className="text-gray-400">News Impact</p>
                <p>{market.newsImpact}</p>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4">
              <h3 className="font-bold mb-3">🎯 Trading Setup</h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400">Entry</p>
                  <p>{market.entry}</p>
                </div>

                <div>
                  <p className="text-gray-400">Stop Loss</p>
                  <p className="text-red-400">{market.stopLoss}</p>
                </div>

                <div>
                  <p className="text-gray-400">Take Profit</p>
                  <p className="text-green-400">{market.takeProfit}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 text-blue-400 font-semibold">
              Analyse öffnen →
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}