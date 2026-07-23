// Capital.com Trade Tracker
// Saves executed trades to DB, monitors positions for SL/TP hit, updates Journal

import { getPrisma } from "../../app/lib/prisma";

export interface TradeRecord {
  dealId: string;
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
        dealId: trade.dealId,
        tradingStyle: trade.tradingStyle,
        confidence: trade.confidence,
        broker: "Capital.com DEMO",
        source: "auto-scan",
        ...(trade.icPositionId ? { icPositionId: trade.icPositionId } : {}),
        ...(trade.entryContext ? { entryContext: trade.entryContext } : {}),
      })
    );
    console.log(`[trade-tracker] Saved trade: ${trade.symbol} ${trade.direction} (${trade.tradingStyle}) deal=${trade.dealId}`);
  } catch (err) {
    console.error("[trade-tracker] Failed to save trade:", err);
  }
}

// Called from background monitor — fetches open Capital.com positions and closes finished trades
export async function syncCapitalPositionsToJournal(): Promise<void> {
  try {
    const { getCapitalSession, isCapitalConnected } = await import("./capital-com-session");
    const { capitalGetPositions, capitalGetClosedPositions } = await import("./capital-com-client");

    if (!isCapitalConnected()) return;
    const session = getCapitalSession()!;

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
    try {
      const from = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 19);
      const to = new Date().toISOString().slice(0, 19);
      const actRes = await fetch(`${DEMO_BASE}/history/activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&pageSize=200`, {
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
          if (openPrice > 0 && epic) pnlByEpicOpen.set(`${epic}|${openPrice.toFixed(5)}`, pnl);
        }
      }
    } catch { /* non-fatal — Fallback auf Retry-Logik unten */ }

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
          // Nach 5 Versuchen aufgeben — wie altes Verhalten
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "status" = 'CLOSED', "result" = 'BREAKEVEN', "profitLoss" = 0, "updatedAt" = NOW() WHERE "id" = $1`,
            trade.id
          );
          console.warn(`[trade-tracker] ⚠️ P&L nach 5 Versuchen nicht gefunden: ${trade.market} deal=${meta.dealId} — CLOSED als BREAKEVEN`);
        }
        continue;
      }

      // Spread losses (-0.01 to -5) are real losses, not breakeven
      const result_str = profitLoss > 0.01 ? "WIN" : profitLoss < -0.01 ? "LOSS" : "BREAKEVEN";

      // Update notes with close data
      let updatedMeta: Record<string, unknown> = {};
      try { updatedMeta = JSON.parse(trade.notes); } catch { updatedMeta = {}; }
      updatedMeta.closeLevel = 0;
      updatedMeta.closedAt = new Date().toISOString();

      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "status" = 'CLOSED', "result" = $1, "profitLoss" = $2, "notes" = $3, "updatedAt" = NOW() WHERE "id" = $4`,
        result_str,
        profitLoss,
        JSON.stringify(updatedMeta),
        trade.id
      );
      console.log(`[trade-tracker] Closed: ${trade.market} ${trade.direction} → ${result_str} P&L=${profitLoss} deal=${meta.dealId}`);
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
      const zeroTrades: Array<{ id: number; market: string; entry: number; notes: string }> =
        await (db.$queryRawUnsafe as any)(
          `SELECT "id","market","entry","notes" FROM "Trade"
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
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "result" = $1, "profitLoss" = $2 WHERE "id" = $3 AND "profitLoss" = 0`,
          res, pnl, t.id
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
