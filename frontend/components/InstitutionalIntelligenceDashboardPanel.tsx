"use client";

import { useEffect, useState } from "react";

type InstitutionalSource = {
  id: string;
  name: string;
  type: string;
  region: string;
  focusAreas: string[];
  supportedMarkets: string[];
  impactLevel: string;
  sourceUsage: string;
  officialSourceUrl: string;
};

type InstitutionalSignal = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  region: string;
  marketBias: string;
  affectedMarkets: string[];
  confidenceImpact: number;
  riskImpact: number;
  strategyImpact: number;
  impactLevel: string;
  reason: string;
  createdAt: string;
};

type InstitutionalResponse = {
  ok: boolean;
  report?: {
    version: string;
    status: string;
    mode: string;
    totalSources: number;
    centralBankSources: number;
    majorBankSources: number;
    globalInstitutionSources: number;
    totalSignals: number;
    highImpactSignals: number;
    criticalImpactSignals: number;
    averageConfidenceImpact: number;
    averageRiskImpact: number;
    sources: InstitutionalSource[];
    signals: InstitutionalSignal[];
    recommendation: string;
    integrationTarget: string[];
    updatedAt: string;
  };
};

export default function InstitutionalIntelligenceDashboardPanel() {
  const [data, setData] = useState<InstitutionalResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInstitutionalIntelligence() {
      try {
        const response = await fetch("/api/bank-institutional-intelligence", {
          cache: "no-store",
        });

        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Institutional Intelligence Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadInstitutionalIntelligence();
  }, []);

  const report = data?.report;
  const sources = report?.sources ?? [];
  const signals = report?.signals ?? [];
  const targets = report?.integrationTarget ?? [];

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-slate-950/80 p-6 shadow-lg shadow-amber-500/10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-amber-300">
            V11.7.4 Institutional Intelligence Dashboard
          </h2>
          <p className="text-sm text-slate-400">
            Zentralbanken, grosse Banken und globale Institutionen als Fundamental Intelligence Layer.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/30 px-4 py-2 text-right">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-bold text-emerald-400">
            {loading ? "LOADING" : report?.status ?? "UNKNOWN"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">
          Institutional Intelligence wird geladen...
        </p>
      )}

      {!loading && !report && (
        <p className="text-sm text-red-400">
          Keine Institutional Intelligence Daten gefunden.
        </p>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard title="Total Sources" value={report.totalSources} />
            <MetricCard title="Central Banks" value={report.centralBankSources} positive />
            <MetricCard title="Major Banks" value={report.majorBankSources} />
            <MetricCard title="Global Institutions" value={report.globalInstitutionSources} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <MetricCard title="Total Signals" value={report.totalSignals} />
            <MetricCard title="Critical Signals" value={report.criticalImpactSignals} negative={report.criticalImpactSignals > 0} />
            <MetricCard title="High Impact" value={report.highImpactSignals} />
            <MetricCard title="Avg Confidence" value={report.averageConfidenceImpact} positive={report.averageConfidenceImpact > 0} negative={report.averageConfidenceImpact < 0} />
            <MetricCard title="Avg Risk" value={report.averageRiskImpact} negative={report.averageRiskImpact > 2} />
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4">
            <h3 className="mb-3 text-lg font-bold text-amber-300">
              Institutional Intelligence Route
            </h3>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-6">
              {targets.map((target) => (
                <RouteBox key={target} title={target} value="Target" />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Institutional Sources
            </h3>

            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <Info label="Name" value={source.name} />
                    <Info label="Type" value={source.type} />
                    <Info label="Region" value={source.region} />
                    <Info label="Impact" value={source.impactLevel} />
                    <Info label="Markets" value={source.supportedMarkets.join(", ")} />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Info label="Focus Areas" value={source.focusAreas.join(", ")} />
                    <Info label="Usage" value={source.sourceUsage} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <h3 className="mb-3 text-lg font-bold text-slate-200">
              Institutional Intelligence Signals
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
                    <Info label="Confidence Impact" value={signal.confidenceImpact} />
                    <Info label="Risk Impact" value={signal.riskImpact} />
                    <Info label="Strategy Impact" value={signal.strategyImpact} />
                    <Info label="Impact Level" value={signal.impactLevel} />
                    <Info label="Region" value={signal.region} />
                    <Info label="Affected Markets" value={signal.affectedMarkets.join(", ")} />
                    <Info label="Created At" value={signal.createdAt} />
                  </div>

                  <p className="mt-3 text-xs text-slate-400">
                    {signal.reason}
                  </p>
                </div>
              ))}

              {signals.length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Institutional Intelligence Signals vorhanden.
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
              : "text-amber-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RouteBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-sm font-bold text-amber-200">{value}</p>
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
