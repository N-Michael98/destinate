export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

async function proxy(request: Request, path: string[]) {
  const PYTHON_BASE = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const target = `${PYTHON_BASE}/api/v1/${path.join("/")}${qs ? `?${qs}` : ""}`;

  try {
    const init: RequestInit = {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.text();
    }
    const res = await fetch(target, init);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Python backend offline", target },
      { status: 503 }
    );
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(request, path);
}
export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(request, path);
}
