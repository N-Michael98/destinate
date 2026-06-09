"use client";

type StatusCard = {
  title: string;
  value: string;
  note: string;
  accent: string;
  border: string;
};

type CenterCard = {
  title: string;
  status: string;
  owner: string;
  route: string;
  purpose: string;
};

const systemCards: StatusCard[] = [
  {
    title: "System Health",
    value: "Stable",
    note: "Core dashboard structure is organized.",
    accent: "text-green-400",
    border: "border-green-900",
  },
  {
    title: "Execution Mode",
    value: "Paper Only",
    note: "Live orders remain blocked.",
    accent: "text-yellow-400",
    border: "border-yellow-900",
  },
  {
    title: "Architecture",
    value: "Clean",
    note: "Detail panels moved to sidebar centers.",
    accent: "text-cyan-400",
    border: "border-cyan-900",
  },
  {
    title: "AI Flow",
    value: "Prepared",
    note: "GPT, Claude, Consensus and Portfolio Brain ready.",
    accent: "text-purple-400",
    border: "border-purple-900",
  },
];

const centers: CenterCard[] = [
  {
    title: "AI Center",
    status: "Prepared",
    owner: "GPT, Claude, Consensus",
    route: "AI Center sidebar group",
    purpose: "Analysis, risk validation and final AI decision support.",
  },
  {
    title: "Portfolio Brain",
    status: "Active",
    owner: "Portfolio Brain Center",
    route: "Portfolio Brain",
    purpose: "Decision memory, adaptive confidence and portfolio risk logic.",
  },
  {
    title: "Evolution Center",
    status: "Moved",
    owner: "Strategy Evolution",
    route: "Strategy Evolution",
    purpose: "Species, mutation, allocation and strategy evolution logic.",
  },
  {
    title: "Execution Center",
    status: "Active",
    owner: "Execution Center",
    route: "Execution Center",
    purpose: "Tickets, queue, bridge and execution preparation layer.",
  },
  {
    title: "Broker Center",
    status: "Active",
    owner: "Broker Center",
    route: "Broker Center",
    purpose: "Broker routing, Capital.com, IC Markets and health checks.",
  },
  {
    title: "Learning Center",
    status: "Prepared",
    owner: "Learning sidebar group",
    route: "Learning Center",
    purpose: "Outcome learning, memory, scheduler and feedback loops.",
  },
];

const alerts = [
  "Live trading remains blocked until explicit approval system is complete.",
  "Broker execution must stay behind the safety firewall.",
  "Old detail dashboards must stay out of AI Agent overview.",
];

const nextActions = [
  "Finalize Mission Control as the system overview only.",
  "Continue detailed work inside the correct sidebar center.",
  "Add dependency alerting before Telegram notification integration.",
  "Later replace text shortcuts with a stable icon library.",
];

export default function AIAgentControlCenter() {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl shadow-black/40">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V15.B.5 Mission Control Finalization
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">
            AI Agent Mission Control
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Clean command overview for system health, center status, safety alerts and next actions.
          </p>
        </div>

        <div className="rounded-full border border-green-500/40 bg-green-500/10 px-4 py-2 text-xs font-semibold text-green-300">
          MISSION CONTROL READY
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4">
        <h2 className="text-sm font-bold text-cyan-300">
          Final Intelligence Flow
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          Market Intelligence - GPT/OpenAI - Claude Risk - Consensus - Portfolio Brain - Evolution Species - Execution Queue - Broker Routing - Outcome Learning - AI Memory
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {systemCards.map((card) => (
          <div
            key={card.title}
            className={`rounded-2xl border ${card.border} bg-black/40 p-4`}
          >
            <p className="text-sm font-bold text-white">{card.title}</p>
            <p className={`mt-4 text-3xl font-black ${card.accent}`}>
              {card.value}
            </p>
            <p className="mt-2 text-xs text-zinc-400">{card.note}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-red-500/20 bg-black/40 p-5">
          <h2 className="text-lg font-bold text-white">
            Critical Safety Alerts
          </h2>
          <div className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert}
                className="rounded-xl border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-200"
              >
                {alert}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-black/40 p-5">
          <h2 className="text-lg font-bold text-white">
            Dependency Scanner Status
          </h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl bg-zinc-900/70 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Scanner
              </p>
              <p className="mt-1 text-lg font-bold text-yellow-300">
                Prepared
              </p>
            </div>
            <div className="rounded-xl bg-zinc-900/70 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Notification Layer
              </p>
              <p className="mt-1 text-lg font-bold text-cyan-300">
                Telegram Later
              </p>
            </div>
            <div className="rounded-xl bg-zinc-900/70 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Rule
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                Broken engines should generate alerts before future live operation.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-black/40 p-5">
          <h2 className="text-lg font-bold text-white">
            Next Actions
          </h2>
          <div className="mt-4 space-y-3">
            {nextActions.map((action, index) => (
              <div
                key={action}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-300"
              >
                <span className="mr-2 font-bold text-purple-300">
                  {index + 1}.
                </span>
                {action}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              Center Routing Overview
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              AI Agent only monitors. Detailed dashboards live in their own sidebar pages.
            </p>
          </div>
          <span className="rounded-full border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-300">
            NO DETAIL STACKING
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {centers.map((center) => (
            <div
              key={center.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {center.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {center.owner}
                  </p>
                </div>
                <span className="rounded-full border border-green-500/30 px-2 py-1 text-[10px] font-semibold text-green-300">
                  {center.status}
                </span>
              </div>

              <p className="text-sm text-zinc-300">{center.purpose}</p>

              <div className="mt-4 rounded-xl bg-zinc-900/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Sidebar Route
                </p>
                <p className="mt-1 text-xs text-cyan-300">{center.route}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-950/20 p-4">
        <h2 className="text-sm font-bold text-yellow-300">
          Safety Rule
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          No engine deleted. No API removed. No trading logic changed. AI Agent is now a clean mission control overview only.
        </p>
      </div>
    </section>
  );
}
