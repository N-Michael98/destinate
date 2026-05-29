export default function AIAssistant() {
  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-4xl font-bold mb-6">
        🤖 AI Assistant
      </h1>

      <p className="text-gray-400 mb-8">
        Hier werden später GPT, Claude und die AI Sandbox integriert.
      </p>

      <div className="bg-gray-900 p-6 rounded-xl">
        <h2 className="text-xl font-bold mb-3">
          AI Status
        </h2>

        <p>GPT: Offline</p>
        <p>Claude: Offline</p>
        <p>Sandbox: Noch nicht verbunden</p>
      </div>
    </main>
  );
}