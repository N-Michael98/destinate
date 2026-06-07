import { NextResponse } from "next/server";
import { getBrokerRoutingLayerReport } from "../../../lib/broker-routing-layer";

export async function GET() {
  const report = getBrokerRoutingLayerReport();

  return NextResponse.json({
    ok: true,
    report,
    timestamp: new Date().toISOString(),
  });
}
