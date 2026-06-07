"use client";

import { useEffect, useState } from "react";

type MultiTimeframeTradeApprovalDecision = {
  id: string;
  symbol: string;
  requestedStyle: string;
  requestedDirection: string;
  requestedPositionSize: number;
  approvedStyle: string;
  approvedDirection: string;
  approvalStatus: string;
  allowExecution: boolean;
  finalPositionSize: number;
  positionSizeMultiplier: number;
  confidenceScore: number;
  riskScore: number;
  requiresStrictApproval: boolean;
  reason: string;
};

type MultiTimeframeTradeApprovalResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    totalTradeRequests: number;
    approvedTrades: number;
    strictApprovalTrades: number;
    rejectedTrades: number;
    waitingTrades: number;
    decisions: MultiTimeframeTradeApprovalDecision[];
    systemRule: string;
    recommendation: string;
    updatedAt: string;
  };
};

export default function MultiTimeframeTradeApprovalDashboardPanel() {
  const [data, setData] = useState<MultiTimeframeTradeApprovalResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMultiTimeframeTradeApproval() {
      try {
        const response = await fetch("/api/multi-timeframe-trade-approval-sync", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Multi-Timeframe Trade Approval Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadMultiTimeframeTradeApproval();
  }, []);

  const report = data?.report;
  const decisions = report?.decisions ?? [];

  return (
    <section className="rounded-2xl border border-teal-500/30 bg-slate-950/80 p-6 shadow-lg shadow-teal-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-teal-300">
            V11.9.4 Multi-Timeframe Trade Approval Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Style-spezifische Trade Approval Prüfung für Scalping, Daytrading und Swing Trading.
          </p>
        </div>

        <div className="rounded-xl border border-teal-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Multi-Timeframe Trade Approval wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Multi-Timeframe Trade Approval Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <MetricCard title="Trade Requests" value={report.totalTradeRequests} />
            <MetricCard title="Approved" value={report.approvedTrades} positive={report.approvedTrades > 0} />
            <MetricCard title="Strict Approval" value={report.strictApprovalTrades} negative={report.strictApprovalTrades > 0} />
            <MetricCard title="Rejected" value={report.rejectedTrades} negative={report.rejectedTrades > 0} />
            <MetricCard title="Waiting" value={report.waitingTrades} />
          </div>

          <div className="rounded-xl border border-teal-500/20 bg-teal-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-teal-300">
              Style Approval Rule
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
              <RouteBox title="Multi-Timeframe" value="Style Input" />
              <RouteBox title="Requested Style" value="Scalp / Day / Swing" />
              <RouteBox title="Style Approval" value="GO / WAIT / REJECT" />
              <RouteBox title="Position Sizing" value="Style Multiplier" />
              <RouteBox title="Execution Queue" value="Next Gate" />
            </div>

            <p className="mt-4 text-sm text-slate-300">
              {report.systemRule}
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Trade Approval Decisions
            </h3>

            <div className="space-y-4">
              {decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm"
                >
                  <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                    <div>
                      <p className="text-lg font-bold text-teal-200">
                        {decision.symbol}
                      </p>
                      <p className="text-xs text-slate-400">
                        Requested: {decision.requestedStyle} {decision.requestedDirection}
                      </p>
                    </div>

                    <StatusBadge status={decision.approvalStatus} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <Info label="Requested Style" value={decision.requestedStyle} />
                    <Info label="Requested Direction" value={decision.requestedDirection} />
                    <Info label="Approved Style" value={decision.approvedStyle} />
                    <Info label="Approved Direction" value={decision.approvedDirection} />
                    <Info label="Execution" value={decision.allowExecution ? "ALLOWED" : "BLOCKED"} />
                    <Info label="Requested Size" value={decision.requestedPositionSize} />
                    <Info label="Final Size" value={decision.finalPositionSize} />
                    <Info label="Multiplier" value={decision.positionSizeMultiplier} />
                    <Info label="Strict Approval" value={decision.requiresStrictApproval ? "YES" : "NO"} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ScoreCard
                      title="Confidence Score"
                      value={decision.confidenceScore}
                      positive={decision.confidenceScore >= 65}
                      negative={decision.confidenceScore < 45}
                    />
                    <ScoreCard
                      title="Risk Score"
                      value={decision.riskScore}
                      positive={decision.riskScore <= 35}
                      negative={decision.riskScore >= 60}
                    />
                  </div>

                  <p className="mt-4 text-xs text-slate-400">
                    {decision.reason}
                  </p>
                </div>
              ))}

              {decisions.length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Multi-Timeframe Trade Approval Decisions vorhanden.
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
              : "text-teal-300"
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
                : "text-teal-300"
          }`}
        >
          {value}
        </p>
      </div>

      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-teal-400"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-teal-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-teal-200">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "APPROVED"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
      : status === "STRICT_APPROVAL_REQUIRED"
        ? "border-orange-500/30 bg-orange-950/40 text-orange-300"
        : status === "WAIT"
          ? "border-yellow-500/30 bg-yellow-950/40 text-yellow-300"
          : "border-red-500/30 bg-red-950/40 text-red-300";

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
