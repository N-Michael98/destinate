"use client";

import type { MissionControlEndpointGroup } from "@/lib/mission-control-endpoint-registry";

type RegistryGroupDashboardItem = {
  group: MissionControlEndpointGroup;
  total: number;
  ready: number;
  warning: number;
  error: number;
  critical: number;
};

type EndpointStatusItem = {
  group?: string;
  status: "READY" | "WARNING" | "ERROR" | "LOADING";
  critical?: boolean;
};

const groupOrder: MissionControlEndpointGroup[] = [
  "CORE",
  "AI",
  "PORTFOLIO",
  "EXECUTION",
  "BROKER",
  "MARKET",
  "EVOLUTION",
  "LEARNING",
];

export function MissionControlRegistryGroupDashboard({
  endpoints,
}: {
  endpoints: EndpointStatusItem[];
}) {
  const groups: RegistryGroupDashboardItem[] = groupOrder.map((group) => {
    const items = endpoints.filter((item) => item.group === group);

    return {
      group,
      total: items.length,
      ready: items.filter((item) => item.status === "READY").length,
      warning: items.filter((item) => item.status === "WARNING").length,
      error: items.filter((item) => item.status === "ERROR").length,
      critical: items.filter((item) => item.critical).length,
    };
  });

  return (
    <div className="mb-6 rounded-2xl border border-zinc-800 bg-black/40 p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Registry Group Dashboard
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Mission Control endpoints grouped by system area.
          </p>
        </div>

        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
          {groups.reduce((sum, item) => sum + item.total, 0)} endpoints grouped
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <div
            key={group.group}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white">
                  {group.group}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Critical: {group.critical}
                </p>
              </div>

              <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${getGroupState(group)}`}>
                {getGroupLabel(group)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              <GroupMetric label="Total" value={group.total} />
              <GroupMetric label="Ready" value={group.ready} />
              <GroupMetric label="Warn" value={group.warning} />
              <GroupMetric label="Err" value={group.error} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-900/70 p-2">
      <p className="text-zinc-500">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  );
}

function getGroupLabel(group: RegistryGroupDashboardItem) {
  if (group.total === 0) return "EMPTY";
  if (group.error > 0) return "ERROR";
  if (group.warning > 0) return "REVIEW";
  return "READY";
}

function getGroupState(group: RegistryGroupDashboardItem) {
  if (group.total === 0) return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  if (group.error > 0) return "border-red-500/30 bg-red-500/10 text-red-300";
  if (group.warning > 0) return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  return "border-green-500/30 bg-green-500/10 text-green-300";
}
