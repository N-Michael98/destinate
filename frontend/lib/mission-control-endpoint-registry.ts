export type MissionControlEndpointGroup =
  | "CORE"
  | "AI"
  | "PORTFOLIO"
  | "EXECUTION"
  | "BROKER"
  | "MARKET"
  | "EVOLUTION"
  | "LEARNING";

export type MissionControlEndpoint = {
  key: string;
  label: string;
  endpoint: string;
  group: MissionControlEndpointGroup;
  critical: boolean;
  description: string;
};

export const missionControlEndpointRegistry: MissionControlEndpoint[] = [
  {
    key: "dependency",
    label: "Dependency Scanner",
    endpoint: "/api/dependency-scanner",
    group: "CORE",
    critical: true,
    description: "Checks system dependency health and broken chains.",
  },
  {
    key: "portfolio",
    label: "Portfolio Brain",
    endpoint: "/api/portfolio-brain",
    group: "PORTFOLIO",
    critical: true,
    description: "Portfolio decision core and exposure intelligence.",
  },
  {
    key: "consensus",
    label: "Consensus Engine",
    endpoint: "/api/consensus/status",
    group: "AI",
    critical: true,
    description: "AI agreement layer between GPT, Claude and system logic.",
  },
  {
    key: "gptAnalyst",
    label: "GPT Analyst",
    endpoint: "/api/gpt-analyst/status",
    group: "AI",
    critical: true,
    description: "GPT/OpenAI analyst status layer.",
  },
  {
    key: "claudeRisk",
    label: "Claude Risk",
    endpoint: "/api/claude-risk/status",
    group: "AI",
    critical: true,
    description: "Claude risk assessment status layer.",
  },
  {
    key: "executionTickets",
    label: "Execution Tickets",
    endpoint: "/api/execution/tickets",
    group: "EXECUTION",
    critical: true,
    description: "Prepared trade tickets before execution queue.",
  },
  {
    key: "executionQueue",
    label: "Execution Queue",
    endpoint: "/api/execution/queue",
    group: "EXECUTION",
    critical: true,
    description: "Pending paper/demo execution queue.",
  },
  {
    key: "brokerHealth",
    label: "Broker Health",
    endpoint: "/api/broker-health-monitor",
    group: "BROKER",
    critical: true,
    description: "Broker infrastructure health monitor.",
  },
  {
    key: "marketData",
    label: "Market Data",
    endpoint: "/api/market-data/status",
    group: "MARKET",
    critical: true,
    description: "Market data availability and status.",
  },
  {
    key: "marketRegime",
    label: "Market Regime",
    endpoint: "/api/market-regime/status",
    group: "MARKET",
    critical: false,
    description: "Market regime classification status.",
  },
  {
    key: "opportunity",
    label: "Opportunity Scanner",
    endpoint: "/api/opportunity-scanner",
    group: "MARKET",
    critical: false,
    description: "Opportunity scanner and market setup discovery.",
  },
  {
    key: "evolution",
    label: "Evolution Governance",
    endpoint: "/api/evolution-governance",
    group: "EVOLUTION",
    critical: false,
    description: "Evolution governance and species safety logic.",
  },
  {
    key: "learning",
    label: "Learning Feedback",
    endpoint: "/api/learning-feedback-integration",
    group: "LEARNING",
    critical: false,
    description: "Learning feedback and outcome integration.",
  },
];

export function getCriticalMissionEndpoints() {
  return missionControlEndpointRegistry.filter((endpoint) => endpoint.critical);
}

export function getMissionEndpointsByGroup(group: MissionControlEndpointGroup) {
  return missionControlEndpointRegistry.filter((endpoint) => endpoint.group === group);
}
