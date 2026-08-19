export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

function calculateRiskValues(input: {
  direction: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  accountSize?: number;
  riskPercent?: number;
}) {
  const accountSize = input.accountSize ?? 30000;
  const riskPercent = input.riskPercent ?? 1;

  const riskAmount = (accountSize * riskPercent) / 100;
  const riskPerUnit = Math.abs(input.entry - input.stopLoss);
  const rewardPerUnit = Math.abs(input.takeProfit - input.entry);

  const positionSize =
    riskPerUnit > 0 ? Number((riskAmount / riskPerUnit).toFixed(2)) : 0;

  const riskReward =
    riskPerUnit > 0 ? Number((rewardPerUnit / riskPerUnit).toFixed(2)) : 0;

  return {
    accountSize,
    riskPercent,
    riskAmount,
    riskReward,
    positionSize,
  };
}

export async function GET() {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      count: trades.length,
      trades,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Trades konnten nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entry = Number(body.entry);
    const stopLoss = Number(body.stopLoss);
    const takeProfit = Number(body.takeProfit);
    const accountSize = body.accountSize ? Number(body.accountSize) : 30000;
    const riskPercent = body.riskPercent ? Number(body.riskPercent) : 1;

    const riskValues = calculateRiskValues({
      direction: body.direction,
      entry,
      stopLoss,
      takeProfit,
      accountSize,
      riskPercent,
    });

    const trade = await prisma.trade.create({
      data: {
        market: body.market,
        direction: body.direction,
        strategy: body.strategy ?? "Unclassified",
        entry,
        stopLoss,
        takeProfit,
        notes: body.notes ?? "",
        accountSize: riskValues.accountSize,
        riskPercent: riskValues.riskPercent,
        riskAmount: riskValues.riskAmount,
        riskReward: riskValues.riskReward,
        positionSize: riskValues.positionSize,
      },
    });

    return NextResponse.json({
      success: true,
      trade,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Trade konnte nicht gespeichert werden.",
      },
      { status: 500 }
    );
  }
}

/**
 * Journal zurücksetzen — OFFENE Trades bleiben stehen (19.08.).
 *
 * VORHER: `prisma.trade.deleteMany()` ohne Filter, also ALLES, auch die noch
 * laufenden Positionen. Und der Bestätigungstext sprach von einer
 * "SQLite-Datenbank", während in Produktion PostgreSQL läuft — wer das liest,
 * denkt an eine lokale Testdatenbank und drückt sorglos.
 *
 * WAS DAS ANRICHTET. Ein gelöschter OFFENER Trade reisst die Verbindung
 * zwischen Broker-Position und System durch. Nachgewiesen am 19.08.: vier
 * offene Positionen bei Capital.com, null passende Zeilen in der Datenbank.
 * Daran hängt weit mehr als das Journal:
 *   - persistMeta() findet keine Zeile und speichert den Risiko-Zustand nicht
 *     mehr (beSet, partialDone, trailSL überleben keinen Neustart)
 *   - der Riegel gegen den doppelten Teilgewinn liest dieselben Zeilen
 *   - der RiskAgent fällt auf GERATENE Werte zurück (DAYTRADING, 72) und
 *     rechnet den Zeit-Exit mit 24 h statt der 168 h eines SWING-Trades
 *   - der Python-Lifecycle kann nach einem Neustart nicht nachregistriert
 *     werden, weil Stil und Confidence fehlen
 *
 * Dieselbe Fehlerklasse wie am 17.08.: ein Knopf nahm dem Tracker die Trades
 * aus der Hand. Deshalb hier NICHT nur ein besserer Warntext, sondern ein
 * Riegel im Code — die Oberfläche ist die falsche Stelle für eine Zusage.
 */
export async function DELETE() {
  try {
    const offen = await prisma.trade.count({ where: { status: "OPEN" } });
    const geloescht = await prisma.trade.deleteMany({
      where: { status: { not: "OPEN" } },
    });

    return NextResponse.json({
      success: true,
      geloescht: geloescht.count,
      offenBehalten: offen,
      message: offen > 0
        ? `${geloescht.count} abgeschlossene Trades gelöscht. `
          + `${offen} OFFENE Trades wurden BEHALTEN — sie gehören zu laufenden `
          + `Positionen beim Broker; ohne sie verliert das System deren `
          + `Risiko-Zustand, Handelsstil und Confidence.`
        : `${geloescht.count} Trades gelöscht. Es gab keine offenen.`,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Trading Journal konnte nicht zurückgesetzt werden.",
      },
      { status: 500 }
    );
  }
}
