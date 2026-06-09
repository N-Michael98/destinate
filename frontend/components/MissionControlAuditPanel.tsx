"use client";

type MissionControlAuditItem = {
  key: string;
  title: string;
  status: "PASS" | "REVIEW" | "FAIL";
  message: string;
};

export function MissionControlAuditPanel({
  checks,
}: {
  checks: MissionControlAuditItem[];
}) {
  return (
    <div className="mb-6 rounded-2xl border border-purple-500/20 bg-black/40 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">
          System Audit & Wiring
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Checks whether Mission Control is connected to the critical AI, portfolio, execution, broker and market systems.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {checks.map((check) => (
          <div
            key={check.key}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"
          >
            <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${getStatusClass(check.status)}`}>
              {check.status}
            </span>
            <h3 className="mt-3 text-sm font-bold text-white">
              {check.title}
            </h3>
            <p className="mt-2 text-xs text-zinc-500">
              {check.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStatusClass(status: "PASS" | "REVIEW" | "FAIL") {
  if (status === "PASS") return "border-green-500/30 bg-green-500/10 text-green-300";
  if (status === "REVIEW") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}
