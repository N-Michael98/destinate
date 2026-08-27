// PRÜFT: Die Zahlen im GPT-Prompt überstehen die Formatierung — durch
// AUSFÜHREN der echten Funktion.
//
// WARUM (27.08.). Die technischen Werte gingen mit `toFixed(2)` in den Prompt.
// Für die grossen FX-Paare, die um 0.6 bis 1.4 notieren, ist das vernichtend:
//
//   EURUSD  ATR 0.0047  ->  "0.00"   GPT sieht NULL
//   USDCHF  ATR 0.0042  ->  "0.00"   GPT sieht NULL
//   AUDUSD  ATR 0.0038  ->  "0.00"   GPT sieht NULL
//   GBPUSD  ATR 0.0055  ->  "0.01"   82 % zu gross
//   USDCAD  ATR 0.0051  ->  "0.01"   96 % zu gross
//   ema20 1.16403 / ema50 1.16201  ->  beide "1.16", nicht unterscheidbar
//
// Der Prompt verlangt genau von diesen Werten die Stop-Platzierung:
// "fall back to roughly 1.5 ATR from entry", "Never place the stop CLOSER than
// 1.5 ATR to entry", "distToRes … measured IN ATR UNITS". Mit ATR = 0.00 ist
// das für diese Paare unbrauchbar — und es fiel nie auf, weil Gold, Indizes
// und Krypto von `toFixed(2)` unberührt bleiben.
//
// WARUM RECHNEND. Eine Struktur-Prüfung sieht nur, DASS formatiert wird. Ob
// ein Wert dabei auf null fällt, zeigt erst der Aufruf mit echten
// Grössenordnungen.
const { read, ladeTsModul } = require("./_lib");

const PFAD = "lib/market-scanner/ai-analysis-engine.ts";

/** Echte Grössenordnungen aus der Watchlist. */
const WERTE = [
  ["EURUSD ATR", 0.0047], ["USDCHF ATR", 0.0042], ["AUDUSD ATR", 0.0038],
  ["GBPUSD ATR", 0.0055], ["NZDUSD ATR", 0.0035], ["USDCAD ATR", 0.0051],
  ["EURJPY ATR", 1.1], ["USDJPY ATR", 0.85], ["XAUUSD ATR", 22.5],
  ["BTCUSD ATR", 1500], ["NAS100 ATR", 180], ["USOIL ATR", 1.35],
  ["EURUSD ema20", 1.16403], ["EURUSD ema50", 1.16201], ["EURUSD bbLower", 1.15803],
  ["XRPUSD Kurs", 1.4523], ["ADAUSD Kurs", 0.6231], ["DOTUSD Kurs", 3.8412],
  ["LTCUSD Kurs", 88.42], ["SPX500 Kurs", 5620.4],
];

module.exports = function pruefe() {
  const funde = [];
  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  const modul = ladeTsModul(PFAD);
  if (modul.fehler) return { titel: "Prompt-Zahlen", funde: [modul.fehler] };
  const z = modul.exports.promptZahl;
  if (typeof z !== "function") {
    return { titel: "Prompt-Zahlen", funde: ["promptZahl wird nicht exportiert — Umbenennung?"] };
  }

  // ── Teil 1: kein Wert darf auf null fallen ────────────────────────────
  for (const [name, w] of WERTE) {
    const s = z(w);
    pruefe1(`"${name}" faellt auf null`, Number(s) !== 0, `${w} -> "${s}"`);
  }

  // ── Teil 2: kein Wert darf an Genauigkeit verlieren ───────────────────
  //
  // Wichtiger als "nicht null": der ausgegebene Text muss den Wert zurueck-
  // liefern. Sonst rechnet GPT mit einer anderen Zahl als das Programm.
  for (const [name, w] of WERTE) {
    const zurueck = Number(z(w));
    pruefe1(`"${name}" verliert Genauigkeit`,
      Math.abs(zurueck - w) <= Math.abs(w) * 1e-9, `${w} -> "${z(w)}"`);
  }

  // ── Teil 3: benachbarte Werte bleiben unterscheidbar ──────────────────
  //
  // ema20 und ema50 lagen bei EURUSD 0.002 auseinander und wurden beide zu
  // "1.16". Ein Modell, das sie vergleichen soll, sieht dann Gleichstand.
  const paare = [
    ["EURUSD ema20/ema50", 1.16403, 1.16201],
    ["USDCHF bb unten/oben", 0.79912, 0.81034],
    ["AUDUSD Kurs/ema20", 0.65213, 0.65198],
  ];
  for (const [name, a, b] of paare) {
    pruefe1(`"${name}" sind nach der Formatierung nicht mehr unterscheidbar`,
      z(a) !== z(b), `beide "${z(a)}"`);
  }

  // ── Teil 4: Randfaelle ────────────────────────────────────────────────
  for (const [name, w, erwartet] of [
    ["null", null, "?"], ["undefined", undefined, "?"],
    ["NaN", NaN, "?"], ["Infinity", Infinity, "?"], ["-Infinity", -Infinity, "?"],
  ]) {
    pruefe1(`Randfall ${name} liefert nicht "?"`, z(w) === erwartet, `-> ${JSON.stringify(z(w))}`);
  }
  pruefe1("negative Werte werden nicht formatiert",
    z(-0.0047) === "-0.004700", `-> "${z(-0.0047)}"`);

  // ── Teil 5: die Verdrahtung — wird sie im Prompt auch BENUTZT? ────────
  //
  // Eine tadellose Funktion nuetzt nichts, wenn der Prompt weiter toFixed(2)
  // schreibt. Kommentare raus: `toFixed(2)` steht auch in der Erklaerung.
  const quelle = read(`frontend/${PFAD}`)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  for (const feld of ["ema20=", "ema50=", "atr=", "ema200=", "bb=["]) {
    const i = quelle.indexOf(feld);
    pruefe1(`Prompt-Feld ${feld} nicht gefunden`, i >= 0);
    if (i >= 0) {
      const abschnitt = quelle.slice(i, i + 60);
      pruefe1(`Prompt-Feld ${feld} benutzt weiter toFixed(2) statt promptZahl`,
        !/toFixed\(2\)/.test(abschnitt), abschnitt.replace(/\s+/g, " ").slice(0, 55));
    }
  }

  return {
    titel: `Prompt-Zahlen (${geprueft} Rechnungen, echte Funktion)`,
    funde,
  };
};
