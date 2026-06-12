import fs from "fs";
import path from "path";

export type SymbolLearning = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  adjustmentFactor: number; // 1.0 = neutral, >1 = boost, <1 = reduce
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

const STORE_PATH = path.join(process.cwd(), "lib", "data", "learning-state.json");

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

export function readLearningState(): LearningState {
  try {
    if (!fs.existsSync(STORE_PATH)) return { ...DEFAULT_STATE };
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as LearningState;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeLearningState(state: LearningState): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

export function storePrediction(pred: Omit<PredictionRecord, "id" | "resolved">): void {
  const state = readLearningState();
  state.pendingPredictions.push({
    ...pred,
    id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    resolved: false,
  });
  // Keep last 200 predictions
  if (state.pendingPredictions.length > 200) {
    state.pendingPredictions = state.pendingPredictions.slice(-200);
  }
  writeLearningState(state);
}
