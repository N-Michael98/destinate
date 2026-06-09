"use client";

type MissionControlRecoveryItem = {
  source: string;
  recovered: boolean;
  recoveryTimeMs: number | null;
};

type MissionControlRecoveryReport = {
  version: string;
  status: string;
  totalTrackedSources: number;
  recoveredSources: number;
  activeIssueSources: number;
  averageRecoveryTimeMs: number | null;
  recoveries: MissionControlRecoveryItem[];
};

export function MissionControlRecoveryPanel({
  recovery,
}: {
  recovery: MissionControlRecoveryReport | null;
}) {
  if (!recovery) {
    return (
      <div className="mb-6 rounded-2xl border border-blue-500/20 bg-black/40 p-5">
        <h2 className="text-lg font-bold text-white">Recovery Tracker</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Recovery report is loading.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-blue-500/20 bg-black/40 p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Recovery Tracker</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Tracks recovered systems, active issues and average recovery time.
          </p>
        </div>

        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
          {recovery.status}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <RecoveryMetric label="Tracked" value={recovery.totalTrackedSources} />
        <RecoveryMetric label="Recovered" value={recovery.recoveredSources} />
        <RecoveryMetric label="Active Issues" value={recovery.activeIssueSources} />
        <RecoveryMetric
          label="Avg Recovery"
          value={
            recovery.averageRecoveryTimeMs === null
              ? "n/a"
              : `${Math.round(recovery.averageRecoveryTimeMs / 1000)}s`
          }
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {recovery.recoveries.slice(0, 6).map((item) => (
          <div
            key={item.source}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold text-white">{item.source}</h3>
              <span
                className={`rounded-full border px-2 py-1 text-[10px] font-black ${
                  item.recovered
                    ? "border-green-500/30 bg-green-500/10 text-green-300"
                    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                }`}
              >
                {item.recovered ? "RECOVERED" : "ACTIVE"}
              </span>
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Recovery time:{" "}
              {item.recoveryTimeMs === null
                ? "pending"
                : `${Math.round(item.recoveryTimeMs / 1000)}s`}
            </p>
          </div>
        ))}

        {recovery.recoveries.length === 0 && (
          <div className="rounded-2xl border border-green-500/20 bg-green-950/20 p-4 text-sm text-green-300">
            No recovery issues tracked yet.
          </div>
        )}
      </div>
    </div>
  );
}

function RecoveryMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
