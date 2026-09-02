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

// ── Journal-Zeilen, die noch nicht geschrieben werden konnten (20.08.) ───────
//
// WARUM ES DIESE WARTESCHLANGE GIBT. Wenn saveCapitalTradeToJournal() gerufen
// wird, ist die Order beim Broker BEREITS LIVE. Sie laesst sich nicht
// zuruecknehmen. Die Journal-Zeile ist die einzige Verbindung zwischen dieser
// laufenden Position und dem System — ohne sie:
//   - persistMeta() findet nichts, der Risiko-Zustand ueberlebt keinen Neustart
//   - der Riegel gegen den doppelten Teilgewinn ist blind
//   - der RiskAgent faellt auf GERATENE Werte zurueck (DAYTRADING, 72)
//   - der Zeit-Exit wird ausgesetzt, die Position laeuft ohne Haltedauer-Grenze
//   - der Python-Lifecycle kann sie nach einem Neustart nicht nachregistrieren
// Genau dieser Zustand wurde am 19.08. an vier laufenden Positionen gemessen.
//
// Bis heute stand hier nur ein `console.error`. Ein Datenbank-Aussetzer von
// wenigen Sekunden — etwa waehrend des Postgres-Patches bei Railway — haette
// die Zeile DAUERHAFT gekostet.
const ausstehendeZeilen: TradeRecord[] = [];

/** Obergrenze der Warteschlange. Ohne sie waere sie ein Leck: bei einem langen
 *  Datenbank-Ausfall wuechse sie mit jedem Trade weiter. Fuenfzig ist mehr als
 *  ein Handelstag je erzeugt (maxTradesPerDay liegt weit darunter). */
export const AUSSTEHEND_MAX = 50;

/** Nimmt eine ungeschriebene Zeile in die Warteschlange. Bei Ueberlauf faellt
 *  die AELTESTE heraus — sie ist am ehesten schon anderweitig geschlossen. */
export function merkeAusstehendeZeile(trade: TradeRecord): void {
  try {
    if (!trade) return;
    ausstehendeZeilen.push(trade);
    while (ausstehendeZeilen.length > AUSSTEHEND_MAX) ausstehendeZeilen.shift();
  } catch { /* Merken darf nie stoeren */ }
}

export function ausstehendeAnzahl(): number {
  return ausstehendeZeilen.length;
}

/** Nur für Tests und Prüfer. */
export function ausstehendeLeeren(): void {
  ausstehendeZeilen.length = 0;
}

/**
 * Schreibt die gemerkten Zeilen nach, sobald die Datenbank wieder antwortet
 * (20.08.). Wird vom Tracker in jedem Zyklus gerufen, also alle zwei Minuten.
 *
 * Gelingt eine Zeile, faellt sie aus der Schlange. Gelingt sie nicht, bleibt
 * sie stehen und wird beim naechsten Zyklus erneut versucht — anders als beim
 * Nachtragen der dealId gibt es hier KEINE Versuchsgrenze: eine fehlende
 * Journal-Zeile kostet dauerhaft Schutz, ein weiterer Versuch kostet nichts.
 */
export async function schreibeAusstehendeZeilen(): Promise<{ geschrieben: number; offen: number }> {
  const bilanz = { geschrieben: 0, offen: 0 };
  if (ausstehendeZeilen.length === 0) return bilanz;
  // Von vorne arbeiten, damit die Reihenfolge der Eroeffnungen erhalten bleibt.
  for (let i = ausstehendeZeilen.length - 1; i >= 0; i--) {
    const trade = ausstehendeZeilen[i];
    // Immer mit Doppelpruefung: die Zeile kann seit dem Merken laengst
    // geschrieben worden sein.
    const ok = await versucheJournalZeile(trade, true);
    if (ok) {
      ausstehendeZeilen.splice(i, 1);
      bilanz.geschrieben++;
      console.log(`[trade-tracker] Journal-Zeile nachgetragen: ${trade.symbol} `
        + `${trade.direction} deal=${trade.dealId || trade.dealReference || "?"}`);
    }
  }
  bilanz.offen = ausstehendeZeilen.length;
  if (bilanz.geschrieben > 0 || bilanz.offen > 0) {
    console.log(`[trade-tracker] ausstehende Journal-Zeilen: ${bilanz.geschrieben} nachgetragen, `
      + `${bilanz.offen} offen`);
  }
  return bilanz;
}

/**
 * EIN Schreibversuch. Getrennt, damit er wiederholt werden kann, ohne die
 * SQL-Anweisung zu verdoppeln.
 *
 * `pruefeDoppelt` MUSS bei jeder Wiederholung gesetzt sein (20.08.). Grund:
 * ein INSERT kann in der Datenbank landen und die ANTWORT trotzdem verloren
 * gehen — bei einem Zeitfehler oder Verbindungsabriss genau der Normalfall.
 * Der naechste Versuch schriebe denselben Trade dann ein ZWEITES Mal, und der
 * Wochen-Report zaehlte ihn doppelt. Wiederholen ohne diese Pruefung waere
 * also schlimmer als gar nicht zu wiederholen.
 */
async function versucheJournalZeile(
  trade: TradeRecord,
  pruefeDoppelt = false,
): Promise<boolean> {
  try {
    const db = getPrisma();

    if (pruefeDoppelt) {
      const kennung = trade.dealId || trade.dealReference || "";
      if (kennung) {
        const vorhanden = await (db.$queryRawUnsafe as (q: string, ...a: unknown[]) => Promise<unknown[]>)(
          `SELECT 1 FROM "Trade" WHERE notes LIKE $1 LIMIT 1`,
          `%${kennung}%`
        );
        if (Array.isArray(vorhanden) && vorhanden.length > 0) {
          console.log(`[trade-tracker] Journal-Zeile war bereits vorhanden (${kennung}) — `
            + `kein zweiter Eintrag`);
          return true;
        }
      }
    }

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
    return true;
  } catch (err) {
    console.warn("[trade-tracker] Journal-Zeile nicht geschrieben:",
      err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Wartezeiten zwischen den Sofort-Versuchen in Millisekunden (20.08.).
 *  Kurz genug, um den Handelszyklus nicht auszubremsen; lang genug, um einen
 *  Verbindungsabriss oder einen Neustart der Datenbank zu ueberbruecken. */
export const JOURNAL_WARTEZEITEN = [400, 1200];

/**
 * Schreibt einen ausgefuehrten Trade ins Journal — mit Wiederholung (20.08.).
 *
 * Die Order ist an diesem Punkt BEREITS LIVE. Ein einzelner Fehlversuch darf
 * die Zeile nicht kosten, deshalb:
 *   1. bis zu drei Sofort-Versuche mit kurzer Pause (deckt Aussetzer ab)
 *   2. scheitert auch der letzte, wandert der Trade in die Warteschlange und
 *      wird in jedem Tracker-Zyklus erneut versucht
 *   3. dazu eine Telegram-Meldung — eine laufende Position ohne Journal-Zeile
 *      ist kein Zustand, den man nur im Log entdecken sollte
 *
 * Rueckgabe: true = geschrieben, false = gemerkt und wird nachgetragen.
 */
export async function saveCapitalTradeToJournal(trade: TradeRecord): Promise<boolean> {
  for (let versuch = 0; versuch <= JOURNAL_WARTEZEITEN.length; versuch++) {
    if (versuch > 0) {
      await new Promise((r) => setTimeout(r, JOURNAL_WARTEZEITEN[versuch - 1]));
    }
    // Ab dem ZWEITEN Versuch auf eine bereits geschriebene Zeile pruefen.
    if (await versucheJournalZeile(trade, versuch > 0)) return true;
  }

  merkeAusstehendeZeile(trade);
  const kennung = trade.dealId || trade.dealReference || "ohne ID";
  console.error(`[trade-tracker] ⚠️ Journal-Zeile nach ${JOURNAL_WARTEZEITEN.length + 1} `
    + `Versuchen NICHT geschrieben: ${trade.symbol} ${trade.direction} ${kennung}. `
    + `Gemerkt — wird in jedem Zyklus erneut versucht. Bis dahin laeuft die Position `
    + `ohne Risiko-Zustand, ohne Teilgewinn-Riegel und ohne Zeit-Exit.`);
  try {
    const { sendTelegram } = await import("../telegram-notifications/telegram-sender");
    await sendTelegram(
      "⚠️ <b>Journal-Zeile konnte nicht geschrieben werden</b>\n\n"
      + `${trade.symbol} ${trade.direction} (${trade.tradingStyle})\n`
      + `Kennung: ${kennung}\n\n`
      + "Die Position ist beim Broker LIVE, hat aber keine Zeile in der Datenbank. "
      + "Solange das so ist, laeuft sie ohne gespeicherten Risiko-Zustand, ohne "
      + "Teilgewinn-Riegel und ohne Zeit-Exit — der RiskAgent schuetzt sie weiter "
      + "ueber Stop, Breakeven und Trailing.\n\n"
      + "Sie wird automatisch in jedem Zyklus erneut geschrieben."
    );
  } catch { /* non-fatal */ }
  return false;
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
): Promise<{ geprueft: number; ergaenzt: number; aufgegeben: number; bereitsAufgegeben: number }> {
  // `bereitsAufgegeben` nachgetragen 02.09.: siehe die Schleife unten. Ohne
  // dieses Feld war der DAUERZUSTAND "hat aufgegeben" von "es gab nichts zu
  // tun" nicht zu unterscheiden — beide ergaben eine Bilanz aus lauter Nullen
  // und damit gar keine Logzeile.
  const bilanz = { geprueft: 0, ergaenzt: 0, aufgegeben: 0, bereitsAufgegeben: 0 };
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
      if (versuche >= DEALID_VERSUCHE_MAX) {
        // ZAEHLEN, nicht nur ueberspringen (02.09.).
        //
        // `aufgegeben` weiter unten zaehlt nur den EINEN Zyklus, in dem die
        // Obergrenze gerissen wird — eine einzige Logzeile, danach nie wieder.
        // Ab dem naechsten Zyklus faellt die Zeile hier heraus, bevor irgendein
        // Zaehler hochgeht: die Bilanz ist {0,0,0}, die Logzeile erscheint
        // nicht, und ein Eintrag, der dauerhaft ohne Positions-ID bleibt, ist
        // vollstaendig still. Genau dieser Dauerzustand ist der interessante —
        // er bedeutet: ohne Risiko-Zustand, ohne Teilgewinn-Riegel, ohne
        // Nachregistrieren, und niemand erfaehrt es.
        bilanz.bereitsAufgegeben++;
        continue;
      }

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

/** Nach so vielen Zyklen ohne passende Position gilt eine aufgegebene Zeile als
 *  Phantom. Drei Zyklen sind rund sechs Minuten Beleg statt einer
 *  Momentaufnahme: ein einzelner Broker-Aussetzer mit leerer Positionsliste
 *  darf keine Journal-Zeile schliessen. */
export const OHNE_POSITION_ZYKLEN_MAX = 3;

/**
 * Traegt fehlende Positions-IDs aus der OFFENEN POSITIONSLISTE nach (02.09.).
 *
 * `ergaenzeFehlendeDealIds` fragt `GET /confirms/{ref}`. Am 02.09. war gemessen,
 * dass dieser Weg tot ist: vier Zeilen, alle mit Order-Referenz, hoechste
 * Versuchszahl 5 — fuenf Versuche ueber zehn Minuten, dann aufgegeben. Capital
 * haelt Bestaetigungen nur kurz vor.
 *
 * Die Positionsliste haben wir ohnehin. Die Entscheidung liegt in
 * `zuordnungAusPositionen()` im RiskAgent, NICHT als Schleife hier —
 * eingebettet liesse sie sich nicht ausfuehren und damit nicht beweisen.
 *
 * DREI AUSGAENGE, streng getrennt:
 *   eindeutig    -> Positions-ID schreiben. Damit greifen Stammdaten,
 *                   Teilgewinn-Riegel und Nachregistrieren wieder, und der
 *                   Zeit-Exit rechnet mit dem ECHTEN Stil statt zu raten.
 *   unklar       -> nichts anfassen. Nur zaehlen.
 *   ohnePosition -> auf dem Symbol ist beim Broker gar nichts offen. Erst wenn
 *                   der /confirms-Weg aufgegeben hat UND das drei Zyklen lang
 *                   so bleibt, wird die Zeile als NIE_BESTAETIGT geschlossen.
 *                   Ohne diesen Ausgang stuende sie fuer immer auf OPEN: die
 *                   P&L-Abstimmung unten ueberspringt jede Zeile ohne dealId,
 *                   es gibt also keinen anderen Weg, der sie je schliesst.
 *
 * Non-fatal in jedem Zweig.
 */
export async function ergaenzeDealIdsAusPositionen(
  positionen: ReadonlyArray<{
    dealId?: string | null; symbol?: string | null; epic?: string | null;
    direction?: string | null; openLevel?: number | null;
  }>,
): Promise<{ ergaenzt: number; unklar: number; beobachtet: number; benannt: number }> {
  const bilanz = { ergaenzt: 0, unklar: 0, beobachtet: 0, benannt: 0 };
  try {
    const db = getPrisma();
    const rows = await (db.$queryRawUnsafe as (q: string) => Promise<Array<{
      id: number; market: string | null; direction: string | null;
      entry: number | null; notes: string;
    }>>)(
      `SELECT "id", "market", "direction", "entry", "notes" FROM "Trade" `
      + `WHERE status = 'OPEN' AND notes LIKE '%dealReference%'`
    );

    const meta = new Map<number, Record<string, unknown>>();
    const markt = new Map<number, string>();
    const offen: Array<{ id: number; market: string | null; direction: string | null; entry: number | null }> = [];
    for (const z of rows ?? []) {
      let m: Record<string, unknown>;
      try { m = JSON.parse(z.notes) as Record<string, unknown>; } catch { continue; }
      if (m.dealId) continue;                                   // schon aufgeloest
      if (!String(m.dealReference ?? "").trim()) continue;       // nichts zu verknuepfen
      meta.set(z.id, m);
      markt.set(z.id, String(z.market ?? "?"));
      offen.push({ id: z.id, market: z.market, direction: z.direction, entry: z.entry });
    }
    if (offen.length === 0) return bilanz;

    const { zuordnungAusPositionen } = await import("../agents/risk-agent");
    const zu = zuordnungAusPositionen(offen, positionen);
    bilanz.unklar = zu.unklar.length;

    for (const { id, dealId } of zu.eindeutig) {
      const m = meta.get(id);
      if (!m) continue;
      const neu: Record<string, unknown> = { ...m, dealId, dealIdQuelle: "POSITIONSLISTE" };
      delete neu.ohnePositionZyklen;
      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "notes" = $1 WHERE "id" = $2`, JSON.stringify(neu), id);
      bilanz.ergaenzt++;
      console.log(`[trade-tracker] ✅ dealId aus Positionsliste: Zeile ${id} `
        + `(${markt.get(id)}) -> ${dealId}`);
    }

    // Eine Zeile, die wieder Anschluss hat, darf ihren Phantom-Zaehler nicht
    // behalten — sonst schluege er beim naechsten Aussetzer sofort durch.
    for (const id of zu.unklar) {
      const m = meta.get(id);
      if (!m || Number(m.ohnePositionZyklen ?? 0) === 0) continue;
      const neu: Record<string, unknown> = { ...m };
      delete neu.ohnePositionZyklen;
      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "notes" = $1 WHERE "id" = $2`, JSON.stringify(neu), id);
    }

    for (const id of zu.ohnePosition) {
      const m = meta.get(id);
      if (!m) continue;
      // Solange der /confirms-Weg noch laeuft, wird NICHT benannt: eine frisch
      // aufgegebene Order kann noch als Position auftauchen.
      const versuche = Number(m.dealIdVersuche ?? 0);
      if (!Number.isFinite(versuche) || versuche < DEALID_VERSUCHE_MAX) {
        bilanz.beobachtet++;
        continue;
      }
      const roh = Number(m.ohnePositionZyklen ?? 0);
      const zyklen = (Number.isFinite(roh) ? roh : 0) + 1;
      if (zyklen < OHNE_POSITION_ZYKLEN_MAX) {
        await db.$executeRawUnsafe(
          `UPDATE "Trade" SET "notes" = $1 WHERE "id" = $2`,
          JSON.stringify({ ...m, ohnePositionZyklen: zyklen }), id);
        bilanz.beobachtet++;
        continue;
      }
      await db.$executeRawUnsafe(
        `UPDATE "Trade" SET "status" = 'CLOSED', "result" = 'BREAKEVEN', `
        + `"profitLoss" = 0, "notes" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
        JSON.stringify({ ...m, ohnePositionZyklen: zyklen, exitReason: "NIE_BESTAETIGT" }), id);
      bilanz.benannt++;
      console.warn(`[trade-tracker] ⚠️ Zeile ${id} (${markt.get(id)}): nach `
        + `${DEALID_VERSUCHE_MAX} Bestaetigungsversuchen und ${zyklen} Zyklen ohne `
        + `passende Position — als NIE_BESTAETIGT geschlossen, P&L 0`);
    }
  } catch (e) {
    console.warn("[trade-tracker] Zuordnung aus der Positionsliste uebersprungen:",
      e instanceof Error ? e.message : String(e));
  }
  return bilanz;
}

export async function syncCapitalPositionsToJournal(): Promise<void> {
  try {
    const { getCapitalSession, isCapitalConnected } = await import("./capital-com-session");
    const { capitalGetPositions, capitalGetClosedPositions } = await import("./capital-com-client");

    // ZUERST ungeschriebene Journal-Zeilen nachtragen (20.08.) — und zwar VOR
    // der Broker-Pruefung. Das Schreiben braucht nur die Datenbank; haenge es
    // an `isCapitalConnected`, blieben gemerkte Zeilen bei getrennter
    // Broker-Sitzung ungeschrieben liegen, obwohl nichts dagegen spricht.
    // Eine fehlende Zeile bedeutet, dass die zugehoerige LAUFENDE Position dem
    // System unbekannt ist — jeder Schritt danach setzt sie voraus.
    await schreibeAusstehendeZeilen();

    if (!isCapitalConnected()) return;
    const session = getCapitalSession()!;

    // DANN fehlende Positions-IDs nachtragen (19.08.). Muss vor dem Abgleich
    // unten laufen: ein Eintrag ohne dealId laesst sich mit keiner offenen
    // Position vergleichen und saehe sonst aus wie eine verschwundene.
    // ── Die Bilanz gehört ins Log (01.09.) ──────────────────────────────
    //
    // Hier stand nur der Aufruf; der Rückgabewert {geprueft, ergaenzt,
    // aufgegeben} wurde verworfen. Die Funktion rechnet ihn also aus, und
    // niemand sieht ihn.
    //
    // Am 01.09. standen fünf offene Positionen beim Broker, vier Journal-
    // Zeilen und NULL mit dealId — und im Log keine einzige Zeile des
    // Nachtrags. Aus dem Log liess sich nicht sagen, ob überhaupt eine
    // Referenz zum Auflösen da war, ob Capital die Bestätigung verweigert
    // oder ob nach fünf Versuchen aufgegeben wurde: alle drei sind still.
    // Ein Eintrag, der `DEALID_VERSUCHE_MAX` erreicht hat, wird mit `continue`
    // übersprungen, BEVOR `geprueft` hochgezählt wird.
    //
    // Reine Beobachtung. Die Zeile erscheint nur, wenn es etwas zu berichten
    // gibt — sonst wäre sie alle zwei Minuten Rauschen.
    const dealIdBilanz = await ergaenzeFehlendeDealIds(
      session.apiKey, session.cst, session.securityToken);
    if (dealIdBilanz.geprueft > 0 || dealIdBilanz.ergaenzt > 0
      || dealIdBilanz.aufgegeben > 0 || dealIdBilanz.bereitsAufgegeben > 0) {
      console.log(`[trade-tracker] dealId-Nachtrag: ${dealIdBilanz.geprueft} geprüft, `
        + `${dealIdBilanz.ergaenzt} ergänzt, ${dealIdBilanz.aufgegeben} aufgegeben, `
        + `${dealIdBilanz.bereitsAufgegeben} bleiben dauerhaft ohne Positions-ID`);
    }

    const posResult = await capitalGetPositions(session.apiKey, session.cst, session.securityToken);
    if (!posResult.ok) return;

    const openDealIds = new Set(
      (posResult.positions ?? []).map((p) => p.dealId ?? "").filter(Boolean)
    );

    // ── Zweiter Weg zur Positions-ID (02.09.) ────────────────────────────
    //
    // MUSS hier stehen, nicht frueher: davor gibt es die Positionsliste noch
    // nicht. Und MUSS vor der Schleife weiter unten stehen: die ueberspringt
    // jede Zeile ohne dealId (`if (!meta.dealId) continue`), eine gerade
    // aufgeloeste Zeile wird also im selben Zyklus richtig behandelt. Die
    // frisch geschriebenen IDs stammen aus genau dieser Liste und stehen damit
    // bereits in `openDealIds` — eine wiederhergestellte Zeile sieht deshalb
    // NICHT wie eine verschwundene Position aus.
    const ausListe = await ergaenzeDealIdsAusPositionen(posResult.positions ?? []);
    if (ausListe.ergaenzt > 0 || ausListe.unklar > 0
      || ausListe.beobachtet > 0 || ausListe.benannt > 0) {
      console.log(`[trade-tracker] Zuordnung aus Positionsliste: ${ausListe.ergaenzt} ergänzt, `
        + `${ausListe.unklar} unklar, ${ausListe.beobachtet} beobachtet, `
        + `${ausListe.benannt} als NIE_BESTAETIGT geschlossen`);
    }

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
