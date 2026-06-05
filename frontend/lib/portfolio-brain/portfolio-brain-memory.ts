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

  return entry;
}

export function getPortfolioBrainMemory(): PortfolioBrainMemoryEntry[] {
  return portfolioBrainMemory;
}
