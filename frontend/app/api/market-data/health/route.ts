import { NextResponse } from "next/server";

const PYTHON_BASE = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${PYTHON_BASE}/health`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json({ ok: true, backend: data, backendUrl: PYTHON_BASE, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Python backend offline", backendUrl: PYTHON_BASE, updatedAt: new Date().toISOString() },
      { status: 503 }
    );
  }
}