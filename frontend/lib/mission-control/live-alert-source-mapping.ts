import { createTelegramAlertPayload } from "@/lib/mission-control-telegram-alerts";

export type LiveAlertSource = {
  key: string;
  label: string;
  endpoint: string;
  group?: string;
  critical?: boolean;
  status: "READY" | "WARNING" | "ERROR" | "LOADING";
  summary: string;
};

export function mapHealthScannerToAlertSources(sources: LiveAlertSource[]) {
  return sources
    .filter((source) => source.status === "ERROR" || source.status === "WARNING")
    .map((source) =>
      createTelegramAlertPayload({
        level: source.status === "ERROR" ? "CRITICAL" : "REVIEW",
        title: `${source.label} ${source.status}`,
        message: `[${source.group || "UNKNOWN"}] ${source.endpoint} - ${source.summary}`,
        endpoint: source.endpoint,
      })
    );
}
