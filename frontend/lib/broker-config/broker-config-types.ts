export type BrokerKey = "CAPITAL_COM" | "IC_MARKETS";
export type SymbolKey = "XAUUSD" | "EURUSD" | "NAS100" | "USOIL" | "BTCUSD" | "SPX500";
export type BotMode = "MANUAL" | "AUTO";
export type AccountMode = "DEMO" | "LIVE";

export interface BrokerSpreadLeverage {
  symbol: SymbolKey;
  symbolLabel: string;
  leverage: number;
  leverageLabel: string;
  spreadTypical: number;
  spreadUnit: string;
  commissionPerLot: number;
  marginPercent: number;
  notes: string;
}

export interface BrokerProfile {
  key: BrokerKey;
  name: string;
  shortName: string;
  regulation: string;
  accountMode: AccountMode;
  accountType: string;
  baseCurrency: string;
  commission: string;
  symbols: BrokerSpreadLeverage[];
  color: string;
}

export interface BrokerConnection {
  brokerKey: BrokerKey;
  connected: boolean;
  accountId: string | null;
  accountMode: AccountMode;
  lastConnectedAt: string | null;
  error: string | null;
}

export interface BotSettings {
  mode: BotMode;
  maxTradesPerDay: number;
  maxConcurrentPositions: number;
  autoApproveThreshold: number;
  pauseOnLoss: boolean;
  pauseOnLossPercent: number;
  tradeLimitEnabled: boolean;       // ON = enforce daily limit; OFF = unlimited
  tradeLimitBypassScore: number;    // When limit reached, still trade if score >= this
  maxTradesPerDayByStyle: {
    DAYTRADING: number;
    SCALPING: number;
    SWING: number;
  };
  // ── Pyramiding (30.07.) — mehrere Positionen im selben Markt ──────────────
  // Standard = aus / 1 Position pro Symbol, also exakt das bisherige Verhalten.
  // Erst wenn der User es in den Einstellungen aktiviert, ändert sich etwas.
  pyramidingEnabled: boolean;
  /** Obergrenze offener Positionen PRO SYMBOL (1 = kein Pyramiding). */
  maxPositionsPerSymbol: number;
  /** Mindest-Confidence für eine Nachkauf-Position. 0 = keine eigene Schwelle,
   *  dann gilt autoApproveThreshold (kein erfundener Zahlenwert im Code). */
  pyramidingMinConfidence: number;
  /** Höchstalter eines Kurses in Minuten, bis zu dem gehandelt werden darf
   *  (02.08.). 0 = Prüfung aus. Greift nur bei minutengenau bekanntem Alter —
   *  bei unbekanntem oder nur tagesgenauem Zeitstempel wird gewarnt, nicht
   *  blockiert, damit Instrumente ohne Minutendaten nicht grundlos ausfallen. */
  maxPriceAgeMinutes: number;
  /** Modellwahl für den Routine-Scan (03.08.). Der Scanner läuft alle 5 Minuten
   *  und schaltete das in der UI gewählte Modell BEDINGUNGSLOS auf das günstige
   *  Pendant herunter (gpt-4o → gpt-4o-mini, Sonnet → Haiku) — ohne Schalter,
   *  ohne Ausnahme. Die Modellwahl in den Einstellungen war für den Scan damit
   *  wirkungslos. false = sparen wie bisher (Standard, unverändertes Verhalten).
   *  true = das konfigurierte Modell wirklich verwenden. Kostet deutlich mehr
   *  (gpt-4o ≈ 6× mini), kann aber differenzierter entscheiden. */
  useFullModelsForScan: boolean;
}

export interface RiskSettings {
  maxRiskPerTradePct: number;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
  maxExposurePct: number;
  minConfidenceScore: number;
}

export interface SystemSettings {
  version: string;
  botSettings: BotSettings;
  riskSettings: RiskSettings;
  connections: BrokerConnection[];
  updatedAt: string;
}
