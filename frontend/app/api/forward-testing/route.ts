import { NextResponse } from "next/server";
import { generateForwardTestingReport } from "../../../lib/forward-testing";
import { loadLivePricesFromPython } from "../../../lib/forward-testing/forward-testing-engine";

export async function GET() {
  // Echte Preise + ATR von Python laden bevor Report generiert wird
  await loadLivePricesFromPython();

  const report = generateForwardTestingReport();

  return NextResponse.json({
    ok: true,
    report,
    pythonPrices: true,
  });
}
