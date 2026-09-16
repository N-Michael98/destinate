/**
 * ExecutionAgent — zuständig für Trade-Ausführung auf allen Brokern
 *
 * Eigener Claude AI Manager prüft vor jeder Ausführung:
 * - Ist das Signal noch valide? (Staleness-Check)
 * - Ist das Risiko im Rahmen?
 * - Soll Capital.com, IC Markets oder beide ausführen?
 *
 * Kommuniziert via Agent Bus.
 */

import Anthropic from "@anthropic-ai/sdk";
import { agentBus, meldeTorEntscheidung } from "./agent-bus";
import { executeCapitalDemoOrder, type ExecutionRequest, type ExecutionResult } from "../capital-com/capital-com-execution";

const AGENT_ID = "ExecutionAgent";

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface ExecutionAgentRequest extends ExecutionRequest {
  signalGeneratedAt?: string;  // ISO — für Staleness-Check
  skipAIValidation?: boolean;  // Notfall-Override
}

export interface ExecutionAgentResult {
  ok: boolean;
  capital?: ExecutionResult;
  icMarkets?: { ok: boolean; positionId?: string; error?: string };
  skippedByAI: boolean;
  aiReason: string;
  executedAt: string;
}

// ── AI Manager ────────────────────────────────────────────────────────────────

let aiClient: Anthropic | null = null;

function getAI(): Anthropic {
  if (!aiClient) aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return aiClient;
}

interface AIExecutionDecision {
  approve: boolean;
  brokers: ("CAPITAL" | "IC_MARKETS")[];
  reason: string;
  adjustedRiskPercent?: number;
}

// Zweite, wortgleiche Fassung — entfernt (08.09.). Siehe die Begründung in
// `lib/ai-gate/ai-gate-alert.ts`: dieselbe Entscheidung stand hier und in
// `orchestrator-agent.ts`, jede mit eigenem modul-scoped Zeitstempel.
async function alertAIGateFallback(gate: string, err: unknown): Promise<void> {
  const { meldeAIGateAusfall } = await import("../ai-gate/ai-gate-alert");
  await meldeAIGateAusfall(gate, err);
}

/**
 * Das Risiko, mit dem die Order WIRKLICH gerechnet wird (16.09.).
 *
 * DER FUND. Hier stand `riskPercent: aiDecision.adjustedRiskPercent ?? req.riskPercent`.
 * Der Orchestrator rechnet das Risiko sorgfaeltig — `min(Claude, maxRiskPerTrade)`,
 * danach die Volatilitaets-Kuerzung — und dieser eine Ausdruck ersetzte es
 * durch eine UNGEPRUEFTE Zahl aus einer Modellantwort. `capital-com-execution`
 * rechnet sie direkt in die Groesse um (`balance * riskPercent / 100`); danach
 * begrenzt nur noch MAX_SIZE. Eine Halluzination (5 statt 1) haette die
 * 1-%-Grenze des Nutzers UND die Volatilitaets-Kuerzung ausgehebelt.
 *
 * Dieselbe Fehlerklasse wie `riskScore ?? 50`: eine Zahl, die nicht gemessen
 * wurde, entscheidet ueber Geld.
 *
 * DIE REGEL. Die KI darf das Risiko SENKEN, nie erhoehen — ihr Auftrag im
 * Prompt lautet ohnehin nur "reduzieren". Alles, was keine endliche positive
 * Zahl ist, faellt auf den Orchestrator-Wert zurueck. Die Richtung ist damit
 * eindeutig: gegenueber vorher kann das Ergebnis nur KLEINER werden.
 */
export function wirksamesKiRisiko(
  angefragt: number,
  kiVorschlag: unknown,
): { risiko: number; hinweis: string | null } {
  if (kiVorschlag === undefined || kiVorschlag === null) return { risiko: angefragt, hinweis: null };
  if (typeof kiVorschlag !== "number" || !Number.isFinite(kiVorschlag) || kiVorschlag <= 0) {
    return { risiko: angefragt, hinweis: `KI-Risiko ${JSON.stringify(kiVorschlag)} unbrauchbar — es gilt ${angefragt} %` };
  }
  if (kiVorschlag > angefragt) {
    return { risiko: angefragt, hinweis: `KI wollte das Risiko ERHOEHEN (${kiVorschlag} > ${angefragt} %) — ignoriert, es gilt ${angefragt} %` };
  }
  if (kiVorschlag < angefragt) {
    return { risiko: kiVorschlag, hinweis: `KI senkt das Risiko ${angefragt} -> ${kiVorschlag} %` };
  }
  return { risiko: angefragt, hinweis: null };
}

/**
 * Wie alt ist das Signal? (16.09.)
 *
 * DER FUND. Die Regel "Signal-Alter > 300s → ABLEHNEN" stand im Prompt — aber
 * der Orchestrator setzte `signalGeneratedAt: new Date()` erst IM MOMENT DER
 * AUSFUEHRUNG. Das Alter war also immer ~0 s, und die Regel pruefte nichts.
 * Jetzt kommt der Zeitstempel vom Scan-Beginn (`analysisResult.scannedAt`) —
 * bewusst der fruehestmoegliche, damit das Alter eher zu hoch als zu niedrig
 * gerechnet wird.
 *
 * `null` = kein oder kein lesbarer Zeitstempel: dann wird nicht geurteilt.
 */
export const SIGNAL_MAX_ALTER_S = 300;

export function signalAlterSekunden(signalGeneratedAt: unknown, jetzt: number): number | null {
  if (typeof signalGeneratedAt !== "string" || !Number.isFinite(jetzt)) return null;
  const t = Date.parse(signalGeneratedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((jetzt - t) / 1000));
}

/**
 * Das Urteil der Ausfuehrungs-KI, geprueft (16.09.). Dieselbe Falle wie bei
 * Meta- und Orchestrator-KI: `!aiDecision.approve` ist fuer einen Text "false"
 * wahr. Nur `true` gibt frei; die Broker-Liste enthaelt nur bekannte Namen.
 */
export function pruefeAusfuehrungsUrteil(roh: unknown): AIExecutionDecision {
  const o = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  const lesbar = typeof o.approve === "boolean";
  const brokers = Array.isArray(o.brokers)
    ? o.brokers.filter((b): b is "CAPITAL" | "IC_MARKETS" => b === "CAPITAL" || b === "IC_MARKETS")
    : (undefined as unknown as AIExecutionDecision["brokers"]);
  return {
    approve: o.approve === true,
    brokers,
    reason: lesbar
      ? String(o.reason ?? "")
      : `Urteil unlesbar (approve=${JSON.stringify(o.approve ?? null)})`,
    adjustedRiskPercent: o.adjustedRiskPercent as number | undefined,
  };
}

async function askAIManager(req: ExecutionAgentRequest): Promise<AIExecutionDecision> {
  try {
    const signalAge = signalAlterSekunden(req.signalGeneratedAt, Date.now()) ?? "unbekannt";

    const ai = getAI();
    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `ExecutionAgent Validierung:
Symbol: ${req.symbol} ${req.direction}
Style: ${req.tradingStyle}
Confidence: ${req.confidence}%
Risk: ${req.riskPercent}%
Signal-Alter: ${signalAge}s

Prüfe:
1. Signal-Alter > 300s → ABLEHNEN (Signal zu alt)
2. Confidence < 70 → ABLEHNEN
3. Risk > 2% → Risk reduzieren auf 1.5%

Antworte NUR mit JSON:
{"approve":true,"brokers":["CAPITAL","IC_MARKETS"],"reason":"kurz","adjustedRiskPercent":${req.riskPercent}}`
      }]
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (json) return pruefeAusfuehrungsUrteil(JSON.parse(json));
  } catch (err) {
    console.warn(`[exec-agent] AI Manager Fehler — Fallback approve (${err})`);
    await alertAIGateFallback("ExecutionAgent", err);
  }
  // Fallback: beide Broker, kein Risiko-Override
  return { approve: true, brokers: ["CAPITAL", "IC_MARKETS"], reason: "fallback" };
}

// ── Hauptfunktion ─────────────────────────────────────────────────────────────

export async function runExecutionAgent(req: ExecutionAgentRequest): Promise<ExecutionAgentResult> {
  console.log(`[exec-agent] ${req.symbol} ${req.direction} confidence=${req.confidence}%`);

  // ── AI Validierung ─────────────────────────────────────────────────────────
  let aiDecision: AIExecutionDecision = { approve: true, brokers: ["CAPITAL", "IC_MARKETS"], reason: "skip-validation" };

  if (!req.skipAIValidation) {
    // Die Alters-Regel der KI im Code durchgesetzt (16.09.) — ein zu altes
    // Signal wird ohne Anfrage abgelehnt, damit Regel und Wirkung nie
    // auseinanderlaufen. Unbekanntes Alter: die KI urteilt wie bisher.
    const alter = signalAlterSekunden(req.signalGeneratedAt, Date.now());
    if (alter !== null && alter > SIGNAL_MAX_ALTER_S) {
      aiDecision = {
        approve: false,
        brokers: [],
        reason: `Signal zu alt (${alter} s > ${SIGNAL_MAX_ALTER_S} s seit Scan-Beginn)`,
      };
    } else {
      aiDecision = await askAIManager(req);
    }
  }

  if (!aiDecision.approve) {
    console.log(`[exec-agent] ❌ AI hat abgelehnt: ${aiDecision.reason}`);
    // Eine Ablehnung ist eine TOR-ENTSCHEIDUNG, kein geschlossener Trade (16.09.).
    // Hier stand `EXECUTION:TRADE_CLOSED` — es war aber nie ein Trade offen.
    meldeTorEntscheidung(AGENT_ID, {
      gate: "Ausfuehrungs-KI",
      symbol: req.symbol,
      direction: req.direction,
      approve: false,
      reason: String(aiDecision.reason ?? "ohne Begruendung"),
      confidence: req.confidence,
    });
    return {
      ok: false,
      skippedByAI: true,
      aiReason: aiDecision.reason,
      executedAt: new Date().toISOString(),
    };
  }

  // Zustimmung melden (16.09.). "fallback" (KI-Ausfall) und "skip-validation"
  // sind KEIN Urteil — sie heissen in der Bilanz Rueckfall.
  meldeTorEntscheidung(AGENT_ID, {
    gate: "Ausfuehrungs-KI",
    symbol: req.symbol,
    direction: req.direction,
    approve: true,
    reason: String(aiDecision.reason ?? ""),
    fallback: aiDecision.reason === "fallback" || aiDecision.reason === "skip-validation",
    confidence: req.confidence,
  });

  // Risiko-Anpassung durch AI — nur nach unten, siehe wirksamesKiRisiko().
  const kiRisiko = wirksamesKiRisiko(req.riskPercent, aiDecision.adjustedRiskPercent);
  if (kiRisiko.hinweis) console.log(`[exec-agent] ${req.symbol}: ${kiRisiko.hinweis}`);
  const effectiveReq: ExecutionRequest = {
    ...req,
    riskPercent: kiRisiko.risiko,
  };

  // Ohne gueltige Broker-Liste warf `.includes` hier eine TypeError und riss
  // den Orchestrator-Zyklus mit (16.09.). Es gilt dann derselbe Rueckfall wie
  // bei einem KI-Ausfall; IC bleibt ohnehin an die Einstellung gebunden.
  const brokers: string[] = Array.isArray(aiDecision.brokers)
    ? aiDecision.brokers
    : ["CAPITAL", "IC_MARKETS"];
  if (!Array.isArray(aiDecision.brokers)) {
    console.warn(`[exec-agent] ${req.symbol}: KI-Antwort ohne Broker-Liste — Rueckfall wie bei Ausfall`);
  }

  const useCapital = brokers.includes("CAPITAL");
  // ── IC Markets braucht eine ausdrückliche Freigabe (15.09.) ───────────────
  //
  // Hier stand nur `aiDecision.brokers.includes("IC_MARKETS")`. Der Rückfall
  // der KI lautet `brokers: ["CAPITAL", "IC_MARKETS"]` — und bei
  // `skipAIValidation` steht dasselbe fest im Code. IC bekam damit praktisch
  // jede Order, sobald nur die Sitzung stand.
  //
  // Das ist der ungeschützte Pfad: IC wird mit dem EIGENEN Kontostand
  // dimensioniert (19864.27 gegen 1562.14, also 12.7×), und keine der sieben
  // Schutzschichten sieht dieses Konto — sie rechnen alle mit der
  // Capital-Positionsliste und dem Capital-Kontostand. Vollständige
  // Begründung am Feld `icMarketsExecutionEnabled`.
  //
  // Die Einstellung steht UND-verknüpft davor, nicht anstelle: die KI darf IC
  // weiterhin ablehnen, aber nicht mehr allein freigeben. Standard AUS.
  const { getSettings } = await import("../settings/settings-store");
  const einstellungen = await getSettings().catch(() => null);
  const icFreigegeben = einstellungen?.botSettings?.icMarketsExecutionEnabled === true;
  const useIC = brokers.includes("IC_MARKETS") && icFreigegeben;
  if (brokers.includes("IC_MARKETS") && !icFreigegeben) {
    console.log(`[exec-agent] ℹ️ ${req.symbol}: IC Markets übersprungen — `
      + `Ausführung dort ist ausgeschaltet (Einstellungen → IC-Markets-Ausführung). `
      + `Nur Capital.com wird von den Schutzschichten erfasst.`);
  }

  // ── Parallel-Execution auf beiden Brokern ──────────────────────────────────
  const [capitalResult, icResult] = await Promise.all([
    useCapital ? executeCapitalDemoOrder(effectiveReq) : Promise.resolve(null),
    useIC ? executeICMarketsOrder(effectiveReq) : Promise.resolve(null),
  ]);

  const ok = (capitalResult?.ok ?? false) || (icResult?.ok ?? false);

  if (ok) {
    agentBus.publish({
      type: "EXECUTION:TRADE_OPENED",
      agentId: AGENT_ID,
      timestamp: new Date().toISOString(),
      payload: {
        symbol: req.symbol,
        direction: req.direction,
        confidence: req.confidence,
        tradingStyle: req.tradingStyle,
        capitalDealId: capitalResult?.dealId,
        icPositionId: icResult?.positionId,
        aiReason: aiDecision.reason,
        riskPercent: effectiveReq.riskPercent,
      },
    });
    console.log(`[exec-agent] ✅ ${req.symbol} ${req.direction} — Capital:${capitalResult?.ok ? capitalResult.dealId : "❌"} IC:${icResult?.ok ? icResult.positionId : "❌"}`);
  } else {
    // ── Der GRUND gehört ins Log (27.08.) ──────────────────────────────────
    //
    // Hier stand nur "Beide Broker fehlgeschlagen: SYMBOL". Beide Ergebnisse
    // tragen ein `error`-Feld, und es wurde verworfen. Schlägt eine Order fehl
    // — zu wenig Margin, Stop zu nah am Kurs, Grösse unter dem Minimum, Markt
    // geschlossen —, stand die Ursache NIRGENDS. Der Orchestrator meldet
    // danach `execResult.aiReason`, und das ist die Begründung der FREIGABE,
    // nicht der Fehler.
    //
    // Das ist die letzte Stelle der ganzen Kette: hier scheitert ein Signal,
    // das alle sieben Prüfungen bestanden hat. Ausgerechnet dort schwieg das
    // Log. `size` und `epic` stehen mit dabei — bei Broker-Ablehnungen wegen
    // Mindestgrösse oder Stop-Abstand ist genau das die Information, die man
    // braucht.
    const cap = capitalResult
      ? `Capital: ${capitalResult.error ?? "ohne Fehlermeldung"}`
        + (capitalResult.size ? ` (size=${capitalResult.size}, epic=${capitalResult.epic})` : "")
      : "Capital: nicht versucht";
    const ic = icResult
      ? `IC: ${icResult.error ?? "ohne Fehlermeldung"}`
      : "IC: nicht versucht";
    console.warn(`[exec-agent] ❌ Order fehlgeschlagen: ${req.symbol} ${req.direction} — ${cap} | ${ic}`);
  }

  return {
    ok,
    capital: capitalResult ?? undefined,
    icMarkets: icResult ?? undefined,
    skippedByAI: false,
    aiReason: aiDecision.reason,
    executedAt: new Date().toISOString(),
  };
}

// ── IC Markets Wrapper (lazy import um Zirkularität zu vermeiden) ─────────────

async function executeICMarketsOrder(req: ExecutionRequest): Promise<{ ok: boolean; positionId?: string; error?: string } | null> {
  try {
    const { isICMarketsConnected, getICMarketsSession } = await import("../icmarkets/icmarkets-session");
    if (!isICMarketsConnected()) return null;

    const { executeICMarketsOrder: icExecute } = await import("../icmarkets/icmarkets-execution");
    const icSession = getICMarketsSession();
    return await icExecute({
      ...req,
      accountBalance: icSession?.balance ?? req.accountBalance,
    });
  } catch (err) {
    console.warn(`[exec-agent] IC Markets Fehler: ${err}`);
    return { ok: false, error: String(err) };
  }
}
