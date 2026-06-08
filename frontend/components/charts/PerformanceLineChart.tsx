import BaseChartCard from "./BaseChartCard";

type LinePoint = {
  label: string;
  value: number;
};

type PerformanceLineChartProps = {
  title: string;
  subtitle?: string;
  data: LinePoint[];
  footer?: string;
};

export default function PerformanceLineChart({
  title,
  subtitle,
  data,
  footer,
}: PerformanceLineChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <BaseChartCard title={title} subtitle={subtitle} footer={footer}>
      <div className="flex h-36 items-end gap-2 rounded-xl bg-zinc-950 p-3">
        {data.map((item) => {
          const height = Math.max(8, Math.round((item.value / maxValue) * 100));

          return (
            <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg bg-emerald-400"
                style={{ height: `${height}%` }}
              />
              <span className="text-[10px] text-zinc-500">{item.label}</span>
            </div>
          );
        })}
      </div>
    </BaseChartCard>
  );
}
