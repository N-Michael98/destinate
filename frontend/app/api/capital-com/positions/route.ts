import { NextResponse } from "next/server";
import { getCapitalOpenPositions, closeCapitalPosition } from "../../../../lib/capital-com/capital-com-execution";
import { isCapitalConnected } from "../../../../lib/capital-com/capital-com-session";

export async function GET() {
  try {
    if (!isCapitalConnected()) {
      return NextResponse.json({ ok: true, positions: [], connected: false });
    }
    const result = await getCapitalOpenPositions();
    return NextResponse.json({ ok: result.ok, positions: result.positions ?? [], connected: true, error: result.error });
  } catch (error) {
    return NextResponse.json({ ok: false, positions: [], error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get("dealId");
    if (!dealId) return NextResponse.json({ ok: false, error: "dealId erforderlich" }, { status: 400 });

    const result = await closeCapitalPosition(dealId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
