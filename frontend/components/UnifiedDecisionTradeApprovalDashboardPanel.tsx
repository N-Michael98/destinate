"use client";

import { useEffect, useState } from "react";

type TradeApprovalGate = {
  id: string;
  name: string;
  status: string;
  required: boolean;
  score: number;
  threshold: number;
  reason: string;
};

type UnifiedDecisionTradeApprovalResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    gates: TradeApprovalGate[];
    passedGates: number;
    strictPassedGates: number;
    blockedGates: number;
    finalTradeApprovalStatus: string;
    allowTradeExecution: boolean;
    requireManualReview: boolean;
    positionSizeMultiplier: number;
    approvalStrictness: string;
    recommendation: string;
    updatedAt: string;
  };
};

export default function UnifiedDecisionTradeApprovalDashboardPanel() {
  const [data, setData] = useState<UnifiedDecisionTradeApprovalResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadApprovalSync() {
      try {
        const response = await fetch("/api/unified-decision-trade-approval-sync", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Unified Decision Trade Approval Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadApprovalSync();
  }, []);

  const report = data?.report;
  const gates = report?.gates ?? [];

  return (
    <section className="rounded-2xl border border-red-500/30 bg-slate-950/80 p-6 shadow-lg shadow-red-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-red-300">
            V11.8.7 Unified Decision Trade Approval Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Zeigt, wie die Unified Portfolio Brain Decision in Trade Approval Gates übersetzt wird.
          </p>
        </div>

        <div className="rounded-xl border border-red-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Unified Decision Trade Approval Sync wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Unified Decision Trade Approval Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard
              title="Final Approval"
              value={report.finalTradeApprovalStatus}
              positive={report.finalTradeApprovalStatus === "APPROVED"}
              negative={report.finalTradeApprovalStatus === "REJECTED"}
            />
            <MetricCard
              title="Execution"
              value={report.allowTradeExecution ? "ALLOWED" : "BLOCKED"}
              positive={report.allowTradeExecution}
              negative={!report.allowTradeExecution}
            />
            <MetricCard
              title="Approval Strictness"
              value={report.approvalStrictness}
              negative={report.approvalStrictness === "HIGH" || report.approvalStrictness === "EXTREME"}
            />
            <MetricCard
              title="Position Multiplier"
              value={report.positionSizeMultiplier}
              positive={report.positionSizeMultiplier >= 1}
              negative={report.positionSizeMultiplier < 1}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Passed Gates" value={report.passedGates} positive={report.passedGates > 0} />
            <MetricCard title="Strict Passed" value={report.strictPassedGates} />
            <MetricCard title="Blocked Gates" value={report.blockedGates} negative={report.blockedGates > 0} />
            <MetricCard
              title="Manual Review"
              value={report.requireManualReview ? "YES" : "NO"}
              negative={report.requireManualReview}
              positive={!report.requireManualReview}
            />
          </div>

          <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-red-300">
              Approval Sync Flow
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
              <RouteBox title="Unified Decision" value="Input" />
              <RouteBox title="Approval Gates" value={`${gates.length} gates`} />
              <RouteBox title="Risk Gate" value={report.blockedGates > 0 ? "BLOCK" : "PASS"} />
              <RouteBox title="Trade Approval" value={report.finalTradeApprovalStatus} />
              <RouteBox title="Execution" value={report.allowTradeExecution ? "OPEN" : "BLOCKED"} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Trade Approval Gates
            </h3>

            <div className="space-y-4">
              {gates.map((gate) => (
                <div
                  key={gate.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm"
                >
                  <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                    <div>
                      <p className="text-lg font-bold text-red-200">
                        {gate.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Required: {gate.required ? "YES" : "NO"}
                      </p>
                    </div>

                    <StatusBadge status={gate.status} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <ScoreCard
                      title="Gate Score"
                      value={gate.score}
                      positive={gate.score >= gate.threshold}
                      negative={gate.score < gate.threshold}
                    />
                    <ScoreCard title="Threshold" value={gate.threshold} />
                    <MetricCard
                      title="Result"
                      value={gate.status}
                      positive={gate.status === "PASS" || gate.status === "STRICT_PASS"}
                      negative={gate.status === "BLOCK"}
                    />
                  </div>

                  <p className="mt-4 text-xs text-slate-400">
                    {gate.reason}
                  </p>
                </div>
              ))}

              {gates.length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Approval Gates vorhanden.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
            <p className="text-xs text-slate-400">Recommendation</p>
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
              : "text-red-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ScoreCard({
  title,
  value,
  positive,
  negative,
}: {
  title: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{title}</p>
        <p
          className={`text-lg font-bold ${
            positive
              ? "text-emerald-400"
              : negative
                ? "text-red-400"
                : "text-red-300"
          }`}
        >
          {value}
        </p>
      </div>

      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-red-400"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-red-200">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "PASS"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
      : status === "STRICT_PASS"
        ? "border-orange-500/30 bg-orange-950/40 text-orange-300"
        : "border-red-500/30 bg-red-950/40 text-red-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}>
      {status}
    </span>
  );
}
