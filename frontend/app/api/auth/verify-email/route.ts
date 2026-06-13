export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: false, error: "Email-Verifizierung nicht aktiv" }, { status: 400 });
}
