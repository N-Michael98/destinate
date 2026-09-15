// ── ABSTÜRZE IN DEN HANDELSSCHLEIFEN ERREICHEN DEN NUTZER (15.09.) ──────────
//
// DER BEFUND. Ein Fehler im Orchestrator-Zyklus wurde so behandelt:
//
//   } catch (err) {
//     console.error("[orchestrator] Zyklus-Fehler:", …);
//   }
//
// Das landet im Railway-Log. Der Nutzer liest Telegram. In `instrumentation.ts`
// wird Telegram an genau drei Stellen benutzt — keine davon für einen
// Zyklus-Absturz. Der Zyklus kann also stundenlang bei jedem Lauf sterben,
// und von aussen sieht es aus wie „gerade keine Gelegenheit".
//
// Das ist exakt das Muster, das den Stillstand seit dem 30.06. so lange
// getragen hat: der Gesamt-Drawdown-Riegel sperrte JEDEN Trade, korrekt, aber
// STILL — nur die Wochengrenze meldete sich. Gefunden wurde es erst, als
// jemand gezielt das Log durchgegangen ist.
//
// WARUM EIN EIGENES MODUL. Die Entscheidung „melden oder nicht" ist die ganze
// Schwierigkeit: alle 5 Minuten dieselbe Nachricht wäre nach einer Stunde
// zwölf Meldungen, und dann schaltet man die Benachrichtigungen ab — womit der
// Alarm schlechter wäre als keiner. Diese Logik gehört nicht in
// `instrumentation.ts` (Datei mit erhöhtem Risiko), sondern dorthin, wo ein
// Prüfer sie WIRKLICH AUFRUFEN kann.
//
// WAS DIESES MODUL NICHT TUT: es trifft keine Handelsentscheidung, es sperrt
// nichts und es ändert an keiner Schleife etwas. Es entscheidet ausschliesslich,
// ob eine Nachricht rausgeht.

/** Was über einen Bereich zuletzt gemeldet wurde. */
export type AlarmZustand = {
  /** Der zuletzt GEMELDETE Text — nicht der zuletzt gesehene. */
  text: string;
  /** Zeitpunkt dieser Meldung (ms). */
  zuletzt: number;
  /** Wie viele gleiche Fehler seither geschluckt wurden. */
  unterdrueckt: number;
};

/**
 * Ruhezeit für denselben Fehler im selben Bereich: 30 Minuten.
 *
 * Der Orchestrator läuft alle 5 Minuten. Ohne Drossel ergäbe ein dauerhaft
 * kaputter Zyklus 12 Nachrichten pro Stunde; mit 30 Minuten sind es zwei, und
 * die zweite sagt ausserdem, wie oft es dazwischen passiert ist. Ein ANDERER
 * Fehler geht sofort raus — eine neue Fehlermeldung ist neue Information.
 */
export const ALARM_RUHE_MS = 30 * 60 * 1000;

/**
 * Entscheidet, ob dieser Fehler gemeldet wird. Ändert `zustand` mit.
 *
 * Bewusst KEIN Zeitgeber und KEIN Netz darin: `jetzt` kommt von aussen, damit
 * ein Prüfer den Ablauf einer halben Stunde nachstellen kann, ohne zu warten.
 *
 * IM ZWEIFEL MELDEN. Ist die Uhr unbrauchbar (NaN) oder läuft sie rückwärts
 * (Neustart, Zeitumstellung), wird gemeldet statt geschluckt. Ein Alarm, den
 * eine kaputte Uhr verschluckt, ist genau der Fehler, den dieses Modul
 * beheben soll — und ein Alarm zu viel kostet nichts.
 */
export function alarmEntscheidung(
  bereich: string,
  text: string,
  jetzt: number,
  zustand: Record<string, AlarmZustand>,
): { melden: boolean; unterdrueckt: number } {
  const vorher = zustand[bereich];

  // Noch nie etwas aus diesem Bereich gehört -> immer melden.
  if (!vorher) {
    zustand[bereich] = { text, zuletzt: jetzt, unterdrueckt: 0 };
    return { melden: true, unterdrueckt: 0 };
  }

  const uhrKaputt = !Number.isFinite(jetzt) || !Number.isFinite(vorher.zuletzt);
  const rueckwaerts = !uhrKaputt && jetzt < vorher.zuletzt;
  const neuerFehler = vorher.text !== text;
  const ruheVorbei = !uhrKaputt && jetzt - vorher.zuletzt >= ALARM_RUHE_MS;

  if (neuerFehler || ruheVorbei || uhrKaputt || rueckwaerts) {
    const geschluckt = vorher.unterdrueckt;
    zustand[bereich] = { text, zuletzt: jetzt, unterdrueckt: 0 };
    return { melden: true, unterdrueckt: geschluckt };
  }

  // Gleicher Fehler, Ruhezeit läuft noch: mitzählen, nicht melden.
  vorher.unterdrueckt++;
  return { melden: false, unterdrueckt: vorher.unterdrueckt };
}

/**
 * Der gemeinsame Zustand liegt auf `global`.
 *
 * NICHT modul-scoped. In diesem Projekt ist das ein Fehler mit Geschichte: am
 * 28.07. hat genau das den Killswitch ausgehebelt, am 26.08. den Preis-Cache.
 * API-Routen und die Schleifen aus `instrumentation.ts` sehen verschiedene
 * Kopien desselben Moduls — eine modul-scoped `let` würde die Drossel pro
 * Kopie führen und damit mehrfach melden.
 */
declare global {
  // eslint-disable-next-line no-var
  var __zyklus_alarm__: Record<string, AlarmZustand> | undefined;
}

/**
 * Meldet einen Absturz aus einer Handelsschleife per Telegram — gedrosselt.
 *
 * Wirft NIE. Ein Alarm, der die Schleife mit in den Abgrund zieht, wäre
 * schlimmer als kein Alarm; deshalb liegt alles in `try/catch` und der
 * Rückgabewert sagt nur, ob etwas rausging.
 */
export async function meldeZyklusFehler(bereich: string, fehler: unknown): Promise<boolean> {
  try {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    // Lesen UND Anlegen an EINER Stelle — der Besitzer dieses Zustands ist
    // dieses Modul, und sonst niemand (Gegenstueck-Regel vom 07.09.).
    global.__zyklus_alarm__ ??= {};
    const { melden, unterdrueckt } = alarmEntscheidung(bereich, text, Date.now(), global.__zyklus_alarm__);
    if (!melden) return false;

    const { sendTelegram } = await import("../telegram-notifications/telegram-sender");
    return await sendTelegram(
      `🚨 <b>Zyklus-Absturz: ${bereich}</b>\n\n`
      + `${text}\n\n`
      + (unterdrueckt > 0
          ? `Seit der letzten Meldung ${unterdrueckt}× derselbe Fehler.\n`
          : "")
      + `Die Schleife läuft weiter und versucht es beim nächsten Durchgang erneut. `
      + `Weitere gleiche Meldungen frühestens in 30 Minuten.`
    );
  } catch {
    // Kein Netz, kein Token, kein Telegram — die Schleife darf davon nichts
    // merken.
    return false;
  }
}
