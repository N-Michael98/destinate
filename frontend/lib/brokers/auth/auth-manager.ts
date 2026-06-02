import { testCapitalDemoAuth } from "./capital-demo";
import { testICMarketsDemoAuth } from "./icmarkets-demo";

export type DemoBroker = "capital-com" | "ic-markets";

export type DemoAuthManagerResult = {
  success: boolean;
  broker: DemoBroker;
  message: string;
};

export async function runDemoAuthCheck(
  broker: DemoBroker
): Promise<DemoAuthManagerResult> {
  if (broker === "capital-com") {
    const result = await testCapitalDemoAuth({
      apiKey: process.env.CAPITAL_COM_DEMO_API_KEY,
      password: process.env.CAPITAL_COM_DEMO_PASSWORD,
      identifier: process.env.CAPITAL_COM_DEMO_IDENTIFIER,
      environment: "demo",
    });

    return {
      success: result.success,
      broker,
      message: result.message,
    };
  }

  const result = await testICMarketsDemoAuth({
    accountId: process.env.IC_MARKETS_DEMO_ACCOUNT_ID,
    server: process.env.IC_MARKETS_DEMO_SERVER,
    platform:
      process.env.IC_MARKETS_DEMO_PLATFORM === "cTrader"
        ? "cTrader"
        : "MT5",
    environment: "demo",
  });

  return {
    success: result.success,
    broker,
    message: result.message,
  };
}