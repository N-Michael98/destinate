export type EvolutionDecision = {
  species: string;
  status: "PROTECTED" | "ACTIVE" | "REDUCED" | "ARCHIVED";
  governanceScore: number;
  reason: string;
};

export type AutonomousEvolutionPortfolioSignal = {
  topStrategy: string;
  championSpecies: string;
  bestMutation: string;
  bestHybrid: string;
  autonomousEvolutionScore: number;
  cycleDecision: string;
  memoryCycles: number;
  averageMemoryScore: number;
  strategyBias: string;
  allocationBias: string;
  riskMode: "EXPAND" | "NORMAL" | "REDUCE" | "PAUSE";
  portfolioAction: string;
};

export type ConsensusPortfolioSignal = {
  version: string;
  totalSymbols: number;
  eliteSymbols: number;
  approvedSymbols: number;
  strictSymbols: number;
  blockedSymbols: number;
  dualBrokerCheckSymbols: number;
  singleBrokerCheckSymbols: number;
  bestConsensusSymbol: string;
  bestConsensusMode: string;
  bestConsensusLevel: string;
  bestConsensusScore: number;
  bestConsensusGoCount: number;
  bestPortfolioRoute: string;
  bestBrokerRoutingMode: string;
  bestExecutionPriority: number;
  bestFinalPositionSize: number;
  portfolioPriority: "MAXIMUM" | "HIGH" | "REDUCED" | "ZERO";
  consensusRiskAdjustment: number;
  consensusAllocationBias:
    | "EXPAND_CONSENSUS_ALLOCATION"
    | "NORMAL_CONSENSUS_ALLOCATION"
    | "DEFENSIVE_CONSENSUS_ALLOCATION"
    | "BLOCK_CONSENSUS_ALLOCATION";
  recommendation: string;
};

export type PortfolioBrainEvolutionSyncReport = {
  version: "V16.1.4";
  status: "READY";

  championSpecies: string;

  protectedSpecies: number;
  activeSpecies: number;
  reducedSpecies: number;
  archivedSpecies: number;

  portfolioBias: string;
  portfolioRiskAdjustment: number;

  autonomousEvolutionSignal: AutonomousEvolutionPortfolioSignal;
  consensusPortfolioSignal: ConsensusPortfolioSignal;

  decisions: EvolutionDecision[];

  summary: string;
  createdAt: string;
};
