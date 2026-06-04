import { AgentMemory } from "./memory/agent-memory";
import { PaperHistory } from "@/lib/paper-trading/paper-history";

type AgentMemoryEntry = {
  id: string;
  type: string;
  symbol?: string;
  direction?: string;
  confidence?: number;
  approved?: boolean;
  executed?: boolean;
  consensusScore?: number;
  riskScore?: number;
  reason: string;
  payload: unknown;
  createdAt: string;
};

type PaperHistoryEvent = {
  id: string;
  type: string;
  entity: string;
  event: string;
  timestamp: string;
  payload: any;
};

export class AITradeOutcomeTracker {
  static analyze() {
    const memory = AgentMemory.getAll() as AgentMemoryEntry[];
    const history = PaperHistory.getAll() as PaperHistoryEvent[];

    const executedTrades = memory.filter(
      (item) => item.type === "AI_TRADE_EXECUTED"
    );

    const rejectedTrades = memory.filter(
      (item) => item.type === "AI_TRADE_REJECTED"
    );

    const positionUpdates = history.filter(
      (item) => item.type === "POSITION_UPDATED"
    );

    const positiveUpdates = positionUpdates.filter(
      (item) => Number(item.payload?.unrealizedPnL ?? 0) > 0
    );

    const negativeUpdates = positionUpdates.filter(
      (item) => Number(item.payload?.unrealizedPnL ?? 0) < 0
    );

    const totalUnrealizedPnL = positionUpdates.reduce(
      (sum, item) => sum + Number(item.payload?.unrealizedPnL ?? 0),
      0
    );

    const wins = positiveUpdates.length;
    const losses = negativeUpdates.length;
    const closedTrades = wins + losses;

    const winRate =
      closedTrades > 0
        ? Number(((wins / closedTrades) * 100).toFixed(2))
        : 0;

    const averagePnL =
      closedTrades > 0
        ? Number((totalUnrealizedPnL / closedTrades).toFixed(2))
        : 0;

    const outcomeQuality =
      executedTrades.length > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                winRate * 0.5 +
                  Number(
                    executedTrades.reduce(
                      (sum, item) => sum + Number(item.confidence ?? 0),
                      0
                    ) / executedTrades.length
                  ) *
                    0.3 +
                  Number(
                    executedTrades.reduce(
                      (sum, item) => sum + Number(item.consensusScore ?? 0),
                      0
                    ) / executedTrades.length
                  ) *
                    0.2
              )
            )
          )
        : 0;

    const recommendation =
      closedTrades === 0
        ? "No realized or updated trade outcomes yet. Run market updates to generate outcome data."
        : winRate >= 60
          ? "Outcome quality is positive. Continue collecting forward-test results."
          : "Outcome quality needs review. Reduce confidence and tighten risk validation.";

    return {
      version: "V10.3.8",
      totalAIMemories: memory.length,
      executedTrades: executedTrades.length,
      rejectedTrades: rejectedTrades.length,
      positionUpdates: positionUpdates.length,
      wins,
      losses,
      closedTrades,
      winRate,
      totalUnrealizedPnL,
      averagePnL,
      outcomeQuality,
      recommendation,
      latestOutcomeEvents: positionUpdates.slice(-10).reverse(),
      status: "analyzed",
      updatedAt: new Date().toISOString(),
    };
  }
}