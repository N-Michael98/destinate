import fs from "fs";
import path from "path";
import { AutonomousTradingEvolutionReport } from "@/lib/autonomous-trading-evolution";

import {
  AutonomousTradingEvolutionMemoryEntry,
  AutonomousTradingEvolutionMemoryReport,
  AutonomousTradingEvolutionMemoryStats,
} from "./autonomous-trading-evolution-memory-types";

const VERSION = "V16.0.2" as const;

const memoryFilePath = path.join(
  process.cwd(),
  "lib",
  "data",
  "autonomous-trading-evolution-memory.json"
);

function ensureMemoryFile() {
  const directory = path.dirname(memoryFilePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(memoryFilePath)) {
    fs.writeFileSync(memoryFilePath, "[]", "utf-8");
  }
}

function readMemoryFile(): AutonomousTradingEvolutionMemoryEntry[] {
  ensureMemoryFile();

  try {
    const raw = fs.readFileSync(memoryFilePath, "utf-8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as AutonomousTradingEvolutionMemoryEntry[];
  } catch {
    return [];
  }
}

function writeMemoryFile(memory: AutonomousTradingEvolutionMemoryEntry[]) {
  ensureMemoryFile();

  fs.writeFileSync(
    memoryFilePath,
    JSON.stringify(memory, null, 2),
    "utf-8"
  );
}

function createMemoryId(report: AutonomousTradingEvolutionReport) {
  return `autonomous-evolution-memory-${report.cycleId}-${Date.now()}`;
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

function buildStats(
  memory: AutonomousTradingEvolutionMemoryEntry[]
): AutonomousTradingEvolutionMemoryStats {
  const scores = memory.map((entry) => entry.autonomousEvolutionScore);

  return {
    totalMemories: memory.length,
    averageEvolutionScore: average(scores),
    bestEvolutionScore: scores.length > 0 ? Math.max(...scores) : 0,
    weakestEvolutionScore: scores.length > 0 ? Math.min(...scores) : 0,
    latestTopStrategy: memory[0]?.topStrategy ?? "NONE",
    latestChampionSpecies: memory[0]?.championSpecies ?? "NONE",
    continueEvolutionCycles: memory.filter(
      (entry) => entry.cycleDecision === "CONTINUE_EVOLUTION"
    ).length,
    reduceRiskCycles: memory.filter(
      (entry) => entry.cycleDecision === "REDUCE_RISK"
    ).length,
    pausedEvolutionCycles: memory.filter(
      (entry) => entry.cycleDecision === "PAUSE_EVOLUTION"
    ).length,
  };
}

function buildRecommendation(memory: AutonomousTradingEvolutionMemoryEntry[]) {
  if (memory.length === 0) {
    return "No autonomous trading evolution memory stored yet.";
  }

  const stats = buildStats(memory);

  if (stats.averageEvolutionScore >= 70) {
    return "Autonomous trading evolution memory is strong. Continue evolution cycles and preserve top performing strategies.";
  }

  if (stats.averageEvolutionScore >= 50) {
    return "Autonomous trading evolution memory is active but requires risk control. Continue with reduced allocation and more validation.";
  }

  return "Autonomous trading evolution memory is weak. Pause aggressive evolution and review strategy quality before continuation.";
}

export function saveAutonomousTradingEvolutionMemory(
  report: AutonomousTradingEvolutionReport
): AutonomousTradingEvolutionMemoryEntry {
  const memory = readMemoryFile();

  const entry: AutonomousTradingEvolutionMemoryEntry = {
    id: createMemoryId(report),
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

  const nextMemory = [entry, ...memory].slice(0, 150);

  writeMemoryFile(nextMemory);

  return entry;
}

export function getAutonomousTradingEvolutionMemory() {
  return readMemoryFile();
}

export function getLatestAutonomousTradingEvolutionMemory(limit = 20) {
  return readMemoryFile().slice(0, limit);
}

export function getAutonomousTradingEvolutionMemoryStats() {
  return buildStats(readMemoryFile());
}

export function buildAutonomousTradingEvolutionMemoryReport():
  AutonomousTradingEvolutionMemoryReport {
  const memory = readMemoryFile();

  return {
    version: VERSION,
    status: "READY",
    stats: buildStats(memory),
    latestMemory: memory[0] ?? null,
    memory,
    recommendation: buildRecommendation(memory),
    updatedAt: new Date().toISOString(),
  };
}

export function clearAutonomousTradingEvolutionMemory() {
  writeMemoryFile([]);
}
