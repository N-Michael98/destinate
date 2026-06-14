import { dbGet, dbSet } from "../db-store";
import { AutonomousTradingEvolutionReport } from "@/lib/autonomous-trading-evolution";

import {
  AutonomousTradingEvolutionMemoryEntry,
  AutonomousTradingEvolutionMemoryReport,
  AutonomousTradingEvolutionMemoryStats,
} from "./autonomous-trading-evolution-memory-types";

const VERSION = "V16.0.2" as const;
const DB_KEY = "autonomous-evolution-memory";

declare global { var __autonomous_evolution_memory__: AutonomousTradingEvolutionMemoryEntry[] | undefined; }

function getCache(): AutonomousTradingEvolutionMemoryEntry[] {
  return global.__autonomous_evolution_memory__ ?? [];
}

function ensureLoaded() {
  if (global.__autonomous_evolution_memory__ === undefined) {
    global.__autonomous_evolution_memory__ = [];
    dbGet<AutonomousTradingEvolutionMemoryEntry[]>(DB_KEY, []).then((data) => {
      global.__autonomous_evolution_memory__ = data;
    }).catch(() => {});
  }
}

function persist() {
  dbSet(DB_KEY, getCache()).catch(() => {});
}

function buildStats(memory: AutonomousTradingEvolutionMemoryEntry[]): AutonomousTradingEvolutionMemoryStats {
  const scores = memory.map((e) => e.autonomousEvolutionScore);
  const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return {
    totalMemories: memory.length,
    averageEvolutionScore: avg,
    bestEvolutionScore: scores.length > 0 ? Math.max(...scores) : 0,
    weakestEvolutionScore: scores.length > 0 ? Math.min(...scores) : 0,
    latestTopStrategy: memory[0]?.topStrategy ?? "NONE",
    latestChampionSpecies: memory[0]?.championSpecies ?? "NONE",
    continueEvolutionCycles: memory.filter((e) => e.cycleDecision === "CONTINUE_EVOLUTION").length,
    reduceRiskCycles: memory.filter((e) => e.cycleDecision === "REDUCE_RISK").length,
    pausedEvolutionCycles: memory.filter((e) => e.cycleDecision === "PAUSE_EVOLUTION").length,
  };
}

export function saveAutonomousTradingEvolutionMemory(
  report: AutonomousTradingEvolutionReport
): AutonomousTradingEvolutionMemoryEntry {
  ensureLoaded();
  const memory = getCache();
  const entry: AutonomousTradingEvolutionMemoryEntry = {
    id: `autonomous-evolution-memory-${report.cycleId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    version: VERSION,
    cycleId: report.cycleId,
    status: report.status,
    cycleDecision: report.cycleDecision,
    topStrategy: report.topStrategy,
    bestMutation: report.bestMutation,
    bestHybrid: report.bestHybrid,
    championSpecies: report.championSpecies,
    autonomousEvolutionScore: report.autonomousEvolutionScore,
    totalRankedStrategies: report.totalRankedStrategies,
    totalMutations: report.totalMutations,
    totalHybrids: report.totalHybrids,
    totalSpecies: report.totalSpecies,
    summary: report.summary,
    payload: report,
  };
  const next = [entry, ...memory].slice(0, 150);
  global.__autonomous_evolution_memory__ = next;
  persist();
  return entry;
}

export function getAutonomousTradingEvolutionMemory(): AutonomousTradingEvolutionMemoryEntry[] {
  ensureLoaded();
  return getCache();
}

export function getLatestAutonomousTradingEvolutionMemory(
  limit = 20
): AutonomousTradingEvolutionMemoryEntry[] {
  ensureLoaded();
  return getCache().slice(0, limit);
}

export function getAutonomousTradingEvolutionMemoryStats(): AutonomousTradingEvolutionMemoryStats {
  ensureLoaded();
  return buildStats(getCache());
}

export function buildAutonomousTradingEvolutionMemoryReport(): AutonomousTradingEvolutionMemoryReport {
  ensureLoaded();
  const memory = getCache();
  return {
    version: VERSION,
    status: "READY",
    stats: buildStats(memory),
    latestMemory: memory[0] ?? null,
    memory,
    recommendation: memory.length === 0 ? "No evolution memory yet." : "Evolution memory active.",
    updatedAt: new Date().toISOString(),
  };
}

export function clearAutonomousTradingEvolutionMemory(): void {
  global.__autonomous_evolution_memory__ = [];
  persist();
}

export async function init(): Promise<void> {
  global.__autonomous_evolution_memory__ = await dbGet<AutonomousTradingEvolutionMemoryEntry[]>(DB_KEY, []);
}
