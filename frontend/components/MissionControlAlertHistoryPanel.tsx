"use client";

import {
  buildAlertHistorySnapshot,
  countCriticalAlertHistory,
  countReviewAlertHistory,
} from "@/lib/mission-control/alert-history";

type AlertHistorySource = {
  key?: string;
  label: string;
  endpoint: string;
  group?: string;
  critical?: boolean;
  status: "READY" | "WARNING" | "ERROR" | "LOADING";
  summary: string;
};

export function MissionControlAlertHistoryPanel({
  sources,
}: {
  sources: AlertHistorySource[];
}) {
  const history = buildAlertHistorySnapshot(sources);
  const critical = countCriticalAlertHistory(history);
  const review = countReviewAlertHistory(history);

  return (
    <div className="mb-6 rounded-2xl border border-orange-500/20 bg-black/40 p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Alert History Snapshot
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Live snapshot of current warning and critical Mission Control alert sources.
          </p>
        </div>

        <div className="flex gap-2">
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
            Critical {critical}
          </span>
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
            Review {review}
          </span>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {history.map((item) => (
          <div
            key={item.key}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {item.label}
                </h3>
                <p className="mt-1 text-xs text-zinc-600">
                  {item.endpoint}
                </p>
              </div>

              <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${getSeverityClass(item.severity)}`}>
                {item.severity}
              </span>
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Group: {item.group}
            </p>
            <p className="mt-2 text-sm text-zinc-300">
              {item.summary}
            </p>
          </div>
        ))}

        {history.length === 0 && (
          <div className="rounded-2xl border border-green-500/20 bg-green-950/20 p-4 text-sm text-green-300">
            No active warning or critical alert history items.
          </div>
        )}
      </div>
    </div>
  );
}

function getSeverityClass(severity: "REVIEW" | "CRITICAL") {
  if (severity === "CRITICAL") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
}
