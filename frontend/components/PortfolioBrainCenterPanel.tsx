"use client";

const portfolioMetrics = [
  { label: "Decision Layer", value: "ACTIVE", detail: "Portfolio Brain online" },
  { label: "AI Inputs", value: "3", detail: "GPT, Claude, Consensus" },
  { label: "Evolution Sync", value: "ACTIVE", detail: "Species allocation linked" },
  { label: "Risk Layer", value: "ACTIVE", detail: "Portfolio risk management" },
  { label: "Learning Loop", value: "READY", detail: "Outcome feedback prepared" },
  { label: "Telegram Ready", value: "YES", detail: "Future alert foundation" },
];

const decisionFlow = [
  "Market Data",
  "News Intelligence",
  "GPT Analyst",
  "Claude Risk",
  "Consensus Engine",
  "Portfolio Brain",
  "Evolution Allocation Sync",
  "Species Capital Allocation",
  "Execution Queue",
  "Broker Execution Sync",
  "Outcome Learning",
  "AI Memory",
];

const aiInputStack = [
  { label: "GPT Analyst", value: "Market + technical + fundamental analysis" },
  { label: "Claude Risk", value: "Risk validation and exposure review" },
  { label: "Consensus Engine", value: "Combines AI outputs into decision signal" },
  { label: "Portfolio Brain", value: "Final portfolio-level decision layer" },
];

const portfolioModules = [
  "Portfolio Brain",
  "Portfolio Brain Unified Decision",
  "Portfolio Brain Evolution Sync",
  "Portfolio Brain Strategy Sync",
  "Portfolio Brain Outcome Learning Sync",
  "Portfolio Brain Adaptive Confidence",
  "Portfolio Brain Adaptive Learning",
  "Portfolio Brain Decision Memory",
  "Portfolio Brain Self Evolution",
  "Portfolio Risk Management",
  "Portfolio Intelligence",
];

const futureDecisionOutputs = [
  { label: "Signal Direction", value: "Prepared" },
  { label: "Confidence Score", value: "Prepared" },
  { label: "Risk Score", value: "Prepared" },
  { label: "Evolution Influence", value: "Prepared" },
  { label: "Execution Permission", value: "Prepared" },
  { label: "Broker Preference", value: "Prepared" },
];

export default function PortfolioBrainCenterPanel() {
  return (
    <section className="rounded-3xl border border-emerald-500/30 bg-zinc-950/70 p-6 shadow-2xl shadow-emerald-950/30">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">
            V15.A.9 Portfolio Brain Center
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Portfolio Brain Decision Intelligence Dashboard
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Central decision hub connecting GPT, Claude, Consensus, Evolution, Risk and future execution decisions.
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300">
          PORTFOLIO BRAIN ACTIVE
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {portfolioMetrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-zinc-800 bg-black/40 p-4"
          >
            <p className="text-xs text-zinc-500">{metric.label}</p>
            <p className="mt-2 text-xl font-bold text-white">{metric.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-emerald-300">
            AI Decision Input Stack
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Portfolio Brain will combine GPT analysis, Claude risk and Consensus signals.
          </p>

          <div className="mt-4 space-y-3">
            {aiInputStack.map((item) => (
              <div key={item.label} className="rounded-xl bg-zinc-900/70 p-3">
                <p className="text-sm font-semibold text-white">
                  {item.label}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-cyan-300">
            Portfolio Decision Flow
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Target architecture from market intelligence to learning memory.
          </p>

          <div className="mt-4 grid gap-2">
            {decisionFlow.map((stage, index) => (
              <div key={stage} className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-xs font-bold text-cyan-300">
                  {index + 1}
                </div>
                <div className="flex-1 rounded-xl bg-zinc-900/70 px-3 py-2 text-sm text-zinc-300">
                  {stage}
                </div>
                <div className="text-xs text-emerald-300">LINKED</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-purple-300">
            Portfolio Brain Modules
          </h3>
          <div className="mt-4 space-y-2 text-sm">
            {portfolioModules.map((module) => (
              <Row key={module} label={module} value="ACTIVE" />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-blue-300">
            Future Decision Outputs
          </h3>
          <div className="mt-4 space-y-2 text-sm">
            {futureDecisionOutputs.map((item) => (
              <Row key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-yellow-300">
            Telegram Alert Readiness
          </h3>
          <p className="mt-3 text-sm text-zinc-300">
            Portfolio Brain Center is prepared for future alerts when GPT, Claude, Consensus, risk validation or portfolio decision confidence becomes degraded.
          </p>

          <div className="mt-4 rounded-xl bg-zinc-900/70 p-3 text-xs text-zinc-300">
            🚨 Future alert: Portfolio Brain decision degraded or AI consensus unavailable.
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-zinc-900/70 px-3 py-2">
      <span className="text-zinc-400">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}
