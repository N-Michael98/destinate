// ── Ausführungs-Stand: ABGELEITET, nicht behauptet (03.09.) ─────────────────
//
// WAS HIER VORHER STAND — in `components/ExecutionCenterPanel.tsx` fest
// verdrahtet, und in der Ansicht `ExecutionLiveCenter` daneben:
//
//   { label: "Queue Tickets",     value: "11" }
//   { label: "Execution Ready",   value: "10/11" }
//   "Execution Status: Prepared"   (grün)
//   "Engine: Online"
//
// Dazu die schwerste Stelle: `/api/execution/tickets` BAUTE die Tickets inline
// zusammen — XAUUSD BUY @ 3365, SL 3345, TP 3390/3420, Confidence 96,
// "Consensus BUY" — und die Ansicht schrieb darunter "Daten aus
// /api/execution/tickets. Auto-Refresh alle 20 Sekunden." Das sah aus wie ein
// Live-Handelssignal mit Einstieg, Stop und Ziel. Es war erfunden.
//
// Nachgeprüft über die System-Karte: `lib/execution-preparation` wird von
// KEINEM Handelspfad erreicht — nur von drei API-Routen. `ExecutionQueue.add()`
// hat genau einen Aufrufer, der selbst nur von Routen erreichbar ist. Die
// Warteschlange ist also strukturell IMMER leer. Die echte Ausführung läuft
// über `capital-com-execution.ts`.
//
// Hier stehen jetzt die Zahlen, die es WIRKLICH gibt: der Tageszähler aus
// `global.__daily_trades__` (Redis-gestützt, vom Orchestrator geführt) und das
// Ergebnis des letzten Scans aus `global.__last_scan_result__`. Fehlt ein
// Zähler, steht `null` — nicht 0. "Heute noch kein Trade" und "es gibt keinen
// Zähler" sind zwei verschiedene Aussagen.

export interface TagesZaehler {
  date?: string | null;
  count?: number | null;
  byStyle?: Record<string, number> | null;
}

export interface ScanErgebnis {
  opportunities?: unknown[] | null;
  updatedAt?: string | null;
}

export interface Grenzen {
  maxTradesPerDay?: number | null;
  tradeLimitEnabled?: boolean | null;
  maxTradesPerDayByStyle?: Record<string, number> | null;
}

export interface StilZeile {
  stil: string;
  heute: number;
  grenze: number | null;
}

export interface AusfuehrungsStand {
  /** Datum des Zählers. Stimmt es nicht mit heute überein, ist er veraltet. */
  datum: string | null;
  /** Gilt der Zähler für den heutigen Tag? null = kein Zähler vorhanden. */
  aktuell: boolean | null;
  heute: number | null;
  grenze: number | null;
  limitAktiv: boolean;
  jeStil: StilZeile[];
  letzterScanGefunden: number | null;
  letzterScanStand: string | null;
  letzterScanAlterMinuten: number | null;
  nichtGemessen: string[];
  updatedAt: string;
}

function ganzzahl(wert: unknown): number | null {
  if (typeof wert !== "number" || !Number.isFinite(wert)) return null;
  return wert;
}

/** Minuten seit einem ISO-Zeitstempel. Unlesbar → null, NICHT 0. */
function minutenSeit(zeitpunkt: unknown, jetzt: number): number | null {
  const roh = String(zeitpunkt ?? "").trim();
  if (!roh) return null;
  const ms = Date.parse(roh);
  if (!Number.isFinite(ms)) return null;
  return Number(((jetzt - ms) / 60000).toFixed(1));
}

/**
 * Leitet den Ausführungs-Stand aus den echten Zählern ab.
 *
 * Als Funktion und NICHT eingebettet in der Route: dort ließe sie sich nicht
 * aufrufen und damit nicht beweisen — derselbe Grund wie bei `brokerZustand()`,
 * `zuordnungAusPositionen()` und `positionenOhneStammdaten()`.
 */
export function ausfuehrungsStand(
  zaehler: TagesZaehler | null | undefined,
  scan: ScanErgebnis | null | undefined,
  grenzen: Grenzen | null | undefined,
  jetzt: number = Date.now(),
): AusfuehrungsStand {
  const datum = String(zaehler?.date ?? "").trim() || null;
  const heuteDatum = new Date(jetzt).toISOString().slice(0, 10);
  const heute = ganzzahl(zaehler?.count);

  // Ein Zähler von GESTERN darf nicht als heutiger Stand durchgehen. Ohne
  // Zähler ist `aktuell` null — "unbekannt", nicht "veraltet".
  const aktuell = datum === null ? null : datum === heuteDatum;

  const jeStilRoh = zaehler?.byStyle ?? {};
  const stilGrenzen = grenzen?.maxTradesPerDayByStyle ?? {};
  // Beide Seiten zusammenführen: ein Stil mit Grenze aber ohne Trades gehört
  // genauso in die Liste wie einer mit Trades ohne Grenze.
  const stile = [...new Set([
    ...Object.keys(jeStilRoh ?? {}),
    ...Object.keys(stilGrenzen ?? {}),
  ])].sort();

  const jeStil: StilZeile[] = stile.map((stil) => ({
    stil,
    heute: ganzzahl((jeStilRoh ?? {})[stil]) ?? 0,
    grenze: ganzzahl((stilGrenzen ?? {})[stil]),
  }));

  const gelegenheiten = Array.isArray(scan?.opportunities)
    ? scan!.opportunities!.length
    : null;

  return {
    datum,
    aktuell,
    heute,
    grenze: ganzzahl(grenzen?.maxTradesPerDay),
    // Ein abgeschaltetes Tageslimit ist eine Aussage über das Risiko und muss
    // sichtbar sein — Standard ist AN, siehe `tradeLimitEnabled` im Snapshot.
    limitAktiv: grenzen?.tradeLimitEnabled !== false,
    jeStil,
    letzterScanGefunden: gelegenheiten,
    letzterScanStand: String(scan?.updatedAt ?? "").trim() || null,
    letzterScanAlterMinuten: minutenSeit(scan?.updatedAt, jetzt),
    nichtGemessen: [
      "Ausführungs-Warteschlange — `lib/execution-preparation` hat keinen "
        + "Aufrufer im Handelspfad und ist strukturell immer leer",
      "Latenz, Slippage und Füllqualität — hier wird nichts davon gemessen",
    ],
    updatedAt: new Date(jetzt).toISOString(),
  };
}
