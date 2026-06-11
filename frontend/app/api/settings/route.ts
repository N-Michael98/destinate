import { NextResponse } from "next/server";
import {
  getSettings,
  updateBotSettings,
  updateRiskSettings,
  simulateBrokerConnect,
  simulateBrokerDisconnect,
} from "../../../lib/settings";

export async function GET() {
  return NextResponse.json({ ok: true, settings: getSettings() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action: string = body.action ?? "";

  if (action === "update_bot") {
    updateBotSettings(body.patch ?? {});
    return NextResponse.json({ ok: true, settings: getSettings() });
  }

  if (action === "update_risk") {
    updateRiskSettings(body.patch ?? {});
    return NextResponse.json({ ok: true, settings: getSettings() });
  }

  if (action === "broker_connect") {
    const result = simulateBrokerConnect(
      body.brokerKey,
      body.apiKey ?? "",
      body.accountMode ?? "DEMO"
    );
    return NextResponse.json({ ok: result.ok, accountId: result.accountId, error: result.error, settings: getSettings() });
  }

  if (action === "broker_disconnect") {
    simulateBrokerDisconnect(body.brokerKey);
    return NextResponse.json({ ok: true, settings: getSettings() });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
