import { ConsensusInput, ConsensusResult, ConsensusVote } from "./consensus-types";
import { VoteCalculator } from "./vote-calculator";
import { calculateConsensusConfidence } from "./confidence-engine";
import { validateTradePermission } from "./trade-validator";

function buildMarketDataVote(ready: boolean): ConsensusVote {
  return ready ? "BUY" : "WAIT";
}

function buildRegimeVote(trend: string): ConsensusVote {
  if (trend === "TRENDING_BULL") return "BUY";
  if (trend === "TRENDING_BEAR") return "SELL";
  if (trend === "VOLATILE") return "WAIT";

  return "WAIT";
}

function buildGptVote(bias: string): ConsensusVote {
  if (bias === "BULLISH") return "BUY";
  if (bias === "BEARISH") return "SELL";
  if (bias === "NEUTRAL") return "WAIT";

  return "WAIT";
}

function buildClaudeVote(approved: boolean): ConsensusVote {
  return approved ? "BUY" : "REJECT";
}

function buildReasoning(
  marketDataVote: ConsensusVote,
  regimeVote: ConsensusVote,
  gptVote: ConsensusVote,
  claudeVote: ConsensusVote,
  finalVote: ConsensusVote
): string {
  return `
Market Data Vote: ${marketDataVote}
Regime Vote: ${regimeVote}
GPT Vote: ${gptVote}
Claude Vote: ${claudeVote}
Final Vote: ${finalVote}
`.trim();
}

export function buildConsensus(input: ConsensusInput): ConsensusResult {
  const marketDataVote = buildMarketDataVote(input.marketDataReady);
  const regimeVote = buildRegimeVote(input.regimeTrend);
  const gptVote = buildGptVote(input.gptBias);
  const claudeVote = buildClaudeVote(input.claudeApproved);

  const votes = [marketDataVote, regimeVote, gptVote, claudeVote];

  const finalVote = VoteCalculator.calculate(votes);

  const confidence = calculateConsensusConfidence(
    votes,
    input.gptConfidence,
    input.claudeApproved
  );

  const approved = validateTradePermission(
    finalVote,
    input.claudeApproved,
    confidence
  );

  return {
    symbol: input.symbol,
    marketDataVote,
    regimeVote,
    gptVote,
    claudeVote,
    finalVote,
    confidence,
    reasoning: buildReasoning(
      marketDataVote,
      regimeVote,
      gptVote,
      claudeVote,
      finalVote
    ),
    approved,
    createdAt: new Date().toISOString(),
  };
}