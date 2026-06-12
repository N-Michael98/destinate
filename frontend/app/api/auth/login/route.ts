import { NextResponse } from "next/server";
import { findUserByUsername, verifyPassword, updateLastLogin, ensureAdminExists } from "../../../../lib/auth/auth-store";
import { signToken } from "../../../../lib/auth/jwt";

export async function POST(request: Request) {
  try {
    ensureAdminExists();

    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const { username, password } = body;

    if (!username || !password)
      return NextResponse.json({ ok: false, error: "Benutzername und Passwort erforderlich" }, { status: 400 });

    const user = findUserByUsername(username.trim());
    if (!user || !verifyPassword(password, user.passwordHash))
      return NextResponse.json({ ok: false, error: "Ungültige Anmeldedaten" }, { status: 401 });

    if (user.status === "PENDING_EMAIL")
      return NextResponse.json({ ok: false, error: "Bitte bestätige zuerst deine E-Mail-Adresse. Prüfe deinen Posteingang." }, { status: 403 });

    if (user.status === "PENDING_APPROVAL")
      return NextResponse.json({ ok: false, error: "Dein Account wartet auf Admin-Freigabe. Du erhältst eine Benachrichtigung." }, { status: 403 });

    const token = await signToken({ sub: user.id, username: user.username, role: user.role });
    updateLastLogin(user.id);

    const res = NextResponse.json({ ok: true, username: user.username, role: user.role });
    res.cookies.set("auth_token", token, {
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
