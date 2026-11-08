/**
 * Active Trade Manager — IC Markets (cTrader)
 * Runs every 2min. Covers ALL live positions.
 *
 * Order of checks per position:
 *  1. Zeit-Exit   — close if position age > style limit
 *  2. Partial TP  — close 50% at 50% to TP (once only)
 *  3. Breakeven   — SL → entry when progress ≥ beAt
 *  4. Trailing SL — move SL up as price rises (only after BE)
 *
 * Zeit-Exit limits:
 *  SCALPING:   4 hours
 *  DAYTRADING: 24 hours
 *  SWING:      168 hours (7 days)
 */

import { getPrisma } from "../../app/lib/prisma";
import { icGetPositions, icUpdatePosition, icClosePosition, icClosePartial, icGetPrice } from "./icmarkets-client";
import { isICMarketsConnected } from "./icmarkets-session";

const DEFAULT_SL_RANGE: Record<string, number> = {
  XAUUSD: 10, XAGUSD: 0.5,
  EURUSD: 0.003, GBPUSD: 0.003, USDJPY: 0.3, AUDUSD: 0.003,
  USDCAD: 0.003, USDCHF: 0.003, GBPJPY: 0.3, EURJPY: 0.3,
  EURGBP: 0.003, NZDUSD: 0.003,
  USTEC: 50, US500: 20, UK100: 30, DE40: 40,
  WTI: 1.0, BRENT: 1.0,
};

const STYLE_MAX_HOURS: Record<string, number> = {
  SCALPING:   4,
  DAYTRADING: 24,
  SWING:      168,
};

interface PosMeta {
  beSet: boolean;
  partialDone: boolean;
  trailSL: number | null;
  confidence: number;
  tradingStyle: string;
  /** Der Stil stammt aus KEINER Quelle, sondern ist der Standardwert (08.09.).
   *  Dann setzt der Zeit-Exit aus — siehe Begründung dort. Gleichzieher mit
   *  `stilGeraten` im Capital.com-Pfad (risk-agent.ts, seit 19.08.). */
  stilGeraten?: boolean;
}
const positionMeta: Map<string, PosMeta> = new Map();

/** Einmal je Position melden, nicht alle zwei Minuten (gleiches Muster wie
 *  `gerateneGemeldet` im risk-agent). */
const gerateneGemeldetIC = new Set<string>();

/** Dasselbe fuer ein unbekanntes Positionsalter (08.11.) — EIGENES
 *  Gedaechtnis, nicht das von `gerateneGemeldetIC`. Teilten sich die zwei
 *  Lagen einen Eintrag, verdeckte die erste Meldung die andere: ein
 *  geratener Stil wuerde ein unbekanntes Alter verschweigen und umgekehrt.
 *  Dieselbe Begruendung wie bei `global.__redis_lage__` je Stelle (01.11.). */
const alterUnbekanntGemeldetIC = new Set<string>();

/**
 * Das Alter in Stunden — oder `null` fuer "unbekannt" (08.11.).
 *
 * EXPORTIERT und rein, damit `safety-nets` sie RECHNEN kann statt den
 * Wortlaut zu pruefen ("ein Regex prueft den Wortlaut, nicht das Verhalten",
 * 30.09.).
 *
 * Drei Lagen, und die dritte ist der eigentliche Grund:
 *
 *  - **Keine lesbare Zeit** (`NaN`) → `null`. `new Date("Unsinn").getTime()`
 *    ist `NaN`, und `NaN >= maxHours` ist `false`: ohne `Number.isFinite`
 *    waere der Zeit-Exit stumm aus. Vierte Wiederholung derselben Falle
 *    (24.08., 28.10., 29.10., 03.11.).
 *
 *  - **Zukunft bis 2 Minuten** → `0`. Echter Uhren-Versatz zwischen zwei
 *    Rechnern; dieselbe Schranke wie `ageInMinutes` (22.09.).
 *
 *  - **Zukunft darueber** → `null`, also UNBEKANNT. Hier haengt mehr dran als
 *    Sauberkeit: fuer cTrader ist NICHT gemessen, ob eine Zone mitkommt.
 *    Kommt zonenlose Ortszeit und `new Date` liest sie als UTC, liegt die
 *    Zeit 1–2 Stunden in der Zukunft. Das Alter waere dann um genau diesen
 *    Versatz zu klein und der Zeit-Exit feuerte VERSPAETET — stumm. Mit
 *    `null` wird daraus eine Meldung, und damit ist die offene Zonenfrage
 *    aus dem Log heraus beantwortbar statt Vermutung.
 *
 * Ehrlich zur Richtung: "unbekannt" heisst hier AUSGESETZT, nicht
 * "geschlossen". Das ist die Entscheidung vom 19.08. (`risk-agent.ts`):
 * ohne bekannte Eroeffnungszeit wird NICHT geschlossen, denn ein Eingriff
 * auf einer Annahme kostet echtes Geld. Dafuer wird es laut.
 */
export function alterStundenIC(openedMs: number, jetztMs: number): number | null {
  if (!Number.isFinite(openedMs) || !Number.isFinite(jetztMs)) return null;
  const stunden = (jetztMs - openedMs) / 3_600_000;
  if (stunden >= 0) return stunden;
  return stunden >= -(2 / 60) ? 0 : null;
}

function getLevel(score: number): { beAt: number; trailDist: number } {
  if (score >= 80) return { beAt: 0.70, trailDist: 0.40 };
  if (score >= 75) return { beAt: 0.55, trailDist: 0.50 };
  return               { beAt: 0.40, trailDist: 0.60 };
}

export async function runICMarketsTradeManager(): Promise<void> {
  if (!isICMarketsConnected()) return;
  const db = getPrisma();

  // ── 1. Get all live positions ─────────────────────────────────────────────
  const posResult = await icGetPositions();
  if (!posResult.ok || !posResult.positions?.length) return;

  // ── Ohne lesbare Richtung wird NICHT bewirtschaftet (08.11.) ──────────────
  //
  // `pos.direction` ist seit heute dreiwertig (`icmarkets-client.ts`). DIESER
  // Filter ist der Grund, warum die Verengung dort ueberhaupt sicher ist:
  // ohne ihn waere `pos.direction === "BUY"` bei `null` schlicht `false`, die
  // Position gaelte als SELL — der Fix haette das Vorzeichen also nur
  // UMGEDREHT statt den Fehler zu beheben. Genau das ist mir am 07.11. im
  // Orchestrator unterlaufen (`6edb2aa`), deshalb steht es hier zuerst.
  //
  // Die Typzusage (`p is …`) ist Absicht und kein Schmuck: danach zaehlt
  // `tsc` jede Stelle auf, die drinnen eine Richtung braucht. Von allein
  // findet es die NICHT — `null === "BUY"` ist gueltiges TypeScript.
  //
  // Gleichzieher mit `active-trade-manager.ts` (Capital.com, 07.11.).
  const bewirtschaftbar = posResult.positions.filter(
    (p): p is typeof p & { direction: "BUY" | "SELL" } => p.direction !== null);
  const ohneRichtung = posResult.positions.length - bewirtschaftbar.length;
  if (ohneRichtung > 0) {
    console.warn(`[ic-trade-mgr] ⚠️ ${ohneRichtung} von ${posResult.positions.length} `
      + `Positionen OHNE lesbare Richtung — fuer die laufen Breakeven, Teilgewinn `
      + `und Trailing NICHT. Ein Stop auf der falschen Seite ist schlimmer als `
      + `keiner; die Broker-seitigen SL/TP bleiben unberuehrt.`);
  }
  if (!bewirtschaftbar.length) return;

  // ── 2. Load DB metadata ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbTrades = await (db.$queryRawUnsafe as any)(
    `SELECT notes FROM "Trade" WHERE status = 'OPEN' AND notes LIKE '%icPositionId%'`
  ) as Array<{ notes: string }>;

  const dbMeta = new Map<string, PosMeta>();
  for (const t of dbTrades) {
    try {
      const m = JSON.parse(t.notes);
      if (m.icPositionId) {
        // `stilGeraten` mitführen (08.09.) — Begründung beim Zeit-Exit unten.
        const stilBekannt = typeof (m.tradingStyle ?? m.strategy) === "string"
          && String(m.tradingStyle ?? m.strategy).trim().length > 0;
        dbMeta.set(String(m.icPositionId), {
          beSet:       m.icBeSet ?? m.beSet ?? false,
          partialDone: m.icPartialDone ?? m.partialDone ?? false,
          trailSL:     m.icTrailSL ?? m.trailSL ?? null,
          confidence:  m.confidence ?? 72,
          tradingStyle: stilBekannt ? String(m.tradingStyle ?? m.strategy) : "DAYTRADING",
          stilGeraten: !stilBekannt,
        });
      }
    } catch { /* skip */ }
  }

  // ── 3. Process each position ──────────────────────────────────────────────
  for (const pos of bewirtschaftbar) {
    const positionId = pos.positionId;
    if (!positionId) continue;
    const entry = pos.openPrice;
    if (!entry || entry <= 0) continue;
    const isBuy = pos.direction === "BUY";
    const symbol = pos.symbol;

    // Get price (per position — IC Markets has no batch API)
    const priceResult = await icGetPrice(symbol).catch(() => null);
    if (!priceResult?.ok) continue;
    const currentPrice = isBuy ? (priceResult.bid ?? 0) : (priceResult.ask ?? 0);
    if (!currentPrice) continue;

    // Ohne Speicher- UND ohne Datenbankeintrag ist der Stil GERATEN — das muss
    // mitgeführt werden, sonst schliesst der Zeit-Exit unten auf einer Annahme.
    const mem = positionMeta.get(positionId)
      ?? { beSet: false, partialDone: false, trailSL: null, confidence: 72,
           tradingStyle: "DAYTRADING", stilGeraten: true };
    const meta: PosMeta = dbMeta.get(positionId) ?? mem;

    // ── Das RATEN selbst melden, nicht erst seine Folge (15.09.) ───────────
    //
    // Bis heute stand die Meldung nur im Zeit-Exit-Zweig — sie kam also erst,
    // wenn die Position alt genug war. Bis dahin lief die Verwaltung still auf
    // geratenen Werten.
    //
    // Der Capital-Pfad macht es seit dem 19.08. richtig (`risk-agent.ts`,
    // `geratenerStilMelden`): er meldet, SOBALD geraten wird, und nennt beides
    // — Stil UND Confidence — samt dem, was daran haengt. Dieselbe
    // Asymmetrie wie beim Zeit-Exit, den ich am 08.09. nachgezogen habe.
    //
    // Die Confidence ist dabei nicht gefaehrlich, aber sie ist erfunden: 72
    // faellt in die UNTERSTE Stufe von `getLevel` (Breakeven bei 0.40 statt
    // 0.70, Trail 0.60) — also die frueher absichernde. Sie geht trotzdem in
    // jede Exit-Entscheidung ein, und dass sie geraten ist, muss man sehen.
    //
    // Einmal je Position, ueber dasselbe Gedaechtnis wie der Zeit-Exit.
    if (meta.stilGeraten === true && !gerateneGemeldetIC.has(positionId)) {
      gerateneGemeldetIC.add(positionId);
      console.warn(`[ic-trade-mgr] ⚠️ ${symbol} pos=${positionId}: weder Journal-Zeile `
        + `noch Speicher-Eintrag — Stil und Confidence GERATEN `
        + `(${meta.tradingStyle}, ${meta.confidence}). Der Zeit-Exit bleibt `
        + `deshalb AUSGESETZT; Breakeven und Trailing laufen weiter, haengen `
        + `aber an dieser geratenen Confidence-Stufe.`);
    }

    const lvl = getLevel(meta.confidence);
    const liveSL = pos.stopLoss ?? 0;
    const liveTP = pos.takeProfit ?? 0;

    const slRange = liveSL > 0
      ? Math.abs(entry - liveSL)
      : (DEFAULT_SL_RANGE[symbol] ?? 0.005);
    const totalRange = liveTP > 0
      ? Math.abs(liveTP - entry)
      : slRange * 2;
    if (slRange < 0.000001) continue;

    const progress = isBuy
      ? (currentPrice - entry) / totalRange
      : (entry - currentPrice) / totalRange;

    const alreadyAtBE = isBuy
      ? (liveSL > 0 && liveSL >= entry - 0.0001)
      : (liveSL > 0 && liveSL <= entry + 0.0001);
    const beEffective = meta.beSet || alreadyAtBE;
    const currentTrailSL = meta.trailSL ?? (liveSL > 0 ? liveSL : (isBuy ? entry - slRange : entry + slRange));

    // ── Zeit-Exit ─────────────────────────────────────────────────────────
    const style = meta.tradingStyle.toUpperCase();
    const maxHours = STYLE_MAX_HOURS[style] ?? STYLE_MAX_HOURS.DAYTRADING;
    // ── Das Alter ist DREIWERTIG (08.11.) ─────────────────────────────────
    //
    // Hier stand `new Date(pos.openTime ?? Date.now())`. Eine fehlende
    // Broker-Zeit wurde damit zu JETZT: `ageHours ≈ 0`, der Zeit-Exit feuerte
    // NIE — und zwar stumm, denn auch die "AUSGESETZT"-Zeile unten greift
    // erst bei `ageHours >= maxHours`. Ein Dauerausfall war von einem
    // gesunden Lauf nicht zu unterscheiden (Regel 25.10.). Der Client
    // erfindet seit heute nichts mehr, also darf es der Verbraucher auch
    // nicht ein zweites Mal tun.
    //
    // Und `new Date("Unsinn").getTime()` ist `NaN`, `NaN >= maxHours` ist
    // `false` — deshalb `Number.isFinite` und kein nackter Vergleich. Zum
    // wiederholten Mal dieselbe Falle: `checkPriceAvailable` (24.08.),
    // `ordersRiegel` (28.10.), `rrBand` (29.10.), der ATR (03.11.).
    const openedMs = pos.openTime === null ? NaN : new Date(pos.openTime).getTime();
    const ageHours: number | null = alterStundenIC(openedMs, Date.now());
    if (ageHours === null && !alterUnbekanntGemeldetIC.has(positionId)) {
      alterUnbekanntGemeldetIC.add(positionId);
      // Der GRUND gehoert in die Zeile, nicht nur die Lage: "fehlt",
      // "unlesbar" und "liegt in der Zukunft" fuehren zu drei verschiedenen
      // naechsten Schritten. Wer den Grund nicht mitschreibt, muss ihn
      // spaeter raten (22.09.).
      const grund = pos.openTime === null
        ? "FEHLT"
        : !Number.isFinite(openedMs)
          ? `ist unlesbar (${pos.openTime})`
          : `liegt in der ZUKUNFT (${pos.openTime}) — pruefe die Zeitzone, die cTrader schickt`;
      console.warn(`[ic-trade-mgr] ⚠️ ${symbol} pos=${positionId}: Eroeffnungszeit `
        + `${grund} — das `
        + `Alter ist unbekannt, der Zeit-Exit ist fuer diese Position AUSGESETZT. `
        + `Breakeven, Teilgewinn und Trailing laufen weiter (die haengen nicht am Alter).`);
    }
    // ── KEIN Zeit-Exit auf geratenem Handelsstil (08.09.) ──────────────────
    //
    // Gleichzieher mit dem Capital.com-Pfad, wo derselbe Riegel seit dem
    // 19.08. steht (`risk-agent.ts:587`, Begründung dort wörtlich: "Das ist
    // kein Schutz mehr, das ist ein Eingriff auf einer Annahme, und er kostet
    // echtes Geld"). Bei IC Markets fehlte er — dieselbe Fehlerklasse, ein
    // Broker behoben, der andere nicht.
    //
    // Der Rechenweg ist identisch: ohne Journal-Zeile und ohne
    // Speicher-Eintrag stand der Stil auf dem Standardwert DAYTRADING, also
    // 24 Stunden. Wäre die Position in Wirklichkeit SWING (168 h), würde sie
    // 144 Stunden zu früh geschlossen — auf einer Annahme.
    //
    // Breakeven, Teilgewinn und Trailing laufen weiter: die prüfen zusätzlich
    // den ECHTEN Stop beim Broker (`alreadyAtBE`, `meta.trailSL ?? liveSL`)
    // und hängen nicht am geratenen Stil.
    // `ageHours !== null` steht ausdruecklich da: ein unbekanntes Alter darf
    // NICHT in den Zeit-Exit laufen. Ohne den Vergleich waere `null >= 24`
    // zur Laufzeit `false` — also zufaellig richtig, aber aus dem falschen
    // Grund, und ein `0` daneben waere sofort wieder die erfundene Messung.
    if (ageHours !== null && ageHours >= maxHours && meta.stilGeraten === true) {
      if (!gerateneGemeldetIC.has(positionId)) {
        gerateneGemeldetIC.add(positionId);
        console.warn(`[ic-trade-mgr] ⏸ Zeit-Exit AUSGESETZT: ${symbol} ${pos.direction} `
          + `age=${ageHours.toFixed(1)}h — Handelsstil ist GERATEN (weder Journal-Zeile `
          + `noch Speicher-Eintrag). Auf ${style} zu schliessen waere ein Eingriff `
          + `auf einer Annahme.`);
      }
    } else if (ageHours !== null && ageHours >= maxHours) {
      const closeResult = await icClosePosition(positionId);
      if (closeResult.ok) {
        positionMeta.delete(positionId);
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET status='CLOSED', result='CLOSED_TIME', "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $1`,
          `%${positionId}%`
        ).catch(() => {});
        console.log(`[ic-trade-mgr] ⏰ Zeit-Exit: ${symbol} ${pos.direction} age=${ageHours.toFixed(1)}h limit=${maxHours}h (${style})`);
        continue;
      }
    }

    // ── Partial TP (50% close at 50% progress) ───────────────────────────
    if (!meta.partialDone && progress >= 0.50 && pos.volume > 0) {
      const partialVol = Math.floor(pos.volume / 2);
      if (partialVol > 0) {
        const partialResult = await icClosePartial(positionId, partialVol);
        if (partialResult.ok) {
          positionMeta.set(positionId, { ...meta, partialDone: true });
          // icPartialDone in notes persistieren (Generalkontroll-Fund 28.07.):
          // vorher wurde nur updatedAt gesetzt — der Merker lebte ausschliesslich
          // in der Map und war nach jedem Neustart weg, wodurch ein zweiter
          // Teilverkauf ausgelöst werden konnte. Merged, überschreibt nichts.
          try {
            const rows = await (db.$queryRawUnsafe as (q: string, ...a: unknown[]) => Promise<Array<{ id: number; notes: string }>>)(
              `SELECT id, notes FROM "Trade" WHERE status='OPEN' AND notes LIKE $1 LIMIT 1`,
              `%${positionId}%`
            );
            if (rows?.length) {
              let m: Record<string, unknown> = {};
              try { m = JSON.parse(rows[0].notes) as Record<string, unknown>; } catch { m = {}; }
              await db.$executeRawUnsafe(
                `UPDATE "Trade" SET "notes"=$1, "updatedAt"=NOW() WHERE "id"=$2`,
                JSON.stringify({ ...m, icPartialDone: true }),
                rows[0].id
              );
            }
          } catch (e) {
            console.warn(`[ic-trade-mgr] icPartialDone nicht persistiert (${positionId}):`, e instanceof Error ? e.message : String(e));
          }
          console.log(`[ic-trade-mgr] 💰 Partial TP: ${symbol} closed ${partialVol} of ${pos.volume} at ${(progress*100)|0}% to TP`);
        }
      }
    }

    // ── Breakeven ─────────────────────────────────────────────────────────
    if (!beEffective && progress >= lvl.beAt) {
      const newSL = entry;
      const upd = await icUpdatePosition(positionId, newSL, liveTP > 0 ? liveTP : undefined);
      if (upd.ok) {
        positionMeta.set(positionId, { ...meta, beSet: true, trailSL: newSL });
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "stopLoss"=$1, "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $2`,
          newSL, `%${positionId}%`
        ).catch(() => {});
        console.log(`[ic-trade-mgr] ✅ Breakeven: ${symbol} ${pos.direction} entry=${entry} progress=${(progress*100).toFixed(0)}%`);
        try {
          const { notifyBreakeven } = await import("../telegram-notifications/telegram-sender");
          await notifyBreakeven({ symbol, direction: pos.direction, entry, broker: "IC Markets" });
        } catch { /* non-fatal */ }
        continue;
      }
    }

    // ── Trailing SL ───────────────────────────────────────────────────────
    if (beEffective || alreadyAtBE) {
      const trailDistance = slRange * lvl.trailDist;
      const newTrailSL = isBuy ? currentPrice - trailDistance : currentPrice + trailDistance;
      const shouldUpdate = isBuy
        ? newTrailSL > currentTrailSL && newTrailSL >= entry
        : newTrailSL < currentTrailSL && newTrailSL <= entry;
      if (shouldUpdate) {
        const upd = await icUpdatePosition(positionId, newTrailSL, liveTP > 0 ? liveTP : undefined);
        if (upd.ok) {
          positionMeta.set(positionId, { ...meta, beSet: true, trailSL: newTrailSL });
          await db.$executeRawUnsafe(
            `UPDATE "Trade" SET "stopLoss"=$1, "updatedAt"=NOW() WHERE status='OPEN' AND notes LIKE $2`,
            newTrailSL, `%${positionId}%`
          ).catch(() => {});
          console.log(`[ic-trade-mgr] 📈 Trail SL: ${symbol} ${pos.direction} SL=${newTrailSL.toFixed(5)} price=${currentPrice.toFixed(5)}`);
        }
      }
    }
  }

  // ── Cleanup closed positions ──────────────────────────────────────────────
  const liveIds = new Set(posResult.positions.map(p => p.positionId).filter(Boolean));
  for (const id of positionMeta.keys()) {
    if (!liveIds.has(id)) positionMeta.delete(id);
  }
  // Das Meldungs-Gedaechtnis mit aufraeumen (08.09.) — sonst waechst es mit
  // jeder je gesehenen Position weiter. Genau das Leck, das am 26.08. in der
  // Brute-Force-Karte gefunden wurde: ein Set, das nur waechst.
  // Das zweite Gedaechtnis muss MIT aufgeraeumt werden, sonst waechst es
  // unbegrenzt — und eine spaeter neu eroeffnete Position mit derselben
  // Kennung bliebe stumm, obwohl ihr Alter wieder unbekannt ist.
  for (const id of alterUnbekanntGemeldetIC) {
    if (!liveIds.has(id)) alterUnbekanntGemeldetIC.delete(id);
  }
  for (const id of gerateneGemeldetIC) {
    if (!liveIds.has(id)) gerateneGemeldetIC.delete(id);
  }
}
