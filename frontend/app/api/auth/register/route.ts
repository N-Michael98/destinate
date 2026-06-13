export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { registerUser, ensureAdminExists } from "../../../../lib/auth/auth-store";

export async function POST(request: Request) {
  try {
    await ensureAdminExists();

    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const { username, email, password } = body;

    if (!username || !email || !password)
      return NextResponse.json({ ok: false, error: "Alle Felder sind erforderlich" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ ok: false, error: "Ungültige E-Mail Adresse" }, { status: 400 });
    if (username.length < 3)
      return NextResponse.json({ ok: false, error: "Benutzername muss mindestens 3 Zeichen haben" }, { status: 400 });

    const result = await registerUser(username.trim(), email.trim().toLowerCase(), password);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });

    return NextResponse.json({
      ok: true,
      message: "Registrierung erfolgreich! Dein Account wartet auf Admin-Freigabe.",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
