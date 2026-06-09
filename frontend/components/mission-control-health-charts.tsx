"use client";

export function HealthBar({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const safeValue = Math.max(0, Math.min(value, max));
  const width = max === 0 ? 0 : Math.round((safeValue / max) * 100);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-300">{label}</span>
        <span className="font-bold text-cyan-300">{safeValue}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function MiniDonut({
  ready,
  warning,
  error,
}: {
  ready: number;
  warning: number;
  error: number;
}) {
  const total = Math.max(ready + warning + error, 1);
  const readyDeg = Math.round((ready / total) * 360);
  const warningDeg = Math.round((warning / total) * 360);

  return (
    <div className="flex items-center gap-5">
      <div
        className="h-28 w-28 rounded-full border border-zinc-800"
        style={{
          background: `conic-gradient(#22c55e 0deg ${readyDeg}deg, #eab308 ${readyDeg}deg ${
            readyDeg + warningDeg
          }deg, #ef4444 ${readyDeg + warningDeg}deg 360deg)`,
        }}
      >
        <div className="m-4 flex h-20 w-20 items-center justify-center rounded-full bg-black text-xl font-black text-white">
          {Math.round((ready / total) * 100)}%
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <LegendItem label="Ready" value={ready} className="bg-green-500" />
        <LegendItem label="Warning" value={warning} className="bg-yellow-500" />
        <LegendItem label="Error" value={error} className="bg-red-500" />
      </div>
    </div>
  );
}

function LegendItem({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2 text-zinc-300">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      <span>{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}
