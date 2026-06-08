"use client";



import BrokerCenterPanel from "./BrokerCenterPanel";
import EvolutionCenterPanel from "./EvolutionCenterPanel";
type CenterCard = {
  title: string;
  subtitle: string;
  status: string;
  modules: string[];
  nextStep: string;
};

const centers: CenterCard[] = [
  {
    title: "AI Center",
    subtitle: "GPT, Claude, Consensus & Portfolio Brain",
    status: "ACTIVE",
    modules: ["GPT Analyst", "Claude Risk", "Consensus", "Portfolio Brain"],
    nextStep: "Connect analysis outputs into unified AI decision flow.",
  },
  {
    title: "Evolution Center",
    subtitle: "Species, allocation, sizing and evolution pipeline",
    status: "ACTIVE",
    modules: [
      "Mutation Competition",
      "Strategy Breeding",
      "Species Classification",
      "Evolution Allocation",
      "Capital Allocation",
      "Position Sizing",
      "Trade Allocation",
    ],
    nextStep: "Add professional Species allocation and capital charts.",
  },
  {
    title: "Execution Center",
    subtitle: "Execution tickets, queue, bridge and dispatch layer",
    status: "ACTIVE",
    modules: [
      "Execution Queue",
      "Execution Tickets",
      "Live Execution Bridge",
      "Broker Execution Sync",
    ],
    nextStep: "Connect queue integration into execution confirmation flow.",
  },
  {
    title: "Broker Center",
    subtitle: "Capital.com, IC Markets, routing and broker health",
    status: "ACTIVE",
    modules: [
      "Broker Routing",
      "Smart Broker Selection",
      "Broker Health",
      "Broker Performance Memory",
    ],
    nextStep: "Prepare broker execution confirmation layer.",
  },
  {
    title: "Learning Center",
    subtitle: "AI memory, outcomes, learning feedback and strategy evolution",
    status: "ACTIVE",
    modules: [
      "AI Memory",
      "Outcome Learning",
      "Trade Feedback",
      "Strategy Evolution",
    ],
    nextStep: "Build feedback loop into GPT, Claude and Portfolio Brain.",
  },
  {
    title: "Market Intelligence Center",
    subtitle: "Market data, news, regime, calendar and institutional context",
    status: "ACTIVE",
    modules: [
      "Market Data",
      "News Intelligence",
      "Economic Calendar",
      "Market Regime",
      "Institutional Intelligence",
    ],
    nextStep: "Feed market intelligence into GPT and Consensus.",
  },
  {
    title: "Portfolio Brain Center",
    subtitle: "Portfolio decisions, risk, memory and adaptive confidence",
    status: "MERGE TARGET",
    modules: [
      "Portfolio Brain",
      "Adaptive Confidence",
      "Decision Memory",
      "Portfolio Risk",
    ],
    nextStep: "Merge old Portfolio Brain panels into tabbed center.",
  },
  {
    title: "Legacy Review",
    subtitle: "Older modules waiting for dependency check before archive",
    status: "REVIEW",
    modules: [
      "Dynamic Position Allocation",
      "Trading Style Priority",
      "Multi Timeframe Sync",
      "Unified Decision Sync",
    ],
    nextStep: "Verify dependencies before hiding or archiving old panels.",
  },
];

export default function AIAgentControlCenter() {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl shadow-black/40">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V15.A.3 Center Shell Refactor
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">
            AI Trading System Control Centers
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Clean dashboard structure. Engines, APIs and existing functionality remain active in the background.
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300">
          SYSTEM ORGANIZED
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4">
        <h2 className="text-sm font-bold text-cyan-300">
          Final Intelligence Flow
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          Market Intelligence → GPT / OpenAI → Claude Risk → Consensus → Portfolio Brain → Evolution Species → Execution Queue → Broker Routing → Capital.com / IC Markets → Outcome Learning → AI Memory
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {centers.map((center) => (
          <div
            key={center.title}
            className="rounded-2xl border border-zinc-800 bg-black/40 p-4 shadow-lg shadow-black/20"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {center.title}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {center.subtitle}
                </p>
              </div>

              <span className="rounded-full border border-cyan-500/30 px-2 py-1 text-[10px] font-semibold text-cyan-300">
                {center.status}
              </span>
            </div>

            <div className="space-y-2">
              {center.modules.map((module) => (
                <div
                  key={module}
                  className="rounded-lg bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300"
                >
                  {module}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl bg-zinc-900/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Next
              </p>
              <p className="mt-1 text-xs text-zinc-300">
                {center.nextStep}
              </p>
            </div>
          </div>
        ))}
      </div>

      
      <EvolutionCenterPanel />
      <BrokerCenterPanel />
      <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-950/20 p-4">
        <h2 className="text-sm font-bold text-yellow-300">
          Refactor Safety Rule
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          No engine deleted. No API removed. No trading logic changed. This version only replaces the overloaded AI Agent Center with clean center shells.
        </p>
      </div>
    </section>
  );
}


