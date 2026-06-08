import BaseChartCard from "./BaseChartCard";

type DonutSlice = {
  label: string;
  value: number;
};

type AllocationDonutChartProps = {
  title: string;
  subtitle?: string;
  data: DonutSlice[];
  footer?: string;
};

export default function AllocationDonutChart({
  title,
  subtitle,
  data,
  footer,
}: AllocationDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <BaseChartCard title={title} subtitle={subtitle} footer={footer}>
      <div className="grid gap-4 md:grid-cols-[160px_1fr] md:items-center">
        <div className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950">
          <div className="absolute h-28 w-28 rounded-full border border-zinc-800 bg-black" />
          <div className="relative text-center">
            <p className="text-2xl font-bold text-white">{total}%</p>
            <p className="text-xs text-zinc-500">Total</p>
          </div>
        </div>

        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">
                  {item.label}
                </span>
                <span className="text-xs font-bold text-white">
                  {item.value}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full rounded-full bg-cyan-400"
                  style={{ width: `${Math.max(item.value, 1)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BaseChartCard>
  );
}
