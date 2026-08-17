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
  /** Märkte meiden, die der Walk-Forward als überangepasst meldet (04.08.).
   *  Der Walk-Forward optimiert auf einem Abschnitt der Historie und misst auf
   *  dem folgenden, ungesehenen; bricht ein Markt dabei ein, war der gute Wert
   *  blosse Kurvenanpassung. Bis zur Einführung dieser Einstellung wurden die
   *  Ergebnisse NUR im Telegram-Bericht angezeigt und beeinflussten den Handel
   *  nie. false = anzeigen, aber nicht sperren (Standard, unverändertes
   *  Verhalten). true = betroffene Märkte überspringen.
   *  ACHTUNG: die Aussagekraft hängt an der Zahl der Out-of-Sample-Trades. Im
   *  Lauf vom 03.08. lagen die zwischen 3 und 44 — das ist dünn. Vor dem
   *  Einschalten einen Lauf mit mehr Daten abwarten. */
  blockOverfitMarkets: boolean;
  /** Gemessener Konsens darf handeln, wenn GPT "WAIT" sagt (04.08.).
   *  Bis dahin war GPTs Urteil absolut: sagte es WAIT, war der Markt erledigt,
   *  egal was TA-Lib, die sechzehn Strategien und die Entry-Quality messen.
   *  true = ein Trade entsteht auch ohne GPT-Richtung, aber NUR wenn alle vier
   *  zutreffen: TA-Lib meldet STRONG_BUY/STRONG_SELL, der Strategie-Konsens
   *  zeigt dieselbe Richtung mit Confidence >= 70, die Entry-Quality zeigt
   *  dieselbe Richtung mit Tier GOOD oder EXCELLENT, und GPT sagt WAIT statt
   *  der Gegenrichtung (ein Widerspruch bleibt bindend). Alle sieben
   *  nachgelagerten Tore gelten unverändert.
   *  false = GPT behält das letzte Wort (Standard, unverändertes Verhalten). */
  allowMeasuredConsensus: boolean;
}

/**
 * Untergrenze für die Confidence eines Signals (13.08.).
 *
 * WOZU. Der Regler "Auto-Approve Threshold" liess Werte von 50 bis 99 zu. Bevor
 * ein Signal diesen Regler überhaupt erreicht, wird es aber schon verworfen:
 * die Signalkette verlangt an DREI Stellen `confidence >= 70`
 *   ai-analysis-engine.ts  simulateClaude (approved)
 *   ai-analysis-engine.ts  goSignal
 *   analysis-agent.ts      Filterung der goSignals
 * Werte zwischen 50 und 69 hatten deshalb KEINERLEI Wirkung — der Regler zeigte
 * eine Einstellmöglichkeit an, die es nicht gab.
 *
 * Die Zahl steht jetzt an EINER Stelle und wird von allen benutzt: von den drei
 * Riegeln, vom Regler als Minimum, und vom Orchestrator, der warnt, wenn ein
 * gespeicherter Wert darunter liegt.
 *
 * BEWUSST NICHT GESENKT. Die 70 tiefer zu legen wäre kein Anzeigefehler mehr,
 * sondern eine Erhöhung des Risikos: es würden Signale gehandelt, die das System
 * bisher als zu unsicher verworfen hat. Das ist eine Entscheidung des Nutzers,
 * keine Aufräumarbeit.
 */
export const MIN_SIGNAL_CONFIDENCE = 70;

export interface RiskSettings {
  maxRiskPerTradePct: number;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
  maxExposurePct: number;
  minConfidenceScore: number;
  /** Wochenverlust-Grenze in % (13.08.).
   *
   *  Stand bis heute als Standardwert direkt in der Signatur von
   *  checkWeeklyLossLimit (6.0) und wurde vom einzigen Aufrufer nicht
   *  uebergeben — der Wert war damit nirgends einstellbar. Seine beiden
   *  Geschwister sind es seit jeher: Tagesverlust 3 % und Gesamt-Drawdown
   *  10 % stehen in den Einstellungen. Nur der Wochenwert nicht. */
  maxWeeklyLossPct: number;

  // ── Ausstiegs-Schwellen relativ zum Stop (Stufe 2, 10.08.) ────────────────
  //
  // Breakeven, Teilgewinn und Trailing lösen bisher bei FESTEN Kursprozenten
  // aus (risk-agent.ts getStyleThresholds: 0,5 % / 1,0 % / 1,5 % bei
  // DAYTRADING). Der Stop ist aber 1,5 × ATR — und ATR im Verhältnis zum Kurs
  // liegt zwischen den Märkten weit auseinander. Gemessen am 10.08. über alle
  // 30 Symbole (ATR(14) auf Tageskerzen): der Breakeven greift bei UKOIL nach
  // 0,06 R, bei EURGBP erst nach 1,04 R — Faktor 17,6. Dieselbe Regel wirkt in
  // 29 von 30 Märkten, BEVOR der Trade seinen eigenen Einsatz verdient hat.
  //
  // Ist der Schalter an, zählen die Schwellen in R (Vielfache des
  // Stop-Abstands) statt in Kursprozent. Damit wirkt dieselbe Regel in jedem
  // Markt gleich.
  //
  // STANDARD AUS: das ändert Handelsverhalten. Solange der Schalter aus ist,
  // läuft alles exakt wie bisher.
  exitThresholdsRelativeToStop: boolean;
  // Vielfache des Stop-Abstands. 1 R = der Trade hat genau seinen Einsatz
  // verdient. Verankert am Ziel, das der Code selbst setzt: takeProfit liegt
  // bei 2 R (ai-analysis-engine.ts).
  breakevenAtR: number;
  partialAtR: number;
  trailAtR: number;
}

export interface SystemSettings {
  version: string;
  botSettings: BotSettings;
  riskSettings: RiskSettings;
  connections: BrokerConnection[];
  updatedAt: string;
}
