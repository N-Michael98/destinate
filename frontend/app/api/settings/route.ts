export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import {
  getSettings,
  updateBotSettings,
  updateRiskSettings,
  simulateBrokerConnect,
  simulateBrokerDisconnect,
} from "../../../lib/settings";

export async function GET() {
  return NextResponse.json({ ok: true, settings: await getSettings() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action: string = body.action ?? "";

  if (action === "update_bot") {
    await updateBotSettings(body.patch ?? {});
    return NextResponse.json({ ok: true, settings: await getSettings() });
  }

  if (action === "update_risk") {
    await updateRiskSettings(body.patch ?? {});
    return NextResponse.json({ ok: true, settings: await getSettings() });
  }

  if (action === "broker_connect") {
    const result = await simulateBrokerConnect(
      body.brokerKey,
      body.apiKey ?? "",
      body.accountMode ?? "DEMO"
    );
    return NextResponse.json({ ok: result.ok, accountId: result.accountId, error: result.error, settings: await getSettings() });
  }

  if (action === "broker_disconnect") {
    await simulateBrokerDisconnect(body.brokerKey);
    return NextResponse.json({ ok: true, settings: await getSettings() });
  }

  if (action === "reset_daily_counter") {
    const today = new Date().toISOString().slice(0, 10);
    if (global.__daily_trades__) {
      global.__daily_trades__ = { date: today, count: 0, byStyle: {} };
    }
    // Also clear Redis counter
    try {
      const { cacheSet } = await import("../../../lib/cache/redis-cache");
      await cacheSet(`daily_trades:${today}`, { count: 0, byStyle: {} }, 90000);
    } catch { /* non-fatal */ }
    return NextResponse.json({ ok: true, message: "Tages-Counter zurückgesetzt" });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
