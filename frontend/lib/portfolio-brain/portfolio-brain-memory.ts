import { PortfolioBrainReport } from "./brain-types";

export type PortfolioBrainMemoryEntry = {
  id: string;
  createdAt: string;
  version: string;
  status: string;
  mode: string;
  decision: string;
  confidence: number;
  riskScore: number;
  report: PortfolioBrainReport;
};

const portfolioBrainMemory: PortfolioBrainMemoryEntry[] = [];

/** Obergrenze der Erinnerungsliste (08.09.). Jeder Eintrag traegt den
 *  vollstaendigen Report; ohne Deckel waechst sie mit jedem Aufruf weiter. */
export const PORTFOLIO_BRAIN_MEMORY_MAX = 50;

export function savePortfolioBrainMemory(
  report: PortfolioBrainReport
): PortfolioBrainMemoryEntry {
  const reportAny = report as any;

  const decision =
    reportAny.decision?.finalDecision ??
    reportAny.finalDecision?.signal ??
    reportAny.decision?.signal ??
    reportAny.signal ??
    "UNKNOWN";

  const confidence =
    reportAny.decision?.confidence ??
    reportAny.finalDecision?.confidence ??
    reportAny.confidence ??
    0;

  const riskScore =
    reportAny.decision?.averageRiskScore ??
    reportAny.finalDecision?.riskScore ??
    reportAny.decision?.riskScore ??
    reportAny.riskScore ??
    0;

  const entry: PortfolioBrainMemoryEntry = {
    id: `portfolio-brain-memory-${Date.now()}`,
    createdAt: new Date().toISOString(),
    version: report.version,
    status: report.status,
    mode: report.mode,
    decision,
    confidence,
    riskScore,
    report,
  };

  portfolioBrainMemory.unshift(entry);
  // ── Obergrenze (08.09., Generalkontrolle) ────────────────────────────────
  //
  // Hier stand nur das `unshift`. Die Liste wurde NIE gekuerzt und haelt den
  // vollstaendigen `report` je Eintrag — bei jedem Aufruf von
  // POST /api/portfolio-brain kam einer dazu, ohne Ende. Dasselbe Muster wie
  // das Leck in der Brute-Force-Karte (26.08.) und in der Journal-
  // Warteschlange (`AUSSTEHEND_MAX`).
  //
  // Verhaltensneutral: entfernt werden nur die AELTESTEN Eintraege. Neu ist
  // vorne, gelesen wird von vorne — wer die letzten Laeufe ansieht, merkt
  // keinen Unterschied.
  while (portfolioBrainMemory.length > PORTFOLIO_BRAIN_MEMORY_MAX) {
    portfolioBrainMemory.pop();
  }

  return entry;
}

export function getPortfolioBrainMemory(): PortfolioBrainMemoryEntry[] {
  return portfolioBrainMemory;
}
