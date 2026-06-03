import { NextResponse } from "next/server";
import { regimeManager } from "../../../../lib/market-regime-engine";

export async function GET() {
  const regimes = [
    regimeManager.getRegime("XAUUSD", 3372, 0.3),
    regimeManager.getRegime("USOIL", 78, 0.05),
    regimeManager.getRegime("EURUSD", 1.08, 0.0002),
    regimeManager.getRegime("BTCUSD", 68300, 30),
  ];

  return NextResponse.json({
    success: true,
    regimes,
    count: regimes.length,
    updatedAt: new Date().toISOString(),
  });
}