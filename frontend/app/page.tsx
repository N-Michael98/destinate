export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-gray-900 p-6">
          <h1 className="text-2xl font-bold mb-8">
            AI Trading System
          </h1>

          <ul className="space-y-4">
            <li>🏠 Dashboard</li>
            <li>📊 Market Scanner</li>
            <li>🤖 AI Assistant</li>
            <li>📈 Trading</li>
            <li>🧪 Simulation Lab</li>
            <li>🛡️ Security Center</li>
            <li>⚙️ Settings</li>
          </ul>
        </aside>

        {/* Main Content */}
        <section className="flex-1 p-10">
          <h2 className="text-4xl font-bold mb-4">
            Willkommen Michael 👊
          </h2>

          <p className="text-gray-400 mb-8">
            AI Trading Ecosystem Dashboard
          </p>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-gray-900 p-6 rounded-xl">
              <h3 className="text-xl font-bold">📊 Market Scanner</h3>
              <p>Analyse aller Märkte</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl">
              <h3 className="text-xl font-bold">🤖 AI Assistant</h3>
              <p>GPT + Claude Integration</p>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl">
              <h3 className="text-xl font-bold">🛡️ Security Center</h3>
              <p>Monitoring & Alerts</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}