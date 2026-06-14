export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  const PYTHON_BASE = (process.env["PYTHON_BACKEND_URL"] as string) ?? "http://localhost:8000";
  try {
    const res = await fetch(`${PYTHON_BASE}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    return NextResponse.json({ ok: true, backend: data, backendUrl: PYTHON_BASE, updatedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err), backendUrl: PYTHON_BASE, updatedAt: new Date().toISOString() },
      { status: 503 }
    );
  }
}
