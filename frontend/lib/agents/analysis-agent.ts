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
import { agentBus, meldeTorEntscheidung } from "./agent-bus";
import { analyzeMarkets, scanDatenVon, type ScannerOpportunity } from "../market-scanner/ai-analysis-engine";
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
    // FEHLENDE WERTE BLEIBEN FEHLEND (16.09.). Hier stand `rsi: … ?? 0` —
    // ein fehlender RSI kam als "RSI 0" an, also extrem ueberverkauft, und die
    // Regel darunter nennt genau das einen Grund, ein SELL abzulehnen. Dieselbe
    // Fehlerklasse wie `riskScore ?? 50`.
    const candidateSummary = candidates.map(c => ({
      symbol: c.symbol,
      direction: c.gpt.direction,
      confidence: c.gpt.confidence,
      taSignal: c.taSignals?.signal ?? null,
      rsi: typeof c.taSignals?.rsi === "number" ? c.taSignals.rsi : null,
      trend1D: c.taSignals?.trend ?? null,
      riskScore: c.claude.riskScore,
    }));

    // ── DIE REGELN SIND DIE DES ANALYSTEN (16.09.) ─────────────────────────
    //
    // Bis heute stand hier "TA-Signal muss mit Direction übereinstimmen". Der
    // GPT-Prompt erlaubt BUY aber ausdruecklich bei "1D trend=BULLISH ODER
    // signal=BUY" — ein regelkonformes Signal mit bullishem Trend und
    // neutralem TA-Signal konnte hier also sterben. Zwei Tore mit
    // widersprechenden Regeln: genau das, was der Nutzer ausgeschlossen hat.
    //
    // Entfallen:
    //  - "Score < 0.65 → ablehnen": finalScore liegt bei ~50–110. Die Regel
    //    griff nie — oder das Modell las sie falsch. finalScore geht nicht mehr
    //    in die Anfrage.
    //  - "Confidence < 72 → reduzieren": eine eigene, fest eingebaute Schwelle
    //    neben der vom Nutzer eingestellten. Die Confidence-Grenze setzt der
    //    Orchestrator.
    //  - `riskApproved`: jeder Kandidat hier IST freigegeben (goSignal).
    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Meta-Analyse von ${candidates.length} Handelssignalen.

Du bist die GEGENPRÜFUNG eines Analysten, keine zweite Bewertung. Jedes Signal hat
die Analyse, die Risiko-Freigabe und die Mindest-Confidence bereits bestanden.

${JSON.stringify(candidateSummary, null, 2)}

Lehne ab (approve=false), wenn EINE dieser Regeln verletzt ist:
- BUY bei rsi > 70, oder SELL bei rsi < 30 (Überdehnung gegen die Richtung).
- BUY, obwohl weder trend1D=BULLISH noch taSignal=BUY/STRONG_BUY.
- SELL, obwohl weder trend1D=BEARISH noch taSignal=SELL/STRONG_SELL.
Das sind die Regeln des Analysten selbst. Ein NEUTRALES taSignal ist KEIN
Ablehnungsgrund, wenn trend1D zur Richtung passt. Ein Wert null heisst "nicht
gemessen" und ist ebenfalls KEIN Ablehnungsgrund.

adjustedConfidence: übernimm die Confidence. Senke sie nur für einen konkreten
Grund, den du in "concern" nennst. Erhöhe sie nie.

Antworte NUR mit JSON Array, ein Eintrag je Symbol:
[{"symbol":"X","approve":true,"adjustedConfidence":75,"concern":"kurz","priority":"HIGH"}]`
      }]
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const json = text.match(/\[[\s\S]*\]/)?.[0];
    if (json) {
      const geparst: unknown = JSON.parse(json);
      const results = (Array.isArray(geparst) ? geparst : []) as Array<Record<string, unknown>>;
      for (const r of results) {
        // Geprueft statt uebernommen (16.09.) — siehe pruefeMetaUrteil().
        decisions.set(schluessel(r?.symbol), pruefeMetaUrteil(r));
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
 *
 * ── NUR NOCH SENKEN (16.09.) ──────────────────────────────────────────────
 * Bis heute wurde auf 0–100 geklemmt — ein ANHEBEN war also erlaubt, und der
 * Pruefer schrieb es sogar fest (`gc(75, 70) === 75`). Damit konnte die
 * Meta-KI ein Signal, das GPT mit 72 bewertet hatte, auf 80 setzen, und der
 * Orchestrator rechnete mit 80: die vom Nutzer eingestellte Schwelle (76)
 * waere umgangen. Die Meta-KI ist die GEGENPRUEFUNG der Analyse, keine zweite
 * Bewertung, die sie ueberstimmen darf — Entscheidung des Nutzers vom 16.09.:
 * keine widerspruechlichen Ergebnisse zwischen den Toren. Deshalb gilt jetzt
 * dieselbe Regel wie beim Risiko der Ausfuehrungs-KI: senken ja, anheben nie.
 *
 * Nur Zahlen und Zahlen-Texte zaehlen; `true` ist keine Confidence (Number(true)
 * waere 1).
 */
export function gepruefteConfidence(roh: unknown, ausgangswert: number): number {
  const n = typeof roh === "number" ? roh
    : typeof roh === "string" && roh.trim() !== "" ? Number(roh)
    : NaN;
  if (!Number.isFinite(n)) return ausgangswert;
  return Math.max(0, Math.min(ausgangswert, n));
}

/**
 * Das Urteil der Meta-KI fuer EINEN Kandidaten, geprueft (16.09.).
 *
 * `approve: r.approve` wurde ungeprueft uebernommen, und abgefragt wurde
 * `!meta.approve` — ein Text "false" ist wahr und haette FREIGEGEBEN. Jetzt
 * gilt nur `true` als Zustimmung; alles andere ist eine Ablehnung MIT Grund,
 * damit sie in der Zyklus-Bilanz nicht wie ein inhaltliches Urteil aussieht.
 */
export function pruefeMetaUrteil(r: unknown): MetaAnalysisDecision {
  const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
  const lesbar = typeof o.approve === "boolean";
  const priority = o.priority === "HIGH" || o.priority === "LOW" ? o.priority : "MEDIUM";
  return {
    approve: o.approve === true,
    adjustedConfidence: typeof o.adjustedConfidence === "number" ? o.adjustedConfidence : NaN,
    concern: lesbar
      ? String(o.concern ?? "")
      : `Urteil unlesbar (approve=${JSON.stringify(o.approve ?? null)})`,
    priority,
  };
}

export async function runAnalysisAgent(markets: CapitalMarket[]): Promise<AnalysisAgentResult> {
  const scannedAt = new Date().toISOString();
  console.log(`[analysis-agent] Starte Analyse: ${markets.length} Märkte`);

  // ── Schritt 1: Bestehende Analyse-Engine (GPT + Claude + TA + Strategies) ──
  const opportunities = await analyzeMarkets(markets);
  console.log(`[analysis-agent] ${opportunities.length} Opportunities gefunden`);

  // Den Scan an die Zyklus-Bilanz melden (16.09.). NUR hier und nicht in der
  // Engine: runAnalysisAgent laeuft ausschliesslich im Handelszyklus, die
  // Engine auch fuer die Dashboard-Route — deren Scans gehoeren nicht in die
  // Bilanz des Handels.
  const scan = scanDatenVon(opportunities);
  if (scan) {
    agentBus.publish({
      type: "ANALYSIS:SCAN_DONE",
      agentId: AGENT_ID,
      timestamp: scannedAt,
      payload: { scan },
    });
  }

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
      meldeTorEntscheidung(AGENT_ID, {
        gate: "Meta-KI", symbol: opp.symbol, direction: opp.gpt.direction,
        approve: false, reason: meta ? String(reason) : "keine Beurteilung fuer dieses Symbol",
        confidence: opp.gpt.confidence,
      });

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
      // War bis 16.09. STUMM auf dem Bus — die Bilanz haette diese Ablehnung verloren.
      meldeTorEntscheidung(AGENT_ID, {
        gate: "Meta-KI", symbol: opp.symbol, direction: opp.gpt.direction,
        approve: false, reason: grund, confidence: angepasst,
      });
      continue;
    }
    const enriched: ScannerOpportunity = {
      ...opp,
      gpt: { ...opp.gpt, confidence: angepasst },
      // Skala korrigiert (16.09.): hier stand `angepasst / 100`. finalScore
      // liegt bei ~50–110, die Confidence bei 0–100 — geteilt durch 100
      // halbierte die Zeile den Score nur. Gelesen wird der Wert nachweislich
      // nirgends weiter (Orchestrator sortiert nicht danach).
      finalScore: (opp.finalScore + angepasst) / 2,
    };
    approved.push(enriched);
    meldeTorEntscheidung(AGENT_ID, {
      gate: "Meta-KI", symbol: opp.symbol, direction: opp.gpt.direction,
      approve: true, reason: String(meta.concern ?? ""),
      // Ein KI-Ausfall gibt ALLE frei — das ist kein Urteil und heisst so.
      fallback: meta.concern === "fallback",
      confidence: angepasst,
    });

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
