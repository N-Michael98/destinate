export type ICMarketsDemoAuthConfig = {
  accountId?: string;
  server?: string;
  platform?: "MT5" | "cTrader";
  environment: "demo";
};

export type ICMarketsDemoAuthResult = {
  success: boolean;
  broker: "ic-markets";
  mode: "demo";
  status: "LOCKED" | "READY_FOR_BRIDGE" | "CONNECTED" | "ERROR";
  message: string;
};

export async function testICMarketsDemoAuth(
  config?: ICMarketsDemoAuthConfig
): Promise<ICMarketsDemoAuthResult> {
  if (!config?.accountId || !config?.server || !config?.platform) {
    return {
      success: false,
      broker: "ic-markets",
      mode: "demo",
      status: "READY_FOR_BRIDGE",
      message:
        "IC Markets demo credentials and platform bridge are not configured yet. MT5/cTrader bridge will be added later.",
    };
  }

  return {
    success: false,
    broker: "ic-markets",
    mode: "demo",
    status: "LOCKED",
    message:
      "IC Markets demo auth test is prepared but MT5/cTrader bridge calls remain locked in V7.4.",
  };
}