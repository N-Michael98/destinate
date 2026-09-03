export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { isCapitalConnected, getCapitalSession } from "../../../../lib/capital-com/capital-com-session";
import { getPrisma } from "../../../lib/prisma";

const DEMO_BASE = "https://demo-api-capital.backend-capital.com/api/v1";

function authHeaders(apiKey: string, cst: string, token: string) {
  return {
    "X-CAP-API-KEY": apiKey,
    "CST": cst,
    "X-SECURITY-TOKEN": token,
    "Content-Type": "application/json",
  };
}

// GET — debug: show raw data from Capital.com endpoints
export async function GET() {
  if (!isCapitalConnected()) return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" });
  const session = getCapitalSession()!;
  const h = authHeaders(session.apiKey, session.cst, session.securityToken);

  const results: Record<string, unknown> = {};

  // Try open positions
  try {
    const r = await fetch(`${DEMO_BASE}/positions`, { headers: h });
    results.positions = { status: r.status, data: await r.json().catch(() => null) };
  } catch (e) { results.positions = { error: String(e) }; }

  // Try transactions
  try {
    const r = await fetch(`${DEMO_BASE}/history/transactions?lastPeriod=604800&pageSize=500`, { headers: h });
    results.transactions = { status: r.status, data: await r.json().catch(() => null) };
  } catch (e) { results.transactions = { error: String(e) }; }

  // Try activity with different params
  try {
    const r = await fetch(`${DEMO_BASE}/history/activity?lastPeriod=86400`, { headers: h });
    results.activity_lastPeriod_86400 = { status: r.status, data: await r.json().catch(() => null) };
  } catch (e) { results.activity_lastPeriod_86400 = { error: String(e) }; }

  return NextResponse.json({ ok: true, results });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { debug?: boolean };

  if (!isCapitalConnected()) {
    return NextResponse.json({ ok: false, error: "Capital.com nicht verbunden" }, { status: 401 });
  }

  const session = getCapitalSession()!;
  const h = authHeaders(session.apiKey, session.cst, session.securityToken);
  const db = getPrisma();
  // ── Ehrliche Zähler (03.09.) ───────────────────────────────────────────
  //
  // Hier standen `imported` und `skipped`. `imported` zählte DREI verschiedene
  // Vorgänge in einen Topf (markiert / aktualisiert / neu angelegt), und
  // `skipped` wurde NIE hochgezählt — die Oberfläche meldete trotzdem
  // "0 bereits vorhanden", eine Zahl ohne jede Bedeutung.
  let markiert = 0;        // Position beim Broker weg — nur vermerkt
  let aktualisiert = 0;    // bestehende Zeile mit echtem P&L geschlossen
  let neuAngelegt = 0;     // Transaktion ohne Journal-Zeile
  let uebersprungen = 0;   // Transaktion ohne verwertbaren P&L

  // ── Step 1: Get currently OPEN positions from Capital.com ──────────────────
  const posRes = await fetch(`${DEMO_BASE}/positions`, { headers: h });
  const openDealIds = new Set<string>();

  if (posRes.ok) {
    const posData = await posRes.json() as { positions?: Record<string, unknown>[] };
    for (const p of posData.positions ?? []) {
      const pos = (p.position ?? p) as Record<string, unknown>;
      const dealId = String(pos.dealId ?? "");
      if (dealId) openDealIds.add(dealId);
    }
  }

  // ── Step 2: Mark OPEN DB trades as CLOSED if no longer in Capital.com ──────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openDbTrades = await (db.$queryRawUnsafe as any)(
    `SELECT id, market, direction, notes FROM "Trade" WHERE "status" = 'OPEN' AND notes LIKE '%dealId%'`
  ) as Array<{ id: number; market: string; direction: string; notes: string }>;

  for (const t of openDbTrades) {
    let meta: { dealId?: string } = {};
    try { meta = JSON.parse(t.notes); } catch { continue; }
    if (!meta.dealId || openDealIds.has(meta.dealId)) continue;

      // Position ist beim Broker weg — hier NUR vermerken, nicht abschliessen.
      //
      // BIS 17.08. stand hier status CLOSED mit result 'CLOSED', ohne P&L und
      // ohne Ausstiegsgrund. Das hatte drei Folgen, alle am Wochen-Report vom
      // 16.08. nachgewiesen:
      //   1. 'CLOSED' ist kein gueltiges Ergebnis — die Auswertung zaehlt nur
      //      WIN und LOSS. Solche Trades erschienen als "WR n/a, +0.0" und
      //      blaehten die Zahl der Trades auf, ohne einen Ausgang zu haben.
      //   2. Der Tracker sieht nur status = 'OPEN'. Einmal auf CLOSED gesetzt,
      //      konnte er den echten P&L und den Ausstiegsgrund NIE mehr
      //      nachtragen — dieser Knopf nahm ihm den Trade aus der Hand.
      //   3. Der Abschnitt "Nach Ausstiegsgrund" fehlte deshalb ganz im
      //      Bericht, sieben Tage nach seinem Einbau.
      //
      // Jetzt bleibt der Trade OPEN und wird nur MARKIERT. Der Tracker laeuft
      // ohnehin alle zwei Minuten, findet die fehlende Position selbst und
      // schliesst sie mit P&L und Grund — so wie es vorgesehen ist. Der
      // manuelle Abgleich meldet damit, was er sieht, statt es zu entscheiden.
      let notizen: Record<string, unknown> = {};
      try { notizen = JSON.parse(t.notes) as Record<string, unknown>; } catch { notizen = {}; }
      notizen.brokerPositionWeg = new Date().toISOString();
      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "notes" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
        JSON.stringify(notizen),
        t.id
      );
    markiert++;
  }

  // ── Step 3: Try /history/transactions for P&L ─────────────────────────────
  const txRes = await fetch(`${DEMO_BASE}/history/transactions?lastPeriod=604800&pageSize=500`, { headers: h });
  let txCount = 0;
  let txTradeCount = 0;

  if (txRes.ok) {
    const txData = await txRes.json() as { transactions?: Record<string, unknown>[] };
    const allTx = txData.transactions ?? [];
    txCount = allTx.length;

    if (body.debug) {
      return NextResponse.json({ ok: true, debug: true, transactions: allTx.slice(0, 5), openDealIds: [...openDealIds] });
    }

    for (const tx of allTx) {
      if (String(tx.transactionType ?? "") !== "TRADE") continue;
      txTradeCount++;
      const dealId = String(tx.dealId ?? tx.reference ?? "");
      if (!dealId) continue;

      const pnlRaw = tx.size ?? tx.profitAndLoss ?? tx.pnl ?? tx.amount ?? 0;
      const profitLoss = typeof pnlRaw === "string"
        ? parseFloat(String(pnlRaw).replace("+", "")) || 0
        : Number(pnlRaw);

      if (Math.abs(profitLoss) < 0.0001) { uebersprungen++; continue; }

      // Spread losses (e.g. -2.34) are LOSS not BREAKEVEN
      const result_str = profitLoss > 0.01 ? "WIN" : profitLoss < -0.01 ? "LOSS" : "BREAKEVEN";

      // ── Die EXAKTE Positions-ID gewinnt IMMER (03.09.) ──────────────────
      //
      // Hier stand EINE Abfrage mit `OR` und `ORDER BY id DESC LIMIT 1`. Zwei
      // Fehler darin, beide nachgeprüft:
      //
      //  1. Der Kommentar versprach "market+direction+CLOSED within 24h
      //     window". Geprüft wurde davon NUR `market`. Kein `status`, keine
      //     Richtung, kein Zeitfenster. Ohne `status`-Filter konnte der lockere
      //     Zweig die Zeile einer LAUFENDEN Position treffen und sie mit dem
      //     P&L eines fremden Trades schliessen.
      //  2. Durch `OR` + `ORDER BY id DESC` gewann schlicht die höhere id: eine
      //     lockere Übereinstimmung schlug den exakten dealId-Treffer, sobald
      //     sie jünger war.
      //
      // Jetzt zwei Abfragen nacheinander — der exakte Treffer gewinnt
      // STRUKTURELL, nicht durch Glück in der Sortierung.
      //
      // EHRLICH BENANNT: `direction` wird weiterhin NICHT geprüft. Die
      // Transaktion von Capital führt keine Richtung mit (siehe den INSERT
      // unten, der genau deshalb keine erfinden darf). Statt einen Filter zu
      // bauen, für den die Daten fehlen, steht die Lücke hier. Der Kommentar
      // behauptet nichts mehr, was der Code nicht tut.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let treffer = await (db.$queryRawUnsafe as any)(
        `SELECT id, status, notes FROM "Trade"
         WHERE notes::text LIKE $1
         ORDER BY id DESC LIMIT 1`,
        `%"dealId":"${dealId}"%`
      ) as Array<{ id: number; status: string; notes: string | null }>;

      if (treffer.length === 0) {
        const markt = String(tx.instrumentName ?? "").trim();
        if (markt) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          treffer = await (db.$queryRawUnsafe as any)(
            `SELECT id, status, notes FROM "Trade"
             WHERE "market" = $1
               AND "status" = 'CLOSED'
               AND ("profitLoss" = 0 OR "profitLoss" IS NULL)
               AND notes::text NOT LIKE '%"source":"tx-sync"%'
               AND "updatedAt" >= NOW() - INTERVAL '24 hours'
             ORDER BY id DESC LIMIT 1`,
            markt
          ) as Array<{ id: number; status: string; notes: string | null }>;
        }
      }

      if (treffer.length > 0) {
        // `notes` MUSS mitgeschrieben werden (03.09.). Vorher blieb ein
        // Etikett wie NIE_BESTAETIGT stehen, obwohl der gerade gefundene echte
        // P&L es widerlegt — und der Nachtrag im Tracker holt das nicht nach,
        // denn der sieht nur `profitLoss = 0`. Die Entscheidung liegt in
        // notizenNachSync() im Tracker, damit der Prüfer sie ausführen kann.
        const { notizenNachSync } = await import("../../../../lib/capital-com/capital-trade-tracker");
        const notizen = notizenNachSync(treffer[0].notes, new Date().toISOString());
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "status"='CLOSED', "result" = $1, "profitLoss" = $2, `
          + `"notes" = $3, "updatedAt" = NOW() WHERE "id" = $4`,
          result_str, profitLoss, JSON.stringify(notizen), treffer[0].id
        );
        aktualisiert++;
      } else {
        // ── KEINE erfundene Richtung mehr (03.09.) ────────────────────────
        //
        // Hier stand `'BUY'` fest verdrahtet — für JEDE unzugeordnete
        // Transaktion, unabhängig davon, was sie wirklich war. Die Richtung
        // kommt nirgendwoher: die Transaktion von Capital führt keine mit.
        // Eine erfundene Richtung ist keine Kleinigkeit, sie landet über
        // `echteGeschlosseneTrades()` in der Lerntabelle.
        //
        // EHRLICH EINGEORDNET, damit hier nichts überversprochen wird: der
        // Lernpfad macht in `trade-feedback-engine.ts:99` aus JEDEM Wert ausser
        // SELL/SHORT ein "BUY". Am Gelernten ändert diese Zeile also noch
        // nichts — aber in Datenbank und Bericht steht jetzt die Wahrheit
        // statt einer Behauptung, und die Lücke ist damit sichtbar statt
        // getarnt. Sie zu schliessen ist eine eigene Entscheidung.
        //
        // Auch der Markt wird nicht mehr erfunden: statt des Textes "UNKNOWN"
        // (der als Symbol mit Länge 7 durch den Lern-Filter kommt und dort eine
        // eigene Win-Rate für einen Markt bekäme, den es nicht gibt) bleibt das
        // Feld LEER. `echteGeschlosseneTrades()` wirft leere Märkte aus und
        // MELDET das — genau der Weg vom 24.08.
        const epic = String(tx.instrumentName ?? tx.epic ?? "").trim();
        const dateStr = String(tx.date ?? tx.dateUtc ?? new Date().toISOString()).slice(0, 19).replace("T", " ");
        await db.$executeRawUnsafe(
          `INSERT INTO "Trade" (
            "market", "direction", "strategy", "entry", "stopLoss", "takeProfit",
            "status", "result", "profitLoss", "accountSize", "riskPercent", "riskAmount",
            "riskReward", "positionSize", "notes", "createdAt", "updatedAt"
          ) VALUES ($1,'UNBEKANNT','Capital.com DEMO | Sync',0,0,0,'CLOSED',$2,$3,$4,1,0,0,0,$5,$6::timestamp,NOW())`,
          epic, result_str, profitLoss,
          session.balance > 0 ? session.balance : 10000,
          JSON.stringify({ dealId, broker: "Capital.com DEMO", source: "tx-sync",
                          richtungUnbekannt: true }),
          dateStr
        );
        neuAngelegt++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    // `imported` bleibt als Summe erhalten, damit ältere Aufrufer nicht
    // brechen — die Aufschlüsselung daneben sagt, WAS geschehen ist.
    imported: markiert + aktualisiert + neuAngelegt,
    markiert,
    aktualisiert,
    neuAngelegt,
    uebersprungen,
    txStatus: txRes.status,
    txTotal: txCount,
    txTrades: txTradeCount,
    message: `${markiert} markiert, ${aktualisiert} mit echtem P&L geschlossen, `
      + `${neuAngelegt} neu angelegt, ${uebersprungen} ohne P&L übersprungen`
  });
}
