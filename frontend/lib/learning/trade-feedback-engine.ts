import { PaperHistory } from "@/lib/paper-trading/paper-history";
import {
  readLearningState,
  writeLearningState,
  type LearningState,
  type SymbolLearning,
  type StrategyLearning,
} from "./learning-store";

// Strategie → Symbol mapping (selbe wie Evolution Engine)
const STRATEGY_SYMBOL_MAP: Record<string, string> = {
  "Risk-Off Trend":    "XAUUSD",
  "Momentum Breakout": "EURUSD",
  "Inventory Reaction":"NAS100",
};

// Backtest-Baseline (Fallback wenn Python offline)
const BACKTEST_BASELINE: Record<string, number> = {
  "Risk-Off Trend":    74,
  "Momentum Breakout": 68,
  "Inventory Reaction":61,
};

type ClosedTrade = {
  symbol: string;
  direction: "BUY" | "SELL";
  pnl: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
  closedAt: string;
};

function extractClosedTrades(slot = "capital"): ClosedTrade[] {
  const history = PaperHistory.getAll(slot);
  const trades: ClosedTrade[] = [];

  for (const event of history) {
    if (event.entity !== "POSITION") continue;
    if (event.event !== "POSITION_CLOSED" && event.event !== "POSITION_UPDATED") continue;

    const p = event.payload as Record<string, unknown>;
    const pnl = typeof p?.pnl === "number" ? p.pnl : 0;
    if (pnl === 0 && event.event !== "POSITION_CLOSED") continue;

    const symbol = typeof p?.symbol === "string" ? p.symbol : "UNKNOWN";
    const direction = typeof p?.direction === "string" ? p.direction as "BUY" | "SELL" : "BUY";
    const outcome: "WIN" | "LOSS" | "BREAKEVEN" =
      pnl > 0.01 ? "WIN" : pnl < -0.01 ? "LOSS" : "BREAKEVEN";

    trades.push({ symbol, direction, pnl, outcome, closedAt: event.timestamp });
  }

  return trades;
}

function calcAdjustmentFactor(actualWinRate: number, baselineWinRate: number, tradeCount: number): number {
  if (tradeCount < 3) return 1.0; // Zu wenig Daten
  const ratio = actualWinRate / Math.max(baselineWinRate, 1);
  // Clamp zwischen 0.5 (stark reduziert) und 1.5 (stark geboostet)
  return Math.min(1.5, Math.max(0.5, ratio));
}

function confidenceLevel(trades: number): "NONE" | "LOW" | "MEDIUM" | "HIGH" {
  if (trades < 3)  return "NONE";
  if (trades < 10) return "LOW";
  if (trades < 25) return "MEDIUM";
  return "HIGH";
}

function generateInsights(
  symbolPerf: Record<string, SymbolLearning>,
  stratAdj: Record<string, StrategyLearning>,
): string[] {
  const insights: string[] = [];

  // Bestes Symbol
  const syms = Object.entries(symbolPerf).filter(([, v]) => v.trades >= 3);
  if (syms.length > 0) {
    const best = syms.sort((a, b) => b[1].winRate - a[1].winRate)[0];
    insights.push(`${best[0]} zeigt beste Performance: ${best[1].winRate.toFixed(0)}% Win-Rate über ${best[1].trades} Trades.`);
    const worst = syms.sort((a, b) => a[1].winRate - b[1].winRate)[0];
    if (worst[0] !== best[0]) {
      insights.push(`${worst[0]} hat schwache Performance (${worst[1].winRate.toFixed(0)}% Win-Rate) — Strategie wird automatisch reduziert.`);
    }
  }

  // Strategie-Abweichungen
  for (const [name, s] of Object.entries(stratAdj)) {
    if (s.confidence === "NONE") continue;
    const diff = s.actualWinRate - s.backtestWinRate;
    if (diff > 5) {
      insights.push(`${name}: Echte Win-Rate (${s.actualWinRate.toFixed(0)}%) übertrifft Backtest (${s.backtestWinRate}%) → Strategie wird geboostet.`);
    } else if (diff < -5) {
      insights.push(`${name}: Echte Win-Rate (${s.actualWinRate.toFixed(0)}%) unter Backtest (${s.backtestWinRate}%) → Evolution-Überprüfung ausgelöst.`);
    }
  }

  if (insights.length === 0) {
    insights.push("Noch zu wenige abgeschlossene Trades für verlässliche Insights. Mindestens 3 Trades pro Symbol nötig.");
  }

  return insights;
}

export type LearningAnalysisReport = {
  version: string;
  analyzedAt: string;
  learningCycles: number;
  totalTradesAnalyzed: number;
  newTradesThisCycle: number;
  symbolPerformance: Record<string, SymbolLearning>;
  strategyAdjustments: Record<string, StrategyLearning>;
  predictionAccuracy: LearningState["predictionAccuracy"];
  insights: string[];
  status: "LEARNING" | "WARMING_UP" | "NO_DATA";
  nextAction: string;
};

export async function runLearningCycle(slots = ["capital", "broker2"]): Promise<LearningAnalysisReport> {
  const state = readLearningState();

  // Trades von beiden Broker-Slots lesen
  const allTrades: ClosedTrade[] = [];
  for (const slot of slots) {
    try { allTrades.push(...extractClosedTrades(slot)); } catch { /* skip */ }
  }

  const newTrades = allTrades.length - state.totalTradesAnalyzed;

  // Symbol-Performance berechnen
  const symbolPerf: Record<string, SymbolLearning> = {};
  const symbolGroups: Record<string, ClosedTrade[]> = {};

  for (const t of allTrades) {
    if (!symbolGroups[t.symbol]) symbolGroups[t.symbol] = [];
    symbolGroups[t.symbol].push(t);
  }

  for (const [symbol, trades] of Object.entries(symbolGroups)) {
    const wins   = trades.filter(t => t.outcome === "WIN").length;
    const losses = trades.filter(t => t.outcome === "LOSS").length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const avgPnl   = trades.length > 0 ? totalPnl / trades.length : 0;

    // Baseline: wenn dieses Symbol in Backtest war, nutze dessen Win-Rate
    const baselineWinRate = 50; // neutral baseline per symbol
    const factor = calcAdjustmentFactor(winRate, baselineWinRate, trades.length);

    symbolPerf[symbol] = {
      trades: trades.length,
      wins,
      losses,
      winRate: Math.round(winRate * 10) / 10,
      avgPnl: Math.round(avgPnl * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      adjustmentFactor: Math.round(factor * 100) / 100,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Strategy Adjustments berechnen
  const stratAdj: Record<string, StrategyLearning> = {};
  for (const [stratName, symbol] of Object.entries(STRATEGY_SYMBOL_MAP)) {
    const symPerf = symbolPerf[symbol];
    const baselineWinRate = BACKTEST_BASELINE[stratName] ?? 60;
    const actualWinRate = symPerf?.winRate ?? 0;
    const tradeCount = symPerf?.trades ?? 0;
    const factor = calcAdjustmentFactor(actualWinRate, baselineWinRate, tradeCount);

    stratAdj[stratName] = {
      strategy: stratName,
      backtestWinRate: baselineWinRate,
      actualWinRate: tradeCount > 0 ? actualWinRate : 0,
      adjustmentFactor: Math.round(factor * 100) / 100,
      confidence: confidenceLevel(tradeCount),
      trades: tradeCount,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Prediction Accuracy aus pending predictions auflösen
  const predAccuracy = state.predictionAccuracy;
  const resolvedPreds = state.pendingPredictions.filter(p => {
    if (p.resolved) return false;
    // Finde passenden abgeschlossenen Trade für dieses Symbol
    const match = allTrades.find(t =>
      t.symbol === p.symbol &&
      new Date(t.closedAt) > new Date(p.timestamp)
    );
    if (!match) return false;
    const correct = (p.direction === "BUY" && match.outcome === "WIN") ||
                    (p.direction === "SELL" && match.outcome === "WIN");
    p.resolved = true;
    p.correct = correct;
    predAccuracy[p.source].total++;
    if (correct) predAccuracy[p.source].correct++;
    predAccuracy[p.source].accuracy = predAccuracy[p.source].total > 0
      ? Math.round((predAccuracy[p.source].correct / predAccuracy[p.source].total) * 100)
      : 0;
    return true;
  });

  const insights = generateInsights(symbolPerf, stratAdj);

  const totalTrades = allTrades.length;
  const status: LearningAnalysisReport["status"] =
    totalTrades === 0 ? "NO_DATA" :
    totalTrades < 5  ? "WARMING_UP" : "LEARNING";

  const nextAction =
    status === "NO_DATA"     ? "Starte Paper Trading um Lern-Daten zu sammeln." :
    status === "WARMING_UP"  ? `${5 - totalTrades} weitere Trades bis verlässliche Anpassungen möglich sind.` :
    `${newTrades} neue Trades analysiert — Strategie-Gewichte wurden aktualisiert.`;

  // State persistieren
  const newState: LearningState = {
    ...state,
    lastAnalyzed: new Date().toISOString(),
    learningCycles: state.learningCycles + 1,
    totalTradesAnalyzed: totalTrades,
    symbolPerformance: symbolPerf,
    strategyAdjustments: stratAdj,
    predictionAccuracy: predAccuracy,
    pendingPredictions: state.pendingPredictions,
    insights,
  };
  writeLearningState(newState);

  return {
    version: "V1.0",
    analyzedAt: new Date().toISOString(),
    learningCycles: newState.learningCycles,
    totalTradesAnalyzed: totalTrades,
    newTradesThisCycle: Math.max(0, newTrades),
    symbolPerformance: symbolPerf,
    strategyAdjustments: stratAdj,
    predictionAccuracy: predAccuracy,
    insights,
    status,
    nextAction,
  };
}

export function getLearningAdjustmentFactor(strategyName: string): number {
  const state = readLearningState();
  return state.strategyAdjustments[strategyName]?.adjustmentFactor ?? 1.0;
}

export function getLearningState(): LearningState {
  return readLearningState();
}
