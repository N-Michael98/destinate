import Link from "next/link";

const topOpportunity = {
  name: "Gold",
  category: "Commodities",
  direction: "SELL",
  score: 85,
  timeframe: "H4",
  risk: "Low",
};

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
              <p className="mt-2 text-green-400">Scanner Ready</p>
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

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-900 p-6 rounded-xl">
              <h3 className="text-xl font-bold mb-4">📊 Market Intelligence</h3>
              <ul className="space-y-2">
                <li>📈 Indices</li>
                <li>💱 Forex</li>
                <li>🛢️ Commodities</li>
                <li>₿ Crypto</li>
              </ul>
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
                      : "text-red-400 font-bold"
                  }
                >
                  Direction: {topOpportunity.direction}
                </p>

                <p>Score: {topOpportunity.score}</p>
                <p>Timeframe: {topOpportunity.timeframe}</p>
                <p className="text-green-400">Risk: {topOpportunity.risk}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}