import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    module: "Paper Trading API",
    version: "V10.2.1",
    status: "online",
    mode: "paper",
    timestamp: new Date().toISOString(),
  });
}