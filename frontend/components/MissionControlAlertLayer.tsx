"use client";

import { useMemo } from "react";

type AlertStatus = "CRITICAL" | "REVIEW" | "HEALTHY";

export type MissionAlertSource = {
  label: string;
  endpoint: string;
  status: "READY" | "WARNING" | "ERROR" | "LOADING";
  summary: string;
};

export function MissionControlAlertLayer({
  sources,
}: {
  sources: MissionAlertSource[];
}) {
  const alerts = useMemo(() => {
    const critical = sources
      .filter((item) => item.status === "ERROR")
      .map((item) => ({
        level: "CRITICAL" as AlertStatus,
        title: `${item.label} offline`,
        message: `${item.endpoint} returned an error state. Summary: ${item.summary}`,
      }));

    const review = sources
      .filter((item) => item.status === "WARNING")
      .map((item) => ({
        level: "REVIEW" as AlertStatus,
        title: `${item.label} needs review`,
        message: `${item.endpoint} returned a warning state. Summary: ${item.summary}`,
      }));

    if (critical.length === 0 && review.length === 0 && sources.length > 0) {
      return [
        {
          level: "HEALTHY" as AlertStatus,
          title: "All monitored systems healthy",
          message: "Mission Control has no critical or warning alerts from monitored endpoints.",
        },
      ];
    }

    return [...critical, ...review];
  }, [sources]);

  return (
    <div className="mb-6 rounded-2xl border border-red-500/20 bg-black/40 p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Mission Control Alert Layer
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Converts endpoint status into critical, review or healthy alerts.
          </p>
        </div>

        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
          TELEGRAM READY LATER
        </span>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {alerts.map((alert) => (
          <div
            key={`${alert.level}-${alert.title}`}
            className={`rounded-2xl border p-4 ${getAlertStyle(alert.level)}`}
          >
            <p className="text-xs font-black tracking-wide">
              {alert.level}
            </p>
            <h3 className="mt-2 text-base font-bold text-white">
              {alert.title}
            </h3>
            <p className="mt-2 text-sm text-zinc-300">
              {alert.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getAlertStyle(level: AlertStatus) {
  if (level === "CRITICAL") {
    return "border-red-500/40 bg-red-950/30 text-red-300";
  }

  if (level === "REVIEW") {
    return "border-yellow-500/40 bg-yellow-950/30 text-yellow-300";
  }

  return "border-green-500/40 bg-green-950/30 text-green-300";
}
