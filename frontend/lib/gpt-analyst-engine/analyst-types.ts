export type MarketBias =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export interface TradeIdea {
  symbol: string;

  bias: MarketBias;

  entryLow: number;
  entryHigh: number;

  stopLoss: number;

  takeProfit1: number;
  takeProfit2: number;

  /** OPTIONAL seit 15.09. — und das ist der Unterschied zum Claude-Risk-Pfad.
   *
   * Der ECHTE Weg hat eine Confidence: der Prompt in
   * `app/api/gpt-analyst/analyze/route.ts` verlangt ausdruecklich
   * `"confidence": 60-95`. Diese Zahl ist eine Modellantwort und bleibt.
   *
   * Der regelbasierte RUECKFALL (`gpt-analyst-manager.ts`) hatte dagegen
   * bedingungslos 80 eingesetzt — eine Behauptung, die im Dashboard neben der
   * echten stand und von ihr nicht zu unterscheiden war. Er setzt das Feld
   * jetzt gar nicht mehr, und die Anzeige zeigt dafuer "—".
   *
   * Nicht zu verwechseln mit `claude-risk-engine`: dort verlangt der Prompt
   * KEINE Confidence, weshalb das Feld dort ganz entfallen ist. */
  confidence?: number;

  reasoning: string;

  createdAt: string;
}