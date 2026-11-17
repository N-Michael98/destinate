// ── /exitsim — WAS HAETTE DER SCHALTER GEBRACHT, JE STIL? (17.11.) ──────────
//
// `/exits` hat gezeigt: ueber alle Trades ist „bis Stop/Ziel halten" etwas
// schlechter als das Tatsaechliche — aufgeschluesselt aber KOSTET die
// Ausstiegslogik bei DAYTRADING und RETTET bei SWING. Die Frage dahinter ist,
// was `exitThresholdsRelativeToStop` JE STIL bewirken wuerde.
//
// DAS IST KEIN ZWEITES REGELWERK, SONDERN EINE NACHBILDUNG. Offene Positionen
// werden alle 2 Minuten von ZWEI Systemen verwaltet (`instrumentation.ts`):
// zuerst der RiskAgent (`processPosition`, risk-agent.ts), danach der
// Python-Lifecycle (`on_price_update`, trade_lifecycle_manager.py). Am Broker
// gilt immer der ENGERE Stop, und es gibt hoechstens EINEN Teilgewinn
// (`teilgewinnErlaubt` / `merkeTeilgewinn`). Der Schalter aendert NUR die
// Schwellen des RiskAgent — der Python-Lifecycle laeuft unveraendert weiter.
//
// Die RiskAgent-Funktionen kommen als PARAMETER und sind die echten
// (`getStyleThresholds`, `wirksameSchwellen`, `BE_TOLERANCE`). Die
// Python-Stufen lassen sich aus TypeScript nicht importieren; sie stehen
// unten als Kopie, und der Pruefer liest `get_level` aus der Python-Datei und
// vergleicht. Ebenso die Zahlen des RiskAgent, die keine Funktion haben.
//
// WAS ES NICHT KANN: die KI vor jeder Stufe (SKIP/ADJUST) ist nicht
// nachbildbar — angenommen wird, dass sie die Regelwerte durchwinkt. Deshalb
// die Kalibrierung gegen das TATSAECHLICHE Ergebnis, auf Trades OHNE
// KI-Abweichung und OHNE Teilgewinn-Bein.

import { istR, nachrechnen, STIL_REIHENFOLGE, type Kandidat, type Kerze } from "./exit-messung";
import { htmlSicher } from "../html-sicher/html-sicher";

export interface StilSchwellen { bePct: number; partialPct: number; trailPct: number; atrFactor: number }
export interface SchalterEinstellung {
  exitThresholdsRelativeToStop: boolean;
  breakevenAtR: number;
  partialAtR: number;
  trailAtR: number;
}
/** Die echten Funktionen aus risk-agent.ts — hineingereicht, keine Kopie. */
export interface SimAbh {
  stilSchwellen(stil: string): StilSchwellen;
  wirksameSchwellen(regel: StilSchwellen, slRange: number, entry: number,
    einstellung: SchalterEinstellung | undefined): StilSchwellen & { relativ: boolean };
  beToleranz: Readonly<Record<string, number>>;
}

/**
 * RiskAgent-Zahlen ohne eigene Funktion (risk-agent.ts, processPosition).
 * Gebunden an die Quelle durch den Pruefer — aendert sie sich dort, wird er rot.
 */
export const RISK_KONST = {
  /** `const beBufferRatio = … : 0.15;` — Breakeven-Stop liegt 0.15 R UNTER dem Einstieg (BUY). */
  beBufferAnteil: 0.15,
  /** `: 0.5;` — Anteil des Teilgewinns ohne KI-Anpassung. */
  teilAnteil: 0.5,
  /** `rawSize >= 2 ? Math.floor(rawSize * anteil) : 0` */
  teilMinGroesse: 2,
  /** `Math.max(beTol, slRange * 0.20)` */
  beZoneAnteil: 0.20,
  /** `BE_TOLERANCE[symbol] ?? slRange * 0.01` */
  beTolRueckfall: 0.01,
  /** `ctx.atrMap.get(symbol) ?? … ?? slRange * 0.5` */
  atrRueckfall: 0.5,
  /** `if (slRange < 0.000001) return;` */
  minSlRange: 0.000001,
} as const;

/** Python `get_level` (trade_lifecycle_manager.py) — Kopie, gebunden durch den Pruefer. */
export const PY_STUFEN: ReadonlyArray<{ abConfidence: number; beAt: number; trailDist: number; partialAt: number }> = [
  { abConfidence: 80, beAt: 0.70, trailDist: 0.40, partialAt: 0.50 },
  { abConfidence: 75, beAt: 0.55, trailDist: 0.50, partialAt: 0.50 },
  { abConfidence: -Infinity, beAt: 0.40, trailDist: 0.60, partialAt: 0.50 },
];

export function pyStufe(confidence: number): { beAt: number; trailDist: number; partialAt: number } {
  for (const s of PY_STUFEN) if (confidence >= s.abConfidence) return s;
  return PY_STUFEN[PY_STUFEN.length - 1];
}

/**
 * ATR(14) wie TA-Lib (`talib.ATR(h, l, c, timeperiod=14)`): True Range ab der
 * ZWEITEN Kerze, erster Wert = Mittel der ersten 14, danach Wilder-Glaettung.
 * Auf Mittelkursen. `abMs` ist der Zeitpunkt, ab dem der Wert bekannt ist
 * (Ende der Stundenkerze) — kein Blick in die Zukunft.
 *
 * NAEHERUNG: das Backend rechnet auf yfinance-Stundenkerzen, hier sind es
 * Capital-Kerzen. Der Unterschied geht in die Kalibrierung ein.
 */
export function atrReihe(stunden: readonly Kerze[], periode = 14): Array<{ abMs: number; atr: number }> {
  const s = [...stunden].sort((a, b) => a.t - b.t);
  const h = s.map((k) => (k.bidHoch + k.askHoch) / 2);
  const l = s.map((k) => (k.bidTief + k.askTief) / 2);
  const c = s.map((k) => (k.bidSchluss + k.askSchluss) / 2);
  const aus: Array<{ abMs: number; atr: number }> = [];
  let atr: number | null = null;
  let summe = 0;
  for (let i = 1; i < s.length; i++) {
    const tr = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    if (atr === null) {
      summe += tr;
      if (i === periode) atr = summe / periode;
    } else {
      atr = (atr * (periode - 1) + tr) / periode;
    }
    if (atr !== null && Number.isFinite(atr)) aus.push({ abMs: s[i].t + 3_600_000, atr });
  }
  return aus;
}

/** Der zuletzt BEKANNTE ATR-Wert zum Zeitpunkt `tMs`, sonst null. */
export function atrBei(reihe: ReadonlyArray<{ abMs: number; atr: number }>, tMs: number): number | null {
  let wert: number | null = null;
  for (const r of reihe) {
    if (r.abMs <= tMs) wert = r.atr; else break;
  }
  return wert;
}

export type SimEnde = "STOP" | "ZIEL" | "BEIDE" | "ZEIT";
export interface SimErgebnis {
  r: number;
  ende: SimEnde;
  teilgewinn: "RISK" | "PY" | null;
  breakeven: boolean;
}

/**
 * Laeuft die Kerzen ab — in der Reihenfolge des echten 2-Minuten-Zyklus:
 *
 *   1. Am Broker: berueht die Kerze den Stop bzw. das Ziel, das ZU BEGINN der
 *      Kerze galt? (Beides in einer Kerze = Stop, vorsichtig.)
 *   2. RiskAgent auf dem Schlusskurs der Kerze (Schliess-Seite).
 *   3. Python-Lifecycle auf dem MITTELkurs (`(bid + ask) / 2`, instrumentation.ts).
 *
 * Ein neuer Stop gilt erst ab der NAECHSTEN Kerze — so kann nie ein Stop
 * greifen, der aus einem Kurs derselben Kerze stammt.
 *
 * Gibt null zurueck, wenn keine Kerze nach dem Einstieg vorliegt, Confidence
 * oder Grösse fehlen — dann ist keine treue Nachbildung moeglich.
 */
export function simuliere(
  k: Kandidat, kerzen: readonly Kerze[], kerzenMinuten: number, endeMs: number,
  atr: ReadonlyArray<{ abMs: number; atr: number }>,
  einstellung: SchalterEinstellung, abh: SimAbh,
): SimErgebnis | null {
  if (k.confidence === null || k.groesse === null) return null;
  const abMs = k.eroeffnetMs + kerzenMinuten * 60_000;
  const genutzt = kerzen.filter((x) => x.t >= abMs && x.t < endeMs);
  if (genutzt.length === 0) return null;

  const buy = k.richtung === "BUY";
  const entry = k.entry;
  const groesse = k.groesse;
  const lvl = pyStufe(k.confidence);
  const pyWeg = Math.abs(k.ziel - entry);     // Python total_range (take_profit > 0)
  const pySpanne = k.risiko;                  // Python sl_range: der REGISTRIERTE Stop
  const besser = (neu: number, alt: number) => (buy ? neu > alt : neu < alt);
  const rAus = (kurs: number) => (buy ? kurs - entry : entry - kurs) / k.risiko;

  let liveSL = k.stop;
  let offen = 1;
  const beine: Array<{ anteil: number; kurs: number }> = [];
  const ra = { beSet: false, partialDone: false, teilGroesse: 0, trailSL: null as number | null, peak: null as number | null };
  const py = { beSet: false, partialDone: false, trailSL: k.stop as number | null, currentSL: k.stop };
  let teilgewinn: "RISK" | "PY" | null = null;
  let breakeven = false;
  let ende: SimEnde = "ZEIT";

  for (const x of genutzt) {
    // 1. Broker
    const stopHit = buy ? x.bidTief <= liveSL : x.askHoch >= liveSL;
    const zielHit = buy ? x.bidHoch >= k.ziel : x.askTief <= k.ziel;
    if (stopHit) { beine.push({ anteil: offen, kurs: liveSL }); offen = 0; ende = zielHit ? "BEIDE" : "STOP"; break; }
    if (zielHit) { beine.push({ anteil: offen, kurs: k.ziel }); offen = 0; ende = "ZIEL"; break; }

    const cur = buy ? x.bidSchluss : x.askSchluss;

    // 2. RiskAgent (processPosition)
    const slRange = Math.abs(entry - liveSL);
    if (slRange >= RISK_KONST.minSlRange) {
      const thr = abh.wirksameSchwellen(abh.stilSchwellen(k.stil), slRange, entry, einstellung);
      const profitPct = buy ? (cur - entry) / entry : (entry - cur) / entry;
      const atrWert = atrBei(atr, x.t) ?? slRange * RISK_KONST.atrRueckfall;
      const beTol = Object.prototype.hasOwnProperty.call(abh.beToleranz, k.symbol)
        ? abh.beToleranz[k.symbol] : slRange * RISK_KONST.beTolRueckfall;
      const beZone = Math.max(beTol, slRange * RISK_KONST.beZoneAnteil);
      const alreadyAtBE = buy ? liveSL >= entry - beZone : liveSL <= entry + beZone;
      const beEffective = ra.beSet || alreadyAtBE;
      const currentTrailSL = ra.trailSL === null ? liveSL
        : (buy ? Math.max(ra.trailSL, liveSL) : Math.min(ra.trailSL, liveSL));

      if (!ra.partialDone && profitPct >= thr.partialPct) {
        const teil = groesse >= RISK_KONST.teilMinGroesse ? Math.floor(groesse * RISK_KONST.teilAnteil) : 0;
        if (teil > 0) {
          const anteil = teil / groesse;
          beine.push({ anteil, kurs: cur });
          offen -= anteil;
          ra.teilGroesse = teil;
          teilgewinn = "RISK";
        }
        ra.partialDone = true;   // auch bei 0 — „zu klein zum Halbieren" (risk-agent.ts)
      }
      if (!beEffective && profitPct >= thr.bePct) {
        const neu = buy ? entry - slRange * RISK_KONST.beBufferAnteil : entry + slRange * RISK_KONST.beBufferAnteil;
        liveSL = neu;
        ra.beSet = true;
        ra.trailSL = neu;
        breakeven = true;
        // `return` im echten Code: in diesem Zyklus kein Trailing des RiskAgent.
      } else if (profitPct >= thr.trailPct) {
        const prevPeak = ra.peak ?? cur;
        const newPeak = buy ? Math.max(prevPeak, cur) : Math.min(prevPeak, cur);
        const dist = atrWert * thr.atrFactor;
        const neu = buy ? Math.max(newPeak - dist, entry) : Math.min(newPeak + dist, entry);
        const soll = buy ? neu > currentTrailSL + beTol : neu < currentTrailSL - beTol;
        if (soll) {
          liveSL = neu;
          // Woertlich wie im Code: `beSet: trailSL >= entry` — auch fuer SELL.
          ra.beSet = neu >= entry;
          ra.peak = newPeak;
          ra.trailSL = neu;
        } else if (newPeak !== prevPeak) {
          ra.peak = newPeak;
        }
      }
    }
    if (offen <= 0) break;

    // 3. Python-Lifecycle (on_price_update) auf dem Mittelkurs
    const mid = (x.bidSchluss + x.askSchluss) / 2;
    const progress = pyWeg > 0 ? (buy ? (mid - entry) / pyWeg : (entry - mid) / pyWeg) : 0;
    const pyAmBE = py.currentSL > 0 && (buy ? py.currentSL >= entry : py.currentSL <= entry);
    if (!py.partialDone && progress >= lvl.partialAt) {
      py.partialDone = true;
      const volumen = groesse / 2;
      const offeneGroesse = offen * groesse;
      // teilgewinnErlaubt: gesperrt, wenn der RiskAgent schon >0 genommen hat;
      // Menge > 0 und kleiner als die offene Grösse.
      if (ra.teilGroesse === 0 && volumen > 0 && volumen < offeneGroesse) {
        const anteil = volumen / groesse;
        beine.push({ anteil, kurs: cur });   // Schliessung am Markt: Schliess-Seite
        offen -= anteil;
        ra.partialDone = true;               // merkeTeilgewinn
        ra.teilGroesse = volumen;
        teilgewinn = "PY";
      }
    } else if (!py.beSet && !pyAmBE && progress >= lvl.beAt) {
      py.beSet = true;
      py.trailSL = entry;
      py.currentSL = entry;
      breakeven = true;
      if (besser(entry, liveSL)) liveSL = entry;
    } else if (py.beSet || pyAmBE) {
      const dist = pySpanne * lvl.trailDist;
      const neu = buy ? mid - dist : mid + dist;
      const aktuell = py.trailSL ?? py.currentSL;
      const richtigeSeite = buy ? neu < mid : neu > mid;
      const soll = richtigeSeite && (buy ? neu > aktuell && neu >= entry : neu < aktuell && neu <= entry);
      if (soll) {
        py.trailSL = neu;
        py.currentSL = neu;
        if (besser(neu, liveSL)) liveSL = neu;
      }
    }
  }

  if (offen > 0) {
    const letzte = genutzt[genutzt.length - 1];
    beine.push({ anteil: offen, kurs: buy ? letzte.bidSchluss : letzte.askSchluss });
  }
  const r = beine.reduce((s, b) => s + b.anteil * rAus(b.kurs), 0);
  return { r, ende, teilgewinn, breakeven };
}

// ── Statistik ────────────────────────────────────────────────────────────────

export interface Stat { n: number; mittel: number | null; sd: number | null; se: number | null }

/** Mittel, Stichproben-Streuung (n−1) und Standardfehler. Unter 2 Werten keine Streuung. */
export function statistik(werte: readonly number[]): Stat {
  const w = werte.filter((v) => Number.isFinite(v));
  const n = w.length;
  if (n === 0) return { n, mittel: null, sd: null, se: null };
  const mittel = w.reduce((s, v) => s + v, 0) / n;
  if (n < 2) return { n, mittel, sd: null, se: null };
  const sd = Math.sqrt(w.reduce((s, v) => s + (v - mittel) ** 2, 0) / (n - 1));
  return { n, mittel, sd, se: sd / Math.sqrt(n) };
}

// ── Bericht ──────────────────────────────────────────────────────────────────

export interface SimFall {
  kandidat: Kandidat;
  halten: number | null;     // aus `/exits` (nachrechnen)
  v1: SimErgebnis;           // heute
  v2: SimErgebnis;           // Schalter umgelegt
}

export interface SimGruppe {
  name: string;
  n: number;
  halten: Stat;
  v1: Stat;
  v2: Stat;
  /** V2 − V1 je Trade, gepaart. */
  delta: Stat;
  /** V1 − tatsaechlich, nur Trades ohne KI-Abweichung und ohne Teilgewinn-Bein. */
  kalibrierung: Stat;
  /** Hat die Nachbildung einen Teilgewinn, wo einer war — und keinen, wo keiner war? */
  teilgewinnTreffer: number;
  urteil: string;
}

export interface SimBericht {
  fensterTage: number | null;
  heuteRelativ: boolean;
  kandidaten: number;
  ohneConfidence: number;
  ohneGroesse: number;
  ohneDaten: number;
  kiAbweichung: number;
  teilgewinnOhneIst: number;
  gruppen: SimGruppe[];
  abbruch: string | null;
}

export const MIN_JE_GRUPPE = 30;

export function simGruppe(name: string, faelle: readonly SimFall[]): SimGruppe {
  const halten = statistik(faelle.map((f) => f.halten).filter((v): v is number => v !== null));
  const v1 = statistik(faelle.map((f) => f.v1.r));
  const v2 = statistik(faelle.map((f) => f.v2.r));
  const delta = statistik(faelle.map((f) => f.v2.r - f.v1.r));
  const kal = statistik(faelle
    .filter((f) => !f.kandidat.kiAbweichung)
    .map((f) => { const i = istR(f.kandidat); return i === null ? NaN : f.v1.r - i; }));
  const teilgewinnTreffer = faelle.filter((f) => (f.v1.teilgewinn !== null) === f.kandidat.teilgewinnGenommen).length;

  let urteil: string;
  if (faelle.length < MIN_JE_GRUPPE) {
    urteil = `⚠️ zu wenig (${faelle.length} < ${MIN_JE_GRUPPE})`;
  } else if (delta.mittel === null || delta.se === null) {
    urteil = "nicht berechenbar";
  } else if (kal.mittel === null) {
    urteil = "⚠️ keine Kalibrierung möglich — V2 nicht belastbar";
  } else if (Math.abs(kal.mittel) > Math.abs(delta.mittel)) {
    urteil = "⚠️ Nachbildung weicht stärker ab als der Effekt — V2 nicht belastbar";
  } else if (Math.abs(delta.mittel) > 2 * delta.se) {
    urteil = "Unterschied ausserhalb ±2 SE";
  } else {
    urteil = "Unterschied innerhalb des Rauschens (±2 SE)";
  }
  return { name, n: faelle.length, halten, v1, v2, delta, kalibrierung: kal, teilgewinnTreffer, urteil };
}

/** Was der Abruf je Trade liefert (Form von `SimDaten` aus exit-lauf.ts). */
export interface SimEingabe {
  kandidat: Kandidat;
  kerzen: readonly Kerze[];
  stunden: readonly Kerze[];
  minuten: number;
  endeMs: number;
  datenGrund: string | null;
}

/**
 * Aus den abgerufenen Daten den Bericht machen: JEDER Ausschluss gezaehlt,
 * BEIDE Varianten auf denselben Kerzen, je Stil (bekannte zuerst) und gesamt.
 * V2 ist die Einstellung von heute mit UMGELEGTEM Schalter — sonst nichts.
 */
export function simBerichtAus(
  eingaben: readonly SimEingabe[], heute: SchalterEinstellung, abh: SimAbh,
  zusatz: { fensterTage: number | null; abbruch: string | null; kandidaten: number },
): SimBericht {
  const umgelegt: SchalterEinstellung = { ...heute, exitThresholdsRelativeToStop: !heute.exitThresholdsRelativeToStop };
  const faelle: SimFall[] = [];
  let ohneDaten = 0, ohneConfidence = 0, ohneGroesse = 0;
  for (const d of eingaben) {
    const k = d.kandidat;
    if (d.datenGrund !== null || d.kerzen.length === 0) { ohneDaten++; continue; }
    if (k.confidence === null) { ohneConfidence++; continue; }
    if (k.groesse === null) { ohneGroesse++; continue; }
    const atr = atrReihe(d.stunden);
    const v1 = simuliere(k, d.kerzen, d.minuten, d.endeMs, atr, heute, abh);
    const v2 = simuliere(k, d.kerzen, d.minuten, d.endeMs, atr, umgelegt, abh);
    if (v1 === null || v2 === null) { ohneDaten++; continue; }
    faelle.push({ kandidat: k, halten: nachrechnen(k, d.kerzen, d.minuten, d.endeMs).haltenR, v1, v2 });
  }
  const stile = [...new Set(faelle.map((f) => f.kandidat.stil))].sort((a, b) => {
    const ra = (STIL_REIHENFOLGE as readonly string[]).indexOf(a);
    const rb = (STIL_REIHENFOLGE as readonly string[]).indexOf(b);
    return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || a.localeCompare(b);
  });
  const gruppen = stile.map((s) => simGruppe(s, faelle.filter((f) => f.kandidat.stil === s)));
  gruppen.push(simGruppe("gesamt", faelle));
  return {
    fensterTage: zusatz.fensterTage,
    heuteRelativ: heute.exitThresholdsRelativeToStop,
    kandidaten: zusatz.kandidaten,
    ohneConfidence, ohneGroesse, ohneDaten,
    kiAbweichung: faelle.filter((f) => f.kandidat.kiAbweichung).length,
    teilgewinnOhneIst: faelle.filter((f) => f.kandidat.teilgewinnGenommen).length,
    gruppen,
    abbruch: zusatz.abbruch,
  };
}

function rk(v: number | null): string {
  return v === null ? "?" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}
function pm(s: Stat): string {
  return s.mittel === null ? "?" : `${rk(s.mittel)}${s.se === null ? "" : ` ±${(2 * s.se).toFixed(2)}`}`;
}

/** Telegram-Text. Feste Form, Gruppen sind begrenzt (Stile + gesamt); fremde Texte entschaerft. */
export function simText(b: SimBericht): string {
  const z: string[] = [];
  const schalter = (an: boolean) => (an ? "AN" : "AUS");
  z.push(`🧪 <b>/exitsim${b.fensterTage === null ? "" : ` ${b.fensterTage}`}</b> — Ausstiegslogik nachgerechnet`);
  z.push(`<i>Beide Systeme wie im Betrieb (RiskAgent, dann Python-Lifecycle, engerer Stop gilt). V1 = heute (Schalter ${schalter(b.heuteRelativ)}), V2 = Schalter ${schalter(!b.heuteRelativ)}. Die KI vor jeder Stufe ist NICHT nachgebildet.</i>`);
  if (b.abbruch !== null) z.push("", `⚠️ <b>Abgebrochen:</b> ${htmlSicher(b.abbruch)}`);
  z.push("", `<b>Nachgerechnet:</b> ${b.gruppen.find((g) => g.name === "gesamt")?.n ?? 0} von ${b.kandidaten} Trades`);
  if (b.ohneDaten > 0) z.push(`  • ohne Kursdaten: ${b.ohneDaten}`);
  if (b.ohneConfidence > 0) z.push(`  • ohne Confidence (Python-Stufen unbekannt): ${b.ohneConfidence}`);
  if (b.ohneGroesse > 0) z.push(`  • ohne Positionsgrösse (Teilgewinn nicht nachbildbar): ${b.ohneGroesse}`);
  z.push(`  • davon KI abgewichen (SKIP/ADJUST): ${b.kiAbweichung} — nicht in der Kalibrierung`);
  if (b.teilgewinnOhneIst > 0) z.push(`  • mit Teilgewinn: ${b.teilgewinnOhneIst} — „tatsächlich" nicht bestimmbar, nicht in der Kalibrierung`);
  z.push("", "<b>Ø R je Trade</b> <i>(±2 Standardfehler)</i>:");
  for (const g of b.gruppen) {
    z.push(`<b>${htmlSicher(g.name)}</b> (${g.n}): halten ${pm(g.halten)} · V1 ${pm(g.v1)} · V2 ${pm(g.v2)}`);
    z.push(`   V2−V1 ${pm(g.delta)} · Kalibrierung V1−tats. ${pm(g.kalibrierung)} (${g.kalibrierung.n}) · Teilgewinn getroffen ${g.teilgewinnTreffer}/${g.n}`);
    z.push(`   → ${htmlSicher(g.urteil)}`);
  }
  z.push("", "<i>5-Minuten-Kerzen statt 2-Minuten-Takt, kein Schlupf, ATR aus Capital- statt yfinance-Kerzen, Teilgewinn als echte Halbierung. Ein Unterschied ist keine Zusage.</i>");
  return z.join("\n");
}
