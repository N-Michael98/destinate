export function SidebarIcon({
  code,
  active = false,
}: {
  code: string;
  active?: boolean;
}) {
  const base =
    "flex h-8 min-w-8 items-center justify-center rounded-xl border px-2 text-[10px] font-black tracking-wide transition";

  const state = active
    ? "border-cyan-400 bg-cyan-400/15 text-cyan-200 shadow-lg shadow-cyan-950/40"
    : "border-zinc-700 bg-zinc-900 text-zinc-400 group-hover:border-cyan-700 group-hover:text-cyan-300";

  return <div className={`${base} ${state}`}>{code}</div>;
}
