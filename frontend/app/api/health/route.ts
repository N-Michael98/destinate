export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, app: "Destinate", timestamp: new Date().toISOString() });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
