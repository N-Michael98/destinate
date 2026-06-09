import { missionControlEndpointRegistry } from "@/lib/mission-control-endpoint-registry";

export type MissionControlAuditStatus = "PASS" | "REVIEW" | "FAIL";

export type MissionControlAuditItem = {
  key: string;
  title: string;
  status: MissionControlAuditStatus;
  message: string;
};

export type MissionControlAuditReport = {
  ok: boolean;
  version: "V15.B.16";
  checkedAt: string;
  totalChecks: number;
  pass: number;
  review: number;
  fail: number;
  checks: MissionControlAuditItem[];
};

function checkEndpointExists(endpoint: string) {
  return missionControlEndpointRegistry.some((item) => item.endpoint === endpoint);
}

function checkGroupExists(group: string) {
  return missionControlEndpointRegistry.some((item) => item.group === group);
}

export function runMissionControlAudit(): MissionControlAuditReport {
  const checks: MissionControlAuditItem[] = [
    {
      key: "registry-exists",
      title: "Endpoint registry",
      status: missionControlEndpointRegistry.length > 0 ? "PASS" : "FAIL",
      message: `${missionControlEndpointRegistry.length} endpoints registered.`,
    },
    {
      key: "gpt-status",
      title: "GPT Analyst wiring",
      status: checkEndpointExists("/api/gpt-analyst/status") ? "PASS" : "FAIL",
      message: "GPT Analyst status endpoint must be registered.",
    },
    {
      key: "claude-status",
      title: "Claude Risk wiring",
      status: checkEndpointExists("/api/claude-risk/status") ? "PASS" : "FAIL",
      message: "Claude Risk status endpoint must be registered.",
    },
    {
      key: "consensus-status",
      title: "Consensus wiring",
      status: checkEndpointExists("/api/consensus/status") ? "PASS" : "FAIL",
      message: "Consensus status endpoint must be registered.",
    },
    {
      key: "portfolio-brain",
      title: "Portfolio Brain wiring",
      status: checkEndpointExists("/api/portfolio-brain") ? "PASS" : "FAIL",
      message: "Portfolio Brain endpoint must be registered.",
    },
    {
      key: "execution-queue",
      title: "Execution wiring",
      status:
        checkEndpointExists("/api/execution/tickets") &&
        checkEndpointExists("/api/execution/queue")
          ? "PASS"
          : "FAIL",
      message: "Execution tickets and queue must be registered.",
    },
    {
      key: "broker-health",
      title: "Broker wiring",
      status: checkEndpointExists("/api/broker-health-monitor") ? "PASS" : "FAIL",
      message: "Broker health monitor must be registered.",
    },
    {
      key: "market-data",
      title: "Market wiring",
      status:
        checkEndpointExists("/api/market-data/status") &&
        checkEndpointExists("/api/market-regime/status")
          ? "PASS"
          : "REVIEW",
      message: "Market data and market regime should be registered.",
    },
    {
      key: "group-coverage",
      title: "Group coverage",
      status:
        checkGroupExists("AI") &&
        checkGroupExists("PORTFOLIO") &&
        checkGroupExists("EXECUTION") &&
        checkGroupExists("BROKER") &&
        checkGroupExists("MARKET")
          ? "PASS"
          : "REVIEW",
      message: "Core mission groups should be represented.",
    },
    {
      key: "telegram-prep",
      title: "Telegram preparation",
      status: "REVIEW",
      message: "Telegram payload preparation exists, but live sending remains intentionally disabled.",
    },
  ];

  const pass = checks.filter((item) => item.status === "PASS").length;
  const review = checks.filter((item) => item.status === "REVIEW").length;
  const fail = checks.filter((item) => item.status === "FAIL").length;

  return {
    ok: fail === 0,
    version: "V15.B.16",
    checkedAt: new Date().toISOString(),
    totalChecks: checks.length,
    pass,
    review,
    fail,
    checks,
  };
}
