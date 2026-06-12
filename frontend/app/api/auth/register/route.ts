import { NextResponse } from "next/server";
import { registerUser, ensureAdminExists } from "../../../../lib/auth/auth-store";
import { sendVerificationEmail } from "../../../../lib/auth/mailer";

export async function POST(request: Request) {
  try {
    ensureAdminExists();

    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const { username, email, password } = body;

    if (!username || !email || !password)
      return NextResponse.json({ ok: false, error: "Alle Felder sind erforderlich" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ ok: false, error: "Ungültige E-Mail Adresse" }, { status: 400 });
    if (username.length < 3)
      return NextResponse.json({ ok: false, error: "Benutzername muss mindestens 3 Zeichen haben" }, { status: 400 });

    const result = registerUser(username.trim(), email.trim().toLowerCase(), password);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 });

    // Send verification email
    const baseUrl = new URL(request.url).origin;
    const mailResult = await sendVerificationEmail(email, username, result.token!, baseUrl);

    if (!mailResult.ok) {
      // Email failed but user is registered — tell them to contact admin
      return NextResponse.json({
        ok: true,
        message: "Account erstellt, aber E-Mail konnte nicht gesendet werden. Bitte Admin kontaktieren.",
        emailSent: false,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Registrierung erfolgreich! Bitte prüfe deine E-Mail und bestätige den Link.",
      emailSent: true,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
