"use client";

type CenterCard = {
  title: string;
  subtitle: string;
  status: string;
  modules: string[];
  routeTarget: string;
};

const centers: CenterCard[] = [
  {
    title: "AI Command Center",
    subtitle: "GPT, Claude, Consensus, Portfolio Brain and AI Agent overview.",
    status: "ACTIVE",
    routeTarget: "AI Center sidebar group",
    modules: ["GPT Analyst", "Claude Risk", "Consensus", "Portfolio Brain", "AI Agent"],
  },
  {
    title: "Evolution Center",
    subtitle: "Species, mutation, allocation, sizing and strategy evolution.",
    status: "MOVE TO STRATEGY EVOLUTION",
    routeTarget: "Strategy Evolution",
    modules: ["Mutation", "Breeding", "Species", "Governance", "Allocation"],
  },
  {
    title: "Execution Center",
    subtitle: "Trade approval, execution tickets, live bridge and dispatch.",
    status: "MOVE TO EXECUTION CENTER",
    routeTarget: "Execution Center",
    modules: ["Trade Approval", "Execution Queue", "Tickets", "Live Bridge"],
  },
  {
    title: "Broker Center",
    subtitle: "Capital.com, IC Markets, routing, broker health and sync.",
    status: "MOVE TO BROKER CENTER",
    routeTarget: "Broker Center",
    modules: ["Broker Routing", "Capital.com", "IC Markets", "Broker Health"],
  },
  {
    title: "Portfolio Brain Center",
    subtitle: "Portfolio decisions, risk, memory and adaptive confidence.",
    status: "MOVE TO PORTFOLIO BRAIN",
    routeTarget: "Portfolio Brain",
    modules: ["Portfolio Brain", "Risk", "Decision Memory", "Adaptive Confidence"],
  },
  {
    title: "Learning Center",
    subtitle: "AI memory, outcome learning, feedback loop and reports.",
    status: "MOVE TO LEARNING",
    routeTarget: "AI Memory / Learning Reports",
    modules: ["AI Memory", "Outcome Learning", "Feedback", "Reports"],
  },
];

export default function AIAgentControlCenter() {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl shadow-black/40">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V15.B.0 AI Agent Cleanup
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">
            AI Agent Command Overview
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            This page is now only the AI command overview. Detailed dashboards belong to their own sidebar centers.
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300">
          CLEAN OVERVIEW
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4">
        <h2 className="text-sm font-bold text-cyan-300">
          Final Intelligence Flow
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          Market Intelligence → GPT / OpenAI → Claude Risk → Consensus → Portfolio Brain → Evolution Species → Execution Queue → Broker Routing → Outcome Learning → AI Memory
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                Target page
              </p>
              <p className="mt-1 text-xs text-zinc-300">
                {center.routeTarget}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-950/20 p-4">
        <h2 className="text-sm font-bold text-yellow-300">
          Cleanup Rule
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          No detailed center dashboards should be stacked inside AI Agent. Each detailed dashboard must move to its correct sidebar page.
        </p>
      </div>
    </section>
  );
}
