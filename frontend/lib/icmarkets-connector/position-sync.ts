import { icMarketsClient } from "./icmarkets-client";
import { ICMarketsPosition } from "./icmarkets-types";

export class ICMarketsPositionSync {
  async getOpenPositions(): Promise<ICMarketsPosition[]> {
    return icMarketsClient.getOpenPositions();
  }

  async getExposureSummary() {
    const positions = await this.getOpenPositions();

    const totalFloatingPnL = positions.reduce(
      (sum, position) => sum + position.floatingPnL,
      0
    );

    const totalVolume = positions.reduce(
      (sum, position) => sum + position.volume,
      0
    );

    return {
      openPositions: positions.length,
      totalFloatingPnL,
      totalVolume,
      positions,
      updatedAt: new Date(),
    };
  }
}

export const icMarketsPositionSync =
  new ICMarketsPositionSync();