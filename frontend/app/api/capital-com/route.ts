import { NextResponse } from "next/server";
import {
  connectCapital,
  disconnectCapital,
  getCapitalSession,
  isCapitalConnected,
  capitalGetPrices,
} from "../../../lib/capital-com";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? "status";

    if (action === "status") {
      const connected = isCapitalConnected();
      const session = getCapitalSession();
      return NextResponse.json({
        ok: true,
        connected,
        accountId: session?.accountId ?? null,
        accountType: session?.accountType ?? null,
        connectedAt: session?.connectedAt ?? null,
        accounts: session?.accounts ?? [],
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
