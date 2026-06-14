export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

import { getEvolutionAllocationReport }
from "@/lib/evolution-allocation";

export async function GET() {
  return NextResponse.json({
    ok: true,

    report: getEvolutionAllocationReport(),
  });
}