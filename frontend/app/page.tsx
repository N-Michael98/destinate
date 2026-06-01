import Link from "next/link";
import { markets } from "./data/markets";

function createSlug(name: string) {
  return name.toLowerCase().replaceAll(" ", "-");
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
            <Link className="block hover:text-blue-400" href="/trading-journal">📒 Trading Journal</Link>
            <Link className="block hover:text-blue-400" href="/trading">📈 Trading</Link>
            <Link className="block hover:text-blue-400" href="#broker-hub">🔌 Broker Hub</Link>
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

            <div className="bg-gray-900 p-5 rounded-xl border border-orange-900">
              <h3 className="font-bold text-lg">🔌 Broker Hub</h3>
              <p className="mt-2 text-orange-400">Simulation Mode</p>
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

            <Link
              href={`/market-intelligence/${createSlug(topOpportunity.name)}`}
              className="block bg-gray-900 p-6 rounded-xl hover:border-blue-500 border border-gray-900 transition"
            >
              <h3 className="text-xl font-bold mb-4">🎯 Top Opportunity</h3>

              <div className="space-y-2">
                <p className="text-2xl font-bold text-blue-400">{topOpportunity.name}</p>
                <p className="text-gray-400">{topOpportunity.category}</p>
                <p>Score: {topOpportunity.score}</p>
                <p className="text-cyan-400 font-bold">Confidence: {topOpportunity.confidence}%</p>
                <p>Risk/Reward: {topOpportunity.riskReward}</p>

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

                <p className="pt-3 text-blue-400 font-semibold">Analyse öffnen →</p>
              </div>
            </Link>
          </div>


          <div id="broker-hub" className="bg-gray-900 p-6 rounded-xl mb-8 border border-orange-900">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold">🔌 Broker Integration Layer V6.0</h3>
                <p className="text-gray-400 mt-2">
                  Architektur für zukünftige Broker-Verbindungen. Aktuell sicher im Simulationsmodus.
                </p>
              </div>

              <div className="bg-black border border-orange-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Bot Execution</p>
                <p className="text-orange-400 font-bold">Simulation Only</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-xl font-bold">Capital.com</h4>
                  <span className="text-red-400 font-bold">Disconnected</span>
                </div>

                <div className="space-y-3 text-gray-300">
                  <p>API Key: <span className="text-gray-500">Not configured</span></p>
                  <p>Account: <span className="text-gray-500">Demo / Live later</span></p>
                  <p>Status: <span className="text-orange-400">Coming Soon</span></p>
                </div>

                <button className="mt-5 w-full bg-gray-800 text-gray-400 px-4 py-3 rounded-xl cursor-not-allowed">
                  Connect später
                </button>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-xl font-bold">IC Markets</h4>
                  <span className="text-red-400 font-bold">Disconnected</span>
                </div>

                <div className="space-y-3 text-gray-300">
                  <p>Account Number: <span className="text-gray-500">Not configured</span></p>
                  <p>Server: <span className="text-gray-500">Not configured</span></p>
                  <p>Status: <span className="text-orange-400">Coming Soon</span></p>
                </div>

                <button className="mt-5 w-full bg-gray-800 text-gray-400 px-4 py-3 rounded-xl cursor-not-allowed">
                  Connect später
                </button>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-xl font-bold">MetaTrader 5</h4>
                  <span className="text-red-400 font-bold">Disconnected</span>
                </div>

                <div className="space-y-3 text-gray-300">
                  <p>Bridge: <span className="text-gray-500">Not installed</span></p>
                  <p>Execution: <span className="text-gray-500">Disabled</span></p>
                  <p>Status: <span className="text-orange-400">Coming Soon</span></p>
                </div>

                <button className="mt-5 w-full bg-gray-800 text-gray-400 px-4 py-3 rounded-xl cursor-not-allowed">
                  Connect später
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡️ Bot Permissions</h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Read Account Data</div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">✅ Read Open Positions</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">🔒 Place Orders</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">🔒 Modify Orders</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">🔒 Close Orders</div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">🔒 Auto Execution</div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🤖 Future Bot Flow</h4>

                <div className="space-y-3 text-gray-300">
                  <p>1. Signal Engine prüft Setup Quality.</p>
                  <p>2. AI Trade Review bewertet den Trade.</p>
                  <p>3. Bot Readiness prüft System-Reife.</p>
                  <p>4. Broker Hub sendet später Orders an Capital.com / IC Markets / MT5.</p>
                </div>

                <p className="mt-5 text-orange-400 font-semibold">
                  Aktuell: Keine echten Orders. Nur Architektur und Sicherheitsschicht.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl">
            <h3 className="text-xl font-bold mb-4">🏆 Market Ranking</h3>

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