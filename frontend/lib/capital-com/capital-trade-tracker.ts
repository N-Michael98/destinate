// Capital.com Trade Tracker
// Saves executed trades to DB, monitors positions for SL/TP hit, updates Journal

import { getPrisma } from "../../app/lib/prisma";

export interface TradeRecord {
  /** Die ECHTE Positions-ID des Brokers. Leer, solange sie unbekannt ist —
   *  hier darf NIEMALS eine Order-Referenz stehen (19.08.). */
  dealId: string;
  /** Die Order-Referenz (`o_...`). Bis zum 19.08. landete sie ersatzweise im
   *  Feld dealId und machte den Eintrag damit dauerhaft unauffindbar: eine
   *  Referenz passt zu keiner Positions-ID. Jetzt steht sie hier, und der
   *  Tracker traegt die echte dealId nach, sobald die Bestaetigung lesbar
   *  wird. */
  dealReference?: string;
  symbol: string;
  direction: "BUY" | "SELL";
  tradingStyle: string;
  strategy: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  size: number;
  accountBalance: number;
  riskPercent: number;
  confidence: number;
  icPositionId?: string; // IC Markets position ID if also executed there
  entryContext?: Record<string, unknown>; // Marktbedingungen beim Entry (für Analysis Engine)
  /** Order abgeschickt, Bestaetigung nicht lesbar (17.08.). Landet in den
   *  Notizen, damit ein Phantom-Trade spaeter erkennbar ist: gab es die
   *  Position nie, schliesst der Tracker sie als BREAKEVEN mit P&L 0 —
   *  ununterscheidbar von einem echten Nulltrade. */
  unbestaetigt?: boolean;
}

export async function saveCapitalTradeToJournal(trade: TradeRecord): Promise<void> {
  try {
    const db = getPrisma();
    const riskAmount = trade.accountBalance * (trade.riskPercent / 100);
    const riskPerUnit = Math.abs(trade.entry - trade.stopLoss);
    const rewardPerUnit = Math.abs(trade.takeProfit - trade.entry);
    const riskReward = riskPerUnit > 0 ? Number((rewardPerUnit / riskPerUnit).toFixed(2)) : 0;
    const positionSize = trade.size;

    await db.$executeRawUnsafe(
      `INSERT INTO "Trade" (
        "market", "direction", "strategy", "entry", "stopLoss", "takeProfit",
        "status", "result", "profitLoss", "accountSize", "riskPercent", "riskAmount",
        "riskReward", "positionSize", "notes", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'OPEN', 'OPEN', 0, $7, $8, $9, $10, $11, $12,
        NOW(), NOW()
      )`,
      trade.symbol,
      trade.direction,
      `${trade.tradingStyle} | ${trade.strategy}`,
      trade.entry,
      trade.stopLoss > 0 ? trade.stopLoss : 0,
      trade.takeProfit > 0 ? trade.takeProfit : 0,
      trade.accountBalance,
      trade.riskPercent,
      riskAmount,
      riskReward,
      positionSize,
      JSON.stringify({
        // dealId nur setzen, wenn es eine ECHTE Positions-ID ist. Ein leerer
        // Wert ist ehrlicher als eine Order-Referenz, die nie passt.
        ...(trade.dealId ? { dealId: trade.dealId } : {}),
        ...(trade.dealReference ? { dealReference: trade.dealReference } : {}),
        tradingStyle: trade.tradingStyle,
        confidence: trade.confidence,
        broker: "Capital.com DEMO",
        source: "auto-scan",
        ...(trade.icPositionId ? { icPositionId: trade.icPositionId } : {}),
        ...(trade.entryContext ? { entryContext: trade.entryContext } : {}),
        ...(trade.unbestaetigt ? { unbestaetigt: true } : {}),
      })
    );
    console.log(`[trade-tracker] Saved trade: ${trade.symbol} ${trade.direction} (${trade.tradingStyle}) deal=${trade.dealId}`);
  } catch (err) {
    console.error("[trade-tracker] Failed to save trade:", err);
  }
}

// Called from background monitor — fetches open Capital.com positions and closes finished trades
/**
 * Leitet aus dem echten Schlusskurs ab, WARUM ein Trade endete (09.08.).
 *
 * exitPosition ist die objektive Zahl: 0 = am Stop, 1 = am Ziel. Sie bleibt
 * auch dann brauchbar, wenn die Einteilung spaeter anders gezogen wird. Die
 * 5 %-Toleranz ist die einzige gewaehlte Zahl: gross genug fuer Schlupf beim
 * Schliessen, klein genug, um einen Trailing-Ausstieg nahe am Ziel nicht
 * faelschlich als "Ziel" zu zaehlen.
 *
 * ALS EIGENE FUNKTION SEIT 17.08. Vorher stand die Ableitung nur im Hauptpfad.
 * Der P&L-Nachtrag weiter unten korrigiert Ergebnis und P&L, setzte aber
 * KEINEN Ausstiegsgrund — und genau ueber diesen Weg laufen Trades, die der
 * manuelle Journal-Abgleich (sync-journal) vorher geschlossen hat. Der schreibt
 * status CLOSED und result 'CLOSED' ohne P&L und ohne Grund, und nimmt den
 * Trade damit dem Tracker aus der Hand: der sieht nur status = 'OPEN'.
 *
 * NACHGEWIESEN am Wochen-Report vom 16.08.: der Abschnitt "Nach Ausstiegsgrund"
 * fehlte GANZ, sieben Tage nach dem Einbau — weil kein einziger Trade einen
 * hatte. Die Auswertung zeigt den Abschnitt nur, wenn mindestens einer benannt
 * ist.
 *
 * Fuer SELL liegt das Ziel UNTER dem Stop — die Formel dreht sich mit, weil
 * die Spanne dann negativ ist. 0 bleibt Stop, 1 bleibt Ziel.
 */
export function ausstiegsgrund(
  schlusskurs: number | null,
  stopLoss: number,
  takeProfit: number,
): { exitPosition: number | null; exitReason: string } {
  if (schlusskurs === null || !Number.isFinite(schlusskurs)) {
    return { exitPosition: null, exitReason: "KEIN_SCHLUSSKURS" };
  }
  const spanne = Number(takeProfit) - Number(stopLoss);
  if (!Number.isFinite(spanne) || Math.abs(spanne) === 0) {
    return { exitPosition: null, exitReason: "UNBEKANNT" };
  }
  const exitPosition = (schlusskurs - Number(stopLoss)) / spanne;
  if (!Number.isFinite(exitPosition)) {
    return { exitPosition: null, exitReason: "UNBEKANNT" };
  }
  const exitReason = exitPosition >= 0.95 ? "ZIEL"
    : exitPosition <= 0.05 ? "STOP"
    : "DAZWISCHEN";
  return { exitPosition: Number(exitPosition.toFixed(4)), exitReason };
}

/**
 * Meldet dem Python-Lifecycle, dass ein Trade geschlossen ist (18.08.).
 *
 * WARUM DAS FEHLTE. `pyCloseTrade()` existierte seit jeher, hatte aber KEINEN
 * einzigen Aufrufer. Der Python-Lifecycle raeumte seinen Trade damit nie aus
 * `_trades` — ein Eintrag je jemals eroeffnetem Trade blieb bis zum naechsten
 * Neustart des Dienstes liegen. `open_trades` in /lifecycle/stats zaehlte
 * entsprechend falsch, und das Ereignis TRADE_CLOSED konnte nie feuern.
 *
 * Der Nutzer verliert dadurch KEINE Meldung: die Telegram-Nachricht zum
 * geschlossenen Trade kommt von hier (notifyTradeClosed), nicht aus Python.
 * Was fehlte, war das Aufraeumen.
 *
 * Bewusst non-fatal und ohne Rueckgabe: ist Python nicht erreichbar, laeuft
 * das System regelbasiert weiter — genau wie bei allen anderen py-Aufrufen.
 */
async function meldeSchliessungAnPython(
  dealId: string,
  profitLoss: number,
  grund: string,
): Promise<void> {
  if (!dealId) return;
  try {
    const { pyCloseTrade } = await import("../python-backend/python-client");
    await pyCloseTrade(dealId, Number.isFinite(profitLoss) ? profitLoss : 0, grund || "CLOSED");
  } catch (e) {
    console.warn(`[trade-tracker] Python-Lifecycle nicht ueber Schliessung informiert (deal=${dealId}):`,
      e instanceof Error ? e.message : String(e));
  }
}

/** Nach so vielen vergeblichen Versuchen wird die Referenz nicht mehr
 *  aufgeloest. Capital.com haelt Bestaetigungen nur begrenzte Zeit vor; ewig
 *  weiterzufragen waere Last ohne Aussicht. */
export const DEALID_VERSUCHE_MAX = 5;

/**
 * Traegt fehlende Positions-IDs nach (19.08.).
 *
 * Scheitert der Bestaetigungsschritt beim Auftragen, kennt das Journal nur die
 * Order-Referenz. Seit dem 19.08. steht sie in `dealReference` statt sich als
 * `dealId` auszugeben — ehrlich, aber der Eintrag bleibt damit vorerst
 * unauffindbar fuer persistMeta, teilgewinnStand, stammdatenAusNotizen und
 * nachzuregistrieren. Diese Funktion holt die echte ID nach.
 *
 * Sie laeuft im selben Zyklus wie der Rest des Trackers, also alle zwei
 * Minuten — frueh genug, solange Capital die Bestaetigung noch vorhaelt.
 *
 * Non-fatal in jedem Zweig: ein Fehlschlag hier darf den Tracker nicht
 * anhalten.
 */
export async function ergaenzeFehlendeDealIds(
  apiKey: string, cst: string, securityToken: string,
): Promise<{ geprueft: number; ergaenzt: number; aufgegeben: number }> {
  const bilanz = { geprueft: 0, ergaenzt: 0, aufgegeben: 0 };
  try {
    const db = getPrisma();
    const rows = await (db.$queryRawUnsafe as (q: string) => Promise<Array<{ id: number; notes: string }>>)(
      `SELECT id, notes FROM "Trade" WHERE status = 'OPEN' AND notes LIKE '%dealReference%'`
    );
    const { capitalConfirmDeal } = await import("./capital-com-client");

    for (const zeile of rows ?? []) {
      let m: Record<string, unknown>;
      try { m = JSON.parse(zeile.notes) as Record<string, unknown>; } catch { continue; }
      if (m.dealId) continue;                       // schon aufgeloest
      const ref = String(m.dealReference ?? "");
      if (!ref) continue;
      const versuche = Number(m.dealIdVersuche ?? 0);
      if (versuche >= DEALID_VERSUCHE_MAX) continue; // aufgegeben, siehe unten

      bilanz.geprueft++;
      const a = await capitalConfirmDeal(apiKey, cst, securityToken, ref);
      const neu: Record<string, unknown> = { ...m, dealIdVersuche: versuche + 1 };

      if (a.ok && a.dealId) {
        neu.dealId = a.dealId;
        bilanz.ergaenzt++;
        console.log(`[trade-tracker] dealId nachgetragen: ref=${ref} -> ${a.dealId}`);
      } else if (a.ok && a.abgelehnt) {
        // Es wird nie eine Position geben — nicht weiter fragen.
        neu.dealIdVersuche = DEALID_VERSUCHE_MAX;
        neu.exitReason = "NIE_BESTAETIGT";
        bilanz.aufgegeben++;
        console.warn(`[trade-tracker] Order ${ref} wurde abgelehnt/geloescht — keine Position`);
      } else if (versuche + 1 >= DEALID_VERSUCHE_MAX) {
        bilanz.aufgegeben++;
        console.warn(`[trade-tracker] dealId zu ref=${ref} nach ${DEALID_VERSUCHE_MAX} `
          + `Versuchen nicht aufloesbar (${a.error ?? "?"}) — der Eintrag bleibt ohne `
          + `Positions-ID und damit ohne Risiko-Zustand, Teilgewinn-Riegel und Nachregistrieren`);
      }

      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "notes" = $1 WHERE "id" = $2`,
        JSON.stringify(neu), zeile.id
      );
    }
  } catch (e) {
    console.warn("[trade-tracker] Nachtragen der dealIds uebersprungen:",
      e instanceof Error ? e.message : String(e));
  }
  return bilanz;
}

export async function syncCapitalPositionsToJournal(): Promise<void> {
  try {
    const { getCapitalSession, isCapitalConnected } = await import("./capital-com-session");
    const { capitalGetPositions, capitalGetClosedPositions } = await import("./capital-com-client");

    if (!isCapitalConnected()) return;
    const session = getCapitalSession()!;

    // ZUERST fehlende Positions-IDs nachtragen (19.08.). Muss vor dem Abgleich
    // unten laufen: ein Eintrag ohne dealId laesst sich mit keiner offenen
    // Position vergleichen und saehe sonst aus wie eine verschwundene.
    await ergaenzeFehlendeDealIds(session.apiKey, session.cst, session.securityToken);

    const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
    if (!posResult.ok) return;

    const openDealIds = new Set(
      (posResult.positions ?? []).map((p) => p.dealId ?? "").filter(Boolean)
    );

    // Fetch recent transactions for P&L (last 24h) — more reliable than activity endpoint
    const DEMO_BASE = "https://demo-api-capital.backend-capital.com/api/v1";
    const txRes = await fetch(`${DEMO_BASE}/history/transactions?lastPeriod=86400`, {
      headers: { "X-CAP-API-KEY": session.apiKey, "CST": session.cst, "X-SECURITY-TOKEN": session.securityToken },
    });
    const txData = txRes.ok ? (await txRes.json() as { transactions?: Record<string, unknown>[] }) : { transactions: [] };
    // Map: dealId → P&L (size field)
    const pnlByDealId = new Map<string, number>();
    const marketByDealId = new Map<string, string>();
    for (const tx of txData.transactions ?? []) {
      if (String(tx.transactionType ?? "") !== "TRADE") continue;
      const dealId = String(tx.dealId ?? tx.reference ?? "");
      const pnlRaw = tx.size ?? tx.profitAndLoss ?? 0;
      const pnl = typeof pnlRaw === "string" ? parseFloat(String(pnlRaw).replace("+", "")) || 0 : Number(pnlRaw);
      if (dealId) { pnlByDealId.set(dealId, pnl); marketByDealId.set(dealId, String(tx.instrumentName ?? "")); }
    }

    // ── P&L-Match über openPrice (BEWIESEN 26.07. via /api/debug-pnl) ────────
    // Capital vergibt beim Schliessen eine ANDERE dealId als beim Öffnen → der
    // direkte dealId-Match (pnlByDealId) griff praktisch nie (alle Trades 0.0).
    // Bewiesene Kette: DB.entry == activity.openPrice, und activity.dealId ==
    // transaction.dealId. Also: (epic, openPrice) → P&L.
    const { EPIC_MAP } = await import("./capital-com-client");
    const pnlByEpicOpen = new Map<string, number>();
    // SCHLUSSKURS mitnehmen (09.08.). Capital liefert ihn in derselben
    // Aktivitaet (details.closeLevel) — bisher wurde er geholt und weggeworfen:
    // weiter unten stand hart "closeLevel = 0". Damit war nicht feststellbar,
    // WARUM ein Trade endete (Ziel, Stop, Zeit-Exit, Trailing). Genau diese
    // Frage steht offen, seit der Wochen-Report zeigte, dass die Stufe GOOD
    // bei 66,7 % Treffern trotzdem Verlust macht.
    // KEIN zusaetzlicher HTTP-Aufruf: dieselbe Schleife, dasselbe details-Objekt.
    const closeByEpicOpen = new Map<string, number>();
    try {
      const from = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 19);
      const to = new Date().toISOString().slice(0, 19);
      // detailed=true ist ZWINGEND: nur dann liefert Capital details.openPrice
      // (ohne den Parameter fehlt das details-Objekt → Map bliebe leer → alle
      //  Trades blieben 0.0). Bewiesen via /api/debug-pnl backfillSim.
      const actRes = await fetch(`${DEMO_BASE}/history/activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pageSize=200&detailed=true`, {
        headers: { "X-CAP-API-KEY": session.apiKey, "CST": session.cst, "X-SECURITY-TOKEN": session.securityToken },
      });
      if (actRes.ok) {
        const actData = await actRes.json() as { activities?: Record<string, unknown>[] };
        for (const a of actData.activities ?? []) {
          if (String(a.type ?? "") !== "POSITION") continue;
          const actDealId = String(a.dealId ?? "");
          const pnl = pnlByDealId.get(actDealId);  // activity.dealId == transaction.dealId
          if (pnl === undefined) continue;
          const details = (a.details ?? {}) as Record<string, unknown>;
          const openPrice = Number(details.openPrice ?? 0);
          const epic = String(a.epic ?? details.epic ?? "");
          if (openPrice > 0 && epic) {
            const schluessel = `${epic}|${openPrice.toFixed(5)}`;
            pnlByEpicOpen.set(schluessel, pnl);
            const closeLevel = Number(details.closeLevel ?? details.level ?? 0);
            if (closeLevel > 0) closeByEpicOpen.set(schluessel, closeLevel);
          }
        }
      }
      console.log(`[trade-tracker] P&L-Map: ${pnlByDealId.size} tx, ${pnlByEpicOpen.size} epic|openPrice, ${closeByEpicOpen.size} mit Schlusskurs`);
    } catch (e) {
      console.warn(`[trade-tracker] Activity-Fetch fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }

    const db = getPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openTrades: Array<{ id: number; market: string; direction: string; entry: number; stopLoss: number; takeProfit: number; notes: string }> = await (db.$queryRawUnsafe as any)(
      `SELECT "id", "market", "direction", "entry", "stopLoss", "takeProfit", "notes" FROM "Trade" WHERE "status" = 'OPEN' AND "notes" LIKE '%dealId%'`
    );

    for (const trade of openTrades) {
      let meta: { dealId?: string } = {};
      try { meta = JSON.parse(trade.notes); } catch { continue; }
      if (!meta.dealId || openDealIds.has(meta.dealId)) continue;

      // Position is no longer open — get real P&L.
      // Weg 1 (alt): direkt per Open-dealId — matcht praktisch nie.
      // Weg 2 (BEWIESEN): über market+entry → epic+openPrice → P&L.
      const openKey = `${(EPIC_MAP[trade.market] ?? trade.market)}|${Number(trade.entry).toFixed(5)}`;
      const profitLoss = pnlByDealId.get(meta.dealId) ?? pnlByEpicOpen.get(openKey) ?? null;

      // Capital.com braucht 1-3 Min um den P&L zu verbuchen. BUG-FIX 13.07.:
      // Vorher wurde hier sofort CLOSED/BREAKEVEN/0 gesetzt — aber der Sync
      // liest nur status='OPEN', also wurde der echte P&L NIE nachgetragen
      // (alle Trades endeten als 0.0). Jetzt: OPEN lassen und bis zu 5 Zyklen
      // (~10 Min) auf die Transaktion warten, erst dann aufgeben.
      if (profitLoss === null) {
        let m: Record<string, unknown> = {};
        try { m = JSON.parse(trade.notes); } catch { m = {}; }
        const retries = (typeof m.pnlRetries === "number" ? m.pnlRetries : 0) + 1;
        if (retries <= 5) {
          m.pnlRetries = retries;
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "notes" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
            JSON.stringify(m),
            trade.id
          );
          console.log(`[trade-tracker] P&L noch nicht verbucht: ${trade.market} deal=${meta.dealId} (Versuch ${retries}/5) — bleibt OPEN`);
        } else {
          // Nach 5 Versuchen aufgeben — wie altes Verhalten.
          //
          // ERWEITERT 17.08.: War die Order NIE BESTAETIGT und ist auch nach
          // fuenf Zyklen weder eine Position noch ein P&L aufgetaucht, dann
          // hat es diesen Trade mit hoher Wahrscheinlichkeit nie gegeben — die
          // Bestaetigung war unlesbar und der Broker hat die Order vermutlich
          // abgelehnt. Bisher landete so ein Phantom als BREAKEVEN mit P&L 0 in
          // der Statistik, ohne Ausstiegsgrund und damit ununterscheidbar von
          // einem echten Nulltrade. Genau diese Statistik soll spaeter die
          // Exit-Schwellen belegen.
          //
          // Der Eintrag wird NICHT geloescht, sondern BENANNT: er taucht im
          // Wochenreport als eigene Gruppe auf und verfaelscht die uebrigen nicht.
          const phantom = m.unbestaetigt === true;
          m.exitReason = phantom ? "NIE_BESTAETIGT" : "KEIN_PNL";
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "status" = 'CLOSED', "result" = 'BREAKEVEN', "profitLoss" = 0, "notes" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
            JSON.stringify(m),
            trade.id
          );
          if (phantom) {
            console.error(`[trade-tracker] ⚠️ PHANTOM: ${trade.market} deal=${meta.dealId} war nie bestaetigt und ist nie als Position aufgetaucht — als NIE_BESTAETIGT geschlossen`);
          } else {
            console.warn(`[trade-tracker] ⚠️ P&L nach 5 Versuchen nicht gefunden: ${trade.market} deal=${meta.dealId} — CLOSED als KEIN_PNL`);
          }
          await meldeSchliessungAnPython(String(meta.dealId ?? ""), 0, String(m.exitReason));
        }
        continue;
      }

      // Spread losses (-0.01 to -5) are real losses, not breakeven
      const result_str = profitLoss > 0.01 ? "WIN" : profitLoss < -0.01 ? "LOSS" : "BREAKEVEN";

      // Update notes with close data
      let updatedMeta: Record<string, unknown> = {};
      try { updatedMeta = JSON.parse(trade.notes); } catch { updatedMeta = {}; }
      // AUSSTIEGSGRUND ABLEITEN (09.08.).
      //
      // Hier stand "updatedMeta.closeLevel = 0" — eine fest verdrahtete Null,
      // obwohl der echte Schlusskurs eine Schleife weiter oben schon vorliegt.
      // Der Trade kennt stopLoss und takeProfit; mit dem echten Schlusskurs
      // laesst sich daraus ableiten, WARUM er endete — ohne neues Datenfeld.
      //
      // exitPosition ist die objektive Zahl: 0 = am Stop, 1 = am Ziel. Sie
      // bleibt auch dann brauchbar, wenn die Einteilung unten spaeter anders
      // gezogen wird. Die 5 %-Toleranz ist die einzige gewaehlte Zahl hier:
      // gross genug fuer Schlupf beim Schliessen, klein genug, um einen
      // Trailing-Ausstieg nahe am Ziel nicht faelschlich als "Ziel" zu zaehlen.
      const schlusskurs = closeByEpicOpen.get(openKey) ?? null;
      const { exitPosition, exitReason } = ausstiegsgrund(
        schlusskurs, Number(trade.stopLoss), Number(trade.takeProfit));
      updatedMeta.closeLevel = schlusskurs ?? 0;
      updatedMeta.exitPosition = exitPosition;
      updatedMeta.exitReason = exitReason;
      updatedMeta.closedAt = new Date().toISOString();

      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "status" = 'CLOSED', "result" = $1, "profitLoss" = $2, "notes" = $3, "updatedAt" = NOW() WHERE "id" = $4`,
        result_str,
        profitLoss,
        JSON.stringify(updatedMeta),
        trade.id
      );
      console.log(`[trade-tracker] Closed: ${trade.market} ${trade.direction} → ${result_str} P&L=${profitLoss} | Ausstieg: ${exitReason}${exitPosition !== null ? ` (${(exitPosition * 100).toFixed(0)}% zwischen Stop und Ziel)` : ""} deal=${meta.dealId}`);
      try {
        const { notifyTradeClosed } = await import("../telegram-notifications/telegram-sender");
        await notifyTradeClosed({
          symbol: trade.market,
          direction: trade.direction as "BUY" | "SELL",
          result: result_str as "WIN" | "LOSS" | "BREAKEVEN",
          profitLoss,
          currency: "CHF",
          broker: "Capital.com",
        });
      } catch { /* non-fatal */ }
      await meldeSchliessungAnPython(String(meta.dealId ?? ""), profitLoss, exitReason);
    }

    // ── NACHTRAG: CLOSED-Trades mit profitLoss=0 der letzten 48h korrigieren ──
    // Beleg 23.07.: Capital verbuchte die P&L-Transaktion erst um 07:07 UTC für
    // einen deutlich älteren Trade. Die 5 Retries (=10 Min) geben viel zu früh
    // auf → Trade landet auf 0.0. Sobald die Transaktion da ist, wird der echte
    // Wert hier nachgetragen. Sicherheiten: nur profitLoss=0, nur wenn ein
    // echter Wert gefunden wird, updatedAt bleibt unverändert (Report-Zeitraum
    // bleibt korrekt), UPDATE nochmals mit profitLoss=0 abgesichert.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zeroTrades: Array<{ id: number; market: string; entry: number; notes: string;
                                stopLoss: number; takeProfit: number }> =
        await (db.$queryRawUnsafe as any)(
          `SELECT "id","market","entry","notes","stopLoss","takeProfit" FROM "Trade"
           WHERE "status" = 'CLOSED' AND "profitLoss" = 0
             AND "updatedAt" >= NOW() - INTERVAL '48 hours'
             AND "notes" LIKE '%dealId%'`
        );
      const corrected: string[] = [];
      for (const t of zeroTrades) {
        let m: { dealId?: string } = {};
        try { m = JSON.parse(t.notes); } catch { continue; }
        const key = `${(EPIC_MAP[t.market] ?? t.market)}|${Number(t.entry).toFixed(5)}`;
        const pnl = (m.dealId ? pnlByDealId.get(m.dealId) : undefined) ?? pnlByEpicOpen.get(key);
        if (pnl === undefined || pnl === 0) continue; // nur echte Werte nachtragen
          const res = pnl > 0.01 ? "WIN" : pnl < -0.01 ? "LOSS" : "BREAKEVEN";

          // AUSSTIEGSGRUND MITSCHREIBEN (17.08.). Hier wurden bisher nur
          // Ergebnis und P&L korrigiert. Genau ueber diesen Weg laufen aber
          // Trades, die der manuelle Journal-Abgleich (sync-journal) vorher
          // geschlossen hat: der setzt status CLOSED ohne P&L und ohne Grund
          // und nimmt sie damit dem Hauptpfad aus der Hand, denn der sieht nur
          // status = 'OPEN'. Folge: der Abschnitt "Nach Ausstiegsgrund" im
          // Wochen-Report vom 16.08. fehlte GANZ — kein einziger Trade hatte
          // einen. Der Schlusskurs liegt hier ohnehin vor (closeByEpicOpen,
          // dieselbe Funktion), es braucht keinen zusaetzlichen Abruf.
          let notizen: Record<string, unknown> = {};
          try { notizen = JSON.parse(t.notes) as Record<string, unknown>; } catch { notizen = {}; }
          if (!notizen.exitReason) {
            const schluss = closeByEpicOpen.get(key) ?? null;
            const grund = ausstiegsgrund(schluss, Number(t.stopLoss), Number(t.takeProfit));
            notizen.closeLevel = schluss ?? 0;
            notizen.exitPosition = grund.exitPosition;
            notizen.exitReason = grund.exitReason;
            notizen.nachgetragenAm = new Date().toISOString();
          }
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "result" = $1, "profitLoss" = $2, "notes" = $3 WHERE "id" = $4 AND "profitLoss" = 0`,
            res, pnl, JSON.stringify(notizen), t.id
          );
        corrected.push(`${t.market}: ${res} ${pnl > 0 ? "+" : ""}${pnl}`);
        console.log(`[trade-tracker] 🔄 P&L nachgetragen: ${t.market} id=${t.id} → ${res} ${pnl}`);
      }
      if (corrected.length > 0) {
        console.log(`[trade-tracker] ✅ ${corrected.length} Trades mit echtem P&L korrigiert`);
        try {
          const { sendTelegram } = await import("../telegram-notifications/telegram-sender");
          await sendTelegram(
            `🔄 <b>P&L nachgetragen</b>\n\n${corrected.length} Trade(s) hatten 0.0, weil Capital die Transaktion verspätet verbucht — jetzt mit echten Werten korrigiert:\n\n` +
            corrected.slice(0, 10).map(c => `• ${c}`).join("\n") +
            (corrected.length > 10 ? `\n…und ${corrected.length - 10} weitere` : "")
          );
        } catch { /* non-fatal */ }
      }
    } catch (e) {
      console.warn("[trade-tracker] P&L-Nachtrag fehlgeschlagen (non-fatal):", e instanceof Error ? e.message : String(e));
    }
  } catch (err) {
    console.error("[trade-tracker] syncCapitalPositions error:", err);
  }
}
