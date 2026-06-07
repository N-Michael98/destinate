"use client";

import { useEffect, useState } from "react";

type InstitutionalPortfolioBrainSignal = {
  id: string;
  sourceName: string;
  sourceType: string;
  marketBias: string;
  affectedMarkets: string[];
  confidenceImpact: number;
  riskImpact: number;
  strategyImpact: number;
  impactLevel: string;
  reason: string;
};

type PortfolioBrainAdjustment = {
  institutionalConfidenceScore: number;
  institutionalRiskScore: number;
  institutionalStrategyScore: number;
  portfolioBrainConfidenceAdjustment: number;
  portfolioBrainRiskAdjustment: number;
  portfolioBrainStrategyAdjustment: number;
  allowAggressiveTrading: boolean;
  allowNormalTrading: boolean;
  requireDefensiveMode: boolean;
  institutionalBias: string;
  affectedMarkets: string[];
  reason: string;
};

type InstitutionalPortfolioBrainSyncResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    totalInstitutionalSignals: number;
    criticalSignals: number;
    highImpactSignals: number;
    institutionalSignals: InstitutionalPortfolioBrainSignal[];
    portfolioBrainAdjustment: PortfolioBrainAdjustment;
    integrationTarget: string[];
    recommendation: string;
    updatedAt: string;
  };
};

export default function InstitutionalPortfolioBrainSyncDashboardPanel() {
  const [data, setData] = useState<InstitutionalPortfolioBrainSyncResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInstitutionalPortfolioBrainSync() {
      try {
        const response = await fetch("/api/institutional-portfolio-brain-sync", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Institutional Portfolio Brain Sync Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadInstitutionalPortfolioBrainSync();
  }, []);

  const report = data?.report;
  const adjustment = report?.portfolioBrainAdjustment;
  const signals = report?.institutionalSignals ?? [];
  const targets = report?.integrationTarget ?? [];

  return (
    <section className="rounded-2xl border border-orange-500/30 bg-slate-950/80 p-6 shadow-lg shadow-orange-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-orange-300">
            V11.7.6 Institutional Portfolio Brain Sync Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Zeigt, wie Institutional Intelligence den Portfolio Brain beeinflusst.
          </p>
        </div>

        <div className="rounded-xl border border-orange-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Institutional Portfolio Brain Sync wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Institutional Portfolio Brain Sync Daten gefunden.
        </p>
      )}

      {report && adjustment && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Institutional Signals" value={report.totalInstitutionalSignals} />
            <MetricCard title="Critical Signals" value={report.criticalSignals} negative={report.criticalSignals > 0} />
            <MetricCard title="High Impact Signals" value={report.highImpactSignals} />
            <MetricCard title="Institutional Bias" value={adjustment.institutionalBias} negative={adjustment.institutionalBias === "RISK_OFF"} positive={adjustment.institutionalBias === "RISK_ON"} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ScoreCard
              title="Institutional Confidence Score"
              value={adjustment.institutionalConfidenceScore}
              positive={adjustment.institutionalConfidenceScore >= 65}
              negative={adjustment.institutionalConfidenceScore < 45}
            />
            <ScoreCard
              title="Institutional Risk Score"
              value={adjustment.institutionalRiskScore}
              positive={adjustment.institutionalRiskScore < 55}
              negative={adjustment.institutionalRiskScore >= 70}
            />
            <ScoreCard
              title="Institutional Strategy Score"
              value={adjustment.institutionalStrategyScore}
              positive={adjustment.institutionalStrategyScore >= 65}
              negative={adjustment.institutionalStrategyScore < 45}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard
              title="Confidence Adjustment"
              value={adjustment.portfolioBrainConfidenceAdjustment}
              positive={adjustment.portfolioBrainConfidenceAdjustment > 0}
              negative={adjustment.portfolioBrainConfidenceAdjustment < 0}
            />
            <MetricCard
              title="Risk Adjustment"
              value={adjustment.portfolioBrainRiskAdjustment}
              negative={adjustment.portfolioBrainRiskAdjustment > 0}
              positive={adjustment.portfolioBrainRiskAdjustment < 0}
            />
            <MetricCard
              title="Strategy Adjustment"
              value={adjustment.portfolioBrainStrategyAdjustment}
              positive={adjustment.portfolioBrainStrategyAdjustment > 0}
              negative={adjustment.portfolioBrainStrategyAdjustment < 0}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DecisionCard
              title="Aggressive Trading"
              active={adjustment.allowAggressiveTrading}
              activeText="ALLOWED"
              inactiveText="BLOCKED"
            />
            <DecisionCard
              title="Normal Trading"
              active={adjustment.allowNormalTrading}
              activeText="ALLOWED"
              inactiveText="BLOCKED"
            />
            <DecisionCard
              title="Defensive Mode"
              active={adjustment.requireDefensiveMode}
              activeText="REQUIRED"
              inactiveText="NOT REQUIRED"
              reverse
            />
          </div>

          <div className="rounded-xl border border-orange-500/20 bg-orange-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-orange-300">
              Portfolio Brain Sync Route
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
              {targets.map((target) => (
                <RouteBox key={target} title={target} value="Sync Target" />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Affected Markets
            </h3>

            <div className="flex flex-wrap gap-2">
              {adjustment.affectedMarkets.map((market) => (
                <span
                  key={market}
                  className="rounded-full border border-orange-500/20 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-orange-200"
                >
                  {market}
                </span>
              ))}
            </div>

            <p className="mt-4 text-sm text-slate-300">
              {adjustment.reason}
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Institutional Signals To Portfolio Brain
            </h3>

            <div className="space-y-3">
              {signals.map((signal) => (
                <div
                  key={signal.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                    <Info label="Source" value={signal.sourceName} />
                    <Info label="Type" value={signal.sourceType} />
                    <Info label="Market Bias" value={signal.marketBias} />
                    <Info label="Impact Level" value={signal.impactLevel} />
                    <Info label="Confidence Impact" value={signal.confidenceImpact} />
                    <Info label="Risk Impact" value={signal.riskImpact} />
                    <Info label="Strategy Impact" value={signal.strategyImpact} />
                    <Info label="Affected Markets" value={signal.affectedMarkets.join(", ")} />
                  </div>

                  <p className="mt-3 text-xs text-slate-400">
                    {signal.reason}
                  </p>
                </div>
              ))}

              {signals.length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Institutional Portfolio Brain Signals vorhanden.
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
              : "text-orange-300"
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
                : "text-orange-300"
          }`}
        >
          {value}
        </p>
      </div>

      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div
          className="h-2 rounded-full bg-orange-400"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function DecisionCard({
  title,
  active,
  activeText,
  inactiveText,
  reverse,
}: {
  title: string;
  active: boolean;
  activeText: string;
  inactiveText: string;
  reverse?: boolean;
}) {
  const isPositive = reverse ? !active : active;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p
        className={`mt-2 text-xl font-bold ${
          isPositive ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {active ? activeText : inactiveText}
      </p>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-orange-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-orange-200">{value}</p>
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
