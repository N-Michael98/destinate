"use client";

import { useEffect, useMemo, useState } from "react";
import { HealthBar, MiniDonut } from "./mission-control-health-charts";
import { MissionControlAlertLayer } from "./MissionControlAlertLayer";
import { missionControlEndpointRegistry } from "@/lib/mission-control-endpoint-registry";
import { MissionControlRegistryGroupDashboard } from "./MissionControlRegistryGroupDashboard";
import { MissionControlAuditPanel } from "./MissionControlAuditPanel";
import { HealthScannerMonitorPanel } from "./HealthScannerMonitorPanel";
import { MissionControlAlertHistoryPanel } from "./MissionControlAlertHistoryPanel";
import { MissionControlEventTimelinePanel } from "./MissionControlEventTimelinePanel";
import { MissionControlRecoveryPanel } from "./MissionControlRecoveryPanel";

type ApiStatus = "READY" | "WARNING" | "ERROR" | "LOADING";

type MissionControlEventLogEntry = {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  source: string;
  message: string;
  payload: unknown;
  createdAt: string;
};

type MissionControlRecoveryItem = {
  source: string;
  recovered: boolean;
  recoveryTimeMs: number | null;
};

type MissionControlRecoveryReport = {
  version: string;
  status: string;
  totalTrackedSources: number;
  recoveredSources: number;
  activeIssueSources: number;
  averageRecoveryTimeMs: number | null;
  recoveries: MissionControlRecoveryItem[];
};

type MissionControlHealthReport = {
  ok: boolean;
  version: string;
  checkedAt: string;
  totalEndpoints: number;
  ready: number;
  warnings: number;
  errors: number;
  criticalErrors: number;
  healthScore: number;
  endpoints: EndpointResult[];
};

type EndpointResult = {
  key: string;
  label: string;
  endpoint: string;
  group?: string;
  critical?: boolean;
  status: ApiStatus;
  summary: string;
  updatedAt?: string;
  checkedAt?: string;
  responseTimeMs?: number;
  description?: string;
};

const endpoints = missionControlEndpointRegistry;

function getSummary(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "No payload";

  const data = payload as Record<string, unknown>;

  if (typeof data.status === "string") return data.status;
  if (typeof data.mode === "string") return data.mode;
  if (typeof data.message === "string") return data.message;
  if (typeof data.updatedAt === "string") return "Updated";

  if (Array.isArray(data.tickets)) return `${data.tickets.length} tickets`;
  if (Array.isArray(data.queue)) return `${data.queue.length} queued`;
  if (Array.isArray(data.opportunities)) return `${data.opportunities.length} opportunities`;

  if (data.report && typeof data.report === "object") {
    const report = data.report as Record<string, unknown>;
    if (typeof report.status === "string") return report.status;
    if (typeof report.version === "string") return report.version;
  }

  return "Online";
}

function statusFromResponse(ok: boolean, payload: unknown): ApiStatus {
  if (!ok) return "ERROR";

  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (data.ok === false) return "WARNING";
    if (typeof data.status === "string" && data.status.toLowerCase().includes("error")) {
      return "ERROR";
    }
  }

  return "READY";
}

export default function UnifiedMissionControlDashboard() {
  const [results, setResults] = useState<EndpointResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("");
  const [auditChecks, setAuditChecks] = useState([]);
  const [eventTimeline, setEventTimeline] = useState<MissionControlEventLogEntry[]>([]);

  async function loadMissionControl() {
    setLoading(true);

    try {
      const response = await fetch("/api/mission-control/health", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Mission Control health request failed: ${response.status}`);
      }

      const report = (await response.json()) as MissionControlHealthReport;

      const auditResponse = await fetch("/api/mission-control/audit", {
        cache: "no-store",
      });
      const auditReport = await auditResponse.json().catch(() => null);

      if (auditReport && Array.isArray(auditReport.checks)) {
        setAuditChecks(auditReport.checks);
      }

      const eventsResponse = await fetch("/api/mission-control/events", {
        cache: "no-store",
      });
      const eventsReport = await eventsResponse.json().catch(() => null);

      if (eventsReport && Array.isArray(eventsReport.latest)) {
        setEventTimeline(eventsReport.latest);
      }

      const recoveryResponse = await fetch("/api/mission-control/recovery", {
        cache: "no-store",
      });
      const recoveryData = await recoveryResponse.json().catch(() => null);

      if (recoveryData && recoveryData.ok && recoveryData.recovery) {
        setRecoveryReport(recoveryData.recovery);
      }

      setResults(report.endpoints);
      setLastUpdate(new Date(report.checkedAt).toLocaleTimeString());
    } catch {
      setResults([]);
      setLastUpdate(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMissionControl();

    const interval = window.setInterval(() => {
      loadMissionControl();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const ready = results.filter((item) => item.status === "READY").length;
    const warnings = results.filter((item) => item.status === "WARNING").length;
    const errors = results.filter((item) => item.status === "ERROR").length;

    return {
      total: results.length,
      ready,
      warnings,
      errors,
      health:
        results.length === 0
          ? 0
          : Math.round((ready / results.length) * 100),
    };
  }, [results]);

  return (
    <section className="rounded-3xl border border-cyan-500/20 bg-zinc-950/80 p-6 shadow-2xl shadow-black/50">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
            V15.B.8 Unified Mission Control
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            AI Trading System Command Center
          </h1>
          <p className="mt-2 max-w-4xl text-sm text-zinc-400">
            Unified overview for system health, AI decision flow, execution readiness, broker health, market status and dependency monitoring.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMissionControl}
          className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
        >
          Refresh Mission Control
        </button>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4 xl:col-span-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-bold text-cyan-300">Registry coverage</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Mission Control now reads from one central endpoint registry used by health, alerts and future Telegram logic.
            </p>
          </div>
          <div className="rounded-full border border-cyan-500/30 px-3 py-1 text-xs font-bold text-cyan-200">
            {endpoints.length} endpoints registered
          </div>
        </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4">
          <h2 className="text-sm font-bold text-cyan-300">Telegram readiness</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Alert payloads are prepared. Real Telegram sending remains disabled until bot token, chat id and approval rules are added.
          </p>
          <div className="mt-4 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-center text-xs font-black text-yellow-300">
            PAYLOAD ONLY
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="System Health" value={`${stats.health}%`} note="Online endpoint ratio" accent="text-green-400" />
        <MetricCard title="Ready Modules" value={`${stats.ready}/${stats.total}`} note="Healthy endpoints" accent="text-cyan-400" />
        <MetricCard title="Warnings" value={`${stats.warnings}`} note="Needs review" accent="text-yellow-400" />
        <MetricCard title="Errors" value={`${stats.errors}`} note="Failed requests" accent="text-red-400" />
      </div>

      <MissionControlAlertLayer sources={results} />
      <MissionControlAlertHistoryPanel sources={results} />
      <MissionControlEventTimelinePanel events={eventTimeline} />
      <MissionControlRecoveryPanel recovery={recoveryReport} />
      <MissionControlAuditPanel checks={auditChecks} />
      <MissionControlRegistryGroupDashboard endpoints={results} />
      <HealthScannerMonitorPanel endpoints={results} />

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-cyan-500/20 bg-black/40 p-5">
          <h2 className="text-lg font-bold text-white">Health distribution</h2>
          <p className="mt-1 text-sm text-zinc-500">Ready, warning and error ratio.</p>
          <div className="mt-5">
            <MiniDonut ready={stats.ready} warning={stats.warnings} error={stats.errors} />
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-black/40 p-5">
          <h2 className="text-lg font-bold text-white">Endpoint readiness</h2>
          <div className="mt-5 space-y-3">
            <HealthBar label="System health" value={stats.health} />
            <HealthBar label="Ready modules" value={stats.ready} max={Math.max(stats.total, 1)} />
            <HealthBar label="Warnings" value={stats.warnings} max={Math.max(stats.total, 1)} />
            <HealthBar label="Errors" value={stats.errors} max={Math.max(stats.total, 1)} />
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-black/40 p-5">
          <h2 className="text-lg font-bold text-white">Control readiness</h2>
          <div className="mt-5 space-y-3">
            <HealthBar label="Execution lock" value={100} />
            <HealthBar label="Paper safety" value={100} />
            <HealthBar label="Broker protection" value={85} />
            <HealthBar label="Telegram alerts" value={25} />
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-black/40 p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Live System Matrix
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Auto-refresh every 30 seconds. Last update: {lastUpdate || "pending"}
            </p>
          </div>

          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
            {loading ? "LOADING" : "MONITORING"}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{item.label}</h3>
                  <p className="mt-1 text-xs text-zinc-500">{item.endpoint}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <p className="mt-4 text-lg font-black text-zinc-100">
                {item.summary}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Checked: {item.checkedAt ? new Date(item.checkedAt).toLocaleTimeString() : item.updatedAt || "pending"}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Response time: {item.responseTimeMs ?? 0} ms
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-purple-500/20 bg-black/40 p-5">
          <h2 className="text-lg font-bold text-white">
            AI Decision Flow
          </h2>
          <div className="mt-4 space-y-3">
            {[
              "Market Intelligence",
              "GPT Analyst",
              "Claude Risk",
              "Consensus",
              "Portfolio Brain",
              "Execution Queue",
              "Broker Routing",
              "Outcome Learning",
            ].map((step, index) => (
              <div
                key={step}
                className="flex items-center gap-3 rounded-xl bg-zinc-900/70 px-3 py-2"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-purple-500/30 text-xs font-bold text-purple-300">
                  {index + 1}
                </span>
                <span className="text-sm text-zinc-300">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-black/40 p-5">
          <h2 className="text-lg font-bold text-white">
            Safety Locks
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <SafetyRow label="Live Orders" value="Blocked" />
            <SafetyRow label="Execution Mode" value="Paper Only" />
            <SafetyRow label="Broker Dispatch" value="Protected" />
            <SafetyRow label="Telegram Alerts" value="Planned" />
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-black/40 p-5">
          <h2 className="text-lg font-bold text-white">
            Next Control Upgrades
          </h2>
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            <p className="rounded-xl bg-zinc-900/70 p-3">
              Add visual charts for health, execution load and broker status.
            </p>
            <p className="rounded-xl bg-zinc-900/70 p-3">
              Add Telegram alert bridge after dependency scanner validation.
            </p>
            <p className="rounded-xl bg-zinc-900/70 p-3">
              Add AI decision summary from GPT, Claude and Consensus.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  title,
  value,
  note,
  accent,
}: {
  title: string;
  value: string;
  note: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className={`mt-4 text-4xl font-black ${accent}`}>{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{note}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ApiStatus }) {
  const style =
    status === "READY"
      ? "border-green-500/30 bg-green-500/10 text-green-300"
      : status === "WARNING"
        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
        : status === "ERROR"
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";

  return (
    <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${style}`}>
      {status}
    </span>
  );
}

function SafetyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-zinc-900/70 px-3 py-2">
      <span className="text-zinc-400">{label}</span>
      <span className="font-bold text-yellow-300">{value}</span>
    </div>
  );
}














