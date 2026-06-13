export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, signToken } from "../../../../lib/auth/jwt";
import { updateUsername } from "../../../../lib/auth/auth-store";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: "Ungültige Session" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const { newUsername } = body;

    if (!newUsername?.trim())
      return NextResponse.json({ ok: false, error: "Benutzername erforderlich" }, { status: 400 });

    const result = await updateUsername(payload.sub, newUsername.trim());
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });

    const newToken = await signToken({ sub: payload.sub, username: newUsername.trim(), role: payload.role });
    const res = NextResponse.json({ ok: true, username: newUsername.trim() });
    res.cookies.set("auth_token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
