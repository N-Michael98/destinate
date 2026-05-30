export default function AIAssistant() {
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
          <h2 className="text-xl font-bold mb-3">
            GPT Status
          </h2>

          <p className="text-yellow-400">
            Offline
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">
            Claude Status
          </h2>

          <p className="text-yellow-400">
            Offline
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-3">
            Sandbox
          </h2>

          <p className="text-yellow-400">
            Nicht verbunden
          </p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">
          💬 AI Chat
        </h2>

        <div className="bg-black border border-gray-800 rounded-xl p-4 h-80 overflow-y-auto">
          <div className="mb-4">
            <p className="text-cyan-400 font-bold">
              AI Assistant
            </p>

            <p className="text-gray-300">
              Hallo Michael 👋
            </p>

            <p className="text-gray-300">
              Ich bin bereit für Marktanalysen,
              Trading-Setups und AI-Auswertungen.
            </p>
          </div>

          <div className="mb-4">
            <p className="text-cyan-400 font-bold">
              AI Assistant
            </p>

            <p className="text-gray-300">
              Wähle eine Schnellanalyse oder stelle später eine
              eigene Frage.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <input
            type="text"
            placeholder="Frage den AI Assistant..."
            className="flex-1 bg-black border border-gray-800 rounded-xl px-4 py-3"
          />

          <button className="bg-blue-600 hover:bg-blue-700 px-6 rounded-xl">
            Senden
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">
            ⚡ Quick Actions
          </h2>

          <div className="space-y-3">
            <button className="w-full text-left bg-black p-3 rounded-lg border border-gray-800">
              📊 Analysiere Gold
            </button>

            <button className="w-full text-left bg-black p-3 rounded-lg border border-gray-800">
              🛢️ Analysiere WTI Crude Oil
            </button>

            <button className="w-full text-left bg-black p-3 rounded-lg border border-gray-800">
              📈 Analysiere NAS100
            </button>

            <button className="w-full text-left bg-black p-3 rounded-lg border border-gray-800">
              🌍 Analysiere EURUSD
            </button>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">
            🧠 Beispiel-Fragen
          </h2>

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