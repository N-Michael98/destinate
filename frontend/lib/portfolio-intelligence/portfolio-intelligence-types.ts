import fs from "fs";
import path from "path";
import { PaperPosition } from "@/lib/paper-trading/paper-types";
import {
  PortfolioExposure,
  PortfolioIntelligenceReport,
  PortfolioRiskLevel,
} from "./portfolio-intelligence-types";

const historyFilePath = path.join(
  process.cwd(),
  "lib",
  "data",
  "paper-history.json"
);

function readHistory(): unknown[] {
  try {
    if (!fs.existsSync(historyFilePath)) {
      return [];
    }

    const raw = fs.readFileSync(historyFilePath, "utf-8");
    return JSON.parse(raw) as unknown[];
  } catch {
    return [];
  }
}

function isPaperPosition(value: unknown): value is PaperPosition {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<PaperPosition>;

  return Boolean(
    item.id &&
      item.symbol &&
      item.direction &&
      item.status &&
      typeof item.size === "number"
  );
}

function collectPositionsFromPayload(payload: unknown): PaperPosition[] {
  const found: PaperPosition[] = [];

  function walk(value: unknown) {
    if (!value) return;

    if (isPaperPosition(value)) {
      found.push(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(walk);
    }
  }

  walk(payload);

  return found;
}

function buildExposure(
  positions: PaperPosition[],
  keyGetter: (position: PaperPosition) => string
): PortfolioExposure[] {
  const exposureMap = new Map<string, PortfolioExposure>();

  positions.forEach((position) => {
    const key = keyGetter(position);

    const current =
      exposureMap.get(key) ??
      {
        key,
        count: 0,
        totalSize: 0,
        totalUnrealizedPnL: 0,
      };

    current.count += 1;
    current.totalSize += Number(position.size ?? 0);
    current.totalUnrealizedPnL += Number(position.unrealizedPnL ?? 0);

    exposureMap.set(key, current);
  });

  return Array.from(exposureMap.values()).sort(
    (a, b) => b.totalSize - a.totalSize
  );
}

function getRiskLevel(score: number): PortfolioRiskLevel {
  if (score >= 85) return "EXTREME";
  if (score >= 65) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

export class PortfolioIntelligenceEngine {
  static analyze(): PortfolioIntelligenceReport {
    const history = readHistory();

    const positions = history.flatMap((event) =>
      collectPositionsFromPayload(event)
    );

    const uniquePositions = Array.from(
      new Map(positions.map((position) => [position.id, position])).values()
    );

    const openPositions = uniquePositions.filter(
      (position) => position.status === "OPEN"
    );

    const closedPositions = uniquePositions.filter(
      (position) => position.status === "CLOSED"
    );

    const totalUnrealizedPnL = Number(
      openPositions
        .reduce(
          (sum, position) => sum + Number(position.unrealizedPnL ?? 0),
          0
        )
        .toFixed(2)
    );

    const symbolExposure = buildExposure(
      openPositions,
      (position) => position.symbol
    );

    const directionExposure = buildExposure(
      openPositions,
      (position) => position.direction
    );

    const largestExposure = symbolExposure[0] ?? null;

    const totalSize = openPositions.reduce(
      (sum, position) => sum + Number(position.size ?? 0),
      0
    );

    const concentrationRisk =
      totalSize > 0 && largestExposure
        ? Number(
            ((largestExposure.totalSize / totalSize) * 100).toFixed(2)
          )
        : 0;

    const portfolioRiskScore = Math.min(
      100,
      Math.round(
        openPositions.length * 12 +
          concentrationRisk * 0.45 +
          Math.max(0, -totalUnrealizedPnL) * 0.1
      )
    );

    const portfolioRiskLevel = getRiskLevel(portfolioRiskScore);

    const recommendation =
      portfolioRiskLevel === "EXTREME"
        ? "Extreme portfolio risk detected. Reduce exposure immediately and avoid adding new positions."
        : portfolioRiskLevel === "HIGH"
          ? "High portfolio risk detected. Reduce concentration and avoid correlated positions."
          : portfolioRiskLevel === "MEDIUM"
            ? "Moderate portfolio risk. Keep position sizing controlled and monitor concentration."
            : "Portfolio risk is low. Normal paper trading can continue.";

    return {
      version: "V11.2.0",
      generatedAt: new Date().toISOString(),
      totalPositions: uniquePositions.length,
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      totalUnrealizedPnL,
      portfolioRiskScore,
      portfolioRiskLevel,
      symbolExposure,
      directionExposure,
      largestExposureSymbol: largestExposure?.key ?? null,
      concentrationRisk,
      recommendation,
      status: "analyzed",
    };
  }
}