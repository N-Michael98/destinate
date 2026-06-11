"use client";

import { useEffect, useState } from "react";
import ExecutionQueuePositionSyncPanel from "./ExecutionQueuePositionSyncPanel";
import ExecutionPositionTicketSyncPanel from "./ExecutionPositionTicketSyncPanel";
import { ForwardTestResultsChart, WinRateTrendChart } from "./PerformanceCharts";

interface ForwardTestResult {
  resultId: string;
  symbol: string;
  side: "BUY" | "SELL";
  tradingStyle: string;
  confidenceScore: number;
  evolvedLotSize: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPercent: number;
  actualRR: number;
  expectedRR: number;
  pnlPercent: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN" | "PENDING";
  hitTarget: boolean;
  hitStop: boolean;
  barsHeld: number;
  slippagePercent: number;
  note: string;
}

interface ForwardTestingMetrics {
  totalSignals: number;
  completedTrades: number;
  pendingTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  avgRR: number;
  profitFactor: number;
  expectedValuePerTrade: number;
  totalPnlPercent: number;
  avgConfidenceScore: number;
  avgEvolvedLotSize: number;
  bestTrade: string;
  worstTrade: string;
}

interface ForwardTestingReport {
  version: string;
  status: string;
  mode: string;
  sessionId: string;
  results: ForwardTestResult[];
  metrics: ForwardTestingMetrics;
  loopSource: string;
  summary: string;
  safety: { liveTradingEnabled: false; orderExecutionEnabled: false; forwardTestMode: string };
  createdAt: string;
}

type Tab = "overview" | "results" | "position-sync" | "tickets";

function outcomeCls(o: string) {
  if (o === "WIN") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (o === "LOSS") return "border-red-500/40 bg-red-500/10 text-red-300";
  if (o === "BREAKEVEN") return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  return "border-slate-500/40 bg-slate-500/10 text-slate-400";
}

function sideCls(s: string) {
  return s === "BUY"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    : "border-red-500/40 bg-red-500/10 text-red-300";
}

function Chip({ label, cls }: { label: string; cls: string }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}

function KpiCard({
  label, value, sub, accent = "text-white",
}: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-black ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 py-2 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

export default function ForwardTestingCenter() {
  const [report, setReport] = useState<ForwardTestingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  function load() {
    setLoading(true);
    fetch("/api/forward-testing", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setReport(d.report))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "results", label: "Trade Results" },
    { id: "position-sync", label: "Position Sync V16.3.0" },
    { id: "tickets", label: "Evolved Tickets V16.3.1" },
  ];

  const m = report?.metrics;

  return (
    <section className="bg-gray-900 border border-teal-900 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-400 mb-2">V16.4.0</p>
          <h2 className="text-4xl font-black text-white">Forward Testing</h2>
          <p className="text-gray-400 text-lg mt-3 max-w-3xl">
            Walk-Forward Simulation auf evolved Execution Signals. Der Loop läuft: Position Sizing Evolution → Execution Tickets → Forward Test → Learning.
          </p>
        </div>
        <div className="flex flex-col gap-3 min-w-[200px]">
          <div className="bg-black border border-teal-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Status</p>
            <p className="text-teal-400 text-2xl font-bold mt-1">{report?.status ?? "—"}</p>
          </div>
          <button
            onClick={load}
            className="bg-teal-900/40 hover:bg-teal-900/70 border border-teal-700 text-teal-300 text-sm font-bold rounded-xl px-4 py-2 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-xl text-sm font-bold border transition ${
              tab === t.id
                ? "bg-teal-900/60 border-teal-600 text-teal-300"
                : "bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-slate-400">
          Lade Forward Testing Daten...
        </div>
      )}

      {!loading && tab === "overview" && report && m && (
        <div className="space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Win Rate" value={`${m.winRate}%`} sub={`${m.wins}W / ${m.losses}L / ${m.breakevens}BE`} accent="text-teal-400" />
            <KpiCard label="Profit Factor" value={m.profitFactor} sub="Gross profit / gross loss" accent={m.profitFactor >= 1.5 ? "text-emerald-400" : m.profitFactor >= 1 ? "text-yellow-400" : "text-red-400"} />
            <KpiCard label="Avg R:R" value={m.avgRR} sub="Average risk/reward achieved" accent="text-indigo-400" />
            <KpiCard label="Total PnL" value={`${m.totalPnlPercent}%`} sub="Cumulative forward test P&L" accent={m.totalPnlPercent >= 0 ? "text-emerald-400" : "text-red-400"} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Signals" value={m.totalSignals} />
            <KpiCard label="Completed" value={m.completedTrades} />
            <KpiCard label="EV / Trade" value={`${m.expectedValuePerTrade}%`} accent={m.expectedValuePerTrade >= 0 ? "text-teal-400" : "text-red-400"} />
            <KpiCard label="Avg Confidence" value={`${m.avgConfidenceScore}%`} accent="text-violet-400" />
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <ForwardTestResultsChart />
            <WinRateTrendChart />
          </div>

          {/* Details */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Performance Breakdown</h3>
              <MetricRow label="Avg Evolved Lot Size" value={`${m.avgEvolvedLotSize} lots`} />
              <MetricRow label="Best Trade" value={m.bestTrade} />
              <MetricRow label="Worst Trade" value={m.worstTrade} />
              <MetricRow label="Breakevens" value={m.breakevens} />
              <MetricRow label="Pending" value={m.pendingTrades} />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Loop Source</h3>
              <p className="text-sm text-teal-300 font-semibold mb-3">{report.loopSource}</p>
              <p className="text-sm text-slate-400">{report.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Chip label={report.mode} cls="border-teal-500/40 bg-teal-500/10 text-teal-300" />
                <Chip label={report.safety.forwardTestMode} cls="border-violet-500/40 bg-violet-500/10 text-violet-300" />
                <Chip label="LIVE BLOCKED" cls="border-red-500/40 bg-red-500/10 text-red-300" />
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Session: {report.sessionId} · {new Date(report.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && tab === "results" && report && (
        <div className="space-y-4">
          {report.results.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-slate-400">
              Keine Forward Test Results verfügbar.
            </div>
          )}
          {report.results.map((r) => (
            <div key={r.resultId} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <p className="text-xs font-mono text-slate-500">{r.resultId}</p>
                    <h3 className="text-xl font-bold text-white">{r.symbol}</h3>
                    <Chip label={r.side} cls={sideCls(r.side)} />
                    <Chip label={r.outcome} cls={outcomeCls(r.outcome)} />
                    <Chip label={r.tradingStyle} cls="border-slate-600 bg-slate-800 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-500">{r.note}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black ${r.pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.pnlPercent >= 0 ? "+" : ""}{r.pnlPercent}%
                  </p>
                  <p className="text-xs text-slate-500">P&L</p>
                </div>
              </div>
              <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                {[
                  { l: "Entry", v: r.entryPrice },
                  { l: "Exit", v: r.exitPrice },
                  { l: "SL", v: r.stopLoss },
                  { l: "TP", v: r.takeProfit },
                  { l: "Actual RR", v: r.actualRR },
                  { l: "Exp RR", v: r.expectedRR },
                  { l: "Lots", v: r.evolvedLotSize },
                  { l: "Bars", v: r.barsHeld },
                ].map(({ l, v }) => (
                  <div key={l} className="rounded-xl border border-slate-800 bg-slate-950/70 p-2 text-center">
                    <p className="text-[9px] uppercase tracking-[0.15em] text-slate-500">{l}</p>
                    <p className="mt-1 text-xs font-bold text-white">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "position-sync" && <ExecutionQueuePositionSyncPanel />}
      {!loading && tab === "tickets" && <ExecutionPositionTicketSyncPanel />}

      {!loading && !report && (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-6 text-red-300">
          Forward Testing Daten konnten nicht geladen werden.
        </div>
      )}
    </section>
  );
}
