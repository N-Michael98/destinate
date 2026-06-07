"use client";

import { useEffect, useState } from "react";

type StylePriorityDecision = {
  symbol: string;
  style: string;
  direction: string;
  status: string;
  confidenceScore: number;
  riskScore: number;
  priorityScore: number;
  rank: number;
  isPrimary: boolean;
  isSecondary: boolean;
  isBlocked: boolean;
  positionSizeMultiplier: number;
  finalPositionSize: number;
  reason: string;
};

type SymbolStylePriorityResult = {
  id: string;
  symbol: string;
  primaryStyle: string;
  secondaryStyle: string;
  blockedStyles: string[];
  waitingStyles: string[];
  rejectedStyles: string[];
  activeDirection: string;
  activePriorityScore: number;
  activePositionSizeMultiplier: number;
  activeFinalPositionSize: number;
  requiresStrictApproval: boolean;
  tradeAllowed: boolean;
  decisions: StylePriorityDecision[];
  recommendation: string;
};

type TradingStylePriorityResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    totalSymbols: number;
    symbolsWithPrimaryStyle: number;
    scalpPrimarySymbols: number;
    daytradingPrimarySymbols: number;
    swingPrimarySymbols: number;
    blockedSymbols: number;
    results: SymbolStylePriorityResult[];
    systemRule: string;
    recommendation: string;
    updatedAt: string;
  };
};

export default function TradingStylePriorityDashboardPanel() {
  const [data, setData] = useState<TradingStylePriorityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPriorityEngine() {
      try {
        const response = await fetch("/api/trading-style-priority-engine", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Trading Style Priority Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPriorityEngine();
  }, []);

  const report = data?.report;
  const results = report?.results ?? [];

  return (
    <section className="rounded-2xl border border-purple-500/30 bg-slate-950/80 p-6 shadow-lg shadow-purple-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-purple-300">
            V11.9.6 Trading Style Priority Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Wählt pro Symbol den aktiven Trading Style: Scalping, Daytrading oder Swing.
          </p>
        </div>

        <div className="rounded-xl border border-purple-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Trading Style Priority Engine wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Trading Style Priority Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <MetricCard title="Symbols" value={report.totalSymbols} />
            <MetricCard title="With Primary" value={report.symbolsWithPrimaryStyle} positive={report.symbolsWithPrimaryStyle > 0} />
            <MetricCard title="Scalp Primary" value={report.scalpPrimarySymbols} positive={report.scalpPrimarySymbols > 0} />
            <MetricCard title="Day Primary" value={report.daytradingPrimarySymbols} positive={report.daytradingPrimarySymbols > 0} />
            <MetricCard title="Swing Primary" value={report.swingPrimarySymbols} positive={report.swingPrimarySymbols > 0} />
            <MetricCard title="Blocked" value={report.blockedSymbols} negative={report.blockedSymbols > 0} />
          </div>

          <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-purple-300">
              Priority Rule
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
              <RouteBox title="Scalping" value="Fast Setup" />
              <RouteBox title="Daytrading" value="Intraday Setup" />
              <RouteBox title="Swing" value="Higher Timeframe" />
              <RouteBox title="Priority Engine" value="Primary Style" />
              <RouteBox title="Execution Queue" value="Only Primary" />
            </div>

            <p className="mt-4 text-sm text-slate-300">
              {report.systemRule}
            </p>
          </div>

          <div className="space-y-6">
            {results.map((result) => (
              <div
                key={result.id}
                className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5"
              >
                <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-purple-200">
                      {result.symbol}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Active Direction: {result.activeDirection}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StyleBadge style={result.primaryStyle} label={`Primary: ${result.primaryStyle}`} />
                    <StyleBadge style={result.secondaryStyle} label={`Secondary: ${result.secondaryStyle}`} />
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-5">
                  <MetricCard
                    title="Trade Allowed"
                    value={result.tradeAllowed ? "YES" : "NO"}
                    positive={result.tradeAllowed}
                    negative={!result.tradeAllowed}
                  />
                  <MetricCard
                    title="Priority Score"
                    value={result.activePriorityScore}
                    positive={result.activePriorityScore >= 70}
                    negative={result.activePriorityScore < 45}
                  />
                  <MetricCard
                    title="Position Multiplier"
                    value={result.activePositionSizeMultiplier}
                    positive={result.activePositionSizeMultiplier > 0}
                    negative={result.activePositionSizeMultiplier === 0}
                  />
                  <MetricCard
                    title="Final Size"
                    value={result.activeFinalPositionSize}
                    positive={result.activeFinalPositionSize > 0}
                    negative={result.activeFinalPositionSize === 0}
                  />
                  <MetricCard
                    title="Strict Approval"
                    value={result.requiresStrictApproval ? "YES" : "NO"}
                    negative={result.requiresStrictApproval}
                    positive={!result.requiresStrictApproval && result.tradeAllowed}
                  />
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <ListCard title="Blocked Styles" values={result.blockedStyles} negative />
                  <ListCard title="Waiting Styles" values={result.waitingStyles} />
                  <ListCard title="Rejected Styles" values={result.rejectedStyles} negative />
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                  <h4 className="mb-3 text-sm font-bold text-slate-200">
                    Style Priority Ranking
                  </h4>

                  <div className="space-y-3">
                    {result.decisions.map((decision) => (
                      <div
                        key={`${result.symbol}-${decision.style}`}
                        className="rounded-xl border border-slate-700 bg-slate-900/80 p-4"
                      >
                        <div className="mb-3 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                          <div>
                            <p className="text-lg font-bold text-purple-200">
                              #{decision.rank} {decision.style}
                            </p>
                            <p className="text-xs text-slate-400">
                              {decision.direction} | {decision.status}
                            </p>
                          </div>

                          <DecisionBadge decision={decision} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                          <Info label="Priority Score" value={decision.priorityScore} />
                          <Info label="Confidence" value={decision.confidenceScore} />
                          <Info label="Risk" value={decision.riskScore} />
                          <Info label="Multiplier" value={decision.positionSizeMultiplier} />
                          <Info label="Final Size" value={decision.finalPositionSize} />
                          <Info label="Blocked" value={decision.isBlocked ? "YES" : "NO"} />
                        </div>

                        <p className="mt-3 text-xs text-slate-400">
                          {decision.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
                  <p className="text-xs text-slate-400">Symbol Recommendation</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-200">
                    {result.recommendation}
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
              : "text-purple-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-purple-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-purple-200">{value}</p>
    </div>
  );
}

function StyleBadge({ style, label }: { style: string; label: string }) {
  const className =
    style === "SCALPING"
      ? "border-sky-500/30 bg-sky-950/40 text-sky-300"
      : style === "DAYTRADING"
        ? "border-violet-500/30 bg-violet-950/40 text-violet-300"
        : style === "SWING"
          ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
          : "border-slate-500/30 bg-slate-950/40 text-slate-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: StylePriorityDecision }) {
  const text = decision.isPrimary
    ? "PRIMARY"
    : decision.isSecondary
      ? "SECONDARY"
      : decision.isBlocked
        ? "BLOCKED"
        : "AVAILABLE";

  const className =
    decision.isPrimary
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
      : decision.isSecondary
        ? "border-sky-500/30 bg-sky-950/40 text-sky-300"
        : decision.isBlocked
          ? "border-red-500/30 bg-red-950/40 text-red-300"
          : "border-slate-500/30 bg-slate-950/40 text-slate-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {text}
    </span>
  );
}

function ListCard({
  title,
  values,
  negative,
}: {
  title: string;
  values: string[];
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p className={`mt-2 text-sm font-bold ${negative ? "text-red-300" : "text-purple-200"}`}>
        {values.length > 0 ? values.join(", ") : "NONE"}
      </p>
    </div>
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
