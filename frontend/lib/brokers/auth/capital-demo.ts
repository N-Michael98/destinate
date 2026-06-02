export type CapitalDemoAuthConfig = {
  apiKey?: string;
  password?: string;
  identifier?: string;
  environment: "demo";
};

export type CapitalDemoAuthResult = {
  success: boolean;
  broker: "capital-com";
  mode: "demo";
  status: "LOCKED" | "READY_FOR_ENV" | "CONNECTED" | "ERROR";
  message: string;
};

export async function testCapitalDemoAuth(
  config?: CapitalDemoAuthConfig
): Promise<CapitalDemoAuthResult> {
  if (!config?.apiKey || !config?.password || !config?.identifier) {
    return {
      success: false,
      broker: "capital-com",
      mode: "demo",
      status: "READY_FOR_ENV",
      message:
        "Capital.com demo credentials are not configured. Add them later through .env.local, never directly in code.",
    };
  }

  return {
    success: false,
    broker: "capital-com",
    mode: "demo",
    status: "LOCKED",
    message:
      "Capital.com demo auth test is prepared but external API calls remain locked in V7.4.",
  };
}