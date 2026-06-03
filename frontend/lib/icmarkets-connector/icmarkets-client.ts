import {
  ICMarketsAccountSnapshot,
  ICMarketsConfig,
  ICMarketsConnectionStatus,
  ICMarketsPosition,
} from "./icmarkets-types";

export class ICMarketsClient {
  private config: ICMarketsConfig;

  constructor(config?: Partial<ICMarketsConfig>) {
    this.config = {
      enabled: true,
      mode: "DEMO",
      readOnly: true,
      allowLiveOrders: false,
      server: process.env.ICMARKETS_SERVER,
      accountId: process.env.ICMARKETS_ACCOUNT_ID,
      apiKey: process.env.ICMARKETS_API_KEY,
      ...config,
    };
  }

  getConfig(): ICMarketsConfig {
    return this.config;
  }

  getStatus(): ICMarketsConnectionStatus {
    if (!this.config.enabled) return "DISCONNECTED";
    if (!this.config.server || !this.config.accountId) return "PREPARED";
    return "PREPARED";
  }

  async getAccountSnapshot(): Promise<ICMarketsAccountSnapshot> {
    return {
      broker: "IC_MARKETS",
      mode: this.config.mode,
      balance: 30000,
      equity: 30120,
      margin: 0,
      freeMargin: 30120,
      currency: "CHF",
      status: this.getStatus(),
      updatedAt: new Date(),
    };
  }

  async getOpenPositions(): Promise<ICMarketsPosition[]> {
    return [];
  }
}

export const icMarketsClient = new ICMarketsClient();