export default function MarketIntelligence() {
  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-4xl font-bold mb-6">
        📊 Market Intelligence Engine
      </h1>

      <p className="text-gray-400 mb-8">
        Analyse aller Märkte und Erkennung der besten Trading Chancen.
      </p>

      <div className="grid grid-cols-2 gap-6">

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">
            📈 Indices
          </h2>

          <p>
            NAS100, US500, DAX, SMI, FTSE...
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">
            💱 Forex
          </h2>

          <p>
            EURUSD, GBPUSD, USDJPY...
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">
            🛢️ Commodities
          </h2>

          <p>
            WTI, Brent, Gold, Silver...
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">
            ₿ Crypto
          </h2>

          <p>
            BTC, ETH und weitere Märkte.
          </p>
        </div>

      </div>
    </main>
  );
}