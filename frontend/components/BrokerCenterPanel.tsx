"use client";

const brokerMetrics = [
  { label: "Broker Modules", value: "12", detail: "Routing & health stack" },
  { label: "Routing Tickets", value: "11", detail: "Species broker routing" },
  { label: "Dispatch Ready", value: "10/11", detail: "Broker execution sync" },
  { label: "Connected", value: "10", detail: "Broker connection status" },
  { label: "Limited", value: "1", detail: "Tactical restriction" },
  { label: "Telegram Ready", value: "YES", detail: "Future alert foundation" },
];

const brokerStack = [
  "Smart Broker Selection",
  "Broker Routing Layer",
  "Capital.com Routing Sync",
  "IC Markets Routing Sync",
  "Dual Broker Orchestrator",
  "Broker Health Monitor",
  "Broker Health Dual Broker Sync",
  "Broker Performance Memory",
  "Broker Reputation Memory",
  "Broker Execution Quality Learning",
  "Autonomous Broker Optimization",
  "Species Broker Execution Sync",
];

const brokerDistribution = [
  { label: "Dual Broker", value: "6", detail: "Hybrid + Institutional" },
  { label: "Capital.com", value: "2", detail: "Liquidity layer" },
  { label: "IC Markets", value: "3", detail: "Trend + Breakout" },
];

const brokerHealth = [
  { label: "Connected Broker Tickets", value: "10" },
  { label: "Limited Connection Tickets", value: "1" },
  { label: "No Connection Tickets", value: "0" },
  { label: "Healthy Sync Tickets", value: "10" },
  { label: "Degraded Sync Tickets", value: "1" },
  { label: "Blocked Sync Tickets", value: "0" },
];

export default function BrokerCenterPanel() {
  return (
    <section className="rounded-3xl border border-blue-500/30 bg-zinc-950/70 p-6 shadow-2xl shadow-blue-950/30">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-400">
            V15.A.8 Broker Center
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Broker Execution Intelligence Dashboard
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Central overview for broker routing, broker health, execution sync and future Telegram broker alerts.
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300">
          BROKER CENTER ACTIVE
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {brokerMetrics.map((metric) => (
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
          <h3 className="text-sm font-bold text-blue-300">
            Broker Stack Modules
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Current broker-side infrastructure preserved and organized.
          </p>

          <div className="mt-4 grid gap-2">
            {brokerStack.map((module, index) => (
              <div key={module} className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-500/40 bg-blue-500/10 text-xs font-bold text-blue-300">
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
            Broker Distribution
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Current simulated broker routing split from Species execution sync.
          </p>

          <div className="mt-4 space-y-3">
            {brokerDistribution.map((broker) => (
              <div key={broker.label} className="rounded-xl bg-zinc-900/70 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {broker.label}
                    </p>
                    <p className="text-xs text-zinc-500">{broker.detail}</p>
                  </div>
                  <p className="text-xl font-bold text-cyan-300">
                    {broker.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-950/20 p-3">
            <p className="text-xs font-bold text-yellow-300">
              Future connector target
            </p>
            <p className="mt-1 text-xs text-zinc-300">
              Capital.com and IC Markets connector results will later feed broker health, execution confirmation and Telegram alerts.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-emerald-300">
            Broker Sync Health
          </h3>
          <div className="mt-4 space-y-2 text-sm">
            {brokerHealth.map((item) => (
              <Row key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-purple-300">
            Execution Confirmation Layer
          </h3>
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Confirmation Pending" value="10" />
            <Row label="Limited Confirmation" value="1" />
            <Row label="Confirmation Blocked" value="0" />
            <Row label="Next Engine" value="V15.5.0" />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-sm font-bold text-yellow-300">
            Telegram Alert Readiness
          </h3>
          <p className="mt-3 text-sm text-zinc-300">
            Broker Center is prepared for future alerts when connection, dispatch, confirmation or broker health becomes WARNING or CRITICAL.
          </p>

          <div className="mt-4 rounded-xl bg-zinc-900/70 p-3 text-xs text-zinc-300">
            🚨 Future alert: Broker execution sync degraded or broker connection limited.
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
