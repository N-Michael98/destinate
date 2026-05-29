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
      <h1 className="text-4xl font-bold mb-4">
        📊 Market Intelligence Engine
      </h1>

      <p className="text-gray-400 mb-8">
        Märkte werden automatisch nach Risiko und Analyse-Qualität sortiert.
      </p>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-900 p-5 rounded-xl">
          <h2 className="font-bold">📈 Indices</h2>
          <p className="text-gray-400 mt-2">Scanning...</p>
        </div>

        <div className="bg-gray-900 p-5 rounded-xl">
          <h2 className="font-bold">💱 Forex</h2>
          <p className="text-gray-400 mt-2">Scanning...</p>
        </div>

        <div className="bg-gray-900 p-5 rounded-xl">
          <h2 className="font-bold">🛢️ Commodities</h2>
          <p className="text-gray-400 mt-2">Scanning...</p>
        </div>

        <div className="bg-gray-900 p-5 rounded-xl">
          <h2 className="font-bold">₿ Crypto</h2>
          <p className="text-gray-400 mt-2">Scanning...</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl overflow-hidden">
        <div className="bg-green-900 p-4 font-bold text-center">
          🎯 Beste Chancen stehen automatisch oben
        </div>

        <div className="grid grid-cols-6 gap-4 p-4 bg-gray-800 font-bold">
          <div>Market</div>
          <div>Category</div>
          <div>Direction</div>
          <div>Score</div>
          <div>Timeframe</div>
          <div>Risk</div>
        </div>

        {sortedMarkets.map((market) => (
          <div
            key={market.name}
            className="grid grid-cols-6 gap-4 p-4 border-t border-gray-800"
          >
            <div className="font-bold">{market.name}</div>
            <div>{market.category}</div>

            <div
              className={
                market.direction === "BUY"
                  ? "text-green-400 font-bold"
                  : market.direction === "SELL"
                  ? "text-red-400 font-bold"
                  : "text-yellow-400 font-bold"
              }
            >
              {market.direction}
            </div>

            <div>{market.score}</div>
            <div>{market.timeframe}</div>

            <div
              className={
                market.risk === "Low"
                  ? "text-green-400"
                  : market.risk === "Medium"
                  ? "text-yellow-400"
                  : "text-red-400"
              }
            >
              {market.risk}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}