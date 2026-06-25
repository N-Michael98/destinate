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
        decisions.set(r.symbol, {
          approve: r.approve,
          adjustedConfidence: r.adjustedConfidence,
          concern: r.concern,
          priority: r.priority,
        });
      }
    }
  } catch (err) {
    console.warn(`[analysis-agent] Meta-AI Fehler — alle Kandidaten approved (${err})`);
    // Fallback: alle approven
    for (const c of candidates) {
      decisions.set(c.symbol, {
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

export async function runAnalysisAgent(markets: CapitalMarket[]): Promise<AnalysisAgentResult> {
  const scannedAt = new Date().toISOString();
  console.log(`[analysis-agent] Starte Analyse: ${markets.length} Märkte`);

  // ── Schritt 1: Bestehende Analyse-Engine (GPT + Claude + TA + Strategies) ──
  const opportunities = await analyzeMarkets(markets);
  console.log(`[analysis-agent] ${opportunities.length} Opportunities gefunden`);

  // ── Schritt 2: Nur GO-Signale mit ausreichender Confidence weiterbewerten ──
  const goSignals = opportunities.filter(o => o.goSignal && o.gpt.confidence >= 70);

  // ── Schritt 3: Meta-AI bewertet Top-Kandidaten ────────────────────────────
  const metaDecisions = await runMetaAnalysis(goSignals);

  // ── Schritt 4: Filter anwenden ─────────────────────────────────────────────
  const approved: ScannerOpportunity[] = [];
  const rejected: Array<{ symbol: string; reason: string }> = [];

  for (const opp of goSignals) {
    const meta = metaDecisions.get(opp.symbol);

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

    // Confidence aktualisieren falls Meta-AI sie angepasst hat
    const enriched: ScannerOpportunity = {
      ...opp,
      gpt: { ...opp.gpt, confidence: meta.adjustedConfidence },
      finalScore: (opp.finalScore + meta.adjustedConfidence / 100) / 2,
    };
    approved.push(enriched);

    agentBus.publish({
      type: "ANALYSIS:SIGNAL_GENERATED",
      agentId: AGENT_ID,
      timestamp: scannedAt,
      payload: {
        symbol: opp.symbol,
        direction: opp.gpt.direction,
        confidence: meta.adjustedConfidence,
        status: "APPROVED",
        priority: meta.priority,
        concern: meta.concern,
      },
    });

    console.log(`[analysis-agent] ✅ ${opp.symbol} ${opp.gpt.direction} conf=${meta.adjustedConfidence}% priority=${meta.priority}`);
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
