import { NextResponse } from "next/server";
import { getCapitalSession, isCapitalConnected } from "../../../../lib/capital-com/capital-com-session";
import { capitalGetAvailableMarkets, capitalSearchMarkets } from "../../../../lib/capital-com/capital-com-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get("q") ?? "";
    const types = searchParams.get("types") ?? "CURRENCIES,INDICES,COMMODITIES,CRYPTOCURRENCIES";

    if (!isCapitalConnected()) {
      return NextResponse.json({ ok: false, connected: false, markets: [], error: "Capital.com nicht verbunden" });
    }

    const session = getCapitalSession()!;
    const instrumentTypes = types.split(",").map((t) => t.trim());

    const result = searchTerm
      ? await capitalSearchMarkets(session.apiKey, session.cst, session.securityToken, searchTerm)
      : await capitalGetAvailableMarkets(session.apiKey, session.cst, session.securityToken, instrumentTypes);

    return NextResponse.json({ ok: result.ok, connected: true, markets: result.markets ?? [], total: result.markets?.length ?? 0, error: result.error });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
