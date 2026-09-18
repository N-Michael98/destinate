// ── ZYKLUS-BILANZ: WO STERBEN DIE SIGNALE — UEBER ALLE ZYKLEN (16.09.) ──────
//
// ANLASS. Am 16.09. liess sich EIN Zyklus aus dem Log Zeile fuer Zeile
// abgleichen (GPT 25/3/2 -> 2 Vetos -> 3 unter 70 -> 0 GO). Das war n=1. Ob
// die Confidence, das R/R, die Meta-KI oder die Schwelle das eigentliche
// Nadeloehr ist, laesst sich nur ueber VIELE Zyklen sagen — und dafuer gab es
// nichts: jede Stufe schrieb ihre eigene Logzeile, niemand zaehlte zusammen.
//
// WIE. Dieses Modul ist ein EMPFAENGER am Agent-Bus (seit 16.09. auf
// `global`). Die Stufen melden, was sie entschieden haben — der Orchestrator
// Anfang und Ende des Zyklus, der Analyse-Agent den Scan, jedes Tor seine
// Entscheidung, der Ausfuehrungs-Agent Erfolg und Fehlschlag. Hier kommt es
// zusammen: eine Zeile pro Zyklus und eine Tagessumme in Redis, die nach
// Handelsschluss per Telegram rausgeht — AUCH an Tagen ohne Trade.
//
// WAS ES NICHT TUT: es entscheidet nichts, sperrt nichts und veraendert keinen
// Wert, den der Handel liest. Jede Funktion hier wirft nie nach aussen.

export type Richtungen = { WAIT: number; BUY: number; SELL: number };

/** Was der Scan ueber sich meldet (vom Analyse-Agenten, nur im Handelszyklus). */
export type ScanDaten = {
  maerkte: number;
  gpt: Richtungen;
  vetos: number;
  stilVerworfen: number;
  /** Confidence der Richtungssignale, die unter der Untergrenze lagen. */
  unterGrenze: number[];
  go: number;
  rrAbgelehnt: number;
  claudeGefragt: number;
  /** GPT-Antworten, die dem eigenen Prompt widersprechen — Anzahl je Art. */
  regelbrueche: Record<string, number>;
  dauerMs: Record<string, number>;
  /** Was im Prompt wirklich drinstand. `performance` ist am 17.09. entfallen —
   *  es war ein EURUSD-Backtest, der fuer alle 30 Maerkte eingespielt wurde. */
  kontext: { news: boolean; mtfSymbole: number };
};

export type TorEintrag = {
  gate: string;
  symbol?: string;
  approve: boolean;
  reason: string;
  fallback?: boolean;
};

export type ZyklusBilanz = {
  start: number;
  ende?: number;
  ausgang?: string;
  scan?: ScanDaten;
  tore: TorEintrag[];
  trades: string[];
  fehlgeschlagen: string[];
};

export type TorSumme = { ja: number; nein: number; fallback: number; gruende: Record<string, number> };

export type Tagessumme = {
  datum: string;
  zyklen: number;
  ausgaenge: Record<string, number>;
  scans: number;
  maerkte: number;
  gpt: Richtungen;
  vetos: number;
  stilVerworfen: number;
  unterGrenze: number;
  confMin: number | null;
  confMax: number | null;
  go: number;
  rrAbgelehnt: number;
  claudeGefragt: number;
  /** Wie oft News im Prompt standen, und die Summe der Symbole MIT 1H/1W. */
  newsZyklen: number;
  mtfSumme: number;
  regelbrueche: Record<string, number>;
  tore: Record<string, TorSumme>;
  trades: number;
  fehlgeschlagen: number;
  dauerSummeMs: number;
  dauerMaxMs: number;
};

/** Obergrenzen, damit weder die Zyklus- noch die Tagesbilanz unbegrenzt waechst. */
const MAX_TORE_JE_ZYKLUS = 200;
const MAX_GRUENDE_JE_TOR = 25;
const MAX_TEXT = 160;

export function neueBilanz(start: number): ZyklusBilanz {
  return { start, tore: [], trades: [], fehlgeschlagen: [] };
}

const zahl = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const text = (x: unknown): string => String(x ?? "").slice(0, MAX_TEXT);

/**
 * Einen Grund zum ZAEHLEN vereinheitlichen: Zahlen weg, sonst waere
 * "Confidence 74 < Schwelle 76" und "Confidence 73 < Schwelle 76" je ein
 * eigener Grund und die Tagessumme zerfiele in Einzelfaelle.
 */
export function grundSchluessel(grund: string): string {
  return text(grund)
    .replace(/\([^)]*\)/g, "")          // Klammerzusaetze (Einstellungswerte u. ae.)
    .replace(/-?\d+(?:[.,]\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "ohne Grund";
}

/** Ein Bus-Ereignis in die laufende Bilanz uebernehmen. Unbekanntes wird ignoriert. */
export function bilanzVerbuchen(
  b: ZyklusBilanz,
  ev: { type: string; payload?: Record<string, unknown> },
): void {
  const p = ev.payload ?? {};
  switch (ev.type) {
    case "ANALYSIS:SCAN_DONE": {
      const s = p.scan as ScanDaten | undefined;
      if (s && typeof s === "object") b.scan = s;
      break;
    }
    case "GATE:DECISION": {
      if (b.tore.length >= MAX_TORE_JE_ZYKLUS) break;
      if (typeof p.gate !== "string" || typeof p.approve !== "boolean") break;
      b.tore.push({
        gate: p.gate,
        symbol: typeof p.symbol === "string" ? p.symbol : undefined,
        approve: p.approve,
        reason: text(p.reason),
        fallback: p.fallback === true,
      });
      break;
    }
    case "EXECUTION:TRADE_OPENED":
      if (b.trades.length < MAX_TORE_JE_ZYKLUS) b.trades.push(`${text(p.symbol)} ${text(p.direction)}`.trim());
      break;
    case "EXECUTION:TRADE_FAILED":
      if (b.fehlgeschlagen.length < MAX_TORE_JE_ZYKLUS) b.fehlgeschlagen.push(`${text(p.symbol)}: ${text(p.grund)}`);
      break;
  }
}

/** Die Zeile pro Zyklus. */
export function bilanzZeile(b: ZyklusBilanz): string {
  const dauer = b.ende !== undefined ? Math.round((b.ende - b.start) / 1000) : null;
  const teile: string[] = [`Ausgang: ${b.ausgang ?? "?"}`];
  if (dauer !== null) teile.push(`${dauer}s`);
  const s = b.scan;
  if (s) {
    const conf = s.unterGrenze.length > 0
      ? ` (${Math.min(...s.unterGrenze)}–${Math.max(...s.unterGrenze)})`
      : "";
    teile.push(`GPT ${s.gpt.WAIT}W/${s.gpt.BUY}B/${s.gpt.SELL}S`);
    teile.push(`Veto ${s.vetos}`);
    if (s.stilVerworfen > 0) teile.push(`Stil ${s.stilVerworfen}`);
    teile.push(`<Grenze ${s.unterGrenze.length}${conf}`);
    teile.push(`Freigabe-Nein ${s.rrAbgelehnt}`);
    teile.push(`GO ${s.go}`);
    const brueche = Object.entries(s.regelbrueche).filter(([, n]) => n > 0);
    if (brueche.length > 0) teile.push(`Regelbruch GPT: ${brueche.map(([k, n]) => `${k} ${n}`).join(", ")}`);
    // Was im Prompt wirklich drinstand (17.09.). Bis heute wurde `kontext`
    // gemessen und NIRGENDS ausgegeben — eine Zahl, die niemand sieht, ist
    // keine Messung. Faellt der Multi-Timeframe-Abruf aus, urteilt GPT auf 1D
    // allein; genau das soll man dem Zyklus ansehen.
    const k = s.kontext;
    if (k) teile.push(`Kontext: News ${k.news ? "ja" : "nein"}, MTF ${zahl(k.mtfSymbole)}/${zahl(s.maerkte)}`);
    const d = s.dauerMs;
    const dauerText = Object.entries(d).map(([k2, v]) => `${k2} ${Math.round(v / 1000)}s`).join(" ");
    if (dauerText) teile.push(`Dauer: ${dauerText}`);
  }
  for (const t of b.tore.filter((t) => !t.approve || t.fallback)) {
    teile.push(`${t.gate}${t.fallback ? " (Rueckfall)" : " nein"}${t.symbol ? ` ${t.symbol}` : ""}: ${t.reason}`);
  }
  if (b.trades.length > 0) teile.push(`TRADES: ${b.trades.join(", ")}`);
  if (b.fehlgeschlagen.length > 0) teile.push(`Broker-Fehler: ${b.fehlgeschlagen.join(" ; ")}`);
  return `[zyklus] 📋 ${teile.join(" | ")}`;
}

export function leereTagessumme(datum: string): Tagessumme {
  return {
    datum, zyklen: 0, ausgaenge: {}, scans: 0, maerkte: 0,
    gpt: { WAIT: 0, BUY: 0, SELL: 0 }, vetos: 0, stilVerworfen: 0,
    unterGrenze: 0, confMin: null, confMax: null, go: 0, rrAbgelehnt: 0,
    claudeGefragt: 0, newsZyklen: 0, mtfSumme: 0,
    regelbrueche: {}, tore: {}, trades: 0, fehlgeschlagen: 0,
    dauerSummeMs: 0, dauerMaxMs: 0,
  };
}

/**
 * Eine abgeschlossene Zyklus-Bilanz zur Tagessumme addieren. Gibt eine NEUE
 * Summe zurueck; eine Summe von einem anderen Tag wird verworfen.
 */
export function tagessummeAddieren(alt: Tagessumme | null | undefined, b: ZyklusBilanz, datum: string): Tagessumme {
  const t: Tagessumme = alt && alt.datum === datum
    ? JSON.parse(JSON.stringify(alt)) as Tagessumme
    : leereTagessumme(datum);
  t.zyklen++;
  const ausgang = grundSchluessel(b.ausgang ?? "unbekannt");
  t.ausgaenge[ausgang] = (t.ausgaenge[ausgang] ?? 0) + 1;
  if (b.ende !== undefined) {
    const d = Math.max(0, b.ende - b.start);
    t.dauerSummeMs += d;
    t.dauerMaxMs = Math.max(t.dauerMaxMs, d);
  }
  const s = b.scan;
  if (s) {
    t.scans++;
    t.maerkte += zahl(s.maerkte);
    t.gpt.WAIT += zahl(s.gpt?.WAIT);
    t.gpt.BUY += zahl(s.gpt?.BUY);
    t.gpt.SELL += zahl(s.gpt?.SELL);
    t.vetos += zahl(s.vetos);
    t.stilVerworfen += zahl(s.stilVerworfen);
    const conf = (s.unterGrenze ?? []).filter((c) => Number.isFinite(c));
    t.unterGrenze += conf.length;
    for (const c of conf) {
      t.confMin = t.confMin === null ? c : Math.min(t.confMin, c);
      t.confMax = t.confMax === null ? c : Math.max(t.confMax, c);
    }
    t.go += zahl(s.go);
    t.rrAbgelehnt += zahl(s.rrAbgelehnt);
    t.claudeGefragt += zahl(s.claudeGefragt);
    // `zahl(...)` auch auf der Summenseite: eine Tagessumme aus Redis, die
    // noch von gestern (ohne diese Felder) stammt, ergaebe sonst NaN.
    t.newsZyklen = zahl(t.newsZyklen) + (s.kontext?.news === true ? 1 : 0);
    t.mtfSumme = zahl(t.mtfSumme) + zahl(s.kontext?.mtfSymbole);
    for (const [k, n] of Object.entries(s.regelbrueche ?? {})) {
      t.regelbrueche[k] = (t.regelbrueche[k] ?? 0) + zahl(n);
    }
  }
  for (const tor of b.tore) {
    const summe = t.tore[tor.gate] ?? { ja: 0, nein: 0, fallback: 0, gruende: {} };
    if (tor.fallback) summe.fallback++;
    if (tor.approve) summe.ja++;
    else {
      summe.nein++;
      const k = grundSchluessel(tor.reason);
      if (summe.gruende[k] !== undefined || Object.keys(summe.gruende).length < MAX_GRUENDE_JE_TOR) {
        summe.gruende[k] = (summe.gruende[k] ?? 0) + 1;
      } else {
        summe.gruende["(weitere)"] = (summe.gruende["(weitere)"] ?? 0) + 1;
      }
    }
    t.tore[tor.gate] = summe;
  }
  t.trades += b.trades.length;
  t.fehlgeschlagen += b.fehlgeschlagen.length;
  return t;
}

/** Fuer Telegram (parse_mode HTML) — ein `<` im Grund liesse die Nachricht sonst scheitern. */
export function htmlSicher(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Die Tagesbilanz als Telegram-Text. */
export function tagesbilanzText(t: Tagessumme): string {
  const zeilen: string[] = [];
  zeilen.push(`📋 <b>Zyklus-Tagesbilanz ${htmlSicher(t.datum)}</b>`);
  zeilen.push("");
  zeilen.push(`🔁 Zyklen: ${t.zyklen} (mit Analyse: ${t.scans})`);
  // ── DER SELTENSTE AUSGANG IST DER WICHTIGSTE (18.09.) ──────────────────────
  //
  // Hier stand `.slice(0, 6)`. In der ersten echten Tagesbilanz (17.09., 259
  // Zyklen) ergaben die sechs gezeigten Ausgaenge zusammen 258 — EIN Zyklus
  // endete anders und war nicht zu sehen. Genau so verschwindet ein "Absturz:
  // …": er ist selten, steht deshalb hinten, und faellt aus der Liste.
  //
  // Jetzt: acht Zeilen, ein Absturz IMMER (auch wenn er einmal vorkam), und
  // was dann noch fehlt, wird als Zahl benannt statt verschwiegen.
  const alleAusgaenge = Object.entries(t.ausgaenge).sort((a, b) => b[1] - a[1]);
  const istAbsturz = (k: string) => /absturz|fehler|killswitch/i.test(k);
  const gezeigt = alleAusgaenge.slice(0, 8);
  for (const e of alleAusgaenge) {
    if (istAbsturz(e[0]) && !gezeigt.includes(e)) gezeigt.push(e);
  }
  for (const [k, n] of gezeigt) {
    zeilen.push(`   • ${istAbsturz(k) ? "❗ " : ""}${htmlSicher(k)}: ${n}`);
  }
  const rest = alleAusgaenge.filter((e) => !gezeigt.includes(e));
  if (rest.length > 0) {
    const restZyklen = rest.reduce((s, e) => s + zahl(e[1]), 0);
    zeilen.push(`   • (${rest.length} weitere Ausgaenge, ${restZyklen} Zyklen)`);
  }
  if (t.scans > 0) {
    zeilen.push("");
    zeilen.push(`🧠 GPT: ${t.gpt.WAIT} WAIT · ${t.gpt.BUY} BUY · ${t.gpt.SELL} SELL (${t.maerkte} Marktanalysen)`);
    zeilen.push(`🚧 Vetos: ${t.vetos} · Stil verworfen: ${t.stilVerworfen}`);
    const spanne = t.confMin !== null ? ` (Confidence ${t.confMin}–${t.confMax})` : "";
    zeilen.push(`📉 Unter der Untergrenze: ${t.unterGrenze}${spanne}`);
    zeilen.push(`⚖️ An der Risiko-Freigabe gescheitert (R/R oder Risiko-Score): ${t.rrAbgelehnt}`);
    zeilen.push(`✅ GO: ${t.go} · Claude gefragt: ${t.claudeGefragt}`);
    // Womit GPT gearbeitet hat. Ein Tag mit "MTF Ø 0" heisst: jedes Urteil kam
    // allein aus dem Tageschart, obwohl der Prompt 1H/1W vorsieht.
    const mtfSchnitt = t.scans > 0 ? Math.round(zahl(t.mtfSumme) / t.scans) : 0;
    zeilen.push(`🧭 Kontext: News in ${zahl(t.newsZyklen)}/${t.scans} Scans · `
      + `Multi-Timeframe Ø ${mtfSchnitt} Symbole`);
    const brueche = Object.entries(t.regelbrueche).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (brueche.length > 0) {
      zeilen.push(`⚠️ GPT gegen eigenen Prompt: ${brueche.map(([k, n]) => `${htmlSicher(k)} ${n}`).join(", ")}`);
    }
  }
  const tore = Object.entries(t.tore);
  if (tore.length > 0) {
    zeilen.push("");
    zeilen.push("🚪 <b>Tore</b>");
    for (const [gate, s] of tore) {
      const fb = s.fallback > 0 ? ` · ${s.fallback} Rückfall` : "";
      // Reine Sperr-Tore (Duplikat, Filterkette …) melden nur Ablehnungen —
      // "0 ja" wuerde dort faelschlich nach "nichts durchgelassen" klingen.
      const ja = s.ja > 0 ? `${s.ja} ja · ` : "";
      zeilen.push(`   ${htmlSicher(gate)}: ${ja}${s.nein} nein${fb}`);
      const top = Object.entries(s.gruende).sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [k, n] of top) zeilen.push(`      – ${htmlSicher(k)} (${n}×)`);
    }
  }
  zeilen.push("");
  zeilen.push(`💼 Trades eröffnet: ${t.trades} · Broker-Fehler: ${t.fehlgeschlagen}`);
  if (t.zyklen > 0) {
    zeilen.push(`⏱️ Zyklusdauer Ø ${Math.round(t.dauerSummeMs / t.zyklen / 1000)} s, max ${Math.round(t.dauerMaxMs / 1000)} s`);
  }
  return zeilen.join("\n");
}

// ── Zustand und Bus-Anbindung ────────────────────────────────────────────────
//
// Auf `global` — Schreiber (Orchestrator-Zyklus) und Leser (spaeter evtl.
// eine Route) sehen sonst verschiedene Modulkopien (28.07., 26.08.).

type BilanzZustand = { abonniert: boolean; aktuell: ZyklusBilanz | null };

declare global {
  // eslint-disable-next-line no-var
  var __zyklus_bilanz__: BilanzZustand | undefined;
}

function zustand(): BilanzZustand {
  global.__zyklus_bilanz__ ??= { abonniert: false, aktuell: null };
  return global.__zyklus_bilanz__;
}

export const TAGESSUMME_SCHLUESSEL = (datum: string) => `zyklus:tag:${datum}`;
const TAGESSUMME_TTL = 3 * 24 * 60 * 60;

/** UTC-Datum — das Handelsfenster ist in UTC definiert (Mo–Fr 08–22). */
export function handelstag(jetzt: Date = new Date()): string {
  return jetzt.toISOString().slice(0, 10);
}

/** Einmal am Bus anmelden. Mehrfacher Aufruf ist harmlos. Wirft nie. */
export async function bilanzAbonnieren(): Promise<void> {
  try {
    const z = zustand();
    if (z.abonniert) return;
    const { agentBus } = await import("../agents/agent-bus");
    if (z.abonniert) return;
    z.abonniert = true;

    agentBus.subscribe("CYCLE:STARTED", () => {
      zustand().aktuell = neueBilanz(Date.now());
    });
    for (const typ of ["ANALYSIS:SCAN_DONE", "GATE:DECISION", "EXECUTION:TRADE_OPENED", "EXECUTION:TRADE_FAILED"] as const) {
      agentBus.subscribe(typ, (ev) => {
        const b = zustand().aktuell;
        if (b) bilanzVerbuchen(b, ev);
      });
    }
    agentBus.subscribe("CYCLE:FINISHED", async (ev) => {
      const zz = zustand();
      const b = zz.aktuell;
      zz.aktuell = null;
      if (!b) return;
      b.ende = Date.now();
      b.ausgang = text(ev.payload?.ausgang ?? "unbekannt");
      console.log(bilanzZeile(b));
      try {
        const { cacheGet, cacheSet } = await import("../cache/redis-cache");
        const tag = handelstag();
        const alt = await cacheGet<Tagessumme>(TAGESSUMME_SCHLUESSEL(tag));
        await cacheSet(TAGESSUMME_SCHLUESSEL(tag), tagessummeAddieren(alt, b, tag), TAGESSUMME_TTL);
      } catch (e) {
        console.warn(`[zyklus] Tagessumme nicht gespeichert: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  } catch (e) {
    console.warn(`[zyklus] Bilanz nicht am Bus angemeldet: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Die Tagessumme lesen und als Telegram-Nachricht senden. Wirft nie. */
export async function tagesbilanzSenden(tag: string = handelstag()): Promise<boolean> {
  try {
    const { cacheGet } = await import("../cache/redis-cache");
    const t = (await cacheGet<Tagessumme>(TAGESSUMME_SCHLUESSEL(tag))) ?? leereTagessumme(tag);
    const { sendTelegram } = await import("../telegram-notifications/telegram-sender");
    const nachricht = t.zyklen === 0
      ? `${tagesbilanzText(t)}\n\n⚠️ Heute wurde KEIN Handelszyklus verbucht — lief der Orchestrator?`
      : tagesbilanzText(t);
    return await sendTelegram(nachricht);
  } catch {
    return false;
  }
}
