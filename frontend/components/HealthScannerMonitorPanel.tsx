"use client";

type HealthScannerItem = {
  key: string;
  label: string;
  endpoint: string;
  group?: string;
  critical?: boolean;
  status: "READY" | "WARNING" | "ERROR" | "LOADING";
  summary: string;
  responseTimeMs?: number;
  checkedAt?: string;
};

export function HealthScannerMonitorPanel({
  endpoints,
}: {
  endpoints: HealthScannerItem[];
}) {
  return (
    <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-black/40 p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Health Scanner Monitor
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Live endpoint scan results from the central Mission Control Health Scanner.
          </p>
        </div>

        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
          {endpoints.length} scanned endpoints
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <div className="grid grid-cols-6 bg-zinc-900/80 px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
          <div>System</div>
          <div>Group</div>
          <div>Status</div>
          <div>Response</div>
          <div>Critical</div>
          <div>Summary</div>
        </div>

        <div className="divide-y divide-zinc-800">
          {endpoints.map((item) => (
            <div
              key={item.key}
              className="grid grid-cols-6 items-center px-4 py-3 text-sm"
            >
              <div>
                <p className="font-bold text-white">{item.label}</p>
                <p className="mt-1 text-xs text-zinc-600">{item.endpoint}</p>
              </div>

              <div className="text-zinc-400">{item.group || "UNKNOWN"}</div>

              <div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${getStatusClass(item.status)}`}>
                  {item.status}
                </span>
              </div>

              <div className="font-bold text-cyan-300">
                {item.responseTimeMs ?? 0} ms
              </div>

              <div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${
                  item.critical
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
                }`}>
                  {item.critical ? "YES" : "NO"}
                </span>
              </div>

              <div className="text-zinc-400">{item.summary}</div>
            </div>
          ))}

          {endpoints.length === 0 && (
            <div className="px-4 py-6 text-sm text-zinc-500">
              No scanner results available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusClass(status: "READY" | "WARNING" | "ERROR" | "LOADING") {
  if (status === "READY") return "border-green-500/30 bg-green-500/10 text-green-300";
  if (status === "WARNING") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  if (status === "ERROR") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
}
