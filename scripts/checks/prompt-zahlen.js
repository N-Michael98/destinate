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

  // ── Teil 4: Platz für die Sammel-Antwort (06.09.) ────────────────────────
  //
  // Hier stand `max_tokens: 4000` mit dem Kommentar "für ALLE ~22 Märkte
  // (Testphase)". Die Watchlist hat DREISSIG Märkte, und der Wert wurde nie
  // mitgezogen. Gemessen am 06.09.: 9654 Zeichen Antwort für 30 Märkte
  // (~2600 Token) — schon in Sichtweite der Grenze.
  //
  // Reisst die Antwort die Grenze, schneidet OpenAI sie mitten im JSON ab,
  // `parseJSON` fällt auf die leere Liste zurück, und im Log steht
  // "→ 0 Opportunities" — genau wie bei einem Modell, das nichts findet. Diese
  // beiden Ursachen MUESSEN unterscheidbar bleiben, sonst sucht man beim
  // nächsten Stillstand wieder tagelang.
  const tb = modul.exports.tokenBudget;
  if (typeof tb !== "function") {
    funde.push("tokenBudget wird nicht exportiert — der Platz für die "
      + "Sammel-Antwort bleibt ungeprüft");
  } else {
    pruefe1("der Platz waechst nicht mit der Zahl der Maerkte",
      tb(30) > tb(22), `30 -> ${tb(30)}, 22 -> ${tb(22)}`);
    pruefe1("bei 30 Maerkten ist der Platz nicht mindestens doppelt so gross "
      + "wie die gemessenen ~2600 Token",
      tb(30) >= 5200, String(tb(30)));
    pruefe1("der Platz faellt unter den frueheren Festwert 4000",
      tb(0) >= 4000 && tb(1) >= 4000 && tb(30) >= 4000,
      `${tb(0)} / ${tb(1)} / ${tb(30)}`);
    pruefe1("der Platz ueberschreitet die Ausgabegrenze der GPT-4o-Familie",
      tb(1000) <= 16000, String(tb(1000)));
    pruefe1("unsinnige Eingaben ergeben keinen brauchbaren Wert",
      tb(NaN) === 4000 && tb(-5) === 4000 && tb(Infinity) <= 16000,
      `${tb(NaN)} / ${tb(-5)} / ${tb(Infinity)}`);
  }

  // Strukturell: der abgeleitete Wert muss auch ANKOMMEN, und ein Abschneiden
  // muss auffallen. Ohne diese beiden Zeilen waere die Rechnung oben folgenlos.
  const quell = read(`frontend/${PFAD}`);
  pruefe1("der abgeleitete Platz kommt nicht beim Aufruf an",
    /max_tokens: maxTokens/.test(quell)
    && /tokenBudget\(validMarkets\.length\)/.test(quell),
    "sonst rechnet die Funktion, und der Aufruf nimmt weiter einen Festwert");
  pruefe1("ein abgeschnittenes GPT-Urteil bleibt unbemerkt",
    /finish_reason === "length"/.test(quell),
    "abgeschnitten sieht dann aus wie 'nichts gefunden'");
  pruefe1("ein abgeschnittenes Claude-Urteil bleibt unbemerkt",
    /stop_reason \?\? ""\) === "max_tokens"/.test(quell),
    "eine abgerissene Begruendung zaehlt sonst als Ablehnung");

  // ── Teil 5: eine Modell-Sperre darf die Analyse nicht schwaerzen (07.09.) ─
  //
  // GEMESSEN am 07.09., direkt nach der Umstellung auf die konfigurierten
  // Modelle:
  //
  //   🎯 Scan nutzt die konfigurierten Modelle: gpt-4o / claude-sonnet-4-6
  //   ⛔ GPT HTTP 403: Project `proj_…` does not have access to model `gpt-4o`
  //   GPT-Batch: KEINE ANTWORT → 0 Opportunities
  //   Trichter: 30 Märkte → … → Richtung≠WAIT 0 → 0 = GO
  //
  // Das Netz dafuer EXISTIERTE, mit genau diesem Versprechen im Kommentar —
  // aber die Bedingung `scanGptModel !== ai.openai.model` feuerte NUR, wenn das
  // guenstige Modell benutzt worden war. Im Ernstfall war es abgeschaltet.
  pruefe1("das GPT-Netz greift wieder nur in eine Richtung",
    /const zweitModell = scanGptModel === ai\.openai\.model/.test(quell)
    && /zweitModell !== scanGptModel/.test(quell),
    "eine gesperrte Modellwahl schwaerzt sonst jeden Zyklus");
  pruefe1("es steht nicht im Log, wenn das ZWEITE Modell geantwortet hat",
    /Die Analyse läuft mit \$\{zweitModell\}/.test(quell),
    "sonst sieht man oben 'nutzt die konfigurierten Modelle' und glaubt es");
  pruefe1("fuer Claude gibt es gar kein Netz",
    /const zweitClaude = scanClaudeModel === ai\.anthropic\.model/.test(quell)
    && /zweitClaude !== scanClaudeModel/.test(quell));

  // Und der schwerere Teil: was, wenn BEIDE nicht antworten.
  pruefe1("ein ausgefallener Claude-Aufruf erfindet wieder einen Risiko-Wert",
    /if \(raw === null\)[\s\S]{0,1800}?claude = simulateClaude\(gpt, market\);/.test(quell),
    "`riskScore ?? 50` liess das Risiko-Tor still wegfallen (50 < 60 ist wahr)");
  pruefe1("ein ausgefallener Claude-Aufruf traegt wieder das Etikett CLAUDE_REAL",
    /if \(raw === null\)[\s\S]*?\} else \{[\s\S]{0,600}?source: "CLAUDE_REAL"/.test(quell),
    "dieselbe Luege, die am 01.09. fuer simulateClaude behoben wurde");
  // NICHT einfach `/ohneClaude\+\+/` — den Ausdruck gibt es auch im Zweig
  // "kein Claude-Schluessel". Im Sabotage-Lauf vom 07.09. rutschte "Zaehlung
  // entfernt" damit durch: der Pruefer fand die ANDERE Fundstelle. Dieselbe
  // Fehlerklasse, vor der CLAUDE.md warnt — geprueft wird jetzt IM Block.
  pruefe1("der Ausfall wird nicht gezaehlt und nicht gemeldet",
    /if \(raw === null\)[\s\S]{0,1800}?Claude hat nicht geantwortet[\s\S]{0,400}?ohneClaudeAusfall\+\+/
      .test(quell),
    "ohne Zaehlung faellt ein dauerhafter Claude-Ausfall nicht auf");

  // ── Die URSACHE darf nicht erfunden werden (08.09.) ──────────────────────
  //
  // Beide Faelle liefen in EINEN Zaehler `ohneClaude`, und die Zusammenfassung
  // endete pauschal mit „Kein Anthropic-Schluessel hinterlegt." Im Betriebslog
  // vom 08.09. 17:21 stand genau das — waehrend drei Zeilen darueber der echte
  // Grund stand: `Claude HTTP 400 … "Your credit balance is too low"`.
  //
  // Ein 400 wegen Guthaben BEWEIST, dass der Schluessel da ist; ohne Schluessel
  // kaeme man nicht bis zur Abrechnung. Die Meldung schickte also auf die Suche
  // nach einer fehlenden Umgebungsvariable. Dieselbe Fehlerklasse wie in
  // CLAUDE.md: eine Diagnose, die eine Ursache behauptet, die sie nicht
  // gemessen hat.
  pruefe1("Ausfall und fehlender Schluessel laufen wieder in EINEN Zaehler",
    /ohneClaudeKeinSchluessel/.test(quell) && /ohneClaudeAusfall/.test(quell),
    "dann behauptet die Meldung eine Ursache, die sie nicht kennt");
  pruefe1("der Zweig 'kein Schluessel' zaehlt nicht mehr getrennt",
    /!hasClaude[\s\S]{0,120}?ohneClaudeKeinSchluessel\+\+/.test(quell));
  // Und die Meldung selbst: der Ausfall-Fall darf NICHT behaupten, der
  // Schluessel fehle. Kommentare vorher weg — die Begruendung oben zitiert den
  // alten Wortlaut, und ein Pruefer, der seine eigene Erklaerung findet, prueft
  // nichts (CLAUDE.md, sechsmal zugeschlagen).
  const ohneKomm = quell
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const ausfallBlock = (ohneKomm.match(
    /if \(ohneClaudeAusfall > 0\)[\s\S]{0,700}?\n  \}/) || [""])[0];
  pruefe1("die Ausfall-Meldung behauptet weiterhin einen fehlenden Schluessel",
    ausfallBlock !== "" && !/Kein Anthropic-Schl/.test(ausfallBlock),
    "der Schluessel IST hinterlegt, wenn der Aufruf mit 400 scheitert");
  pruefe1("die Ausfall-Meldung verweist nicht auf den echten Grund",
    /Grund `\s*\n?\s*\+ `steht in den ⛔-Zeilen|steht in den ⛔-Zeilen/.test(ausfallBlock),
    "HTTP-Status und Antworttext stehen dort und sollen nicht neu erfunden werden");

  return {
    titel: `Prompt-Zahlen (${geprueft} Rechnungen, echte Funktion)`,
    funde,
  };
};
