import { NextResponse } from "next/server";
import { generateEconomicCalendarReport } from "@/lib/economic-calendar";

export async function GET() {
  const report = generateEconomicCalendarReport();

  return NextResponse.json({
    ok: true,
    report,
  });
}