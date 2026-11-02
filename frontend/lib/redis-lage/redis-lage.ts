/**
 * EIN REDIS-AUSFALL DARF NICHT STUMM SEIN (01.11.)
 *
 * ANLASS. Ausgeführt gemessen am 01.11., mit dem ECHTEN Cache-Modul ohne
 * `REDIS_URL` — ein Redis-Ausfall sieht an vier Geldstellen so aus:
 *
 *   checkDailyLossLimit(1000, 3)       -> allowed:true, 0 Logzeilen
 *     danach day_start_balance          = {balance:1000, herkunft:"speicher"}
 *   checkWeeklyLossLimit(1000, 6)      -> allowed:true, 0 Logzeilen
 *     danach week_start_balance         = {balance:1000, herkunft:"speicher"}
 *   checkTotalDrawdownLimit(1000, 10)  -> allowed:true, 0 Logzeilen
 *     danach peak_balance               = {peak:1000,   herkunft:"speicher"}
 *   restoreKillswitchFromRedis()       -> false,        0 Meldungen
 *
 * Jede der drei Grenzen hielt den Ausfall für den ERSTEN Lauf des
 * Zeitraums und setzte ihren Bezugspunkt auf den Kontostand im
 * Ausfall-Moment — der Schutz misst ab da von dort und ist damit
 * schwächer, ohne dass es jemand erfährt.
 *
 * WARUM EINE EIGENE DATEI. Dieselbe Begründung wie bei `htmlSicher`
 * (31.10.): rein, ohne Importe, ohne Seiteneffekte. `trade-filters.ts`
 * und `killswitch-engine.ts` stehen beide auf der Liste der Dateien mit
 * erhöhtem Risiko — dort gehört ein möglichst kleiner Diff hin, und eine
 * Umsetzung an zwei Stellen könnte auseinanderlaufen.
 *
 * WARUM AUF `global`. Die Grenzen laufen aus `instrumentation.ts`,
 * `/peakreset` und `/status` laufen in `app/api` — zwei Modulkopien. Eine
 * modul-scoped Variable drosselte jede Kopie für sich, und bei einem
 * Dauerausfall kämen doppelt so viele Zeilen (Regel vom 28.07., dreimal
 * übergangen am 25.10.).
 *
 * WARUM JE STELLE EIN EIGENER ZUSTAND. Teilten sich die Stellen einen,
 * verdeckte die erste Meldung die anderen drei — wieder ein stummer
 * Ausfall, nur eine Ebene höher.
 */

export type RedisLage = "aus" | "ok";

type Eintrag = { lage: RedisLage; letzteMeldung: number };

declare global {
  // eslint-disable-next-line no-var
  var __redis_lage__: Map<string, Eintrag> | undefined;
}

function lagen(): Map<string, Eintrag> {
  global.__redis_lage__ ??= new Map();
  return global.__redis_lage__;
}

/** Ein Dauerausfall wird alle 30 Minuten erneut gemeldet. */
export const REDIS_MELDE_ABSTAND_MS = 30 * 60 * 1000;

/**
 * Soll diese Stelle jetzt melden?
 *
 * - Jeder **Wechsel** wird gemeldet — auch die Rückkehr zu `ok`, sonst
 *   bliebe offen, ob der Ausfall vorbei ist.
 * - Ein **Dauerausfall** wird nach `REDIS_MELDE_ABSTAND_MS` erneut
 *   gemeldet. Ohne die Wiederholung verschwände genau der interessante
 *   Fall nach der ersten Meldung für immer (Lehre vom 25.10.).
 * - Ein **gesunder Dauerzustand schweigt** — sonst wären es bei drei
 *   Grenzen und 288 Zyklen über 800 Zeilen am Tag.
 * - Der **erste** Blick auf eine Stelle meldet nur, wenn sie `aus` ist:
 *   ein gesunder Start ist keine Nachricht.
 */
/**
 * Dieselbe Drossel unter neutralem Namen (02.11.).
 *
 * Die Mechanik ist nicht Redis-spezifisch — der erste Nutzer war es,
 * daher der Dateiname. Seit dem 02.11. meldet auch der Scanner damit
 * den Totalausfall der Signalquelle. Ein ALIAS, keine zweite Fassung:
 * zwei Umsetzungen derselben Drossel koennten auseinanderlaufen.
 */
export function lageMelden(
  stelle: string,
  lage: RedisLage,
  jetzt: number = Date.now(),
): boolean {
  return redisLageMelden(stelle, lage, jetzt);
}

export function redisLageMelden(
  stelle: string,
  lage: RedisLage,
  jetzt: number = Date.now(),
): boolean {
  const k = lagen();
  const vorher = k.get(stelle);

  if (!vorher) {
    k.set(stelle, { lage, letzteMeldung: jetzt });
    return lage === "aus";
  }
  if (vorher.lage !== lage) {
    k.set(stelle, { lage, letzteMeldung: jetzt });
    return true;
  }
  if (lage === "aus" && jetzt - vorher.letzteMeldung >= REDIS_MELDE_ABSTAND_MS) {
    k.set(stelle, { lage, letzteMeldung: jetzt });
    return true;
  }
  return false;
}
