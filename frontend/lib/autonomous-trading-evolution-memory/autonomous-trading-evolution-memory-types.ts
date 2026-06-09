import { AutonomousTradingEvolutionReport } from "@/lib/autonomous-trading-evolution";

export type AutonomousTradingEvolutionMemoryEntry = {
  id: string;
  createdAt: string;
  version: string;
  cycleId: string;
  status: string;
  cycleDecision: string;
  topStrategy: string;
  bestMutation: string;
  bestHybrid: string;
  championSpecies: string;
  autonomousEvolutionScore: number;
  totalRankedStrategies: number;
  totalMutations: number;
  totalHybrids: number;
  totalSpecies: number;
  summary: string;
  payload: AutonomousTradingEvolutionReport;
};

export type AutonomousTradingEvolutionMemoryStats = {
  totalMemories: number;
  averageEvolutionScore: number;
  bestEvolutionScore: number;
  weakestEvolutionScore: number;
  latestTopStrategy: string;
  latestChampionSpecies: string;
  continueEvolutionCycles: number;
  reduceRiskCycles: number;
  pausedEvolutionCycles: number;
};

export type AutonomousTradingEvolutionMemoryReport = {
  version: "V16.0.2";
  status: "READY";
  stats: AutonomousTradingEvolutionMemoryStats;
  latestMemory: AutonomousTradingEvolutionMemoryEntry | null;
  memory: AutonomousTradingEvolutionMemoryEntry[];
  recommendation: string;
  updatedAt: string;
};
