/**
 * Zustand des Python-Backends (19.08.).
 *
 * WOZU. Alle Aufrufe an divine-warmth / exquisite-rejoicing sind bewusst
 * fehlertolerant: `post()` und `get()` in python-client.ts geben bei jedem
 * Fehler `null` zurueck, und das System laeuft regelbasiert weiter. Das ist
 * als Verhalten richtig — aber der Ausfall war damit UNSICHTBAR. Es entstand
 * eine console.warn-Zeile und sonst nichts.
 *
 * Nachgewiesen am 18.08. in der Generalkontrolle: `pyHealthCheck()` hat keinen
 * Aufrufer, `/api/market-data/health` wird nur von LiveMarketWidget.tsx geholt
 * (also nur bei geoeffneter Seite), und der Diagnostics-Agent prueft
 * ausschliesslich Agenten. Faellt Python im Hintergrund aus, merkt es niemand.
 *
 * Das ist keine Kleinigkeit: ueber diesen Dienst laufen der Python-Lifecycle
 * (Breakeven, Teilgewinn, Trailing, Zeit-Exit als zweite Schicht) und die
 * Datenversorgung der Analysis-Engine.
 *
 * KEIN EIGENER TESTAUFRUF. Dieses Modul fragt nichts ab — es zaehlt mit, was
 * im Betrieb ohnehin passiert. Ein zusaetzlicher Health-Ping alle paar Minuten
 * waere Last ohne Erkenntnis: wenn die echten Aufrufe durchgehen, ist der
 * Dienst erreichbar, und wenn sie es nicht tun, ist genau das die Antwort.
 *
 * Reine Zaehlung, kein Netz, keine Datenbank: dieses Modul darf niemals ein
 * Grund sein, warum ein Handelszyklus scheitert.
 *
 * ZUR LEBENSDAUER, offen gesagt: die Zaehler liegen im Arbeitsspeicher des
 * Prozesses und sind nach einem Neustart weg. Fuer die Frage "antwortet Python
 * gerade?" genuegt das — genau dafuer ist es gebaut.
 */

/** Ab wie vielen Fehlschlaegen in Folge der Dienst als ausgefallen gilt.
 *  Eins waere zu nervoes (ein einzelner Zeitfehler kommt vor), fuenf zu
 *  traege. Dieselbe Schwelle wie beim AI Manager, aus demselben Grund. */
export const AUSFALL_AB_FEHLERN = 3;

export interface PythonStatus {
  seit: string;
  gesamt: number;
  erfolge: number;
  fehler: number;
  letzterErfolgAt: string | null;
  letzterErfolgPfad: string | null;
  letzterFehlerAt: string | null;
  letzterFehler: string | null;
  letzterFehlerPfad: string | null;
  fehlerInFolge: number;
  fehlerAnteilPct: number;
  /** true = antwortet, false = faellt aus, null = seit dem Start nicht gerufen.
   *  null ist NICHT dasselbe wie "laeuft": ist PYTHON_BACKEND_URL nicht
   *  gesetzt, wird gar nicht erst gerufen — das als Ausfall zu melden waere
   *  ein Fehlalarm. */
  erreichbar: boolean | null;
}

interface Zustand {
  seit: string;
  erfolge: number;
  fehler: number;
  letzterErfolgAt: string | null;
  letzterErfolgPfad: string | null;
  letzterFehlerAt: string | null;
  letzterFehler: string | null;
  letzterFehlerPfad: string | null;
  fehlerInFolge: number;
  /** Wurde der laufende Ausfall schon gemeldet? Verhindert, dass derselbe
   *  Ausfall alle fuenf Minuten erneut per Telegram kommt. */
  ausfallGemeldet: boolean;
}

function neuerZustand(): Zustand {
  return {
    seit: new Date().toISOString(),
    erfolge: 0,
    fehler: 0,
    letzterErfolgAt: null,
    letzterErfolgPfad: null,
    letzterFehlerAt: null,
    letzterFehler: null,
    letzterFehlerPfad: null,
    fehlerInFolge: 0,
    ausfallGemeldet: false,
  };
}

// Prozessweit, damit ein Modul-Neuimport in Next.js die Zaehlung nicht
// zuruecksetzt — dasselbe Muster wie bei ai-manager-status.
declare global { var __python_status__: Zustand | undefined; }

function zustand(): Zustand {
  if (!global.__python_status__) global.__python_status__ = neuerZustand();
  return global.__python_status__;
}

/**
 * Einen Aufruf ans Python-Backend verbuchen.
 *
 * @param pfad    der aufgerufene Pfad, z. B. "/api/v1/lifecycle/trades"
 * @param erfolg  true = HTTP 2xx mit lesbarer Antwort
 * @param fehler  kurzer Grund, nur bei erfolg=false ("401", "timeout", ...)
 */
export function meldePythonAufruf(pfad: string, erfolg: boolean, fehler?: string): void {
  // Niemals werfen: dieses Modul zaehlt nur mit und darf einen Handelszyklus
  // unter keinen Umstaenden abbrechen.
  try {
    const z = zustand();
    const p = String(pfad ?? "").slice(0, 120);
    const jetzt = new Date().toISOString();
    if (erfolg === true) {
      z.erfolge++;
      z.fehlerInFolge = 0;
      z.letzterErfolgAt = jetzt;
      z.letzterErfolgPfad = p;
    } else {
      z.fehler++;
      z.fehlerInFolge++;
      z.letzterFehlerAt = jetzt;
      z.letzterFehler = String(fehler ?? "unbekannt").slice(0, 200);
      z.letzterFehlerPfad = p;
    }
  } catch { /* Zaehlen darf nie stoeren */ }
}

export function getPythonStatus(): PythonStatus {
  const z = zustand();
  const gesamt = z.erfolge + z.fehler;
  return {
    seit: z.seit,
    gesamt,
    erfolge: z.erfolge,
    fehler: z.fehler,
    letzterErfolgAt: z.letzterErfolgAt,
    letzterErfolgPfad: z.letzterErfolgPfad,
    letzterFehlerAt: z.letzterFehlerAt,
    letzterFehler: z.letzterFehler,
    letzterFehlerPfad: z.letzterFehlerPfad,
    fehlerInFolge: z.fehlerInFolge,
    fehlerAnteilPct: gesamt > 0 ? Math.round((z.fehler / gesamt) * 1000) / 10 : 0,
    // Noch nie gerufen -> null. Ohne gesetzte URL wird gar nicht gerufen; das
    // als Ausfall zu melden waere ein Fehlalarm.
    erreichbar: gesamt === 0 ? null : z.fehlerInFolge < AUSFALL_AB_FEHLERN,
  };
}

export type PythonUebergang = "AUSFALL" | "ERHOLT" | null;

/**
 * Gibt den Zustandswechsel zurueck — und zwar GENAU EINMAL je Wechsel.
 *
 * WARUM ES DIESE FUNKTION GIBT. Der Diagnostics-Agent laeuft alle fuenf
 * Minuten. Fragte er nur `erreichbar === false` ab, kaeme waehrend eines
 * Ausfalls alle fuenf Minuten dieselbe Telegram-Nachricht — bei einer Nacht
 * Ausfall zwoelf pro Stunde. Genau dieser Fehler steckte im Alarm des AI
 * Managers vom 11.08.
 *
 * "ERHOLT" wird ebenfalls genau einmal gemeldet: die Entwarnung ist die
 * wichtigere Haelfte, sonst weiss niemand, ob der Ausfall noch anhaelt.
 */
export function pythonUebergang(): PythonUebergang {
  try {
    const z = zustand();
    // KEIN gesonderter Riegel fuer "nie gerufen". Der erste Entwurf hatte hier
    // `if (gesamt === 0) return null;` — im Sabotage-Lauf am 19.08. zeigte
    // sich, dass die Zeile TOT war: ohne Aufruf ist fehlerInFolge 0, also nie
    // >= AUSFALL_AB_FEHLERN, und ausfallGemeldet kann gar nicht gesetzt sein.
    // Sie liess sich ersatzlos streichen, ohne dass sich irgendein Ergebnis
    // aenderte. Ein Riegel, der nichts verriegelt, taeuscht Sicherheit vor.
    const ausgefallen = z.fehlerInFolge >= AUSFALL_AB_FEHLERN;
    if (ausgefallen && !z.ausfallGemeldet) {
      z.ausfallGemeldet = true;
      return "AUSFALL";
    }
    if (!ausgefallen && z.ausfallGemeldet) {
      z.ausfallGemeldet = false;
      return "ERHOLT";
    }
    return null;
  } catch {
    return null;
  }
}

/** Nur für Tests und Prüfer. */
export function resetPythonStatus(): void {
  global.__python_status__ = neuerZustand();
}
