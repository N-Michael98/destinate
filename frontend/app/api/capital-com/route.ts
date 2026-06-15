export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import {
  connectCapital,
  disconnectCapital,
  getCapitalSession,
  isCapitalConnected,
  autoReconnectCapital,
  getSavedCredentials,
  getLastReconnectError,
} from "../../../lib/capital-com";
import { capitalGetPrices } from "../../../lib/capital-com/capital-com-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? "status";

    // Only reconnect on explicit action=reconnect, not on every status check
    // (prevents Capital.com rate limiting from 20s polling)
    let reconnectError: string | null = getLastReconnectError();
    if (action === "reconnect" && !isCapitalConnected()) {
      const r = await autoReconnectCapital();
      reconnectError = r.ok ? null : (r.error ?? "Unbekannter Fehler");
    }

    if (action === "status") {
      const connected = isCapitalConnected();
      const session = getCapitalSession();
      const saved = await getSavedCredentials();
      return NextResponse.json({
        ok: true,
        connected,
        accountId: session?.accountId ?? null,
        accountType: session?.accountType ?? null,
        connectedAt: session?.connectedAt ?? null,
        accounts: session?.accounts ?? [],
        balance: session?.balance ?? null,
        currency: session?.currency ?? null,
        savedIdentifier: saved?.identifier ?? null,
        hasSavedCredentials: !!saved,
        reconnectError,
      });
    }

    if (action === "debug") {
      // DB diagnostic — shows exactly what's in CapitalCredentials table
      const saved = await getSavedCredentials();
      return NextResponse.json({
        ok: true,
        dbHasCredentials: !!saved,
        savedIdentifier: saved?.identifier ?? null,
        sessionInMemory: isCapitalConnected(),
        reconnectError,
      });
    }

    if (action === "prices") {
      const session = getCapitalSession();
      if (!session) return NextResponse.json({ ok: false, error: "Not connected" }, { status: 401 });
      const result = await capitalGetPrices(session.apiKey, session.cst, session.securityToken);
      return NextResponse.json({ ok: result.ok, prices: result.prices, error: result.error });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const action = body.action ?? "";

    if (action === "connect") {
      const { apiKey, login, password } = body;
      if (!apiKey || !login || !password) {
        return NextResponse.json({ ok: false, error: "apiKey, login und password erforderlich" }, { status: 400 });
      }
      const result = await connectCapital(apiKey, login, password);
      return NextResponse.json(result);
    }

    if (action === "disconnect") {
      await disconnectCapital();
      return NextResponse.json({ ok: true, connected: false });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
