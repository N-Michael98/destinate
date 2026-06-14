import { dbGet, dbSet } from "../db-store";

export type SymbolLearning = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  adjustmentFactor: number;
  lastUpdated: string;
};

export type StrategyLearning = {
  strategy: string;
  backtestWinRate: number;
  actualWinRate: number;
  adjustmentFactor: number;
  confidence: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  trades: number;
  lastUpdated: string;
};

export type PredictionRecord = {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  source: "gpt" | "claude" | "consensus";
  confidence: number;
  timestamp: string;
  resolved: boolean;
  correct?: boolean;
};

export type LearningState = {
  version: string;
  lastAnalyzed: string;
  learningCycles: number;
  totalTradesAnalyzed: number;
  symbolPerformance: Record<string, SymbolLearning>;
  strategyAdjustments: Record<string, StrategyLearning>;
  predictionAccuracy: {
    gpt:       { correct: number; total: number; accuracy: number };
    claude:    { correct: number; total: number; accuracy: number };
    consensus: { correct: number; total: number; accuracy: number };
  };
  pendingPredictions: PredictionRecord[];
  insights: string[];
};

const DB_KEY = "learning-state";

const DEFAULT_STATE: LearningState = {
  version: "1.0",
  lastAnalyzed: new Date().toISOString(),
  learningCycles: 0,
  totalTradesAnalyzed: 0,
  symbolPerformance: {},
  strategyAdjustments: {},
  predictionAccuracy: {
    gpt:       { correct: 0, total: 0, accuracy: 0 },
    claude:    { correct: 0, total: 0, accuracy: 0 },
    consensus: { correct: 0, total: 0, accuracy: 0 },
  },
  pendingPredictions: [],
  insights: [],
};

declare global { var __learning_state__: LearningState | undefined; }

function getCache(): LearningState {
  return global.__learning_state__ ?? { ...DEFAULT_STATE };
}

function ensureLoaded() {
  if (global.__learning_state__ === undefined) {
    global.__learning_state__ = { ...DEFAULT_STATE };
    dbGet<LearningState>(DB_KEY, { ...DEFAULT_STATE }).then((data) => {
      global.__learning_state__ = data;
    }).catch(() => {});
  }
}

// Synchronous reads (backward compatible with existing callers)
export function readLearningState(): LearningState {
  ensureLoaded();
  return getCache();
}

export function writeLearningState(state: LearningState): void {
  global.__learning_state__ = state;
  dbSet(DB_KEY, state).catch(() => {});
}

export async function storePrediction(pred: Omit<PredictionRecord, "id" | "resolved">): Promise<void> {
  const state = readLearningState();
  state.pendingPredictions.push({
    ...pred,
    id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    resolved: false,
  });
  if (state.pendingPredictions.length > 200) {
    state.pendingPredictions = state.pendingPredictions.slice(-200);
  }
  writeLearningState(state);
}

export async function init(): Promise<void> {
  global.__learning_state__ = await dbGet<LearningState>(DB_KEY, { ...DEFAULT_STATE });
}
