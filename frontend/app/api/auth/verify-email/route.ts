import { NextResponse } from "next/server";
import { verifyEmailToken } from "../../../../lib/auth/auth-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";

  if (!token) return NextResponse.json({ ok: false, error: "Kein Token angegeben" }, { status: 400 });

  const result = verifyEmailToken(token);
  return NextResponse.json(result.ok ? { ok: true } : { ok: false, error: result.error }, { status: result.ok ? 200 : 400 });
}
