/**
 * IC Markets Journal Sync
 * Reads closed deals from cTrader via get_deals and updates Trade DB records.
 * Mirrors capital-trade-tracker.ts pattern.
 */

import { getPrisma } from "../../app/lib/prisma";
import { isICMarketsConnected } from "./icmarkets-session";
// `zeitOderNull` kommt aus dem Client: EINE Umsetzung, nicht zwei. Zwei
// Fassungen desselben Lesewegs koennten auseinanderlaufen — dieselbe
// Begruendung wie bei `htmlSicher` (31.10.) und `cacheLesen` (01.11.).
import { icGetDeals, zeitOderNull } from "./icmarkets-client";
import { lesbareRichtung, richtungAnzeige } from "../richtung/richtung";

interface ICDeal {
  positionId: string;
  symbol: string;
  /**
   * `null` heisst: der Broker hat KEINE lesbare Richtung geschickt.
   *
   * Bis zum 08.11. stand hier `?? "BUY"`. Ehrlich zur Reichweite, im Code
   * nachgezaehlt und NICHT vermutet: anders als bei Capital.com landet
   * dieser Wert NICHT in der `Trade`-Tabelle — das UPDATE unten setzt
   * `status`, `result`, `profitLoss`, `closePrice`, `updatedAt` und
   * `notes`, keine Richtung. Die erfundene Richtung ging also allein in
   * eine LOGZEILE. Kein Geld, aber dieselbe Luege, und ein Log ist das
   * Werkzeug, mit dem man die naechste Ursache sucht.
   */
  direction: string | null;
  volume: number;
  entryPrice: number;
  closePrice: number;
  netProfit: number;
  /**
   * `null` heisst: der Broker hat KEINEN Schlusszeitpunkt geschickt (08.11.).
   *
   * Bis dahin stand hier `?? new Date().toISOString()` — und der Wert geht
   * als `notes.icClosedAt` in die DATENBANK. Ein Datensatz, der eine Zeit
   * behauptet, die es nicht gab, ist schlimmer als ein Log, der es tut: Logs
   * sind nach Tagen weg, Datensaetze liest man Monate spaeter zur
   * Rekonstruktion. Heute hat `icClosedAt` null Leser — genau deshalb jetzt,
   * solange es nichts kostet.
   *
   * Umgerechnet wird NICHT: ob cTrader eine Zone mitschickt, ist ungemessen
   * (Capital.com tut es nicht, 22.09.). Hier wird nur nichts erfunden.
   */
  closeTime: string | null;
}

async function getClosedDeals(fromTimestamp?: number): Promise<ICDeal[]> {
  const res = await icGetDeals(fromTimestamp);
  if (!res.ok || !res.deals?.length) return [];
  return res.deals.map((d) => ({
    positionId: String(d.positionId ?? d.dealId ?? d.id ?? ""),
    symbol: String(d.symbol ?? d.symbolName ?? ""),
    // Dieselbe Lesart wie im ganzen Programm (`lib/richtung/richtung.ts`).
    direction: lesbareRichtung(d.tradeSide ?? d.direction),
    volume: Number(d.volume ?? 0),
    entryPrice: Number(d.entryPrice ?? d.openPrice ?? 0),
    closePrice: Number(d.closePrice ?? d.exitPrice ?? 0),
    netProfit: Number(d.netProfit ?? d.profitLoss ?? 0),
    // Leer bleibt leer — Begruendung am Feld oben.
    closeTime: zeitOderNull(d.closeTime ?? d.closeTimestamp),
  }));
}

export async function syncICMarketsJournal(): Promise<{ synced: number; skipped: number }> {
  if (!isICMarketsConnected()) return { synced: 0, skipped: 0 };

  const db = getPrisma();
  let synced = 0;
  let skipped = 0;

  // Only look at last 7 days
  const fromTs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const deals = await getClosedDeals(fromTs);

  for (const deal of deals) {
    if (!deal.positionId || deal.netProfit === 0) { skipped++; continue; }

    // Find matching open trade by icPositionId in notes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trades = await (db.$queryRawUnsafe as any)(
      `SELECT id, status, notes FROM "Trade"
       WHERE notes::text LIKE $1
         AND status = 'OPEN'
       LIMIT 1`,
      `%"icPositionId":"${deal.positionId}"%`
    ) as Array<{ id: number; status: string; notes: string }>;

    if (!trades.length) { skipped++; continue; }

    const trade = trades[0];
    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(trade.notes); } catch { /* ok */ }

    const profitLoss = deal.netProfit;
    const result = profitLoss > 0.01 ? "WIN" : profitLoss < -0.01 ? "LOSS" : "BREAKEVEN";

    await db.$executeRawUnsafe(
      `UPDATE "Trade"
       SET status = 'CLOSED',
           result = $1,
           "profitLoss" = $2,
           "closePrice" = $3,
           "updatedAt" = NOW(),
           notes = $4
       WHERE id = $5`,
      result,
      profitLoss,
      deal.closePrice,
      // FEHLT die Zeit, wird der SCHLUESSEL weggelassen (08.11.) — nicht ein
      // erfundener Wert eingetragen. Dieselbe Regel wie bei `dealId` und
      // `signalQuelle` (30.09./30.10.): ein fehlendes Feld ist ehrlich, ein
      // erfundenes macht aus "nicht gemessen" eine Messung.
      JSON.stringify({
        ...meta,
        icClosePrice: deal.closePrice,
        ...(deal.closeTime === null ? {} : { icClosedAt: deal.closeTime }),
        source: "ic-sync",
      }),
      trade.id
    );

    // `richtungAnzeige` statt der rohen Richtung: eine fehlende Richtung
    // heisst hier "—" und eine unbekannte "LONG?" — nicht "BUY". Ein Log,
    // das eine Richtung erfindet, ist genau das Werkzeug, mit dem man
    // hinterher die falsche Ursache sucht.
    console.log(`[ic-journal-sync] ${deal.symbol} ${richtungAnzeige(deal.direction)} → ${result} CHF ${profitLoss.toFixed(2)}`);
    synced++;
  }

  return { synced, skipped };
}
