import Link from "next/link";
import { markets } from "../../data/markets";

function createSlug(name: string) {
  return name.toLowerCase().replaceAll(" ", "-");
}

export default async function MarketDetail({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const { market: marketSlug } = await params;

  const market = markets.find(
    (item) => createSlug(item.name) === marketSlug
  );

  if (!market) {
    return (
      <main className="min-h-screen bg-black text-white p-10">
        <Link href="/market-intelligence" className="text-blue-400">
          ← Zurück zum Scanner
        </Link>
        <h1 className="text-4xl font-bold mt-6">Market not found</h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <Link
        href="/market-intelligence"
        className="inline-block mb-8 text-blue-400 hover:text-blue-300"
      >
        ← Zurück zum Scanner
      </Link>

      <h1 className="text-5xl font-bold mb-2">📊 {market.name}</h1>

      <p className="text-gray-400 mb-8">
        Detailanalyse für {market.name}
      </p>

      <div className="grid grid-cols-5 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <p className="text-gray-400">Direction</p>
          <p className="text-2xl font-bold">{market.direction}</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <p className="text-gray-400">Score</p>
          <p className="text-2xl font-bold">{market.score}</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <p className="text-gray-400">Confidence</p>
          <p className="text-2xl font-bold text-cyan-400">
            {market.confidence}%
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <p className="text-gray-400">Risk</p>
          <p className="text-2xl font-bold">{market.risk}</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <p className="text-gray-400">Risk/Reward</p>
          <p className="text-2xl font-bold text-green-400">
            {market.riskReward}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-xl">
          <p className="text-gray-400">Trend</p>
          <p>{market.trend}</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <p className="text-gray-400">AI Rating</p>
          <p>{market.aiRating}</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <p className="text-gray-400">Timeframe</p>
          <p>{market.timeframe}</p>
        </div>
      </div>

      <div className="bg-gray-900 p-8 rounded-xl mb-8">
        <h2 className="text-2xl font-bold mb-4">🎯 Trading Setup</h2>

        <div className="grid grid-cols-3 gap-6">
          <p>Entry: {market.entry}</p>
          <p className="text-red-400">Stop Loss: {market.stopLoss}</p>
          <p className="text-green-400">Take Profit: {market.takeProfit}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900 p-8 rounded-xl">
          <h2 className="text-2xl font-bold mb-4">🧠 Analyse</h2>

          <ul className="list-disc ml-6 space-y-2">
            {market.analysis.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-900 p-8 rounded-xl">
          <h2 className="text-2xl font-bold mb-4">📰 News</h2>

          <ul className="list-disc ml-6 space-y-2">
            {market.news.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}