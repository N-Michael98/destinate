// ── /exits — WIE WEIT LIEFEN DIE TRADES WIRKLICH? (16.11.) ──────────────────
//
// Gemessen am 26./27.10.: kein einziger Trade erreicht sein Ziel (`WIN/ZIEL`
// 0 von 124), ein Gewinner bringt 0.37 R. Offen blieb die Frage DAVOR: kam der
// KURS nie dorthin, oder ist UNSERE Ausstiegslogik vorher ausgestiegen? Nur die
// Antwort darauf sagt, ob `exitThresholdsRelativeToStop` etwas aendern wuerde.
//
// DIESES MODUL IST REIN: keine Importe ausser zwei reinen Lesarten, keine
// Datenbank, kein Broker, keine Uhr. Haltedauern, die Etiketten ohne Ergebnis
// und die Epic-Tabelle kommen als PARAMETER vom Aufrufer, der sie aus den
// echten Quellen holt (`STYLE_MAX_HOURS`, `ETIKETTEN_OHNE_ERGEBNIS`,
// `EPIC_MAP`). Eine zweite Fassung davon waere eine zweite Wahrheit — der
// Pruefer bindet den Aufrufer an die Quellen.
//
// WAS ES MISST — und was NICHT: es laeuft die Kerzen ab dem Einstieg ab, mit
// dem URSPRUENGLICHEN Stop und Ziel, bis zum ersten Treffer oder bis zum
// Zeit-Exit des Stils. Es simuliert NICHT unsere Ausstiegslogik (Breakeven,
// Teilgewinn, ATR-Trailing) — dafuer braeuchte es den ATR zum damaligen
// Zeitpunkt. Es misst, was der KURS tat.

import { lesbareRichtung, type Richtung } from "../richtung/richtung";
import { htmlSicher } from "../html-sicher/html-sicher";

/** Unter dieser Zahl ist ein Anteil Rauschen — dieselbe Grenze wie /edge. */
export const MIN_BEWERTET = 30;
/** Hoechstens so viele Trades je Lauf; der Rest wird GEZAEHLT, nicht verschwiegen. */
export const MAX_KANDIDATEN = 400;
/** Capital.com: `max` hoechstens 1000 Kerzen je Abruf (offizielle API-Doku). */
export const MAX_KERZEN = 1000;

/** Eine Zeile, wie der Webhook sie aus der Trade-Tabelle liest. */
export interface ExitZeile {
  id: number;
  market: string | null;
  direction: string | null;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  notes: string | null;
  createdAt: Date | string | null;
}

export type Ausschluss =
  | "notizenUnlesbar"
  | "nichtCapital"
  | "mitIcPosition"
  | "nichtAutoScan"
  | "ohneErgebnis"
  | "richtungUnlesbar"
  | "preiseUnbrauchbar"
  | "falscheSeite"
  | "stilUnbekannt"
  | "ohneEpic"
  | "ohneDatum"
  | "ausserhalbFenster"
  | "ueberObergrenze";

/** Alle Ausschluesse NAMENTLICH — eine fehlende Zeile im Bericht faellt so auf. */
export const AUSSCHLUESSE: readonly Ausschluss[] = [
  "notizenUnlesbar", "nichtCapital", "mitIcPosition", "nichtAutoScan", "ohneErgebnis",
  "richtungUnlesbar", "preiseUnbrauchbar", "falscheSeite", "stilUnbekannt",
  "ohneEpic", "ohneDatum", "ausserhalbFenster", "ueberObergrenze",
];

const AUSSCHLUSS_TEXT: Record<Ausschluss, string> = {
  notizenUnlesbar: "Notizen unlesbar",
  nichtCapital: "nicht Capital.com",
  mitIcPosition: "auch bei IC ausgefuehrt (IC ueberschreibt den Stop dieser Zeile)",
  nichtAutoScan: "nicht auto-scan (rekonstruiert / tx-sync)",
  ohneErgebnis: "ohne Ergebnis (NIE_BESTAETIGT / KEIN_PNL)",
  richtungUnlesbar: "Richtung unlesbar",
  preiseUnbrauchbar: "Einstieg/Stop/Ziel unbrauchbar",
  falscheSeite: "Stop oder Ziel auf der falschen Seite",
  stilUnbekannt: "Stil unbekannt (kein Zeit-Horizont)",
  ohneEpic: "Markt ohne Epic",
  ohneDatum: "Eroeffnung ohne lesbares Datum",
  ausserhalbFenster: "ausserhalb des Fensters",
  ueberObergrenze: `ueber der Obergrenze von ${MAX_KANDIDATEN}`,
};

export interface Kandidat {
  id: number;
  symbol: string;
  epic: string;
  richtung: Richtung;
  entry: number;
  stop: number;
  ziel: number;
  /** |Einstieg − Stop|, also 1 R in Preis-Einheiten. */
  risiko: number;
  /** |Ziel − Einstieg| / Risiko. */
  rrGeplant: number;
  stil: string;
  horizontStunden: number;
  eroeffnetMs: number;
  /** Das tatsaechliche Etikett (`exitReason`), z. B. STOP / ZIEL / DAZWISCHEN. */
  istEtikett: string | null;
  /** Der tatsaechliche Schlusskurs aus den Notizen, sonst null. */
  istSchluss: number | null;
}

export interface Auswahl {
  gesamt: number;
  kandidaten: Kandidat[];
  ausgeschlossen: Record<Ausschluss, number>;
}

export interface AuswahlOptionen {
  /** `STYLE_MAX_HOURS` aus dem RiskAgent — die Zeit-Exits je Stil. */
  haltedauer: Readonly<Record<string, number>>;
  /** `ETIKETTEN_OHNE_ERGEBNIS` aus dem Tracker. */
  ohneErgebnis: readonly string[];
  /** `EPIC_MAP` aus dem Broker-Client. */
  epicMap: Readonly<Record<string, string>>;
  jetztMs: number;
  /** null = alles; sonst nur Trades, die in den letzten N Tagen ERÖFFNET wurden. */
  tage: number | null;
}

function zahlUeberNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function zeitMs(v: unknown): number | null {
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function leeresZaehlwerk(): Record<Ausschluss, number> {
  const z = {} as Record<Ausschluss, number>;
  for (const a of AUSSCHLUESSE) z[a] = 0;
  return z;
}

/**
 * Welche Zeilen taugen fuer die Nachrechnung? JEDER Ausschluss wird gezaehlt.
 *
 * Nur `auto-scan`-Zeilen von Capital.com OHNE `icPositionId`: traegt die
 * Zeile eine IC-Position, ueberschreibt der IC-Trade-Manager ihren
 * `stopLoss` (`icmarkets-trade-manager.ts`), bei rekonstruierten
 * Zeilen ist `createdAt` die SCHREIBzeit und der Stop schon nachgezogen, und
 * `tx-sync`-Zeilen tragen Einstieg/Stop/Ziel 0. Fuer alle drei waere 1 R falsch.
 */
export function auswahl(zeilen: readonly ExitZeile[], opt: AuswahlOptionen): Auswahl {
  const ausgeschlossen = leeresZaehlwerk();
  const alle: Kandidat[] = [];
  const grenzeMs = opt.tage === null ? null : opt.jetztMs - opt.tage * 86_400_000;

  for (const z of zeilen ?? []) {
    let m: Record<string, unknown>;
    try {
      const roh = JSON.parse(z.notes ?? "") as unknown;
      if (!roh || typeof roh !== "object" || Array.isArray(roh)) { ausgeschlossen.notizenUnlesbar++; continue; }
      m = roh as Record<string, unknown>;
    } catch {
      ausgeschlossen.notizenUnlesbar++;
      continue;
    }
    if (typeof m.broker !== "string" || !m.broker.startsWith("Capital.com")) { ausgeschlossen.nichtCapital++; continue; }
    // Wurde der Trade AUCH bei IC ausgefuehrt, steht `icPositionId` in
    // DIESER Zeile (capital-trade-tracker.ts) — und der IC-Manager
    // ueberschreibt dann ihren `stopLoss` mit dem IC-Trailing
    // (icmarkets-trade-manager.ts, `notes LIKE '%icPositionId%'`).
    // `broker` und `source` sehen dabei ganz normal aus.
    if (m.icPositionId !== undefined && m.icPositionId !== null && m.icPositionId !== "") {
      ausgeschlossen.mitIcPosition++;
      continue;
    }
    if (m.source !== "auto-scan") { ausgeschlossen.nichtAutoScan++; continue; }
    if (typeof m.exitReason === "string" && opt.ohneErgebnis.includes(m.exitReason)) {
      ausgeschlossen.ohneErgebnis++;
      continue;
    }
    const richtung = lesbareRichtung(z.direction);
    if (richtung === null) { ausgeschlossen.richtungUnlesbar++; continue; }
    const entry = zahlUeberNull(z.entry);
    const stop = zahlUeberNull(z.stopLoss);
    const ziel = zahlUeberNull(z.takeProfit);
    if (entry === null || stop === null || ziel === null) { ausgeschlossen.preiseUnbrauchbar++; continue; }
    const richtigeSeite = richtung === "BUY" ? stop < entry && entry < ziel : ziel < entry && entry < stop;
    if (!richtigeSeite) { ausgeschlossen.falscheSeite++; continue; }
    const stil = typeof m.tradingStyle === "string" ? m.tradingStyle.trim().toUpperCase() : "";
    const horizont = Object.prototype.hasOwnProperty.call(opt.haltedauer, stil) ? opt.haltedauer[stil] : undefined;
    if (typeof horizont !== "number" || !Number.isFinite(horizont) || horizont <= 0) { ausgeschlossen.stilUnbekannt++; continue; }
    const symbol = typeof z.market === "string" ? z.market.trim() : "";
    const epic = symbol && Object.prototype.hasOwnProperty.call(opt.epicMap, symbol) ? opt.epicMap[symbol] : undefined;
    if (typeof epic !== "string" || epic === "") { ausgeschlossen.ohneEpic++; continue; }
    const eroeffnetMs = zeitMs(z.createdAt);
    if (eroeffnetMs === null) { ausgeschlossen.ohneDatum++; continue; }
    if (grenzeMs !== null && eroeffnetMs < grenzeMs) { ausgeschlossen.ausserhalbFenster++; continue; }

    const risiko = Math.abs(entry - stop);
    const istSchluss = zahlUeberNull(m.closeLevel);
    alle.push({
      id: z.id, symbol, epic, richtung, entry, stop, ziel, risiko,
      rrGeplant: Math.abs(ziel - entry) / risiko,
      stil, horizontStunden: horizont, eroeffnetMs,
      istEtikett: typeof m.exitReason === "string" ? m.exitReason : null,
      istSchluss,
    });
  }

  // Die NEUESTEN zuerst — bei mehr als MAX_KANDIDATEN fallen die aeltesten
  // weg, und das wird gezaehlt.
  alle.sort((a, b) => b.eroeffnetMs - a.eroeffnetMs);
  const kandidaten = alle.slice(0, MAX_KANDIDATEN);
  ausgeschlossen.ueberObergrenze = alle.length - kandidaten.length;
  return { gesamt: (zeilen ?? []).length, kandidaten, ausgeschlossen };
}

export type Aufloesung = "MINUTE" | "MINUTE_5" | "MINUTE_15" | "MINUTE_30" | "HOUR" | "HOUR_4";

const AUFLOESUNGEN: ReadonlyArray<{ name: Aufloesung; minuten: number }> = [
  { name: "MINUTE", minuten: 1 },
  { name: "MINUTE_5", minuten: 5 },
  { name: "MINUTE_15", minuten: 15 },
  { name: "MINUTE_30", minuten: 30 },
  { name: "HOUR", minuten: 60 },
  { name: "HOUR_4", minuten: 240 },
];

/**
 * Die FEINSTE Aufloesung, bei der der ganze Horizont in EINEN Abruf passt
 * (plus eine Kerze Reserve, siehe `nachrechnen`). Eine Regel, keine Tabelle:
 * aendert sich eine Haltedauer, zieht die Aufloesung von selbst mit.
 */
export function aufloesungFuer(horizontStunden: number): { name: Aufloesung; minuten: number } {
  for (const a of AUFLOESUNGEN) {
    if ((horizontStunden * 60) / a.minuten + 2 <= MAX_KERZEN) return a;
  }
  return AUFLOESUNGEN[AUFLOESUNGEN.length - 1];
}

/**
 * Capital.com schreibt `snapshotTimeUTC` OHNE Zonen-Angabe
 * (Doku-Beispiel: "2022-04-06T13:18:00"). Der Name sagt UTC — also wird es
 * als UTC gelesen. `brokerZeitNachUtc()` ist hier FALSCH: sie liest eine
 * zonenlose Zeit als Zuercher Ortszeit (22.09.) und verschoebe jede Kerze um
 * 1–2 Stunden. Traegt der Wert eine Zone, gilt diese.
 */
export function utcOhneZone(roh: unknown): number | null {
  if (typeof roh !== "string") return null;
  const s = roh.trim().replace(" ", "T");
  if (s === "") return null;
  const t = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/i.test(s) ? s : `${s}Z`);
  return Number.isFinite(t) ? t : null;
}

/** Fuer den `from`/`to`-Parameter: UTC im Format YYYY-MM-DDTHH:MM:SS. */
export function utcParameter(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

export interface Kerze {
  /** Beginn der Kerze laut `snapshotTimeUTC`, in ms. */
  t: number;
  bidHoch: number; bidTief: number; bidSchluss: number;
  askHoch: number; askTief: number; askSchluss: number;
}

export interface KerzenLesung {
  kerzen: Kerze[];
  unbrauchbar: number;
  /** snapshotTime (Ortszeit) − snapshotTimeUTC in Minuten — der BELEG, dass das UTC-Feld stimmt. */
  versatzMin: number | null;
  versatzMax: number | null;
}

function seite(p: unknown): { bid: number; ask: number } | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const bid = zahlUeberNull(o.bid);
  const ask = zahlUeberNull(o.ask);
  return bid !== null && ask !== null ? { bid, ask } : null;
}

/** Liest die Antwort von `GET /prices/{epic}`. Unbrauchbare Kerzen werden GEZAEHLT. */
export function kerzenLesen(antwort: unknown): KerzenLesung {
  const preise = antwort && typeof antwort === "object"
    ? (antwort as Record<string, unknown>).prices
    : undefined;
  const kerzen: Kerze[] = [];
  let unbrauchbar = 0;
  let versatzMin: number | null = null;
  let versatzMax: number | null = null;
  if (!Array.isArray(preise)) return { kerzen, unbrauchbar, versatzMin, versatzMax };
  for (const p of preise) {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const t = utcOhneZone(o.snapshotTimeUTC);
    const hoch = seite(o.highPrice);
    const tief = seite(o.lowPrice);
    const schluss = seite(o.closePrice);
    if (t === null || !hoch || !tief || !schluss) { unbrauchbar++; continue; }
    kerzen.push({
      t,
      bidHoch: hoch.bid, bidTief: tief.bid, bidSchluss: schluss.bid,
      askHoch: hoch.ask, askTief: tief.ask, askSchluss: schluss.ask,
    });
    const ort = utcOhneZone(o.snapshotTime);
    if (ort !== null) {
      const v = Math.round((ort - t) / 60_000);
      versatzMin = versatzMin === null ? v : Math.min(versatzMin, v);
      versatzMax = versatzMax === null ? v : Math.max(versatzMax, v);
    }
  }
  kerzen.sort((a, b) => a.t - b.t);
  return { kerzen, unbrauchbar, versatzMin, versatzMax };
}

export type Treffer = "ZIEL" | "STOP" | "BEIDE" | "OFFEN" | "KEINE_DATEN";

export interface Nachrechnung {
  treffer: Treffer;
  /** Groesster Lauf zugunsten, in R, BEVOR der Stop fiel. null ohne Kerzen. */
  maxR: number | null;
  /** R bei „bis Stop / Ziel / Zeit-Exit halten". BEIDE zaehlt als Stop (vorsichtig). */
  haltenR: number | null;
  kerzenGenutzt: number;
}

/**
 * Laeuft die Kerzen ab dem Einstieg ab, mit dem URSPRUENGLICHEN Stop und Ziel.
 *
 * Geprueft wird gegen die SCHLIESS-Seite: BUY schliesst zum Geldkurs (bid),
 * SELL zum Briefkurs (ask). Dass Capital.com Stops so ausloest, ist NICHT
 * belegt — deshalb rechnet der Bericht eine Kalibrierung mit: bei Trades mit
 * Etikett STOP muss die Nachrechnung einen Stop finden.
 *
 * Die ERSTE Kerze, die zaehlt, beginnt mindestens eine Kerzenlaenge NACH der
 * Eroeffnung. Ob `snapshotTimeUTC` Beginn oder Ende der Kerze ist, sagt die
 * Doku nicht ausdruecklich; mit dieser Regel liegt in BEIDEN Lesarten kein
 * Kurs von VOR dem Einstieg in der Rechnung. Preis: bis zu zwei Kerzen nach
 * dem Einstieg fehlen — die Kalibrierung macht sichtbar, wenn das zaehlt.
 *
 * Beruehrt eine Kerze Stop UND Ziel, ist die Reihenfolge unbekannt: BEIDE,
 * eigene Zahl, und im R als Stop gewertet. Der Lauf dieser Kerze geht NICHT
 * in maxR ein — ob er vor oder nach dem Stop lag, ist ebenso unbekannt.
 */
export function nachrechnen(k: Kandidat, kerzen: readonly Kerze[], kerzenMinuten: number, endeMs: number): Nachrechnung {
  const abMs = k.eroeffnetMs + kerzenMinuten * 60_000;
  const genutzt = kerzen.filter((x) => x.t >= abMs && x.t < endeMs);
  if (genutzt.length === 0) return { treffer: "KEINE_DATEN", maxR: null, haltenR: null, kerzenGenutzt: 0 };
  let maxR = 0;
  for (const x of genutzt) {
    const hoch = k.richtung === "BUY" ? x.bidHoch : x.askHoch;
    const tief = k.richtung === "BUY" ? x.bidTief : x.askTief;
    const stopBeruehrt = k.richtung === "BUY" ? tief <= k.stop : hoch >= k.stop;
    const zielBeruehrt = k.richtung === "BUY" ? hoch >= k.ziel : tief <= k.ziel;
    if (stopBeruehrt && zielBeruehrt) return { treffer: "BEIDE", maxR, haltenR: -1, kerzenGenutzt: genutzt.length };
    if (stopBeruehrt) return { treffer: "STOP", maxR, haltenR: -1, kerzenGenutzt: genutzt.length };
    if (zielBeruehrt) return { treffer: "ZIEL", maxR: Math.max(maxR, k.rrGeplant), haltenR: k.rrGeplant, kerzenGenutzt: genutzt.length };
    const lauf = k.richtung === "BUY" ? (hoch - k.entry) / k.risiko : (k.entry - tief) / k.risiko;
    if (lauf > maxR) maxR = lauf;
  }
  const letzte = genutzt[genutzt.length - 1];
  const schluss = k.richtung === "BUY" ? letzte.bidSchluss : letzte.askSchluss;
  const haltenR = k.richtung === "BUY" ? (schluss - k.entry) / k.risiko : (k.entry - schluss) / k.risiko;
  return { treffer: "OFFEN", maxR, haltenR, kerzenGenutzt: genutzt.length };
}

/** Das tatsaechlich realisierte R aus dem Schlusskurs der Notizen, sonst null. */
export function istR(k: Kandidat): number | null {
  if (k.istSchluss === null) return null;
  return k.richtung === "BUY" ? (k.istSchluss - k.entry) / k.risiko : (k.entry - k.istSchluss) / k.risiko;
}

export interface EinzelErgebnis {
  kandidat: Kandidat;
  nachrechnung: Nachrechnung;
  /** Gesetzt, wenn keine Kerzen kamen — mit Grund (HTTP-Status, Netz, leer). */
  datenGrund: string | null;
  gekappt: boolean;
}

export interface ExitBericht {
  fensterTage: number | null;
  auswahl: { gesamt: number; ausgeschlossen: Record<Ausschluss, number>; kandidaten: number };
  geprueft: number;
  treffer: Record<Treffer, number>;
  /** Gruende fuer KEINE_DATEN, nach Haeufigkeit. */
  ohneDatenGruende: Array<[string, number]>;
  bewertet: number;
  lauf: { ab05: number; ab10: number; ab15: number; zielErreicht: number; mitWert: number };
  haltenRSchnitt: number | null;
  /** Gepaart: nur Trades, fuer die BEIDE Werte da sind — sonst vergliche man zwei Mengen. */
  paar: { n: number; haltenR: number | null; istR: number | null };
  zielAberVorherRaus: { n: number; istRSchnitt: number | null };
  kalibrierung: { stopEtikett: number; davonStopGefunden: number };
  versatz: { min: number | null; max: number | null };
  kerzenUnbrauchbar: number;
  gekappt: number;
  abbruch: string | null;
}

function schnitt(werte: number[]): number | null {
  const ok = werte.filter((w) => Number.isFinite(w));
  return ok.length === 0 ? null : ok.reduce((s, w) => s + w, 0) / ok.length;
}

export function exitBericht(
  aus: Auswahl,
  ergebnisse: readonly EinzelErgebnis[],
  zusatz: { fensterTage: number | null; abbruch: string | null; kerzenUnbrauchbar: number;
            versatzMin: number | null; versatzMax: number | null },
): ExitBericht {
  const treffer: Record<Treffer, number> = { ZIEL: 0, STOP: 0, BEIDE: 0, OFFEN: 0, KEINE_DATEN: 0 };
  const gruende = new Map<string, number>();
  const bewertete: EinzelErgebnis[] = [];
  let gekappt = 0;
  for (const e of ergebnisse) {
    treffer[e.nachrechnung.treffer]++;
    if (e.gekappt) gekappt++;
    if (e.nachrechnung.treffer === "KEINE_DATEN") {
      const g = e.datenGrund ?? "keine Kerzen nach dem Einstieg";
      gruende.set(g, (gruende.get(g) ?? 0) + 1);
    } else {
      bewertete.push(e);
    }
  }
  const mitWert = bewertete.filter((e) => e.nachrechnung.maxR !== null);
  const r = (e: EinzelErgebnis) => e.nachrechnung.maxR as number;
  const paare = bewertete
    .map((e) => ({ h: e.nachrechnung.haltenR, i: istR(e.kandidat) }))
    .filter((p): p is { h: number; i: number } => p.h !== null && p.i !== null && Number.isFinite(p.h) && Number.isFinite(p.i));
  const vorherRaus = bewertete.filter((e) => e.nachrechnung.treffer === "ZIEL" && e.kandidat.istEtikett !== "ZIEL");
  const stopEtikett = bewertete.filter((e) => e.kandidat.istEtikett === "STOP");

  return {
    fensterTage: zusatz.fensterTage,
    auswahl: { gesamt: aus.gesamt, ausgeschlossen: aus.ausgeschlossen, kandidaten: aus.kandidaten.length },
    geprueft: ergebnisse.length,
    treffer,
    ohneDatenGruende: [...gruende.entries()].sort((a, b) => b[1] - a[1]),
    bewertet: bewertete.length,
    lauf: {
      ab05: mitWert.filter((e) => r(e) >= 0.5).length,
      ab10: mitWert.filter((e) => r(e) >= 1.0).length,
      ab15: mitWert.filter((e) => r(e) >= 1.5).length,
      zielErreicht: bewertete.filter((e) => e.nachrechnung.treffer === "ZIEL").length,
      mitWert: mitWert.length,
    },
    haltenRSchnitt: schnitt(bewertete.map((e) => e.nachrechnung.haltenR as number)),
    paar: {
      n: paare.length,
      haltenR: schnitt(paare.map((p) => p.h)),
      istR: schnitt(paare.map((p) => p.i)),
    },
    zielAberVorherRaus: {
      n: vorherRaus.length,
      istRSchnitt: schnitt(vorherRaus.map((e) => istR(e.kandidat)).filter((x): x is number => x !== null)),
    },
    kalibrierung: {
      stopEtikett: stopEtikett.length,
      davonStopGefunden: stopEtikett.filter((e) => e.nachrechnung.treffer === "STOP" || e.nachrechnung.treffer === "BEIDE").length,
    },
    versatz: { min: zusatz.versatzMin, max: zusatz.versatzMax },
    kerzenUnbrauchbar: zusatz.kerzenUnbrauchbar,
    gekappt,
    abbruch: zusatz.abbruch,
  };
}

function anteil(n: number, von: number): string {
  return von > 0 ? `${n}/${von} (${((n / von) * 100).toFixed(0)} %)` : `${n}/0`;
}

function rText(v: number | null): string {
  return v === null ? "unbekannt" : `${v >= 0 ? "+" : ""}${v.toFixed(2)} R`;
}

/** Telegram-Text. Feste Zeilenzahl, also begrenzte Laenge; fremde Texte entschaerft. */
export function exitsText(b: ExitBericht): string {
  const z: string[] = [];
  z.push(`📐 <b>/exits${b.fensterTage === null ? "" : ` ${b.fensterTage}`}</b> — wie weit lief der Kurs?`);
  z.push(`<i>Nachgerechnet mit dem URSPRÜNGLICHEN Stop und Ziel, bis zum Zeit-Exit des Stils. Unsere Ausstiegslogik (BE/Teilgewinn/Trailing) ist NICHT simuliert.</i>`);
  if (b.abbruch !== null) {
    z.push("", `⚠️ <b>Abgebrochen:</b> ${htmlSicher(b.abbruch)} — Teilergebnis über ${b.geprueft} von ${b.auswahl.kandidaten} Trades.`);
  }
  z.push("", `<b>Auswahl:</b> ${b.auswahl.kandidaten} von ${b.auswahl.gesamt} geschlossenen Trades`);
  for (const a of AUSSCHLUESSE) {
    const n = b.auswahl.ausgeschlossen[a];
    if (n > 0) z.push(`  • ${AUSSCHLUSS_TEXT[a]}: ${n}`);
  }
  z.push("", `<b>Was zuerst berührt wurde</b> (${b.geprueft} geprüft):`);
  z.push(`  🎯 Ziel: ${b.treffer.ZIEL}`);
  z.push(`  🛑 Stop: ${b.treffer.STOP}`);
  z.push(`  ❓ beide in derselben Kerze: ${b.treffer.BEIDE} (als Stop gewertet)`);
  z.push(`  ⏱ keins bis zum Zeit-Exit: ${b.treffer.OFFEN}`);
  z.push(`  ∅ keine Kursdaten: ${b.treffer.KEINE_DATEN}`);
  for (const [g, n] of b.ohneDatenGruende.slice(0, 4)) z.push(`     – ${htmlSicher(g)}: ${n}`);
  if (b.ohneDatenGruende.length > 4) z.push(`     – (${b.ohneDatenGruende.length - 4} weitere Gründe)`);

  z.push("", `<b>Grösster Lauf vor dem Stop</b> (${b.lauf.mitWert} mit Kursdaten):`);
  z.push(`  ≥ 0.5 R: ${anteil(b.lauf.ab05, b.lauf.mitWert)}`);
  z.push(`  ≥ 1.0 R: ${anteil(b.lauf.ab10, b.lauf.mitWert)}`);
  z.push(`  ≥ 1.5 R: ${anteil(b.lauf.ab15, b.lauf.mitWert)}`);
  z.push(`  eigenes Ziel: ${anteil(b.lauf.zielErreicht, b.lauf.mitWert)}`);

  z.push("", `<b>Halten gegen tatsächlich</b> (gepaart, ${b.paar.n} Trades mit beiden Werten):`);
  z.push(`  bis Stop/Ziel/Zeit-Exit gehalten: Ø ${rText(b.paar.haltenR)}`);
  z.push(`  tatsächlich realisiert: Ø ${rText(b.paar.istR)}`);
  z.push(`  Ziel wäre zuerst gekommen, aber anders ausgestiegen: ${b.zielAberVorherRaus.n} (dort realisiert Ø ${rText(b.zielAberVorherRaus.istRSchnitt)})`);

  z.push("", "<b>Selbstprüfung</b>");
  z.push(`  Etikett STOP → Stop auch nachgerechnet: ${anteil(b.kalibrierung.davonStopGefunden, b.kalibrierung.stopEtikett)}`);
  z.push(`  Ortszeit − UTC der Kerzen: ${b.versatz.min === null ? "nicht messbar" : (b.versatz.min === b.versatz.max ? `${b.versatz.min} min` : `${b.versatz.min}…${b.versatz.max} min`)}`);
  if (b.kerzenUnbrauchbar > 0) z.push(`  unbrauchbare Kerzen verworfen: ${b.kerzenUnbrauchbar}`);
  if (b.gekappt > 0) z.push(`  ⚠️ Abrufe am Kerzen-Höchstwert (evtl. gekappt): ${b.gekappt}`);
  if (b.bewertet < MIN_BEWERTET) {
    z.push("", `⚠️ Nur ${b.bewertet} bewertete Trades — unter ${MIN_BEWERTET} sind die Anteile Rauschen, kein Befund.`);
  }
  // Eine Zeile, die von Hand im Journal geaendert wurde (PATCH
  // /api/trades/[id]), traegt KEINE Markierung — sie ist nicht erkennbar und
  // wird deshalb hier benannt statt verschwiegen.
  z.push("", "<i>Kein Schlupf eingerechnet. Von Hand im Journal geänderte Einstiegs-, Stop- oder Zielwerte sind nicht erkennbar. Ein Unterschied ist keine Zusage: andere Schwellen ändern auch, welche Trades es gibt.</i>");
  return z.join("\n");
}
