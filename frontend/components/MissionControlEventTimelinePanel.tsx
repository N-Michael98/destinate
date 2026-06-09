"use client";

type MissionControlEventSeverity = "INFO" | "WARNING" | "CRITICAL";

type MissionControlEventLogEntry = {
  id: string;
  type: string;
  severity: MissionControlEventSeverity;
  source: string;
  message: string;
  payload: unknown;
  createdAt: string;
};

export function MissionControlEventTimelinePanel({
  events,
}: {
  events: MissionControlEventLogEntry[];
}) {
  const latestEvents = events.slice(0, 8);
  const critical = events.filter((event) => event.severity === "CRITICAL").length;
  const warnings = events.filter((event) => event.severity === "WARNING").length;

  return (
    <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-black/40 p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Event Timeline
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Persistent Mission Control event log from health scanner and audit writer.
          </p>
        </div>

        <div className="flex gap-2">
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
            Critical {critical}
          </span>
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
            Warning {warnings}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {latestEvents.map((event) => (
          <div
            key={event.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${getSeverityClass(event.severity)}`}>
                    {event.severity}
                  </span>
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-bold text-zinc-400">
                    {event.type}
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-bold text-white">
                  {event.source}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {event.message}
                </p>
              </div>

              <p className="text-xs text-zinc-600">
                {formatEventTime(event.createdAt)}
              </p>
            </div>
          </div>
        ))}

        {latestEvents.length === 0 && (
          <div className="rounded-2xl border border-green-500/20 bg-green-950/20 p-4 text-sm text-green-300">
            No Mission Control events stored yet.
          </div>
        )}
      </div>
    </div>
  );
}

function getSeverityClass(severity: MissionControlEventSeverity) {
  if (severity === "CRITICAL") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (severity === "WARNING") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
}

function formatEventTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
