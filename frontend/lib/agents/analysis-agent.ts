/**
 * AnalysisAgent — zuständig für Marktsignal-Analyse
 *
 * Aufgaben:
 * 1. Ruft bestehende analyzeMarkets (GPT + Claude + TA-Lib + Strategies) auf
 * 2. Eigener Meta-AI Manager bewertet Top-Kandidaten nochmal ganzheitlich
 * 3. Filtert schwache Signale heraus bevor sie den ExecutionAgent erreichen
 * 4. Publiziert alle Signale als Events auf den Bus
 *
 * Die bestehende Analyse-Engine bleibt unangetastet.
 */

import Anthropic from "@anthropic-ai/sdk";
import { agentBus } from "./agent-bus";
import { analyzeMarkets, type ScannerOpportunity } from "../market-scanner/ai-analysis-engine";
import type { CapitalMarket } from "../capital-com/capital-com-client";
import { MIN_SIGNAL_CONFIDENCE } from "../broker-config";

const AGENT_ID = "AnalysisAgent";

// ── AI Meta-Analyst ───────────────────────────────────────────────────────────

let aiClient: Anthropic | null = null;

function getAI(): Anthropic {
  if (!aiClient) aiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return aiClient;
}

interface MetaAnalysisDecision {
  approve: boolean;
  adjustedConfidence: number;
  concern: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

/** Einheitlicher Schlüssel für die Zuordnung Modellantwort → Kandidat (09.09.).
 *
 * Vorher wurde die Antwort unter `r.symbol` abgelegt und mit `opp.symbol`
 * gesucht — ein EXAKTER Zeichenvergleich. Schreibt das Modell "EUR/USD",
 * " EURUSD" oder "eurusd", findet die Suche nichts, und der Kandidat landet in
 * `if (!meta || !meta.approve)` — also in einer Ablehnung mit dem Text
 * "Meta-AI hat abgelehnt". Eine verfehlte Zuordnung war von einer echten
 * Ablehnung nicht zu unterscheiden.
 *
 * Entfernt wird alles, was keine Ziffer und kein Buchstabe ist, und der Rest
 * in Grossbuchstaben gesetzt. "EUR/USD", "eur usd" und "EURUSD" ergeben damit
 * denselben Schlüssel. Zwei VERSCHIEDENE Märkte fallen dabei nicht zusammen —
 * die Watchlist enthält keine zwei Symbole, die sich nur in Trennzeichen oder
 * Gross-/Kleinschreibung unterscheiden.
 */
export function schluessel(symbol: unknown): string {
  return String(symbol ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

async function runMetaAnalysis(candidates: ScannerOpportunity[]): Promise<Map<string, MetaAnalysisDecision>> {
  const decisions = new Map<string, MetaAnalysisDecision>();
  if (!candidates.length) return decisions;

  try {
    const ai = getAI();

    // Alle Top-Kandidaten in einem einzigen AI-Call bewerten (günstiger)
    const candidateSummary = candidates.map(c => ({
      symbol: c.symbol,
      direction: c.gpt.direction,
      confidence: c.gpt.confidence,
      finalScore: c.finalScore,
      taSignal: c.taSignals?.signal ?? "N/A",
      rsi: c.taSignals?.rsi ?? 0,
      trend: c.taSignals?.trend ?? "N/A",
      riskApproved: c.claude.approved,
      riskScore: c.claude.riskScore,
    }));

    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Meta-Analyse von ${candidates.length} Handelssignalen:

${JSON.stringify(candidateSummary, null, 2)}

Bewerte jeden Kandidaten. Achte auf:
- RSI Überkauft (>70 BUY = riskant) / Überverkauft (<30 SELL = riskant)
- TA-Signal muss mit Direction übereinstimmen
- Confidence < 72 → adjustedConfidence reduzieren
- Score < 0.65 → ablehnen

Antworte NUR mit JSON Array:
[{"symbol":"X","approve":true,"adjustedConfidence":75,"concern":"kurz","priority":"HIGH"}]`
      }]
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const json = text.match(/\[[\s\S]*\]/)?.[0];
    if (json) {
      const results = JSON.parse(json) as Array<MetaAnalysisDecision & { symbol: string }>;
      for (const r of results) {
        decisions.set(schluessel(r.symbol), {
          approve: r.approve,
          adjustedConfidence: r.adjustedConfidence,
          concern: r.concern,
          priority: r.priority,
        });
      }
      // ── Verfehlte Zuordnung MUSS auffallen (09.09.) ──────────────────────
      //
      // Die Entscheidungen werden unten mit `metaDecisions.get(opp.symbol)`
      // geholt, und ein Fehlschlag endet in `if (!meta || !meta.approve)` —
      // also in einer ABLEHNUNG mit dem Text "Meta-AI hat abgelehnt". Eine
      // nicht gefundene Antwort sah damit genau aus wie eine ablehnende.
      //
      // Das ist keine Kleinigkeit: gibt das Modell die Symbole in einer
      // anderen Schreibweise zurueck ("EUR/USD" statt "EURUSD") oder laesst es
      // eines aus, wird JEDER betroffene Kandidat verworfen — und im Log steht
      // eine Ablehnung, die nie stattgefunden hat. Deshalb wird jetzt
      // normalisiert (siehe `schluessel`) UND gemeldet, wenn trotzdem keine
      // einzige Zuordnung gelingt.
      const gefragt = candidates.map((c) => schluessel(c.symbol));
      const getroffen = gefragt.filter((s) => decisions.has(s)).length;
      if (results.length > 0 && getroffen === 0) {
        console.error(
          `[analysis-agent] ⛔ Meta-AI antwortete mit ${results.length} Urteilen, `
          + `aber KEINES passt zu einem Kandidaten. Geliefert: `
          + `[${results.map((r) => r.symbol).join(", ")}] — gefragt: `
          + `[${candidates.map((c) => c.symbol).join(", ")}]. Alle Kandidaten `
          + `wuerden jetzt als "abgelehnt" gelten, obwohl nichts abgelehnt wurde.`
        );
      } else if (getroffen < gefragt.length) {
        console.warn(
          `[analysis-agent] ⚠️ Meta-AI hat ${gefragt.length - getroffen} von `
          + `${gefragt.length} Kandidaten nicht beurteilt — diese gelten als abgelehnt`
        );
      }
    }
  } catch (err) {
    console.warn(`[analysis-agent] Meta-AI Fehler — alle Kandidaten approved (${err})`);
    // MELDEN, nicht nur loggen (08.09.).
    //
    // Dieser Rückfall öffnet das Tor GANZ: jeder Kandidat gilt als freigegeben,
    // die Gegenprüfung auf RSI-Extreme und TA-Widerspruch entfällt vollständig.
    // Am 08.09. lief genau das den ganzen Tag (leeres Anthropic-Guthaben) und
    // stand NUR in der Serverkonsole — über Telegram meldete sich allein der
    // Orchestrator, dessen Text zudem behauptete, die anderen Schichten seien
    // aktiv. `void` mit Absicht: die Meldung darf die Analyse nicht aufhalten
    // und nie mitreissen.
    void import("../ai-gate/ai-gate-alert")
      .then(({ meldeAIGateAusfall }) => meldeAIGateAusfall("Meta-KI", err))
      .catch(() => {});
    // Fallback: alle approven
    for (const c of candidates) {
      decisions.set(schluessel(c.symbol), {
        approve: true,
        adjustedConfidence: c.gpt.confidence,
        concern: "fallback",
        priority: "MEDIUM",
      });
    }
  }

  return decisions;
}

// ── Ergebnis-Typ ──────────────────────────────────────────────────────────────

export interface AnalysisAgentResult {
  opportunities: ScannerOpportunity[];       // alle gescannten
  approved: ScannerOpportunity[];            // bereit für ExecutionAgent
  rejected: Array<{ symbol: string; reason: string }>;
  metaDecisions: Map<string, MetaAnalysisDecision>;
  scannedAt: string;
  symbolCount: number;
}

// ── Hauptfunktion ─────────────────────────────────────────────────────────────

/**
 * Prüft die vom Meta-Schritt angepasste Confidence, statt sie zu übernehmen
 * (07.09.).
 *
 * `adjustedConfidence` kam bis heute ungeprüft aus der Modellantwort. Fehlte
 * das Feld, stand `undefined` in der Confidence — und der Riegel im
 * Orchestrator lautet `if (o.gpt.confidence < threshold)`. `undefined < 77` ist
 * **false**, das Signal wäre also nicht verworfen worden, sondern hätte die
 * Freigabeschwelle vollständig umgangen. Dieselbe Falle wie `NaN <= 0` beim
 * Kurs-Riegel am 24.08.
 *
 * Ein unbrauchbarer Wert lässt die Confidence deshalb UNVERÄNDERT — das ist der
 * konservative Ausgang: es gilt weiter, was GPT selbst gesagt hat, und die
 * Untergrenze der Signalkette greift danach wie bei jedem anderen Signal.
 * Brauchbare Werte werden auf 0–100 geklemmt; ausserhalb liegt kein sinnvoller
 * Prozentwert.
 */
export function gepruefteConfidence(roh: unknown, ausgangswert: number): number {
  const n = Number(roh);
  if (roh === null || roh === "" || !Number.isFinite(n)) return ausgangswert;
  return Math.min(100, Math.max(0, n));
}

export async function runAnalysisAgent(markets: CapitalMarket[]): Promise<AnalysisAgentResult> {
  const scannedAt = new Date().toISOString();
  console.log(`[analysis-agent] Starte Analyse: ${markets.length} Märkte`);

  // ── Schritt 1: Bestehende Analyse-Engine (GPT + Claude + TA + Strategies) ──
  const opportunities = await analyzeMarkets(markets);
  console.log(`[analysis-agent] ${opportunities.length} Opportunities gefunden`);

  // ── Schritt 2: Nur GO-Signale mit ausreichender Confidence weiterbewerten ──
  const goSignals = opportunities.filter(o => o.goSignal && o.gpt.confidence >= MIN_SIGNAL_CONFIDENCE);

  // ── Schritt 3: Meta-AI bewertet Top-Kandidaten ────────────────────────────
  const metaDecisions = await runMetaAnalysis(goSignals);

  // ── Schritt 4: Filter anwenden ─────────────────────────────────────────────
  const approved: ScannerOpportunity[] = [];
  const rejected: Array<{ symbol: string; reason: string }> = [];

  for (const opp of goSignals) {
    // Beide Seiten ueber denselben Schluessel — Begruendung bei `schluessel()`.
    const meta = metaDecisions.get(schluessel(opp.symbol));

    if (!meta || !meta.approve) {
      const reason = meta?.concern ?? "Meta-AI hat abgelehnt";
      rejected.push({ symbol: opp.symbol, reason });
      console.log(`[analysis-agent] ❌ ${opp.symbol} abgelehnt: ${reason}`);

      agentBus.publish({
        type: "ANALYSIS:SIGNAL_GENERATED",
        agentId: AGENT_ID,
        timestamp: scannedAt,
        payload: {
          symbol: opp.symbol,
          direction: opp.gpt.direction,
          confidence: opp.gpt.confidence,
          status: "REJECTED",
          reason,
        },
      });
      continue;
    }

    // ── Die angepasste Confidence wird GEPRUEFT, nicht uebernommen (07.09.) ──
    //
    // Hier stand `confidence: meta.adjustedConfidence` — der Wert kam
    // ungeprueft aus der Modellantwort (`adjustedConfidence: r.adjustedConfidence`
    // weiter oben). Zwei Loecher:
    //
    //  1. FEHLT der Wert in der Antwort, steht `undefined` in der Confidence.
    //     Im Orchestrator lautet der Riegel `if (o.gpt.confidence < threshold)`
    //     — und `undefined < 77` ist FALSE. Das Signal waere also NICHT
    //     verworfen worden, sondern haette die Freigabeschwelle vollstaendig
    //     umgangen.
    //  2. Der Prompt des Meta-Schritts verlangt ausdruecklich "Confidence < 72
    //     → adjustedConfidence reduzieren". Ein auf 68 gesenktes Signal blieb
    //     in `approved` — obwohl die Signalkette an drei Stellen
    //     `confidence >= MIN_SIGNAL_CONFIDENCE` verlangt. Genau diese
    //     Untergrenze war nach der Anpassung nicht mehr wirksam.
    //     (Im Log vom 04.09. sichtbar: "EURUSD: Confidence 68 < Schwelle 77" —
    //     eine 68 haette die Kette gar nicht erreichen duerfen.)
    //
    // Die Pruefung liegt in `gepruefteConfidence()` — als Funktion, damit der
    // Pruefer sie AUSFUEHREN kann statt den Wortlaut festzunageln.
    const angepasst = gepruefteConfidence(meta.adjustedConfidence, opp.gpt.confidence);
    if (angepasst < MIN_SIGNAL_CONFIDENCE) {
      const grund = `Meta-AI senkte Confidence auf ${angepasst} — unter der `
        + `Untergrenze ${MIN_SIGNAL_CONFIDENCE} der Signalkette`;
      rejected.push({ symbol: opp.symbol, reason: grund });
      console.log(`[analysis-agent] ❌ ${opp.symbol} abgelehnt: ${grund}`);
      continue;
    }
    const enriched: ScannerOpportunity = {
      ...opp,
      gpt: { ...opp.gpt, confidence: angepasst },
      finalScore: (opp.finalScore + angepasst / 100) / 2,
    };
    approved.push(enriched);

    agentBus.publish({
      type: "ANALYSIS:SIGNAL_GENERATED",
      agentId: AGENT_ID,
      timestamp: scannedAt,
      payload: {
        symbol: opp.symbol,
        direction: opp.gpt.direction,
        confidence: angepasst,
        status: "APPROVED",
        priority: meta.priority,
        concern: meta.concern,
      },
    });

    console.log(`[analysis-agent] ✅ ${opp.symbol} ${opp.gpt.direction} conf=${angepasst}% priority=${meta.priority}`);
  }

  // Alle nicht-GO Signale als WAIT publizieren (für DiagnosticsAgent)
  const waitCount = opportunities.length - goSignals.length;
  if (waitCount > 0) {
    agentBus.publish({
      type: "ANALYSIS:SIGNAL_GENERATED",
      agentId: AGENT_ID,
      timestamp: scannedAt,
      payload: { status: "WAIT", count: waitCount, total: opportunities.length },
    });
  }

  console.log(`[analysis-agent] Ergebnis: ${approved.length} approved, ${rejected.length} rejected, ${waitCount} WAIT`);

  return {
    opportunities,
    approved,
    rejected,
    metaDecisions,
    scannedAt,
    symbolCount: markets.length,
  };
}
