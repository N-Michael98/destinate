import { ReactNode } from "react";

type BaseChartCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: string;
};

export default function BaseChartCard({
  title,
  subtitle,
  children,
  footer,
}: BaseChartCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 shadow-lg shadow-black/20">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
        ) : null}
      </div>

      <div>{children}</div>

      {footer ? (
        <p className="mt-4 text-xs text-zinc-500">{footer}</p>
      ) : null}
    </div>
  );
}
