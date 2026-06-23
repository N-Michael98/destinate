import type { MarketSnapshot } from "./market-types";

export type MarketProviderStatus = {
  provider: string;
  status: "PREPARED" | "CONNECTED" | "DISCONNECTED" | "ERROR";
  message: string;
};

export async function getMarketProviderStatus(): Promise<MarketProviderStatus> {
  return {
    provider: "Capital.com Live",
    status: "CONNECTED",
    message: "Live prices via Capital.com API + Python Backend fallback.",
  };
}

// Kein Mock mehr — market-manager.ts nutzt echte Capital.com Preise
export async function getMockMarketPrices(): Promise<MarketSnapshot[]> {
  return [];
}
