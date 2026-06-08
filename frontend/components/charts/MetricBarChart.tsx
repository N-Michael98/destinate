import BaseChartCard from "./BaseChartCard";

type BarItem = {
  label: string;
  value: number;
  suffix?: string;
};

type MetricBarChartProps = {
  title: string;
  subtitle?: string;
  data: BarItem[];
  footer?: string;
};

export default function MetricBarChart({
  title,
  subtitle,
  data,
  footer,
}: MetricBarChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <BaseChartCard title={title} subtitle={subtitle} footer={footer}>
      <div className="space-y-3">
        {data.map((item) => {
          const width = Math.round((item.value / maxValue) * 100);

          return (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">
                  {item.label}
                </span>
                <span className="text-xs font-bold text-white">
                  {item.value}
                  {item.suffix ?? ""}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full rounded-full bg-purple-400"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </BaseChartCard>
  );
}
