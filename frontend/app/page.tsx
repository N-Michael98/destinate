import Link from "next/link";
import { markets } from "./data/markets";

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

const topOpportunity = sortedMarkets[0];

const indicesCount = markets.filter((market) => market.category === "Indices").length;
const forexCount = markets.filter((market) => market.category === "Forex").length;
const commoditiesCount = markets.filter((market) => market.category === "Commodities").length;
const cryptoCount = markets.filter((market) => market.category === "Crypto").length;

const buyCount = markets.filter((market) => market.direction === "BUY").length;
const sellCount = markets.filter((market) => market.direction === "SELL").length;
const neutralCount = markets.filter((market) => market.direction === "NEUTRAL").length;

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-gray-900 p-6">
          <h1 className="text-2xl font-bold mb-8">AI Trading System</h1>

          <nav className="space-y-4">
            <Link className="block hover:text-blue-400" href="/">🏠 Dashboard</Link>
            <Link className="block hover:text-blue-400" href="/market-intelligence">📊 Market Intelligence</Link>
            <Link className="block hover:text-blue-400" href="/ai-assistant">🤖 AI Assistant</Link>
            <Link className="block hover:text-blue-400" href="/trading">📈 Trading</Link>
            <Link className="block hover:text-blue-400" href="/simulation-lab">🧪 Simulation Lab</Link>
            <Link className="block hover:text-blue-400" href="/security-center">🛡️ Security Center</Link>
            <Link className="block hover:text-blue-400" href="/settings">⚙️ Settings</Link>
          </nav>
        </aside>

        <section className="flex-1 p-10">
          <h2 className="text-4xl font-bold mb-2">Willkommen Michael 👊</h2>
          <p className="text-gray-400 mb-8">AI Trading Ecosystem Dashboard</p>

          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-900 p-5 rounded-xl">
              <h3 className="font-bold text-lg">📊 Markets</h3>
              <p className="mt-2 text-green-400">{markets.length} Markets Loaded</p>
            </div>

            <div className="bg-gray-900 p-5 rounded-xl">
              <h3 className="font-bold text-lg">🤖 AI Status</h3>
              <p className="mt-2 text-yellow-400">Offline</p>
            </div>

            <div className="bg-gray-900 p-5 rounded-xl">
              <h3 className="font-bold text-lg">🛡️ Security</h3>
              <p className="mt-2 text-green-400">Secure</p>
            </div>

            <div className="bg-gray-900 p-5 rounded-xl">
              <h3 className="font-bold text-lg">☁️ Server</h3>
              <p className="mt-2 text-blue-400">Localhost</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-900 p-6 rounded-xl">
              <h3 className="text-xl font-bold mb-4">📊 Market Statistics</h3>

              <div className="grid grid-cols-2 gap-3">
                <p>📈 Indices: {indicesCount}</p>
                <p>💱 Forex: {forexCount}</p>
                <p>🛢️ Commodities: {commoditiesCount}</p>
                <p>₿ Crypto: {cryptoCount}</p>
              </div>

              <div className="mt-6 border-t border-gray-800 pt-4 grid grid-cols-3 gap-3">
                <p className="text-green-400">BUY: {buyCount}</p>
                <p className="text-red-400">SELL: {sellCount}</p>
                <p className="text-yellow-400">NEUTRAL: {neutralCount}</p>
              </div>

              <Link
                href="/market-intelligence"
                className="inline-block mt-6 text-blue-400 hover:text-blue-300"
              >
                Scanner öffnen →
              </Link>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl">
              <h3 className="text-xl font-bold mb-4">🎯 Top Opportunity</h3>

              <div className="space-y-2">
                <p className="text-2xl font-bold">{topOpportunity.name}</p>
                <p className="text-gray-400">{topOpportunity.category}</p>

                <p
                  className={
                    topOpportunity.direction === "BUY"
                      ? "text-green-400 font-bold"
                      : topOpportunity.direction === "SELL"
                      ? "text-red-400 font-bold"
                      : "text-yellow-400 font-bold"
                  }
                >
                  Direction: {topOpportunity.direction}
                </p>

                <p>Score: {topOpportunity.score}</p>
                <p>Timeframe: {topOpportunity.timeframe}</p>

                <p
                  className={
                    topOpportunity.risk === "Low"
                      ? "text-green-400"
                      : topOpportunity.risk === "Medium"
                      ? "text-yellow-400"
                      : "text-red-400"
                  }
                >
                  Risk: {topOpportunity.risk}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}