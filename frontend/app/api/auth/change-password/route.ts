import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "../../../../lib/auth/jwt";
import { findUserById, verifyPassword } from "../../../../lib/auth/auth-store";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), ".users.json");

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ ok: false, error: "Nicht angemeldet" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: "Ungültige Session" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ ok: false, error: "Alle Felder erforderlich" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ ok: false, error: "Neues Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });
    }

    const user = findUserById(payload.sub);
    if (!user) return NextResponse.json({ ok: false, error: "User nicht gefunden" }, { status: 404 });

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json({ ok: false, error: "Aktuelles Passwort ist falsch" }, { status: 401 });
    }

    // Update password in file
    const users = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    const updated = users.map((u: { id: string; passwordHash: string }) =>
      u.id === user.id ? { ...u, passwordHash: bcrypt.hashSync(newPassword, 12) } : u
    );
    fs.writeFileSync(DB_PATH, JSON.stringify(updated, null, 2), "utf-8");

    // Update global cache
    if (global.__users__) {
      global.__users__ = global.__users__.map((u) =>
        u.id === user.id ? { ...u, passwordHash: bcrypt.hashSync(newPassword, 12) } : u
      );
    }

    return NextResponse.json({ ok: true, message: "Passwort erfolgreich geändert" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
