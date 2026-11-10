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
  try {
    return await bearbeite(request);
  } catch (e) {
    // Ein Speicherfehler MUSS bis zur Oberfläche durchschlagen (06.09.).
    //
    // Bis heute verschluckte `saveToDB` jeden Schreibfehler und die Antwort
    // lautete trotzdem `{ ok: true, settings }` — mit dem NEUEN Wert, denn
    // `set()` hatte ihn vorher schon in den Speicher gelegt. Die Oberfläche
    // zeigte also eine Änderung an, die nie in der Datenbank ankam, und beim
    // nächsten Neustart war sie weg. Genau so verschwindet eine gesenkte
    // Freigabe-Schwelle, ohne dass jemand etwas merkt.
    const grund = e instanceof Error ? e.message : String(e);
    console.error("[settings] ⛔ Speichern fehlgeschlagen — NICHTS wurde geändert:", grund);
    return NextResponse.json(
      { ok: false, error: `Nicht gespeichert: ${grund}` },
      { status: 503 },
    );
  }
}

async function bearbeite(request: Request) {
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
    // IC Markets uses MCP token (no apiKey needed) — mark as connected directly
    if (body.brokerKey === "IC_MARKETS") {
      const { updateBrokerConnection } = await import("@/lib/settings/settings-store");
      // ── KEINE ERFUNDENE KONTONUMMER MEHR (09.11.) ────────────────────
      //
      // Hier stand eine Zufallszahl, die das Dashboard als "Account ID"
      // ausgab — direkt neben den ECHTEN Kontostaenden. Die echte Nummer war
      // da: `/api/icmarkets/connect` gibt `accountId: account.accountId`, und
      // die Oberflaeche ruft genau die Route VORHER auf.
      //
      // Fehlt sie, bleibt das Feld `null` und die Anzeige laesst die Zeile
      // weg, statt eine Nummer zu behaupten.
      const roh = typeof body.accountId === "string" ? body.accountId.trim() : "";
      const echteId = roh === "" ? null : roh;
      await updateBrokerConnection({ brokerKey: "IC_MARKETS", connected: true, accountId: echteId, accountMode: "DEMO", lastConnectedAt: new Date().toISOString(), error: null });
      return NextResponse.json({ ok: true, accountId: echteId, error: null, settings: await getSettings() });
    }
    const result = await simulateBrokerConnect(
      body.brokerKey,
      body.apiKey ?? "",
      body.accountMode ?? "DEMO",
      // Die ECHTE Nummer vom Broker, die der Aufrufer schon hat.
      typeof body.accountId === "string" ? body.accountId : null,
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
