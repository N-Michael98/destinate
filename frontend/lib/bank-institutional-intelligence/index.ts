import type {
  BankInstitutionalIntelligenceReport,
  InstitutionalIntelligenceSignal,
  InstitutionalSource,
} from "./bank-institutional-types";

const institutionalSources: InstitutionalSource[] = [
  {
    id: "source-fed",
    name: "Federal Reserve",
    type: "CENTRAL_BANK",
    region: "United States",
    focusAreas: ["Interest Rates", "Inflation", "Labor Market", "Monetary Policy"],
    supportedMarkets: ["USD", "US500", "NAS100", "US30", "XAUUSD", "US Bonds"],
    impactLevel: "CRITICAL",
    sourceUsage: "Use FOMC statements, dot plot, speeches and policy decisions for USD and index macro bias.",
    officialSourceUrl: "https://www.federalreserve.gov",
  },
  {
    id: "source-ecb",
    name: "European Central Bank",
    type: "CENTRAL_BANK",
    region: "Eurozone",
    focusAreas: ["Interest Rates", "Inflation", "Eurozone Growth", "Monetary Policy"],
    supportedMarkets: ["EUR", "DAX", "EU Stocks", "EUR Bonds", "EURUSD"],
    impactLevel: "CRITICAL",
    sourceUsage: "Use policy statements, press conferences and rate decisions for EUR and European equity bias.",
    officialSourceUrl: "https://www.ecb.europa.eu",
  },
  {
    id: "source-snb",
    name: "Swiss National Bank",
    type: "CENTRAL_BANK",
    region: "Switzerland",
    focusAreas: ["CHF Policy", "Inflation", "Currency Stability", "Rates"],
    supportedMarkets: ["CHF", "EURCHF", "USDCHF", "Swiss Market"],
    impactLevel: "HIGH",
    sourceUsage: "Use SNB policy decisions and currency guidance for CHF risk and safe-haven analysis.",
    officialSourceUrl: "https://www.snb.ch",
  },
  {
    id: "source-boe",
    name: "Bank of England",
    type: "CENTRAL_BANK",
    region: "United Kingdom",
    focusAreas: ["GBP Policy", "Inflation", "Rates", "Financial Stability"],
    supportedMarkets: ["GBP", "FTSE100", "GBPUSD", "EURGBP"],
    impactLevel: "HIGH",
    sourceUsage: "Use rate decisions and monetary policy reports for GBP and UK index bias.",
    officialSourceUrl: "https://www.bankofengland.co.uk",
  },
  {
    id: "source-boj",
    name: "Bank of Japan",
    type: "CENTRAL_BANK",
    region: "Japan",
    focusAreas: ["JPY Policy", "Yield Curve Control", "Rates", "Inflation"],
    supportedMarkets: ["JPY", "USDJPY", "Nikkei", "Japan Bonds"],
    impactLevel: "HIGH",
    sourceUsage: "Use BoJ policy changes and yield guidance for JPY and Asian market risk.",
    officialSourceUrl: "https://www.boj.or.jp",
  },
  {
    id: "source-jpmorgan",
    name: "JPMorgan",
    type: "MAJOR_BANK",
    region: "Global",
    focusAreas: ["Market Outlook", "Equities", "Rates", "Credit", "Macro"],
    supportedMarkets: ["US500", "NAS100", "USD", "Commodities", "Global Equities"],
    impactLevel: "HIGH",
    sourceUsage: "Use market outlooks and institutional research as secondary sentiment confirmation.",
    officialSourceUrl: "https://www.jpmorgan.com",
  },
  {
    id: "source-goldman",
    name: "Goldman Sachs",
    type: "MAJOR_BANK",
    region: "Global",
    focusAreas: ["Macro Research", "Equity Strategy", "Commodities", "Rates"],
    supportedMarkets: ["US500", "NAS100", "XAUUSD", "Oil", "USD"],
    impactLevel: "HIGH",
    sourceUsage: "Use macro and strategy commentary as confirmation for risk-on or risk-off regimes.",
    officialSourceUrl: "https://www.goldmansachs.com",
  },
  {
    id: "source-ubs",
    name: "UBS",
    type: "MAJOR_BANK",
    region: "Switzerland / Global",
    focusAreas: ["Wealth Management", "Macro Outlook", "FX", "Equities"],
    supportedMarkets: ["CHF", "EURCHF", "USDCHF", "European Equities", "Global Equities"],
    impactLevel: "MEDIUM",
    sourceUsage: "Use UBS outlooks for CHF, European assets and global portfolio bias.",
    officialSourceUrl: "https://www.ubs.com",
  },
  {
    id: "source-deutsche-bank",
    name: "Deutsche Bank",
    type: "MAJOR_BANK",
    region: "Germany / Global",
    focusAreas: ["European Macro", "Rates", "FX", "Credit"],
    supportedMarkets: ["EUR", "DAX", "EURUSD", "European Bonds"],
    impactLevel: "MEDIUM",
    sourceUsage: "Use European macro and rates commentary for DAX and EUR bias.",
    officialSourceUrl: "https://www.db.com",
  },
  {
    id: "source-imf",
    name: "International Monetary Fund",
    type: "GLOBAL_INSTITUTION",
    region: "Global",
    focusAreas: ["Global Growth", "Inflation", "Debt Risk", "Financial Stability"],
    supportedMarkets: ["Global Equities", "FX", "Commodities", "Bonds"],
    impactLevel: "HIGH",
    sourceUsage: "Use IMF reports for long-term macro regime and global risk analysis.",
    officialSourceUrl: "https://www.imf.org",
  },
  {
    id: "source-bis",
    name: "Bank for International Settlements",
    type: "GLOBAL_INSTITUTION",
    region: "Global",
    focusAreas: ["Banking Risk", "Liquidity", "Financial Stability", "Credit Conditions"],
    supportedMarkets: ["Bonds", "FX", "Global Equities", "Banking Sector"],
    impactLevel: "HIGH",
    sourceUsage: "Use BIS publications for liquidity risk, banking stress and systemic risk context.",
    officialSourceUrl: "https://www.bis.org",
  },
  {
    id: "source-oecd",
    name: "OECD",
    type: "GLOBAL_INSTITUTION",
    region: "Global",
    focusAreas: ["Economic Outlook", "Growth", "Inflation", "Employment"],
    supportedMarkets: ["Global Equities", "FX", "Bonds"],
    impactLevel: "MEDIUM",
    sourceUsage: "Use OECD outlooks for slower-moving macro learning context.",
    officialSourceUrl: "https://www.oecd.org",
  },
];

const simulatedSignals: InstitutionalIntelligenceSignal[] = [
  {
    id: "institutional-signal-fed-risk-check",
    sourceId: "source-fed",
    sourceName: "Federal Reserve",
    sourceType: "CENTRAL_BANK",
    region: "United States",
    marketBias: "NEUTRAL",
    affectedMarkets: ["USD", "US500", "NAS100", "XAUUSD"],
    confidenceImpact: 2,
    riskImpact: 3,
    strategyImpact: 1,
    impactLevel: "CRITICAL",
    reason: "Federal Reserve source is critical for USD, US indices and gold. Use as macro confirmation before increasing exposure.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "institutional-signal-ecb-eur-check",
    sourceId: "source-ecb",
    sourceName: "European Central Bank",
    sourceType: "CENTRAL_BANK",
    region: "Eurozone",
    marketBias: "NEUTRAL",
    affectedMarkets: ["EUR", "DAX", "EURUSD"],
    confidenceImpact: 1,
    riskImpact: 2,
    strategyImpact: 1,
    impactLevel: "CRITICAL",
    reason: "ECB source is critical for EUR and European indices. Use before EUR or DAX strategy confirmation.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "institutional-signal-bis-risk-context",
    sourceId: "source-bis",
    sourceName: "Bank for International Settlements",
    sourceType: "GLOBAL_INSTITUTION",
    region: "Global",
    marketBias: "RISK_OFF",
    affectedMarkets: ["Global Equities", "Bonds", "FX"],
    confidenceImpact: -1,
    riskImpact: 4,
    strategyImpact: -1,
    impactLevel: "HIGH",
    reason: "BIS source can warn about financial stability and liquidity stress. Use as risk overlay for portfolio exposure.",
    createdAt: new Date().toISOString(),
  },
];

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export function getBankInstitutionalIntelligenceReport(): BankInstitutionalIntelligenceReport {
  const centralBankSources = institutionalSources.filter(
    (source) => source.type === "CENTRAL_BANK",
  ).length;

  const majorBankSources = institutionalSources.filter(
    (source) => source.type === "MAJOR_BANK",
  ).length;

  const globalInstitutionSources = institutionalSources.filter(
    (source) => source.type === "GLOBAL_INSTITUTION",
  ).length;

  const highImpactSignals = simulatedSignals.filter(
    (signal) => signal.impactLevel === "HIGH",
  ).length;

  const criticalImpactSignals = simulatedSignals.filter(
    (signal) => signal.impactLevel === "CRITICAL",
  ).length;

  const averageConfidenceImpact = average(
    simulatedSignals.map((signal) => signal.confidenceImpact),
  );

  const averageRiskImpact = average(
    simulatedSignals.map((signal) => signal.riskImpact),
  );

  const recommendation =
    criticalImpactSignals > 0
      ? "Critical institutional sources available. Use them as macro confirmation before increasing strategy confidence or portfolio exposure."
      : "Institutional source layer ready. Continue collecting source signals for macro learning context.";

  return {
    version: "V11.7.3",
    status: "READY",
    mode: "SIMULATION",
    totalSources: institutionalSources.length,
    centralBankSources,
    majorBankSources,
    globalInstitutionSources,
    totalSignals: simulatedSignals.length,
    highImpactSignals,
    criticalImpactSignals,
    averageConfidenceImpact,
    averageRiskImpact,
    sources: institutionalSources,
    signals: simulatedSignals,
    recommendation,
    integrationTarget: [
      "Outcome Learning",
      "Adaptive Confidence",
      "Portfolio Risk Management",
      "Strategy Weight Auto-Rebalancing",
      "Portfolio Brain",
      "News Intelligence",
    ],
    updatedAt: new Date().toISOString(),
  };
}
