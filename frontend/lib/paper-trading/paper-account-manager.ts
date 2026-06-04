import {
  PaperAccount,
  PaperPosition,
} from "./paper-types";

export class PaperAccountManager {
  createDemoAccount(): PaperAccount {
    return {
      balance: 30000,
      equity: 30000,
      realizedPnL: 0,
      unrealizedPnL: 0,
      openPositions: 0,
      currency: "CHF",
      updatedAt: new Date().toISOString(),
    };
  }

  updateFromPositions(
    account: PaperAccount,
    positions: PaperPosition[]
  ): PaperAccount {
    const openPositions =
      positions.filter(
        (position) => position.status === "OPEN"
      );

    const unrealizedPnL =
      openPositions.reduce(
        (sum, position) => sum + position.unrealizedPnL,
        0
      );

    return {
      ...account,

      unrealizedPnL: Number(unrealizedPnL.toFixed(2)),

      equity: Number(
        (account.balance + unrealizedPnL).toFixed(2)
      ),

      openPositions: openPositions.length,

      updatedAt: new Date().toISOString(),
    };
  }
}