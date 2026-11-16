// ── /exits: DER ABLAUF (16.11.) ──────────────────────────────────────────────
//
// Holt je Kandidat EINEN Kerzen-Abruf und rechnet nach. Alles, was nach
// aussen geht (Abruf, Warten, Uhr), wird HINEINGEREICHT — so faehrt der
// Pruefstand den echten Ablauf ohne Netz und zaehlt die Abrufe.
//
// NACHEINANDER, nicht parallel: Capital.com erlaubt 10 Anfragen je Sekunde
// JE NUTZER (offizielle Doku), und dieses Kontingent teilen wir mit den
// laufenden Handelsschleifen. Eine Messung darf den Handel nicht drosseln.
//
// Ein 401/403/429 bricht AB: der Fehler kehrt bei jedem weiteren Abruf
// zurueck (Regel 22.09. / 02.11.), und bei 429 waere Nachlegen genau falsch.
// Das Teilergebnis wird trotzdem gemeldet — mit Grund.

import {
  aufloesungFuer, kerzenLesen, nachrechnen, utcParameter, MAX_KERZEN,
  type Kandidat, type EinzelErgebnis,
} from "./exit-messung";

export type KerzenAntwort =
  | { ok: true; daten: unknown }
  | { ok: false; status: number | null; error: string };

export interface LaufAbhaengigkeiten {
  kerzen(epic: string, aufloesung: string, vonUtc: string, bisUtc: string, max: number): Promise<KerzenAntwort>;
  warte(ms: number): Promise<void>;
  jetzt(): number;
}

export interface LaufErgebnis {
  ergebnisse: EinzelErgebnis[];
  abbruch: string | null;
  kerzenUnbrauchbar: number;
  versatzMin: number | null;
  versatzMax: number | null;
  abrufe: number;
}

/** Pause zwischen zwei Abrufen: hoechstens 2 je Sekunde. */
export const PAUSE_MS = 500;
/** So viele Netzfehler HINTEREINANDER, dann ist es kein Aussetzer mehr. */
export const NETZFEHLER_GRENZE = 3;
const ENDGUELTIG = new Set([401, 403, 429]);

export async function exitLauf(kandidaten: readonly Kandidat[], abh: LaufAbhaengigkeiten): Promise<LaufErgebnis> {
  const ergebnisse: EinzelErgebnis[] = [];
  let abbruch: string | null = null;
  let kerzenUnbrauchbar = 0;
  let versatzMin: number | null = null;
  let versatzMax: number | null = null;
  let abrufe = 0;
  let netzfehlerFolge = 0;

  for (let i = 0; i < kandidaten.length; i++) {
    const k = kandidaten[i];
    if (i > 0) await abh.warte(PAUSE_MS);
    const a = aufloesungFuer(k.horizontStunden);
    const endeMs = Math.min(k.eroeffnetMs + k.horizontStunden * 3_600_000, abh.jetzt());
    // `to` eine Kerze ueber das Ende hinaus: die letzte Kerze vor dem Ende
    // soll nicht an einer Grenzbedingung des Brokers haengen.
    const antwort = await abh.kerzen(
      k.epic, a.name, utcParameter(k.eroeffnetMs), utcParameter(endeMs + a.minuten * 60_000), MAX_KERZEN);
    abrufe++;

    if (!antwort.ok) {
      if (antwort.status !== null && ENDGUELTIG.has(antwort.status)) {
        abbruch = `HTTP ${antwort.status} beim Kerzen-Abruf (${k.symbol}): ${antwort.error}`;
        break;
      }
      if (antwort.status === null) {
        netzfehlerFolge++;
        if (netzfehlerFolge >= NETZFEHLER_GRENZE) {
          abbruch = `${NETZFEHLER_GRENZE} Netzfehler hintereinander (zuletzt ${k.symbol}): ${antwort.error}`;
        }
      } else {
        netzfehlerFolge = 0;
      }
      ergebnisse.push({
        kandidat: k,
        nachrechnung: { treffer: "KEINE_DATEN", maxR: null, haltenR: null, kerzenGenutzt: 0 },
        datenGrund: antwort.status === null ? "Netzfehler" : `HTTP ${antwort.status}`,
        gekappt: false,
      });
      if (abbruch !== null) break;
      continue;
    }

    netzfehlerFolge = 0;
    const lesung = kerzenLesen(antwort.daten);
    kerzenUnbrauchbar += lesung.unbrauchbar;
    if (lesung.versatzMin !== null) versatzMin = versatzMin === null ? lesung.versatzMin : Math.min(versatzMin, lesung.versatzMin);
    if (lesung.versatzMax !== null) versatzMax = versatzMax === null ? lesung.versatzMax : Math.max(versatzMax, lesung.versatzMax);
    const nachrechnung = nachrechnen(k, lesung.kerzen, a.minuten, endeMs);
    ergebnisse.push({
      kandidat: k,
      nachrechnung,
      datenGrund: nachrechnung.treffer === "KEINE_DATEN"
        ? (lesung.kerzen.length === 0 ? "leere Antwort" : "keine Kerze nach dem Einstieg")
        : null,
      gekappt: lesung.kerzen.length + lesung.unbrauchbar >= MAX_KERZEN,
    });
  }
  return { ergebnisse, abbruch, kerzenUnbrauchbar, versatzMin, versatzMax, abrufe };
}

// ── SPERRE: EIN Lauf zur Zeit (auf `global`) ──────────────────────────────────
//
// Die Webhook-Route und jede andere Modulkopie muessen DIESELBE Sperre sehen
// (Regel 28.07. / 17.09.: wer einen geteilten Zustand baut, legt die Sperre
// dorthin). Eine Sperre, die nie freigegeben wird — etwa weil der Prozess
// mitten im Lauf neu startet —, verfaellt nach VERFALL_MS, statt `/exits`
// fuer immer zu blockieren.

declare global {
  // eslint-disable-next-line no-var
  var __exits_laeuft_seit__: number | null | undefined;
}

export const VERFALL_MS = 30 * 60_000;

export function exitsSperreNehmen(jetztMs: number): { ok: true } | { ok: false; seitMs: number } {
  const seit = global.__exits_laeuft_seit__ ?? null;
  if (seit !== null && jetztMs - seit < VERFALL_MS) return { ok: false, seitMs: seit };
  if (seit !== null) {
    console.warn(`[exits] Sperre seit ${Math.round((jetztMs - seit) / 60_000)} min nicht freigegeben — verfallen, wird neu genommen`);
  }
  global.__exits_laeuft_seit__ = jetztMs;
  return { ok: true };
}

export function exitsSperreFreigeben(): void {
  global.__exits_laeuft_seit__ = null;
}
