// ── DAS SCHATTENBUCH (25.11.) ───────────────────────────────────────────────
//
// WAS HAETTEN DIE SIGNALE GEBRACHT, DIE NICHT GEHANDELT WURDEN?
//
// Jedes Richtungssignal (BUY/SELL) eines Handelszyklus wird mit seinem
// SCHICKSAL festgehalten — an welcher Stufe oder welchem Tor es starb, oder
// dass es gehandelt wurde. Spaeter rechnet `/schatten` mit DERSELBEN
// Kerzen-Nachrechnung wie `/exits` nach, was es bis Stop, Ziel oder Zeit-Exit
// gebracht haette. Damit ist messbar, ob ein Tor Geld rettet oder kostet —
// statt es zu raten (Schwelle 76 gegen 73, Claude-Veto, Walk-Forward, SWING).
//
// DIESES MODUL IST REIN: keine Datenbank, kein Redis, kein Broker, keine Uhr.
// Haltedauern und die Zeit kommen als PARAMETER (`STYLE_MAX_HOURS` aus dem
// RiskAgent — eine Kopie waere eine zweite Wahrheit). Das Schreiben in Redis
// steht in `schattenbuch-speicher.ts`.
//
// WAS ES NICHT IST: eine Simulation UNSERER Ausstiegslogik. Gemessen wird
// „gehalten bis Stop/Ziel/Zeit-Exit", wie in `/exits`. Und die gehandelten
// Signale stehen DANEBEN, auf dieselbe Weise nachgerechnet — sonst waere der
// Vergleich unfair.

import { htmlSicher } from "../html-sicher/html-sicher";
import {
  MIN_BEWERTET, standardfehler,
  type Kandidat, type EinzelErgebnis,
} from "../exit-messung/exit-messung";

/** Ein Tag je Schluessel, UTC-Datum wie die Tagessumme. */
export const SCHATTEN_SCHLUESSEL = (datum: string) => `schatten:tag:${datum}`;
/** 45 Tage aufbewahrt (entschieden 25.11.). */
export const SCHATTEN_TAGE_MAX = 45;
export const SCHATTEN_TTL_SEKUNDEN = SCHATTEN_TAGE_MAX * 24 * 60 * 60;
/** Hoechstens so viele Eintraege je Tag; der Rest wird GEZAEHLT, nicht verschwiegen. */
export const SCHATTEN_MAX_JE_TAG = 600;
/** Dasselbe Symbol + Richtung + Schicksal hoechstens einmal je 60 Minuten. */
export const SCHATTEN_DEDUP_MS = 60 * 60_000;
/** Nachgerechnet werden je Schicksal hoechstens so viele (die neuesten). */
export const SCHATTEN_JE_GRUPPE = 40;
/** Der Grund eines Schicksals, hoechstens so lang (25.11.). Bei der Meta-KI ist
 *  er ein von Claude geschriebener Satz — unbegrenzt liesse er Redis bei 600
 *  Eintraegen je Tag und 45 Tagen Aufbewahrung beliebig wachsen. */
export const SCHATTEN_GRUND_MAX = 120;

/** Die Stufen der Engine — EINE Liste, die Engine benutzt genau diese Namen. */
export const SCHATTEN_STUFE = {
  stil: "Stil unbekannt",
  veto: "Veto",
  unterGrenze: "unter Grenze",
  ohneDaten: "ohne Daten",
  freigabeNein: "Freigabe-Nein",
  ohneStopZiel: "ohne Stop/Ziel",
  ohneStufe: "ohne Stufe",
  go: "GO",
} as const;

/** Die Schicksale NACH dem GO, die kein Tor-Name sind. */
export const SCHICKSAL = {
  gehandelt: "gehandelt",
  broker: "Broker",
  orchestratorKi: "Orchestrator-KI",
  zyklusLimit: "nicht geprueft (Zyklus-Limit)",
  zyklusEnde: "Zyklus endete vorher",
} as const;

/** Was die Engine je Markt mitgibt — die URSPRUENGLICHE Richtung, vor Veto/Stil. */
export interface SchattenRoh {
  symbol: string;
  epic: string;
  richtung: "BUY" | "SELL";
  /** Broker-Kurs zum Zyklusbeginn: BUY zum Brief-, SELL zum Geldkurs. null = unbrauchbar. */
  kurs: number | null;
  stop: number | null;
  ziel: number | null;
  /** null = Stil unbekannt (dann gibt es keinen Zeit-Horizont). */
  stil: string | null;
  confidence: number | null;
  quelle: string;
  stufe: string;
}

export interface SchattenEintrag extends SchattenRoh {
  /** Zyklusbeginn in ms — der Moment des Kurses. */
  ts: number;
  schicksal: string;
  grund: string;
}

export interface SchattenTag {
  datum: string;
  eintraege: SchattenEintrag[];
  /** Wegen der 60-Minuten-Regel nicht aufgenommen. */
  dedupliziert: number;
  /** Ueber der Tagesgrenze — gezaehlt, nicht gespeichert. */
  verworfen: number;
}

const pos = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
const text = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Ein Signal festhalten, so wie es AUS GPT kam — mit der Richtung VOR einem
 * Veto oder einer Stil-Pruefung (beide setzen sie auf WAIT). Nur BUY/SELL;
 * alles andere ist kein Richtungssignal und gibt `null`.
 */
export function schattenRoh(
  m: { symbol?: unknown; epic?: unknown; bid?: unknown; ask?: unknown },
  g: { direction?: unknown; stopLoss?: unknown; takeProfit?: unknown;
    tradingStyle?: unknown; confidence?: unknown; source?: unknown },
  stufe: string,
  stilBekannt = true,
): SchattenRoh | null {
  const richtung = g.direction === "BUY" || g.direction === "SELL" ? g.direction : null;
  const symbol = text(m.symbol);
  if (richtung === null || symbol === "") return null;
  const conf = typeof g.confidence === "number" && Number.isFinite(g.confidence) ? g.confidence : null;
  const stil = stilBekannt && typeof g.tradingStyle === "string" && g.tradingStyle !== "" ? g.tradingStyle : null;
  return {
    symbol,
    epic: text(m.epic),
    richtung,
    kurs: richtung === "BUY" ? pos(m.ask) : pos(m.bid),
    stop: pos(g.stopLoss),
    ziel: pos(g.takeProfit),
    stil,
    confidence: conf,
    quelle: text(g.source) || "unbekannt",
    stufe,
  };
}

/** Prueft, ob ein Wert aus `ScanDaten.schatten` wirklich ein SchattenRoh ist. */
export function istSchattenRoh(v: unknown): v is SchattenRoh {
  if (v === null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const zahlOderNull = (x: unknown) => x === null || (typeof x === "number" && Number.isFinite(x));
  return typeof o.symbol === "string" && o.symbol !== "" && typeof o.epic === "string"
    && (o.richtung === "BUY" || o.richtung === "SELL")
    && zahlOderNull(o.kurs) && zahlOderNull(o.stop) && zahlOderNull(o.ziel)
    && (o.stil === null || typeof o.stil === "string") && zahlOderNull(o.confidence)
    && typeof o.quelle === "string" && typeof o.stufe === "string" && o.stufe !== "";
}

/** Was die Zyklus-Bilanz am Zyklusende weiss — strukturell, ohne Import (kein Kreis). */
export interface ZyklusLage {
  tore: ReadonlyArray<{ gate: string; symbol?: string; approve: boolean; reason: string }>;
  trades: readonly string[];
  fehlgeschlagen: readonly string[];
  ausgang: string;
}

/**
 * Das Schicksal eines Signals. Vor dem GO ist es die Stufe der Engine. Nach
 * dem GO in dieser Reihenfolge:
 *   1. das ERSTE ablehnende Tor mit diesem Symbol
 *   2. gehandelt (ein eroeffneter Trade dieses Symbols)
 *   3. Broker (ein gescheiterter Auftrag dieses Symbols)
 *   4. Orchestrator-KI hat den ganzen Zyklus abgelehnt
 *   5. Zyklus-Limit: gar nicht mehr geprueft
 *   6. sonst: der Zyklus endete vorher — mit dem Ausgang als Grund
 */
export function schicksalBestimmen(roh: SchattenRoh, z: ZyklusLage): { schicksal: string; grund: string } {
  // Jeder Grund durch DIESELBE Begrenzung — eine Stelle, die sie vergisst,
  // waere die Stelle, an der Redis waechst.
  const kurz = (v: unknown) => text(v).slice(0, SCHATTEN_GRUND_MAX);
  if (roh.stufe !== SCHATTEN_STUFE.go) return { schicksal: roh.stufe, grund: "" };
  const nein = z.tore.find((t) => t.symbol === roh.symbol && t.approve === false);
  if (nein) return { schicksal: nein.gate, grund: kurz(nein.reason) };
  if (z.trades.some((t) => t === `${roh.symbol} ${roh.richtung}` || t.startsWith(`${roh.symbol} `))) {
    return { schicksal: SCHICKSAL.gehandelt, grund: "" };
  }
  const fehl = z.fehlgeschlagen.find((f) => f.startsWith(`${roh.symbol}:`));
  if (fehl !== undefined) return { schicksal: SCHICKSAL.broker, grund: kurz(fehl.slice(roh.symbol.length + 1).trim()) };
  const ki = z.tore.find((t) => t.gate === "Orchestrator-KI" && t.approve === false);
  if (ki) return { schicksal: SCHICKSAL.orchestratorKi, grund: kurz(ki.reason) };
  if (z.tore.some((t) => t.gate === "Zyklus-Limit" && t.approve === false)) {
    return { schicksal: SCHICKSAL.zyklusLimit, grund: "" };
  }
  return { schicksal: SCHICKSAL.zyklusEnde, grund: kurz(z.ausgang) };
}

/**
 * Die Eintraege EINES Zyklus aus seiner Bilanz. Ohne Scan, ohne Liste oder
 * mit unlesbaren Werten: keine Eintraege (ein Scan von vor dem Deploy kennt
 * das Feld nicht). Zeit ist der Zyklusbeginn — der Moment des Kurses.
 */
export function zyklusEintraege(b: {
  start: number; ausgang?: string; scan?: { schatten?: unknown };
  tore: ZyklusLage["tore"]; trades: readonly string[]; fehlgeschlagen: readonly string[];
}): SchattenEintrag[] {
  const liste = b.scan?.schatten;
  if (!Array.isArray(liste) || !Number.isFinite(b.start)) return [];
  const lage: ZyklusLage = { tore: b.tore, trades: b.trades, fehlgeschlagen: b.fehlgeschlagen,
    ausgang: text(b.ausgang) };
  return liste.filter(istSchattenRoh).map((roh) => ({ ...roh, ts: b.start, ...schicksalBestimmen(roh, lage) }));
}

/** Ein gespeicherter Tag ist nur dann einer, wenn Datum und Liste stimmen. */
function tagLesen(alt: unknown, datum: string): SchattenTag {
  if (alt !== null && typeof alt === "object") {
    const o = alt as Record<string, unknown>;
    if (o.datum === datum && Array.isArray(o.eintraege)) {
      const zahl = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
      return {
        datum,
        eintraege: (o.eintraege as unknown[]).filter((e): e is SchattenEintrag =>
          istSchattenRoh(e) && typeof (e as SchattenEintrag).ts === "number"
          && typeof (e as SchattenEintrag).schicksal === "string"),
        dedupliziert: zahl(o.dedupliziert),
        verworfen: zahl(o.verworfen),
      };
    }
  }
  return { datum, eintraege: [], dedupliziert: 0, verworfen: 0 };
}

/**
 * Neue Eintraege an einen Tag anhaengen. Gibt einen NEUEN Tag zurueck.
 * Ein Tag von einem anderen Datum oder ein unlesbarer Wert beginnt leer.
 * Dasselbe Symbol + Richtung + Schicksal innerhalb von 60 Minuten wird NICHT
 * aufgenommen (dasselbe Signal kommt alle 5 Minuten wieder — ohne die Regel
 * zaehlte ein Signal zwoelfmal je Stunde, und die Streuung waere erfunden
 * klein). Ueber der Tagesgrenze wird gezaehlt, nicht gespeichert.
 */
export function eintraegeAufnehmen(alt: unknown, datum: string, neue: readonly SchattenEintrag[]): SchattenTag {
  const t = tagLesen(alt, datum);
  const tag: SchattenTag = { ...t, eintraege: [...t.eintraege] };
  for (const e of neue) {
    if (!Number.isFinite(e.ts)) continue;
    const doppelt = tag.eintraege.some((x) =>
      x.symbol === e.symbol && x.richtung === e.richtung && x.schicksal === e.schicksal
      && e.ts >= x.ts && e.ts - x.ts < SCHATTEN_DEDUP_MS);
    if (doppelt) { tag.dedupliziert++; continue; }
    if (tag.eintraege.length >= SCHATTEN_MAX_JE_TAG) { tag.verworfen++; continue; }
    tag.eintraege.push(e);
  }
  return tag;
}

export type SchattenAusschluss =
  | "ohneKurs" | "ohneStopZiel" | "falscheSeite" | "stilUnbekannt"
  | "nochOffen" | "ohneEpic" | "ohneDatum" | "ausserhalbFenster" | "ueberObergrenze";

/** Alle Ausschluesse NAMENTLICH — eine fehlende Zeile im Bericht faellt so auf. */
export const SCHATTEN_AUSSCHLUESSE: readonly SchattenAusschluss[] = [
  "ohneKurs", "ohneStopZiel", "falscheSeite", "stilUnbekannt",
  "nochOffen", "ohneEpic", "ohneDatum", "ausserhalbFenster", "ueberObergrenze",
];

const AUSSCHLUSS_TEXT: Record<SchattenAusschluss, string> = {
  ohneKurs: "ohne Kurs",
  ohneStopZiel: "ohne Stop/Ziel",
  falscheSeite: "Stop/Ziel auf der falschen Seite",
  stilUnbekannt: "Stil unbekannt",
  nochOffen: "Haltedauer noch nicht abgelaufen",
  ohneEpic: "ohne Epic",
  ohneDatum: "ohne Zeit",
  ausserhalbFenster: "ausserhalb des Fensters",
  ueberObergrenze: "ueber der Obergrenze",
};

/**
 * Aus einem Eintrag einen `/exits`-Kandidaten — oder den Grund, warum nicht.
 * Der Einstieg ist der BROKER-Kurs, nicht GPTs Plan: eine Order haette dort
 * gefuellt. Liegt der Stop dann auf der falschen Seite, ist das kein Trade.
 */
export function schattenKandidat(
  e: SchattenEintrag,
  opt: { id: number; haltedauer: Readonly<Record<string, number>>; jetztMs: number },
): { kandidat: Kandidat } | { grund: SchattenAusschluss } {
  if (!Number.isFinite(e.ts)) return { grund: "ohneDatum" };
  if (e.epic === "") return { grund: "ohneEpic" };
  if (e.kurs === null) return { grund: "ohneKurs" };
  if (e.stop === null || e.ziel === null) return { grund: "ohneStopZiel" };
  const kaufen = e.richtung === "BUY";
  const richtigeSeite = kaufen ? e.stop < e.kurs && e.kurs < e.ziel : e.ziel < e.kurs && e.kurs < e.stop;
  if (!richtigeSeite) return { grund: "falscheSeite" };
  const h = e.stil === null ? undefined : opt.haltedauer[e.stil];
  if (typeof h !== "number" || !Number.isFinite(h) || h <= 0) return { grund: "stilUnbekannt" };
  // Erst nach Ablauf der Haltedauer: sonst waere ein halber Verlauf ein Ergebnis.
  if (e.ts + h * 3_600_000 > opt.jetztMs) return { grund: "nochOffen" };
  const risiko = Math.abs(e.kurs - e.stop);
  return {
    kandidat: {
      id: opt.id, symbol: e.symbol, epic: e.epic, richtung: e.richtung,
      entry: e.kurs, stop: e.stop, ziel: e.ziel, risiko,
      rrGeplant: Math.abs(e.ziel - e.kurs) / risiko,
      stil: e.stil as string, horizontStunden: h, eroeffnetMs: e.ts,
      istEtikett: null, istSchluss: null, teilgewinnGenommen: false, kiAbweichung: false,
      confidence: e.confidence, groesse: null, atrTag: null,
      signalQuelle: e.quelle, overrideAktiv: null,
    },
  };
}

export interface SchattenAuswahl {
  fensterTage: number | null;
  /** Eintraege im Fenster, je Schicksal — alle, auch die nicht nachrechenbaren. */
  jeSchicksal: Record<string, number>;
  gesamt: number;
  kandidaten: Kandidat[];
  /** Schicksal je Kandidaten-id. */
  schicksalVon: Record<number, string>;
  ausgeschlossen: Record<SchattenAusschluss, number>;
}

/**
 * Welche Eintraege nachgerechnet werden. Die NEUESTEN zuerst, je Schicksal
 * hoechstens `jeGruppe`, gesamt hoechstens `maxGesamt` — so bekommt jedes Tor
 * seine Daten, statt dass die haeufigste Stufe alles verdraengt.
 */
export function schattenAuswahl(
  eintraege: readonly SchattenEintrag[],
  opt: { haltedauer: Readonly<Record<string, number>>; jetztMs: number; tage: number | null;
    maxGesamt: number; jeGruppe: number },
): SchattenAuswahl {
  const ausgeschlossen = Object.fromEntries(SCHATTEN_AUSSCHLUESSE.map((a) => [a, 0])) as Record<SchattenAusschluss, number>;
  const jeSchicksal: Record<string, number> = {};
  const ab = opt.tage === null ? -Infinity : opt.jetztMs - opt.tage * 86_400_000;
  const gueltig: Array<{ k: Kandidat; schicksal: string }> = [];
  let id = 0;
  for (const e of eintraege) {
    if (Number.isFinite(e.ts) && e.ts < ab) { ausgeschlossen.ausserhalbFenster++; continue; }
    jeSchicksal[e.schicksal] = (jeSchicksal[e.schicksal] ?? 0) + 1;
    const r = schattenKandidat(e, { id: id++, haltedauer: opt.haltedauer, jetztMs: opt.jetztMs });
    if ("grund" in r) { ausgeschlossen[r.grund]++; continue; }
    gueltig.push({ k: r.kandidat, schicksal: e.schicksal });
  }
  gueltig.sort((a, b) => b.k.eroeffnetMs - a.k.eroeffnetMs);
  const kandidaten: Kandidat[] = [];
  const schicksalVon: Record<number, string> = {};
  const jeGruppeGenommen: Record<string, number> = {};
  for (const g of gueltig) {
    const n = jeGruppeGenommen[g.schicksal] ?? 0;
    if (n >= opt.jeGruppe || kandidaten.length >= opt.maxGesamt) { ausgeschlossen.ueberObergrenze++; continue; }
    jeGruppeGenommen[g.schicksal] = n + 1;
    kandidaten.push(g.k);
    schicksalVon[g.k.id] = g.schicksal;
  }
  const gesamt = Object.values(jeSchicksal).reduce((s, n) => s + n, 0);
  return { fensterTage: opt.tage, jeSchicksal, gesamt, kandidaten, schicksalVon, ausgeschlossen };
}

export interface SchattenGruppe {
  schicksal: string;
  imFenster: number;
  nachgerechnet: number;
  bewertet: number;
  ziel: number;
  stop: number;
  beide: number;
  offen: number;
  haltenR: number | null;
  se: number | null;
}

export interface SchattenBericht {
  fensterTage: number | null;
  tageGelesen: number;
  gesamt: number;
  nachgerechnet: number;
  bewertet: number;
  ohneDaten: number;
  gruppen: SchattenGruppe[];
  ausgeschlossen: Record<SchattenAusschluss, number>;
  abbruch: string | null;
}

/** Die gehandelten zuerst (Massstab), danach nach Zahl der Eintraege. */
export function schattenBericht(
  aus: SchattenAuswahl,
  ergebnisse: readonly EinzelErgebnis[],
  meta: { tageGelesen: number; abbruch: string | null },
): SchattenBericht {
  const proGruppe = new Map<string, EinzelErgebnis[]>();
  for (const e of ergebnisse) {
    const s = aus.schicksalVon[e.kandidat.id];
    if (s === undefined) continue;
    const l = proGruppe.get(s) ?? [];
    l.push(e);
    proGruppe.set(s, l);
  }
  const namen = new Set([...Object.keys(aus.jeSchicksal), ...proGruppe.keys()]);
  const gruppen: SchattenGruppe[] = [...namen].map((schicksal) => {
    const alle = proGruppe.get(schicksal) ?? [];
    const bew = alle.filter((e) => e.nachrechnung.treffer !== "KEINE_DATEN");
    const werte = bew.map((e) => e.nachrechnung.haltenR).filter((v): v is number => v !== null && Number.isFinite(v));
    const z = (t: string) => bew.filter((e) => e.nachrechnung.treffer === t).length;
    return {
      schicksal,
      imFenster: aus.jeSchicksal[schicksal] ?? 0,
      nachgerechnet: alle.length,
      bewertet: bew.length,
      ziel: z("ZIEL"), stop: z("STOP"), beide: z("BEIDE"), offen: z("OFFEN"),
      haltenR: werte.length === 0 ? null : werte.reduce((s, v) => s + v, 0) / werte.length,
      se: standardfehler(werte),
    };
  });
  gruppen.sort((a, b) => {
    if (a.schicksal === SCHICKSAL.gehandelt) return -1;
    if (b.schicksal === SCHICKSAL.gehandelt) return 1;
    return b.imFenster - a.imFenster || a.schicksal.localeCompare(b.schicksal);
  });
  const bewertet = gruppen.reduce((s, g) => s + g.bewertet, 0);
  return {
    fensterTage: aus.fensterTage,
    tageGelesen: meta.tageGelesen,
    gesamt: aus.gesamt,
    nachgerechnet: ergebnisse.length,
    bewertet,
    ohneDaten: ergebnisse.length - bewertet,
    gruppen,
    ausgeschlossen: aus.ausgeschlossen,
    abbruch: meta.abbruch,
  };
}

const r2 = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

/** Der Text fuer Telegram (HTML). Fremder Text wird entschaerft. */
export function schattenText(b: SchattenBericht): string {
  const z: string[] = [];
  z.push("👥 <b>Schattenbuch</b> — was hätten die Signale gebracht?");
  z.push(`<i>Gehalten bis Stop/Ziel/Zeit-Exit, wie /exits — NICHT unsere Ausstiegslogik. `
    + `Einstieg = Broker-Kurs zum Zyklusbeginn, Stop/Ziel von GPT.</i>`);
  z.push(`Zeitraum: ${b.fensterTage === null ? "alles" : `letzte ${b.fensterTage} Tage`} `
    + `(${b.tageGelesen} Tage gelesen)`);
  z.push(`Einträge: ${b.gesamt} · nachgerechnet ${b.nachgerechnet} · bewertet ${b.bewertet}`
    + (b.ohneDaten > 0 ? ` · ohne Kursdaten ${b.ohneDaten}` : ""));
  if (b.abbruch !== null) {
    // Kuerzen VOR dem Entschaerfen: sonst zerteilt der Schnitt ein `&amp;`.
    z.push(`⛔ Abgebrochen: ${htmlSicher(b.abbruch.slice(0, 200))} — Teilergebnis.`);
  }
  z.push("");
  z.push("<b>Je Schicksal</b> (🎯 Ziel · 🛑 Stop · ❓ beide · ⏱ keins · Ø R ±2 SE):");
  if (b.gruppen.length === 0) z.push("  (keine Einträge)");
  for (const g of b.gruppen) {
    const r = g.haltenR === null ? "Ø R —" : `Ø ${r2(g.haltenR)} R ±${g.se === null ? "?" : (2 * g.se).toFixed(2)}`;
    const wenig = g.bewertet < MIN_BEWERTET ? " ⚠️ zu wenig" : "";
    z.push(`  ${htmlSicher(g.schicksal)} (${g.bewertet}/${g.imFenster}): 🎯${g.ziel} 🛑${g.stop}`
      + `${g.beide > 0 ? ` ❓${g.beide}` : ""} ⏱${g.offen} · ${r}${wenig}`);
  }
  const aus = SCHATTEN_AUSSCHLUESSE.filter((a) => b.ausgeschlossen[a] > 0)
    .map((a) => `${AUSSCHLUSS_TEXT[a]} ${b.ausgeschlossen[a]}`);
  if (aus.length > 0) {
    z.push("");
    z.push(`Nicht nachgerechnet: ${aus.join(" · ")}`);
  }
  z.push("");
  z.push("<i>(bewertet/im Fenster). Dasselbe Signal kehrt wieder — trotz der 60-Minuten-Regel "
    + "sind die Werte abhängig, die ±2 SE eher zu klein. Ein Unterschied ist keine Zusage.</i>");
  return z.join("\n");
}
