import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "../../../../lib/auth/jwt";
import { findUserById, toPublic } from "../../../../lib/auth/auth-store";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

    const user = findUserById(payload.sub);
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 401 });

    return NextResponse.json({ ok: true, user: toPublic(user) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
