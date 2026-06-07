"use client";

import { useEffect, useState } from "react";

type TimeframeNode = {
  timeframe: string;
  order: number;
  bias: string;
  trendStrength: number;
  structureScore: number;
  liquidityScore: number;
  momentumScore: number;
  reason: string;
};

type StyleDecision = {
  style: string;
  status: string;
  direction: string;
  confidenceScore: number;
  riskScore: number;
  relevantTimeframes: string[];
  positionSizeMultiplier: number;
  holdingRule: string;
  entryRule: string;
  reason: string;
};

type SymbolAnalysis = {
  symbol: string;
  topDownBias: string;
  macroBias: string;
  swingBias: string;
  daytradingBias: string;
  scalpingBias: string;
  timeframeNodes: TimeframeNode[];
  styleDecisions: StyleDecision[];
  recommendedTradingStyle: string;
  finalRecommendation: string;
};

type MultiTimeframeResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    analysisOrder: string[];
    totalSymbols: number;
    approvedScalpingSetups: number;
    approvedDaytradingSetups: number;
    approvedSwingSetups: number;
    blockedSetups: number;
    symbols: SymbolAnalysis[];
    systemRule: string;
    recommendation: string;
    updatedAt: string;
  };
};

export default function MultiTimeframeTradingStyleDashboardPanel() {
  const [data, setData] = useState<MultiTimeframeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMultiTimeframeAnalysis() {
      try {
        const response = await fetch("/api/multi-timeframe-trading-style-analysis", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Multi-Timeframe Trading Style Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadMultiTimeframeAnalysis();
  }, []);

  const report = data?.report;
  const symbols = report?.symbols ?? [];

  return (
    <section className="rounded-2xl border border-indigo-500/30 bg-slate-950/80 p-6 shadow-lg shadow-indigo-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-indigo-300">
            V11.9.1 Multi-Timeframe Trading Style Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Top-Down Analyse von 1M bis 1M Entry mit getrennten Swing-, Daytrading- und Scalping-Entscheidungen.
          </p>
        </div>

        <div className="rounded-xl border border-indigo-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Multi-Timeframe Trading Style Analysis wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Multi-Timeframe Trading Style Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <MetricCard title="Symbols" value={report.totalSymbols} />
            <MetricCard title="Scalping Approved" value={report.approvedScalpingSetups} positive={report.approvedScalpingSetups > 0} />
            <MetricCard title="Daytrading Approved" value={report.approvedDaytradingSetups} positive={report.approvedDaytradingSetups > 0} />
            <MetricCard title="Swing Approved" value={report.approvedSwingSetups} positive={report.approvedSwingSetups > 0} />
            <MetricCard title="Blocked Setups" value={report.blockedSetups} negative={report.blockedSetups > 0} />
          </div>

          <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-indigo-300">
              Top-Down Analysis Order
            </h3>

            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-9">
              {report.analysisOrder.map((timeframe, index) => (
                <RouteBox
                  key={`${timeframe}-${index}`}
                  title={`${index + 1}`}
                  value={timeframe}
                />
              ))}
            </div>

            <p className="mt-4 text-sm text-slate-300">
              {report.systemRule}
            </p>
          </div>

          <div className="space-y-6">
            {symbols.map((symbol) => (
              <div
                key={symbol.symbol}
                className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5"
              >
                <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-indigo-200">
                      {symbol.symbol}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Recommended Style: {symbol.recommendedTradingStyle}
                    </p>
                  </div>

                  <StatusBadge status={symbol.recommendedTradingStyle} />
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-5">
                  <MetricCard title="Top-Down Bias" value={symbol.topDownBias} positive={symbol.topDownBias === "BULLISH"} negative={symbol.topDownBias === "BEARISH"} />
                  <MetricCard title="Macro Bias" value={symbol.macroBias} positive={symbol.macroBias === "BULLISH"} negative={symbol.macroBias === "BEARISH"} />
                  <MetricCard title="Swing Bias" value={symbol.swingBias} positive={symbol.swingBias === "BULLISH"} negative={symbol.swingBias === "BEARISH"} />
                  <MetricCard title="Day Bias" value={symbol.daytradingBias} positive={symbol.daytradingBias === "BULLISH"} negative={symbol.daytradingBias === "BEARISH"} />
                  <MetricCard title="Scalp Bias" value={symbol.scalpingBias} positive={symbol.scalpingBias === "BULLISH"} negative={symbol.scalpingBias === "BEARISH"} />
                </div>

                <div className="mb-5 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                  <h4 className="mb-3 text-sm font-bold text-slate-200">
                    Timeframe Map
                  </h4>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-9">
                    {symbol.timeframeNodes.map((node) => (
                      <TimeframeCard key={`${symbol.symbol}-${node.timeframe}`} node={node} />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                  <h4 className="mb-3 text-sm font-bold text-slate-200">
                    Trading Style Decisions
                  </h4>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {symbol.styleDecisions.map((decision) => (
                      <StyleDecisionCard
                        key={`${symbol.symbol}-${decision.style}`}
                        decision={decision}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
                  <p className="text-xs text-slate-400">Symbol Recommendation</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-200">
                    {symbol.finalRecommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
            <p className="text-xs text-slate-400">System Recommendation</p>
            <p className="mt-1 text-sm font-semibold text-cyan-200">
              {report.recommendation}
            </p>
          </div>

          <div className="text-xs text-slate-500">
            Engine Version: {report.version} | Mode: {report.mode} | Updated At: {report.updatedAt}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  title,
  value,
  positive,
  negative,
}: {
  title: string;
  value: string | number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          positive
            ? "text-emerald-400"
            : negative
              ? "text-red-400"
              : "text-indigo-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-indigo-500/20 bg-slate-950/70 p-4 text-center">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-indigo-200">{value}</p>
    </div>
  );
}

function TimeframeCard({ node }: { node: TimeframeNode }) {
  const className =
    node.bias === "BULLISH"
      ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"
      : node.bias === "BEARISH"
        ? "border-red-500/30 bg-red-950/30 text-red-200"
        : "border-slate-500/30 bg-slate-950/40 text-slate-200";

  return (
    <div className={`rounded-xl border p-3 ${className}`}>
      <p className="text-xs text-slate-400">{node.order}</p>
      <p className="text-lg font-bold">{node.timeframe}</p>
      <p className="text-xs font-semibold">{node.bias}</p>

      <div className="mt-3 space-y-1 text-xs">
        <p>Trend: {node.trendStrength}</p>
        <p>Structure: {node.structureScore}</p>
        <p>Liquidity: {node.liquidityScore}</p>
        <p>Momentum: {node.momentumScore}</p>
      </div>
    </div>
  );
}

function StyleDecisionCard({ decision }: { decision: StyleDecision }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-indigo-200">{decision.style}</p>
          <p className="text-xs text-slate-400">{decision.direction}</p>
        </div>

        <DecisionBadge status={decision.status} />
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm">
        <Info label="Confidence" value={decision.confidenceScore} />
        <Info label="Risk" value={decision.riskScore} />
        <Info label="Position Multiplier" value={decision.positionSizeMultiplier} />
        <Info label="Timeframes" value={decision.relevantTimeframes.join(", ")} />
      </div>

      <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
        <p className="text-xs text-slate-500">Entry Rule</p>
        <p className="mt-1 text-xs font-semibold text-slate-300">
          {decision.entryRule}
        </p>
      </div>

      <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
        <p className="text-xs text-slate-500">Holding Rule</p>
        <p className="mt-1 text-xs font-semibold text-slate-300">
          {decision.holdingRule}
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {decision.reason}
      </p>
    </div>
  );
}

function DecisionBadge({ status }: { status: string }) {
  const className =
    status === "APPROVED"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
      : status === "BLOCKED"
        ? "border-red-500/30 bg-red-950/40 text-red-300"
        : "border-orange-500/30 bg-orange-950/40 text-orange-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {status}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "SCALPING"
      ? "border-sky-500/30 bg-sky-950/40 text-sky-300"
      : status === "DAYTRADING"
        ? "border-violet-500/30 bg-violet-950/40 text-violet-300"
        : status === "SWING"
          ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
          : "border-slate-500/30 bg-slate-950/40 text-slate-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {status}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="break-words font-semibold text-slate-200">{value}</p>
    </div>
  );
}
