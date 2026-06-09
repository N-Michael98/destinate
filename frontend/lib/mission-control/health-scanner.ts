import { missionControlEndpointRegistry } from "@/lib/mission-control-endpoint-registry";

export type MissionEndpointHealthStatus = "READY" | "WARNING" | "ERROR";

export type MissionEndpointHealthResult = {
  key: string;
  label: string;
  endpoint: string;
  group: string;
  critical: boolean;
  description: string;
  status: MissionEndpointHealthStatus;
  summary: string;
  responseTimeMs: number;
  checkedAt: string;
};

export type MissionControlHealthReport = {
  ok: boolean;
  version: "V15.B.14";
  checkedAt: string;
  totalEndpoints: number;
  ready: number;
  warnings: number;
  errors: number;
  criticalErrors: number;
  healthScore: number;
  endpoints: MissionEndpointHealthResult[];
};

function summarizePayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "No payload";

  const data = payload as Record<string, unknown>;

  if (typeof data.status === "string") return data.status;
  if (typeof data.mode === "string") return data.mode;
  if (typeof data.message === "string") return data.message;

  if (Array.isArray(data.tickets)) return `${data.tickets.length} tickets`;
  if (Array.isArray(data.queue)) return `${data.queue.length} queued`;
  if (Array.isArray(data.opportunities)) return `${data.opportunities.length} opportunities`;

  if (data.report && typeof data.report === "object") {
    const report = data.report as Record<string, unknown>;
    if (typeof report.status === "string") return report.status;
    if (typeof report.version === "string") return report.version;
  }

  if (data.ok === true) return "Online";
  if (data.ok === false) return "Warning";

  return "Online";
}

function statusFromPayload(responseOk: boolean, payload: unknown): MissionEndpointHealthStatus {
  if (!responseOk) return "ERROR";

  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;

    if (data.ok === false) return "WARNING";

    if (
      typeof data.status === "string" &&
      data.status.toLowerCase().includes("error")
    ) {
      return "ERROR";
    }
  }

  return "READY";
}

export async function scanMissionControlEndpoints(baseUrl: string): Promise<MissionControlHealthReport> {
  const checkedAt = new Date().toISOString();

  const endpoints = await Promise.all(
    missionControlEndpointRegistry.map(async (item) => {
      const startedAt = Date.now();

      try {
        const response = await fetch(`${baseUrl}${item.endpoint}`, {
          cache: "no-store",
        });

        const payload = await response.json().catch(() => null);
        const responseTimeMs = Date.now() - startedAt;

        return {
          key: item.key,
          label: item.label,
          endpoint: item.endpoint,
          group: item.group,
          critical: item.critical,
          description: item.description,
          status: statusFromPayload(response.ok, payload),
          summary: summarizePayload(payload),
          responseTimeMs,
          checkedAt,
        } satisfies MissionEndpointHealthResult;
      } catch {
        return {
          key: item.key,
          label: item.label,
          endpoint: item.endpoint,
          group: item.group,
          critical: item.critical,
          description: item.description,
          status: "ERROR",
          summary: "Request failed",
          responseTimeMs: Date.now() - startedAt,
          checkedAt,
        } satisfies MissionEndpointHealthResult;
      }
    })
  );

  const ready = endpoints.filter((item) => item.status === "READY").length;
  const warnings = endpoints.filter((item) => item.status === "WARNING").length;
  const errors = endpoints.filter((item) => item.status === "ERROR").length;
  const criticalErrors = endpoints.filter(
    (item) => item.status === "ERROR" && item.critical
  ).length;

  const healthScore =
    endpoints.length === 0 ? 0 : Math.round((ready / endpoints.length) * 100);

  return {
    ok: criticalErrors === 0,
    version: "V15.B.14",
    checkedAt,
    totalEndpoints: endpoints.length,
    ready,
    warnings,
    errors,
    criticalErrors,
    healthScore,
    endpoints,
  };
}
