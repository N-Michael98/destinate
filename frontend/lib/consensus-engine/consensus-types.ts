export type ConsensusVote = "BUY" | "SELL" | "WAIT" | "REJECT";

export interface ConsensusInput {
  symbol: string;
  marketDataReady: boolean;
  regimeTrend: string;
  gptBias: string;
  gptConfidence: number;
  claudeApproved: boolean;
  claudeRisk: string;
}

export interface ConsensusResult {
  symbol: string;
  marketDataVote: ConsensusVote;
  regimeVote: ConsensusVote;
  gptVote: ConsensusVote;
  claudeVote: ConsensusVote;
  finalVote: ConsensusVote;
  confidence: number;
  reasoning: string;
  approved: boolean;
  createdAt: string;
}