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
            <Link className="block hover:text-blue-400" href="#execution-core">🧠 Execution Core</Link>
            <Link className="block hover:text-blue-400" href="#paper-trading">📝 Paper Trading</Link>
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

            <div className="bg-gray-900 p-5 rounded-xl border border-purple-900">
              <h3 className="font-bold text-lg">🧠 Execution Core</h3>
              <p className="mt-2 text-purple-400">Decision Engine</p>
            </div>

            <div className="bg-gray-900 p-5 rounded-xl border border-cyan-900">
              <h3 className="font-bold text-lg">📝 Paper Trading</h3>
              <p className="mt-2 text-cyan-400">Virtual Orders</p>
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




          <div id="paper-trading" className="bg-gray-900 p-6 rounded-xl mb-8 border border-cyan-900">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold">📝 Paper Trading Engine V6.3</h3>
                <p className="text-gray-400 mt-2">
                  Paper Orders Database vorbereitet: virtuelle Orders, Positionen, Trade History und Bot-Performance ohne echtes Geld.
                </p>
              </div>

              <div className="bg-black border border-cyan-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Trading Mode</p>
                <p className="text-cyan-400 font-bold">Paper Trading</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-6">
              <div className="bg-black border border-green-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Paper Balance</h4>
                <p className="text-3xl mt-4 text-green-400">30'000 CHF</p>
                <p className="text-gray-400 mt-2">Virtual account</p>
              </div>

              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Virtual Equity</h4>
                <p className="text-3xl mt-4 text-cyan-400">30'420 CHF</p>
                <p className="text-gray-400 mt-2">Simulated value</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Virtual P/L</h4>
                <p className="text-3xl mt-4 text-blue-400">+420 CHF</p>
                <p className="text-gray-400 mt-2">Demo performance</p>
              </div>

              <div className="bg-black border border-yellow-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Bot Winrate</h4>
                <p className="text-3xl mt-4 text-yellow-400">67%</p>
                <p className="text-gray-400 mt-2">Paper trades</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📌 Virtual Order Ticket</h4>

                <div className="space-y-3">
                  <input
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-gray-400"
                    value="NAS100"
                    readOnly
                  />
                  <select className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-gray-400" disabled>
                    <option>BUY</option>
                    <option>SELL</option>
                  </select>
                  <input
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-gray-400"
                    value="Liquidity Sweep"
                    readOnly
                  />
                  <button className="w-full bg-cyan-700 hover:bg-cyan-800 px-4 py-3 rounded-xl font-bold">
                    Simulate Order
                  </button>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  V6.3: Datenbank und API Routes sind vorbereitet. In V6.4 verbinden wir den Button mit echter Paper Execution.
                </p>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📂 Open Virtual Positions</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    <p className="font-bold">NAS100 BUY</p>
                    <p className="text-gray-300 text-sm">Liquidity Sweep · +180 CHF</p>
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    <p className="font-bold">Gold SELL</p>
                    <p className="text-gray-300 text-sm">Breakout · -45 CHF</p>
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">✅ Closed Paper Trades</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    <p className="font-bold">WTI Crude Oil BUY</p>
                    <p className="text-gray-300 text-sm">+220 CHF · A Setup</p>
                  </div>
                  <div className="border border-red-900 bg-red-950 rounded-lg p-3">
                    <p className="font-bold">EUR/USD SELL</p>
                    <p className="text-gray-300 text-sm">-80 CHF · C Setup</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📊 Paper Bot Metrics</h4>

                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Paper Winrate</span>
                      <span>67%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: "67%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Profit Factor</span>
                      <span>1.85</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: "74%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Max Paper Drawdown</span>
                      <span>2.1%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: "21%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Execution Readiness</span>
                      <span>42%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: "42%" }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🗄️ Paper Orders Database</h4>

                <div className="grid grid-cols-1 gap-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Prisma Model: PaperOrder
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ API: GET /api/paper-orders
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ API: POST /api/paper-orders
                  </div>
                  <div className="border border-blue-900 bg-blue-950 rounded-lg p-3">
                    🔵 API: PATCH /api/paper-orders/[id]
                  </div>
                </div>

                <p className="text-gray-400 mt-5">
                  Die Datenstruktur ist jetzt bereit. Als Nächstes bauen wir die echte Paper Execution Logic.
                </p>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡️ Paper Trading Safety Rules</h4>

                <div className="grid grid-cols-1 gap-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ No real money execution
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ All trades are simulated
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Paper results are not live broker results
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    🔒 Live execution remains locked
                  </div>
                </div>

                <p className="text-gray-400 mt-5">
                  In V6.3 werden wir daraus echte Datenstrukturen bauen: Paper Orders, Paper Positions und Paper Trade History.
                </p>
              </div>
            </div>

            <div className="bg-black border border-cyan-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧭 Paper Trading Roadmap</h4>

              <div className="grid grid-cols-4 gap-4">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V6.2</h5>
                  <p className="text-gray-300 mt-2">Paper Trading UI</p>
                </div>

                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V6.3</h5>
                  <p className="text-gray-300 mt-2">Paper Orders DB active</p>
                </div>

                <div className="border border-purple-900 bg-purple-950 rounded-lg p-4">
                  <h5 className="font-bold">V6.4</h5>
                  <p className="text-gray-300 mt-2">Paper Execution Logic</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V6.5</h5>
                  <p className="text-gray-300 mt-2">Broker API Bridge</p>
                </div>
              </div>
            </div>
          </div>

          <div id="execution-core" className="bg-gray-900 p-6 rounded-xl mb-8 border border-purple-900">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold">🧠 AI Execution Core V6.1</h3>
                <p className="text-gray-400 mt-2">
                  Simulationsbasierte Entscheidungszentrale zwischen Signal Engine, AI Review, Bot Readiness und Broker Hub.
                </p>
              </div>

              <div className="bg-black border border-purple-800 rounded-xl px-5 py-3">
                <p className="text-sm text-gray-400">Execution Mode</p>
                <p className="text-purple-400 font-bold">Simulation Only</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-6">
              <div className="bg-black border border-green-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Decision</h4>
                <p className="text-3xl mt-4 text-yellow-400">WAIT</p>
                <p className="text-gray-400 mt-2">No live execution</p>
              </div>

              <div className="bg-black border border-blue-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Confidence</h4>
                <p className="text-3xl mt-4 text-blue-400">74%</p>
                <p className="text-gray-400 mt-2">Demo signal score</p>
              </div>

              <div className="bg-black border border-cyan-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">AI Approval</h4>
                <p className="text-3xl mt-4 text-cyan-400">Neutral</p>
                <p className="text-gray-400 mt-2">Needs confirmation</p>
              </div>

              <div className="bg-black border border-red-900 rounded-xl p-5">
                <h4 className="font-bold text-lg">Order Status</h4>
                <p className="text-3xl mt-4 text-red-400">Blocked</p>
                <p className="text-gray-400 mt-2">Safety lock active</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">⚙️ Decision Pipeline</h4>

                <div className="space-y-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Signal Engine: Setup Quality prüfen
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ AI Trade Review: Trade Quality bewerten
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Bot Readiness: System-Reife prüfen
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    🔒 Broker Hub: Live Execution gesperrt
                  </div>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🛡️ Execution Safety Rules</h4>

                <div className="grid grid-cols-1 gap-3">
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Prop Firm Rules müssen PASS sein
                  </div>
                  <div className="border border-green-900 bg-green-950 rounded-lg p-3">
                    ✅ Risk pro Trade muss definiert sein
                  </div>
                  <div className="border border-yellow-900 bg-yellow-950 rounded-lg p-3">
                    ⚠️ Confidence mindestens 75% empfohlen
                  </div>
                  <div className="border border-gray-800 bg-gray-950 rounded-lg p-3">
                    🔒 Live Order Execution deaktiviert
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">📌 Example Signal</h4>
                <div className="space-y-2 text-gray-300">
                  <p>Market: <span className="text-blue-400">NAS100</span></p>
                  <p>Strategy: <span className="text-green-400">Liquidity Sweep</span></p>
                  <p>Direction: <span className="text-green-400">BUY</span></p>
                  <p>Risk/Reward: <span className="text-cyan-400">2.5R</span></p>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🤖 AI Decision</h4>
                <div className="space-y-2 text-gray-300">
                  <p>GPT: <span className="text-yellow-400">WAIT</span></p>
                  <p>Claude: <span className="text-yellow-400">WAIT</span></p>
                  <p>System: <span className="text-yellow-400">WAIT</span></p>
                  <p>Consensus: <span className="text-blue-400">74%</span></p>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-5">
                <h4 className="text-xl font-bold mb-4">🚦Final Action</h4>
                <p className="text-4xl font-bold text-yellow-400">WAIT</p>
                <p className="text-gray-400 mt-3">
                  Noch kein Trade. Mehr Confirmation oder bessere Confidence nötig.
                </p>
              </div>
            </div>

            <div className="bg-black border border-purple-900 rounded-xl p-5">
              <h4 className="text-xl font-bold mb-4">🧭 Execution Roadmap</h4>

              <div className="grid grid-cols-4 gap-4">
                <div className="border border-green-900 bg-green-950 rounded-lg p-4">
                  <h5 className="font-bold">V6.1</h5>
                  <p className="text-gray-300 mt-2">AI Execution Core</p>
                </div>

                <div className="border border-blue-900 bg-blue-950 rounded-lg p-4">
                  <h5 className="font-bold">V6.2</h5>
                  <p className="text-gray-300 mt-2">Paper Trading Engine</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V6.3</h5>
                  <p className="text-gray-300 mt-2">Broker API Connection</p>
                </div>

                <div className="border border-gray-800 bg-gray-950 rounded-lg p-4">
                  <h5 className="font-bold">V6.4</h5>
                  <p className="text-gray-300 mt-2">Live Execution Lock</p>
                </div>
              </div>
            </div>
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