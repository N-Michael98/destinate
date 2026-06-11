import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "../../../../lib/auth/jwt";
import { getAllUsers, approveUser, deleteUser } from "../../../../lib/auth/auth-store";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "ADMIN") return null;
  return payload;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Admin required" }, { status: 403 });
  return NextResponse.json({ ok: true, users: getAllUsers() });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Admin required" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, string>;
  const { action, userId } = body;

  if (action === "approve") {
    const ok = approveUser(userId);
    return NextResponse.json({ ok, error: ok ? undefined : "User nicht gefunden" });
  }
  if (action === "delete") {
    const ok = deleteUser(userId);
    return NextResponse.json({ ok, error: ok ? undefined : "Kann Admin nicht löschen" });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
