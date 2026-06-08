"use client";

const executionMetrics = [
  { label: "Queue Tickets", value: "11", detail: "Species queue tickets" },
  { label: "Execution Ready", value: "10/11", detail: "Ready tickets" },
  { label: "Limited", value: "1", detail: "Tactical restriction" },
  { label: "Live Bridge", value: "10/11", detail: "Live execution ready" },
  { label: "Dispatch Ready", value: "10/11", detail: "Broker sync ready" },
  { label: "Confirmation", value: "NEXT", detail: "V15.5.0 target" },
];

const executionStack = [
  "Trade Approval Engine",
  "Trade Approval Execution Queue Sync",
  "Execution Queue Engine",
  "Execution API Queue",
  "Execution API Tickets",
  "Execution API Status",
  "Species Execution Queue",
  "Species Execution Center Sync",
  "Species Execution Ticket Generator",
  "Species Execution Queue Integration",
  "Species Live Execution Bridge",
  "Species Broker Execution Sync",
];

const executionReadiness = [
  { label: "Approval Ready", value: "10 / 11" },
  { label: "Execution Tickets", value: "11" },
  { label: "Queue Ready", value: "10 / 11" },
  { label: "Live Bridge Ready", value: "10 / 11" },
  { label: "Dispatch Ready", value: "10 / 11" },
  { label: "Blocked", value: "0" },
];

const executionWindows = [
  { label: "Immediate", value: "4", detail: "Critical Hybrid tickets" },
  { label: "Standard", value: "6", detail: "High/medium priority tickets" },
  { label: "Tactical", value: "1", detail: "Limited Breakout ticket" },
];

const executionFlow = [
  "Trade Approval",
  "Execution Ticket Generator",
  "Execution Queue Integration",
  "Live Execution Bridge",
  "Broker Execution Sync",
  "Execution Confirmation",
  "Outcome Feedback",
  "Learning Memory",
];

export default function ExecutionCenterPanel() {
  return (
    <section className="rounded-3xl border border-orange-500/30 bg-zinc-950/70 p-6 shadow-2xl shadow-orange-950/30">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-400">
            V15.A.11 Execution Center
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Execution Control Dashboard
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Central overview for trade approval, execution tickets, queue integration, live bridge, broker dispatch and future execution confirmation.
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300">
          EXECUTION CENTER ACTIVE
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {executionMetrics.map((metric) => (
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
          <h3 className="text-sm font-bold text-orange-300">
            Execution Stack Modules
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Active execution-side infrastructure preserved and organized.
          </p>

          <div className="mt-4 grid gap-2">
            {executionStack.map((module, index) => (
              <div key={module} className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/10 text-xs font-bold text-orange-300">
                  {index + 1}
                </div>
                <div className="flex-1 rounded-xl bg-zinc-900/70 px-3 py-2 text-sm text-zinc-300">
                  {module}
                </div>
                <div className="text-xs text-emerald-300">ACTIVE</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-cyan-300">
            Execution Flow
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Target execution path from approval to learning feedback.
          </p>

          <div className="mt-4 grid gap-2">
            {executionFlow.map((stage, index) => (
              <div key={stage} className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-xs font-bold text-cyan-300">
                  {index + 1}
                </div>
                <div className="flex-1 rounded-xl bg-zinc-900/70 px-3 py-2 text-sm text-zinc-300">
                  {stage}
                </div>
                <div className="text-xs text-emerald-300">
                  {stage === "Execution Confirmation" ? "NEXT" : "READY"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-emerald-300">
            Execution Readiness
          </h3>
          <div className="mt-4 space-y-2 text-sm">
            {executionReadiness.map((item) => (
              <Row key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-blue-300">
            Execution Windows
          </h3>
          <div className="mt-4 space-y-3">
            {executionWindows.map((window) => (
              <div key={window.label} className="rounded-xl bg-zinc-900/70 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {window.label}
                    </p>
                    <p className="text-xs text-zinc-500">{window.detail}</p>
                  </div>
                  <p className="text-xl font-bold text-blue-300">
                    {window.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-yellow-300">
            Telegram Alert Readiness
          </h3>
          <p className="mt-3 text-sm text-zinc-300">
            Execution Center is prepared for future alerts when approval, queue, bridge, dispatch or confirmation status becomes degraded or blocked.
          </p>

          <div className="mt-4 rounded-xl bg-zinc-900/70 p-3 text-xs text-zinc-300">
            🚨 Future alert: Execution ticket blocked, broker dispatch failed or confirmation timeout.
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
