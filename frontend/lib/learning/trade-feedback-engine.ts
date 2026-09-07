import { PaperHistory } from "@/lib/paper-trading/paper-history";
import { getPrisma } from "../../app/lib/prisma";
import {
  readLearningState,
  writeLearningState,
  type LearningState,
  type SymbolLearning,
  type StrategyLearning,
} from "./learning-store";

// Strategie → Symbol mapping (selbe wie Evolution Engine)
const STRATEGY_SYMBOL_MAP: Record<string, string> = {
  "Risk-Off Trend":    "XAUUSD",
  "Momentum Breakout": "EURUSD",
  "Inventory Reaction":"NAS100",
};

// Backtest-Baseline (Fallback wenn Python offline)
const BACKTEST_BASELINE: Record<string, number> = {
  "Risk-Off Trend":    74,
  "Momentum Breakout": 68,
  "Inventory Reaction":61,
};

type ClosedTrade = {
  symbol: string;
  /** `null` = die Quelle hat keine lesbare Richtung geliefert (07.09.).
   *  Vorher war das Feld `"BUY" | "SELL"` — und genau deshalb musste jede
   *  Quelle eine Richtung ERFINDEN, wenn sie keine hatte. Siehe
   *  `lesbareRichtung()`. */
  direction: "BUY" | "SELL" | null;
  pnl: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
  closedAt: string;
};

/** Woraus soll gelernt werden? (24.08.)
 *
 * Bis heute gab es nur eine Quelle: die PAPIERHANDELS-Historie. Der Zyklus
 * lernte also aus simulierten Ergebnissen, während die echten Trades in der
 * `Trade`-Tabelle danebenlagen und nie angefasst wurden.
 *
 * Die beiden werden BEWUSST NICHT vermischt. Papier ist Simulation, echt ist
 * echt — ein gemeinsamer Topf würde eine Kennzahl erzeugen, der man nicht
 * ansieht, wie viel davon erfunden ist. Genau diese Sorte Vermischung ist der
 * Grund, warum hier überhaupt aufgeräumt wird. "beide" bleibt möglich, muss
 * aber ausdrücklich verlangt werden und steht im Bericht.
 */
export type LernQuelle = "echt" | "papier" | "beide";

/** BUY/SELL aus der freien Textspalte — oder `null`, wenn nicht lesbar (07.09.).
 *
 * `Trade.direction` ist in der Datenbank ein freier Text und wird von mehreren
 * Schreibern gefüllt. Bis heute stand hier
 *
 *     /^(SELL|SHORT)$/i.test(String(z.direction ?? "")) ? "SELL" : "BUY"
 *
 * — ein Zweiwege-Schalter ohne dritten Ausgang. Damit wurde aus einem leeren
 * Feld, aus `null` und aus dem ausdrücklichen "UNBEKANNT" ein **BUY**. Die
 * Begründung im Kommentar lautete, beide Quellen sollten "nicht unterschiedlich
 * raten" — geraten wurde also zugegebenermassen, nur einheitlich.
 *
 * `null` heisst ausdrücklich "nicht lesbar" und wird auch so weitergereicht.
 *
 * BEWUSST NICHT AUSSORTIERT — anders als beim fehlenden Markt (24.08.).
 * Nachgemessen statt vermutet: `ClosedTrade.direction` wird in dieser Datei
 * GESCHRIEBEN, aber von der Auswertung nirgends gelesen. Die Symbol-Statistik
 * in `analyzeTradeFeedback()` rechnet ausschliesslich mit `outcome` und `pnl`
 * (`wins`/`losses`/`winRate`/`totalPnl`), und der einzige Leser von
 * `.direction` weiter unten ist `p.direction` aus `PredictionRecord` — ein
 * anderes Objekt. Eine Zeile wegen der Richtung zu verwerfen würde also ein
 * ECHTES Ergebnis aus der Win-Rate entfernen, um ein Feld zu retten, das
 * niemand liest. Das wäre schlechter als der Fehler, der hier behoben wird.
 *
 * LONG/SHORT werden mitgelesen, weil der Broker-Pfad diese Wörter benutzt;
 * beides ist eindeutig und muss nicht geraten werden.
 */
export function lesbareRichtung(roh: unknown): "BUY" | "SELL" | null {
  if (typeof roh !== "string") return null;
  const t = roh.trim().toUpperCase();
  if (t === "SELL" || t === "SHORT") return "SELL";
  if (t === "BUY" || t === "LONG") return "BUY";
  return null;
}

/** Geschlossene Trades aus der ECHTEN Trade-Tabelle.
 *
 * `status !== "OPEN"` ist dasselbe Kriterium, das auch der Aufräum-Knopf im
 * Journal benutzt (app/api/trades/route.ts) — eine zweite Definition von
 * "geschlossen" wäre eine Fehlerquelle für sich.
 *
 * FEHLERTOLERANT MIT ABSICHT: ist die Datenbank nicht erreichbar, kommt eine
 * leere Liste zurück und es wird gemeldet. Der Lernzyklus soll später aus
 * einer Schleife laufen; eine Ausnahme von hier würde diese Schleife töten.
 * Das war am 19.08. schon einmal der Fall (Datenbank-Vorlauf in
 * instrumentation.ts).
 */
export async function echteGeschlosseneTrades(): Promise<ClosedTrade[]> {
  // Die Zeilenform wird ausdrücklich benannt: getPrisma() ist hier lose
  // typisiert, ohne Annotation wäre `z` ein `any` und jeder Tippfehler im
  // Feldnamen fiele erst zur Laufzeit auf.
  type Zeile = {
    market: string | null;
    direction: string | null;
    profitLoss: number | null;
    updatedAt: Date | null;
    createdAt: Date | null;
  };
  try {
    const db = getPrisma();
    const zeilen: Zeile[] = await db.trade.findMany({
      where: { status: { not: "OPEN" } },
      select: {
        market: true, direction: true, profitLoss: true,
        updatedAt: true, createdAt: true,
      },
      orderBy: { updatedAt: "asc" },
    });
    // Zeilen OHNE Markt fliegen raus (24.08.). Sie landeten sonst als Symbol
    // "UNKNOWN" in der Lerntabelle und bekämen dort eine Win-Rate und einen
    // Anpassungsfaktor — für einen Markt, den es nicht gibt. Ein Trade, der
    // sich keinem Instrument zuordnen lässt, lehrt nichts über ein Instrument.
    // Gemeldet statt still verworfen, sonst fehlt später die Erklärung für
    // eine abweichende Anzahl.
    const brauchbar = zeilen.filter((z) => (z.market ?? "").trim().length > 0);
    if (brauchbar.length !== zeilen.length) {
      console.warn(
        `[learning] ${zeilen.length - brauchbar.length} geschlossene Trades ohne Markt — nicht gelernt`
      );
    }
    // Die Richtung wird nicht mehr ERFUNDEN (07.09.).
    //
    // Hier stand: `/^(SELL|SHORT)$/i.test(…) ? "SELL" : "BUY"` — mit der
    // Begründung, beide Quellen sollten "nicht unterschiedlich raten". Genau
    // das war der Fehler: aus einem LEEREN Feld, aus `null` und aus
    // "UNBEKANNT" wurde damit ein **BUY**. Geraten wurde trotzdem, nur
    // einheitlich.
    //
    // Der Anlass ist konkret: der manuelle Journal-Abgleich legt für
    // Transaktionen ohne Journal-Zeile eine Zeile an, und deren Richtung ist
    // schlicht unbekannt — seit dem 03.09. steht dort ehrlich "UNBEKANNT"
    // statt eines fest verdrahteten "BUY". Diese Zeilen kamen hier als BUY
    // wieder heraus, und damit wäre die Ehrlichkeit von 03.09. an dieser
    // Stelle wieder zurückgedreht worden.
    //
    // Die Zeile BLEIBT (Begründung bei `lesbareRichtung()`: das Feld hat
    // keinen Leser, ihr `outcome` und `pnl` aber schon). Gemeldet wird
    // trotzdem — eine stille Lücke ist der Anfang der nächsten Vermutung.
    const ohneRichtung = brauchbar.filter((z) => lesbareRichtung(z.direction) === null).length;
    if (ohneRichtung > 0) {
      console.warn(
        `[learning] ${ohneRichtung} von ${brauchbar.length} geschlossenen Trades `
        + "ohne lesbare Richtung — Richtung bleibt unbekannt (Ergebnis zählt weiter)"
      );
    }
    return brauchbar.map((z) => {
      const pnl = typeof z.profitLoss === "number" ? z.profitLoss : 0;
      return {
        symbol: (z.market as string).trim(),
        direction: lesbareRichtung(z.direction),
        pnl,
        // Gleiche Schwelle wie im Papierpfad: ein Cent Rauschen ist kein
        // Gewinn und kein Verlust.
        outcome: pnl > 0.01 ? "WIN" : pnl < -0.01 ? "LOSS" : "BREAKEVEN",
        closedAt: (z.updatedAt ?? z.createdAt ?? new Date()).toISOString(),
      } as ClosedTrade;
    });
  } catch (e) {
    console.error(
      `[learning] ⚠️ echte Trades nicht lesbar — gelernt wird ohne sie: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    return [];
  }
}

function extractClosedTrades(slot = "capital"): ClosedTrade[] {
  const history = PaperHistory.getAll(slot);
  const trades: ClosedTrade[] = [];

  for (const event of history) {
    if (event.entity !== "POSITION") continue;
    if (event.event !== "POSITION_CLOSED" && event.event !== "POSITION_UPDATED") continue;

    const p = event.payload as Record<string, unknown>;
    const pnl = typeof p?.pnl === "number" ? p.pnl : 0;
    if (pnl === 0 && event.event !== "POSITION_CLOSED") continue;

    const symbol = typeof p?.symbol === "string" ? p.symbol : "UNKNOWN";
    // Derselbe Umbau wie im echten Pfad (07.09.) — hier stand:
    //
    //   typeof p?.direction === "string" ? p.direction as "BUY" | "SELL" : "BUY"
    //
    // Zwei Fehler in einer Zeile. Erstens wurde aus einem FEHLENDEN Feld ein
    // "BUY". Zweitens war `as "BUY" | "SELL"` eine Behauptung gegenüber dem
    // Compiler, keine Prüfung: ein "LONG" oder "UNBEKANNT" aus dem
    // Ereignis-Payload wurde unverändert durchgereicht und galt fortan als
    // gültige Richtung, obwohl es keine der beiden ist.
    //
    // Beide Quellen benutzen jetzt DIESELBE Funktion. Der alte Kommentar im
    // echten Pfad verlangte ausdrücklich, dass sie "nicht unterschiedlich
    // raten" — das Verlangen war richtig, nur die Umsetzung falsch: sie raten
    // jetzt gar nicht mehr, und zwar beide gleich.
    const direction = lesbareRichtung(p?.direction);
    const outcome: "WIN" | "LOSS" | "BREAKEVEN" =
      pnl > 0.01 ? "WIN" : pnl < -0.01 ? "LOSS" : "BREAKEVEN";

    trades.push({ symbol, direction, pnl, outcome, closedAt: event.timestamp });
  }

  return trades;
}

function calcAdjustmentFactor(actualWinRate: number, baselineWinRate: number, tradeCount: number): number {
  if (tradeCount < 3) return 1.0; // Zu wenig Daten
  const ratio = actualWinRate / Math.max(baselineWinRate, 1);
  // Clamp zwischen 0.5 (stark reduziert) und 1.5 (stark geboostet)
  return Math.min(1.5, Math.max(0.5, ratio));
}

function confidenceLevel(trades: number): "NONE" | "LOW" | "MEDIUM" | "HIGH" {
  if (trades < 3)  return "NONE";
  if (trades < 10) return "LOW";
  if (trades < 25) return "MEDIUM";
  return "HIGH";
}

function generateInsights(
  symbolPerf: Record<string, SymbolLearning>,
  stratAdj: Record<string, StrategyLearning>,
): string[] {
  const insights: string[] = [];

  // Bestes Symbol
  const syms = Object.entries(symbolPerf).filter(([, v]) => v.trades >= 3);
  if (syms.length > 0) {
    const best = syms.sort((a, b) => b[1].winRate - a[1].winRate)[0];
    insights.push(`${best[0]} zeigt beste Performance: ${best[1].winRate.toFixed(0)}% Win-Rate über ${best[1].trades} Trades.`);
    const worst = syms.sort((a, b) => a[1].winRate - b[1].winRate)[0];
    if (worst[0] !== best[0]) {
      insights.push(`${worst[0]} hat schwache Performance (${worst[1].winRate.toFixed(0)}% Win-Rate) — Strategie wird automatisch reduziert.`);
    }
  }

  // Strategie-Abweichungen
  for (const [name, s] of Object.entries(stratAdj)) {
    if (s.confidence === "NONE") continue;
    const diff = s.actualWinRate - s.backtestWinRate;
    if (diff > 5) {
      insights.push(`${name}: Echte Win-Rate (${s.actualWinRate.toFixed(0)}%) übertrifft Backtest (${s.backtestWinRate}%) → Strategie wird geboostet.`);
    } else if (diff < -5) {
      insights.push(`${name}: Echte Win-Rate (${s.actualWinRate.toFixed(0)}%) unter Backtest (${s.backtestWinRate}%) → Evolution-Überprüfung ausgelöst.`);
    }
  }

  if (insights.length === 0) {
    insights.push("Noch zu wenige abgeschlossene Trades für verlässliche Insights. Mindestens 3 Trades pro Symbol nötig.");
  }

  return insights;
}

export type LearningAnalysisReport = {
  version: string;
  analyzedAt: string;
  learningCycles: number;
  totalTradesAnalyzed: number;
  newTradesThisCycle: number;
  symbolPerformance: Record<string, SymbolLearning>;
  strategyAdjustments: Record<string, StrategyLearning>;
  predictionAccuracy: LearningState["predictionAccuracy"];
  insights: string[];
  status: "LEARNING" | "WARMING_UP" | "NO_DATA";
  nextAction: string;
  /** Woraus wurde gelernt (24.08.).
   *
   * Steht ABSICHTLICH im Bericht: bis heute lernte der Zyklus still aus der
   * Papierhandels-Historie, und dem Bericht sah man das nicht an. Wer eine
   * Kennzahl liest, muss erkennen können, ob sie aus echten oder simulierten
   * Trades stammt. */
  quelle: LernQuelle;
};

export async function runLearningCycle(
  slots = ["capital", "broker2"],
  quelle: LernQuelle = "echt",
): Promise<LearningAnalysisReport> {
  const state = readLearningState();

  // QUELLE (24.08.). Vorher wurde ausschliesslich aus der Papierhandels-
  // Historie gelernt — also aus Simulationen, während die echten Trades
  // danebenlagen. Standard ist jetzt "echt"; Papier muss ausdrücklich
  // verlangt werden und steht im Bericht, damit niemand eine simulierte
  // Kennzahl für eine gemessene hält.
  const allTrades: ClosedTrade[] = [];
  if (quelle === "echt" || quelle === "beide") {
    allTrades.push(...(await echteGeschlosseneTrades()));
  }
  if (quelle === "papier" || quelle === "beide") {
    for (const slot of slots) {
      try { allTrades.push(...extractClosedTrades(slot)); } catch { /* skip */ }
    }
  }
  console.log(
    `[learning] Zyklus mit Quelle "${quelle}": ${allTrades.length} geschlossene Trades`
  );

  const newTrades = allTrades.length - state.totalTradesAnalyzed;

  // Symbol-Performance berechnen
  const symbolPerf: Record<string, SymbolLearning> = {};
  const symbolGroups: Record<string, ClosedTrade[]> = {};

  for (const t of allTrades) {
    if (!symbolGroups[t.symbol]) symbolGroups[t.symbol] = [];
    symbolGroups[t.symbol].push(t);
  }

  for (const [symbol, trades] of Object.entries(symbolGroups)) {
    const wins   = trades.filter(t => t.outcome === "WIN").length;
    const losses = trades.filter(t => t.outcome === "LOSS").length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const avgPnl   = trades.length > 0 ? totalPnl / trades.length : 0;

    // Baseline: wenn dieses Symbol in Backtest war, nutze dessen Win-Rate
    const baselineWinRate = 50; // neutral baseline per symbol
    const factor = calcAdjustmentFactor(winRate, baselineWinRate, trades.length);

    symbolPerf[symbol] = {
      trades: trades.length,
      wins,
      losses,
      winRate: Math.round(winRate * 10) / 10,
      avgPnl: Math.round(avgPnl * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      adjustmentFactor: Math.round(factor * 100) / 100,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Strategy Adjustments berechnen
  const stratAdj: Record<string, StrategyLearning> = {};
  for (const [stratName, symbol] of Object.entries(STRATEGY_SYMBOL_MAP)) {
    const symPerf = symbolPerf[symbol];
    const baselineWinRate = BACKTEST_BASELINE[stratName] ?? 60;
    const actualWinRate = symPerf?.winRate ?? 0;
    const tradeCount = symPerf?.trades ?? 0;
    const factor = calcAdjustmentFactor(actualWinRate, baselineWinRate, tradeCount);

    stratAdj[stratName] = {
      strategy: stratName,
      backtestWinRate: baselineWinRate,
      actualWinRate: tradeCount > 0 ? actualWinRate : 0,
      adjustmentFactor: Math.round(factor * 100) / 100,
      confidence: confidenceLevel(tradeCount),
      trades: tradeCount,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Prediction Accuracy aus pending predictions auflösen
  const predAccuracy = state.predictionAccuracy;
  const resolvedPreds = state.pendingPredictions.filter(p => {
    if (p.resolved) return false;
    // Finde passenden abgeschlossenen Trade für dieses Symbol
    const match = allTrades.find(t =>
      t.symbol === p.symbol &&
      new Date(t.closedAt) > new Date(p.timestamp)
    );
    if (!match) return false;
    const correct = (p.direction === "BUY" && match.outcome === "WIN") ||
                    (p.direction === "SELL" && match.outcome === "WIN");
    p.resolved = true;
    p.correct = correct;
    predAccuracy[p.source].total++;
    if (correct) predAccuracy[p.source].correct++;
    predAccuracy[p.source].accuracy = predAccuracy[p.source].total > 0
      ? Math.round((predAccuracy[p.source].correct / predAccuracy[p.source].total) * 100)
      : 0;
    return true;
  });

  const insights = generateInsights(symbolPerf, stratAdj);

  const totalTrades = allTrades.length;
  const status: LearningAnalysisReport["status"] =
    totalTrades === 0 ? "NO_DATA" :
    totalTrades < 5  ? "WARMING_UP" : "LEARNING";

  // Der Text muss zur QUELLE passen (24.08.): "Starte Paper Trading" wäre bei
  // Quelle "echt" ein falscher Rat — dort fehlen geschlossene ECHTE Trades,
  // und die entstehen durch Handeln, nicht durch Simulieren.
  const nextAction =
    status === "NO_DATA"
      ? (quelle === "papier"
          ? "Starte Paper Trading um Lern-Daten zu sammeln."
          : "Noch keine geschlossenen Trades in der Datenbank — es gibt nichts zu lernen.") :
    status === "WARMING_UP"  ? `${5 - totalTrades} weitere Trades bis verlässliche Anpassungen möglich sind.` :
    `${newTrades} neue Trades analysiert — Strategie-Gewichte wurden aktualisiert.`;

  // State persistieren
  const newState: LearningState = {
    ...state,
    lastAnalyzed: new Date().toISOString(),
    learningCycles: state.learningCycles + 1,
    totalTradesAnalyzed: totalTrades,
    symbolPerformance: symbolPerf,
    strategyAdjustments: stratAdj,
    predictionAccuracy: predAccuracy,
    pendingPredictions: state.pendingPredictions,
    insights,
  };
  writeLearningState(newState);

  return {
    version: "V1.0",
    analyzedAt: new Date().toISOString(),
    learningCycles: newState.learningCycles,
    totalTradesAnalyzed: totalTrades,
    newTradesThisCycle: Math.max(0, newTrades),
    symbolPerformance: symbolPerf,
    strategyAdjustments: stratAdj,
    predictionAccuracy: predAccuracy,
    insights,
    status,
    nextAction,
    quelle,
  };
}

export function getLearningAdjustmentFactor(strategyName: string): number {
  const state = readLearningState();
  return state.strategyAdjustments[strategyName]?.adjustmentFactor ?? 1.0;
}

export function getLearningState(): LearningState {
  return readLearningState();
}
