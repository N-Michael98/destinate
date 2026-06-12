"use client";

import { useEffect, useState, useCallback } from "react";

type SymbolLearning = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  adjustmentFactor: number;
  lastUpdated: string;
};

type StrategyLearning = {
  strategy: string;
  backtestWinRate: number;
  actualWinRate: number;
  adjustmentFactor: number;
  confidence: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  trades: number;
};

type LearningReport = {
  version: string;
  analyzedAt: string;
  learningCycles: number;
  totalTradesAnalyzed: number;
  newTradesThisCycle: number;
  symbolPerformance: Record<string, SymbolLearning>;
  strategyAdjustments: Record<string, StrategyLearning>;
  predictionAccuracy: {
    gpt:       { correct: number; total: number; accuracy: number };
    claude:    { correct: number; total: number; accuracy: number };
    consensus: { correct: number; total: number; accuracy: number };
  };
  insights: string[];
  status: "LEARNING" | "WARMING_UP" | "NO_DATA";
  nextAction: string;
};

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH:   "text-green-400 bg-green-500/10 border-green-500/30",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  LOW:    "text-orange-400 bg-orange-500/10 border-orange-500/30",
  NONE:   "text-slate-400 bg-slate-700/30 border-slate-600/30",
};

const STATUS_META = {
  LEARNING:   { color: "text-green-400", icon: "🧠", label: "Lernt aktiv" },
  WARMING_UP: { color: "text-yellow-400", icon: "🔥", label: "Aufwärmphase" },
  NO_DATA:    { color: "text-slate-400",  icon: "💤", label: "Warte auf Trades" },
};

function FactorBar({ factor }: { factor: number }) {
  const pct = Math.min(150, Math.max(50, factor * 100));
  const color = factor >= 1.1 ? "bg-green-500" : factor <= 0.9 ? "bg-red-500" : "bg-slate-500";
  const width = factor >= 1 ? (factor - 1) * 200 : 0;
  const leftWidth = factor < 1 ? (1 - factor) * 200 : 0;
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
        <div className="absolute inset-0 flex">
          <div className="flex-1 flex justify-end">
            <div className="bg-red-500/60 h-full rounded-l" style={{ width: `${Math.min(leftWidth, 100)}%` }} />
          </div>
          <div className="w-px bg-slate-500" />
          <div className="flex-1">
            <div className={`${color} h-full rounded-r`} style={{ width: `${Math.min(width, 100)}%` }} />
          </div>
        </div>
      </div>
      <span className={`text-xs font-mono font-bold ${factor >= 1.05 ? "text-green-400" : factor <= 0.95 ? "text-red-400" : "text-slate-400"}`}>
        {factor >= 1 ? "+" : ""}{((factor - 1) * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function AccuracyBadge({ label, data }: { label: string; data: { correct: number; total: number; accuracy: number } }) {
  const color = data.accuracy >= 60 ? "text-green-400" : data.accuracy >= 50 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3 text-center">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{data.total > 0 ? `${data.accuracy}%` : "—"}</div>
      <div className="text-xs text-slate-500 mt-0.5">{data.correct}/{data.total} korrekt</div>
    </div>
  );
}

export default function LearningFeedbackPanel() {
  const [report, setReport] = useState<LearningReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastCycle, setLastCycle] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/learning/status", { cache: "no-store" });
      const d = await res.json();
      if (d.state?.learningCycles > 0) {
        // Build report from state
        setReport({
          version: d.state.version,
          analyzedAt: d.state.lastAnalyzed,
          learningCycles: d.state.learningCycles,
          totalTradesAnalyzed: d.state.totalTradesAnalyzed,
          newTradesThisCycle: 0,
          symbolPerformance: d.state.symbolPerformance ?? {},
          strategyAdjustments: d.state.strategyAdjustments ?? {},
          predictionAccuracy: d.state.predictionAccuracy,
          insights: d.state.insights ?? [],
          status: d.state.totalTradesAnalyzed === 0 ? "NO_DATA" :
                  d.state.totalTradesAnalyzed < 5 ? "WARMING_UP" : "LEARNING",
          nextAction: d.state.totalTradesAnalyzed === 0
            ? "Starte Paper Trading um Lern-Daten zu sammeln."
            : `${d.state.totalTradesAnalyzed} Trades analysiert.`,
        });
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runCycle() {
    setRunning(true);
    try {
      const res = await fetch("/api/learning/analyze", { method: "POST", cache: "no-store" });
      const d = await res.json();
      if (d.report) {
        setReport(d.report);
        setLastCycle(new Date().toLocaleTimeString("de-CH"));
      }
    } catch { /* ignore */ } finally {
      setRunning(false);
    }
  }

  const statusMeta = STATUS_META[report?.status ?? "NO_DATA"];
  const stratEntries = Object.entries(report?.strategyAdjustments ?? {});
  const symEntries   = Object.entries(report?.symbolPerformance ?? {});

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/80 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-lg">🧠</span>
        <h2 className="font-bold text-white text-sm">Self-Learning Feedback Loop</h2>
        <span className={`text-xs border rounded px-2 py-0.5 ${statusMeta.color} border-current/30`}>
          {statusMeta.icon} {statusMeta.label}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {report ? `Zyklus #${report.learningCycles}` : "Noch kein Zyklus"}
          {lastCycle && ` · ${lastCycle}`}
        </span>
        <button onClick={runCycle} disabled={running}
          className="rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold px-3 py-1.5 transition-colors">
          {running ? "⏳ Analysiere..." : "▶ Lern-Zyklus starten"}
        </button>
      </div>

      {/* Wie es funktioniert */}
      <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3 text-xs text-slate-400 leading-relaxed">
        <span className="text-slate-300 font-medium">Wie es funktioniert: </span>
        Paper Trade abgeschlossen → System liest Resultat (WIN/LOSS) → vergleicht mit Backtest-Erwartung
        → Strategie-Gewicht wird angepasst → nächster Trade nutzt verbesserte Gewichtung
        <span className="text-purple-400 ml-1">→ Das System wird mit jedem Trade smarter.</span>
      </div>

      {loading && !report && (
        <div className="text-center text-slate-400 text-sm py-4">Lade Lern-Status...</div>
      )}

      {report && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3">
              <div className="text-xs text-slate-400 mb-1">Trades analysiert</div>
              <div className="text-2xl font-bold text-white">{report.totalTradesAnalyzed}</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3">
              <div className="text-xs text-slate-400 mb-1">Lern-Zyklen</div>
              <div className="text-2xl font-bold text-purple-400">{report.learningCycles}</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3">
              <div className="text-xs text-slate-400 mb-1">Neue Trades</div>
              <div className="text-2xl font-bold text-cyan-400">{report.newTradesThisCycle}</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3">
              <div className="text-xs text-slate-400 mb-1">Symbole aktiv</div>
              <div className="text-2xl font-bold text-white">{symEntries.length}</div>
            </div>
          </div>

          {/* Strategie-Anpassungen */}
          {stratEntries.length > 0 && (
            <div className="rounded-lg border border-slate-700/40 overflow-hidden">
              <div className="bg-slate-800/60 px-3 py-2 text-xs text-slate-400 font-medium">
                Strategie-Gewichte — angepasst durch echte Trade-Performance
              </div>
              <div className="divide-y divide-slate-800/60">
                {stratEntries.map(([name, s]) => (
                  <div key={name} className="px-3 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{name}</span>
                      <span className={`text-xs border rounded px-1.5 py-0.5 ${CONFIDENCE_COLORS[s.confidence]}`}>
                        {s.confidence} Konfidenz · {s.trades} Trades
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-400 mb-1">
                      <span>Backtest: <span className="text-slate-300">{s.backtestWinRate}%</span></span>
                      <span>Echt: <span className={s.trades > 0 ? (s.actualWinRate >= s.backtestWinRate ? "text-green-400" : "text-red-400") : "text-slate-500"}>
                        {s.trades > 0 ? `${s.actualWinRate}%` : "—"}
                      </span></span>
                      <span className="ml-auto">Gewichtung: <span className={s.adjustmentFactor >= 1.05 ? "text-green-400" : s.adjustmentFactor <= 0.95 ? "text-red-400" : "text-slate-300"}>
                        ×{s.adjustmentFactor.toFixed(2)}
                      </span></span>
                    </div>
                    <FactorBar factor={s.adjustmentFactor} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Symbol-Performance */}
          {symEntries.length > 0 && (
            <div className="rounded-lg border border-slate-700/40 overflow-hidden">
              <div className="bg-slate-800/60 px-3 py-2 text-xs text-slate-400 font-medium">
                Symbol-Performance — aus Paper Trades
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/40">
                      {["Symbol", "Trades", "Win%", "Avg PnL", "Total PnL", "Faktor"].map(h => (
                        <th key={h} className="text-left text-slate-400 px-3 py-1.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {symEntries.sort((a, b) => b[1].winRate - a[1].winRate).map(([sym, s]) => (
                      <tr key={sym} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-medium text-white">{sym}</td>
                        <td className="px-3 py-2 text-slate-300">{s.trades}</td>
                        <td className={`px-3 py-2 font-medium ${s.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
                          {s.winRate}%
                        </td>
                        <td className={`px-3 py-2 ${s.avgPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {s.avgPnl >= 0 ? "+" : ""}${s.avgPnl.toFixed(2)}
                        </td>
                        <td className={`px-3 py-2 font-medium ${s.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toFixed(2)}
                        </td>
                        <td className={`px-3 py-2 font-mono font-bold ${s.adjustmentFactor >= 1.05 ? "text-green-400" : s.adjustmentFactor <= 0.95 ? "text-red-400" : "text-slate-400"}`}>
                          ×{s.adjustmentFactor.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Prediction Accuracy */}
          <div>
            <div className="text-xs text-slate-400 mb-2 font-medium">AI Vorhersage-Genauigkeit</div>
            <div className="grid grid-cols-3 gap-2">
              <AccuracyBadge label="GPT-4" data={report.predictionAccuracy.gpt} />
              <AccuracyBadge label="Claude" data={report.predictionAccuracy.claude} />
              <AccuracyBadge label="Consensus" data={report.predictionAccuracy.consensus} />
            </div>
            {report.predictionAccuracy.consensus.total === 0 && (
              <div className="text-xs text-slate-500 text-center mt-2">
                Wird gefüllt sobald AI-Predictions mit Paper Trade Resultaten abgeglichen werden können.
              </div>
            )}
          </div>

          {/* Insights */}
          {report.insights.length > 0 && (
            <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3 space-y-1.5">
              <div className="text-xs font-medium text-purple-300 mb-2">🔍 Lern-Insights</div>
              {report.insights.map((ins, i) => (
                <div key={i} className="text-xs text-slate-300 flex gap-2">
                  <span className="text-purple-400 mt-0.5">→</span>
                  <span>{ins}</span>
                </div>
              ))}
            </div>
          )}

          {/* Next Action */}
          <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
            <span className="text-cyan-400">⟳</span>
            {report.nextAction}
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="text-center py-6 space-y-2">
          <div className="text-3xl">🧠</div>
          <div className="text-slate-400 text-sm">Noch kein Lern-Zyklus gestartet.</div>
          <div className="text-slate-500 text-xs">Klicke "Lern-Zyklus starten" um die Paper-Trade-History zu analysieren.</div>
        </div>
      )}
    </div>
  );
}
