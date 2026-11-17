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
  type Kandidat, type EinzelErgebnis, type Kerze,
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

// ── /exitsim: SEITENWEISE ABRUFEN (17.11.) ────────────────────────────────────
//
// Die Nachrechnung der Ausstiegslogik braucht Fuenf-Minuten-Kerzen ueber die
// GANZE Haltedauer — bei SWING 168 h = 2016 Kerzen, also mehr als die 1000 je
// Abruf. Dazu Stundenkerzen fuer die ATR, ab 100 h VOR dem Einstieg, damit die
// Wilder-Glaettung eingeschwungen ist. Dieselben Regeln wie oben: nacheinander,
// Pause zwischen JEDEM Abruf, 401/403/429 brechen ab, drei Netzfehler
// hintereinander ebenso.

/** Feste Aufloesung der Nachrechnung: naeher am 2-Minuten-Takt als 15-Minuten-Kerzen. */
export const SIM_AUFLOESUNG = { name: "MINUTE_5", minuten: 5 } as const;
/** So weit vor dem Einstieg beginnen die Stundenkerzen fuer die ATR. */
export const ATR_VORLAUF_STUNDEN = 100;

export interface SimDaten {
  kandidat: Kandidat;
  kerzen: Kerze[];
  stunden: Kerze[];
  minuten: number;
  endeMs: number;
  /** Gesetzt, wenn fuer diesen Trade keine vollstaendigen Daten kamen. */
  datenGrund: string | null;
}

export interface SimLaufErgebnis {
  daten: SimDaten[];
  abbruch: string | null;
  abrufe: number;
  kerzenUnbrauchbar: number;
}

/** Wie viele Abrufe ein Trade braucht — fuer die ehrliche Zeitangabe vorab. */
export function simAbrufeFuer(k: Kandidat, jetztMs: number): number {
  const endeMs = Math.min(k.eroeffnetMs + k.horizontStunden * 3_600_000, jetztMs);
  const fenster = (MAX_KERZEN - 2) * SIM_AUFLOESUNG.minuten * 60_000;
  const spanne = endeMs + SIM_AUFLOESUNG.minuten * 60_000 - k.eroeffnetMs;
  return Math.max(1, Math.ceil(spanne / fenster)) + 1;   // + Stundenkerzen
}

export async function exitSimLauf(kandidaten: readonly Kandidat[], abh: LaufAbhaengigkeiten): Promise<SimLaufErgebnis> {
  const daten: SimDaten[] = [];
  let abbruch: string | null = null;
  let abrufe = 0;
  let kerzenUnbrauchbar = 0;
  let netzfehlerFolge = 0;
  const minMs = SIM_AUFLOESUNG.minuten * 60_000;
  const fenster = (MAX_KERZEN - 2) * minMs;

  // Ein Abruf mit allen Regeln; null heisst „fuer diesen Trade keine Daten",
  // der Grund steht dann in `grund.wert`.
  const holen = async (epic: string, aufl: string, vonMs: number, bisMs: number, symbol: string,
                       grund: { wert: string | null }) => {
    if (abrufe > 0) await abh.warte(PAUSE_MS);
    const a = await abh.kerzen(epic, aufl, utcParameter(vonMs), utcParameter(bisMs), MAX_KERZEN);
    abrufe++;
    if (!a.ok) {
      if (a.status !== null && ENDGUELTIG.has(a.status)) {
        abbruch = `HTTP ${a.status} beim Kerzen-Abruf (${symbol}): ${a.error}`;
      } else if (a.status === null) {
        netzfehlerFolge++;
        if (netzfehlerFolge >= NETZFEHLER_GRENZE) {
          abbruch = `${NETZFEHLER_GRENZE} Netzfehler hintereinander (zuletzt ${symbol}): ${a.error}`;
        }
      } else {
        netzfehlerFolge = 0;
      }
      grund.wert = a.status === null ? "Netzfehler" : `HTTP ${a.status}`;
      return null;
    }
    netzfehlerFolge = 0;
    const lesung = kerzenLesen(a.daten);
    kerzenUnbrauchbar += lesung.unbrauchbar;
    return lesung.kerzen;
  };

  for (const k of kandidaten) {
    if (abbruch !== null) break;
    const endeMs = Math.min(k.eroeffnetMs + k.horizontStunden * 3_600_000, abh.jetzt());
    const grund: { wert: string | null } = { wert: null };
    const kerzen = new Map<number, Kerze>();
    let vonMs = k.eroeffnetMs;
    const bisGesamt = endeMs + minMs;
    let ok = true;
    while (vonMs < bisGesamt) {
      const bisMs = Math.min(vonMs + fenster, bisGesamt);
      const seite = await holen(k.epic, SIM_AUFLOESUNG.name, vonMs, bisMs, k.symbol, grund);
      if (seite === null) { ok = false; break; }
      for (const x of seite) kerzen.set(x.t, x);   // doppelte Kerze an der Seitengrenze nur einmal
      vonMs = bisMs;
    }
    let stunden: Kerze[] = [];
    if (ok && abbruch === null) {
      const s = await holen(k.epic, "HOUR", k.eroeffnetMs - ATR_VORLAUF_STUNDEN * 3_600_000,
        endeMs + 3_600_000, k.symbol, grund);
      if (s === null) ok = false; else stunden = s;
    }
    const liste = [...kerzen.values()].sort((a, b) => a.t - b.t);
    daten.push({
      kandidat: k, kerzen: ok ? liste : [], stunden, minuten: SIM_AUFLOESUNG.minuten, endeMs,
      datenGrund: ok ? (liste.length === 0 ? "leere Antwort" : null) : grund.wert,
    });
    if (abbruch !== null) break;
  }
  return { daten, abbruch, abrufe, kerzenUnbrauchbar };
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
