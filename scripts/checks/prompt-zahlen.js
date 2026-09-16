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
  // Seit 16.09. steht die Entscheidung in `claudeFragen()` (rechnend geprueft
  // in signal-untergrenze: `hatSchluessel=false` -> "KEIN_SCHLUESSEL"). Hier
  // wird die Verdrahtung gesichert: der Zaehler haengt an GENAU diesem Grund,
  // und der Ausfall-Zaehler steht nicht an seiner Stelle. Kommentarbereinigt,
  // weil die Begruendung oben beide Namen nennt.
  const quellOhneKomm = quell
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  pruefe1("der Zweig 'kein Schluessel' zaehlt nicht mehr getrennt",
    /if \(claudeWeg === "KEIN_SCHLUESSEL"\) ohneClaudeKeinSchluessel\+\+;/.test(quellOhneKomm)
    && !/claudeWeg === "KEIN_SCHLUESSEL"\) ohneClaudeAusfall/.test(quellOhneKomm)
    && /if \(!s\.hatSchluessel\) return "KEIN_SCHLUESSEL";/.test(quellOhneKomm));
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
  // ══ DER ZWEIG DANEBEN — dritter Anlauf (08.09.) ═════════════════════════
  //
  // Am 07.09. wurde `riskScore ?? 50` fuer den Fall behoben, dass Claude NICHT
  // antwortet. Im Zweig daneben — Claude ANTWORTET, aber unlesbar oder
  // unvollstaendig — stand die Zeile weiter. `parseJSON` faellt dort auf `{}`,
  // und damit galt:
  //
  //   riskScore = 50
  //   approved: 50 < 60 && rr >= 1.5   -> das Risiko-Tor faellt WEG
  //   source: "CLAUDE_REAL"            -> obwohl nichts Lesbares kam
  //
  // Das ist das DRITTE Mal, dass diese Fehlerklasse an einer Nachbarstelle
  // ueberlebt hat (01.09., 07.09., 08.09.). Deshalb wird jetzt geprueft, dass
  // die Zahl NIRGENDS mehr per `?? 50` entsteht.
  pruefe1("ein unlesbares Claude-Urteil erfindet wieder einen Risiko-Wert",
    !/riskScore\s*(=|\?\?)\s*(parsed\.riskScore\s*)?\?\?\s*50/.test(ohneKomm)
    && !/parsed\.riskScore \?\? 50/.test(ohneKomm),
    "`50 < 60` ist wahr — das Tor faellt still weg");
  pruefe1("ein fehlender riskScore fuehrt nicht auf das Ersatzurteil",
    /risikoBrauchbar[\s\S]{0,400}?claude = simulateClaude\(gpt, market\)/.test(ohneKomm),
    "sonst traegt eine Nicht-Beurteilung das Etikett CLAUDE_REAL");
  // `null` ist der gefaehrlichste Wert: Number(null) ist 0, und 0 < 60 ist wahr.
  pruefe1("die Pruefung des riskScore laesst null durch",
    /typeof rohRisiko === "number" && Number\.isFinite\(rohRisiko\)/.test(ohneKomm),
    "Number(null) ist 0 — eine reine Endlichkeitspruefung reicht nicht");

  // ── Eine abgeschnittene Antwort ist KEIN Urteil ─────────────────────────
  //
  // Die Logzeile sagte "zaehlt als Ablehnung" — und danach wurde der
  // abgeschnittene Text trotzdem zurueckgegeben. Ueber `?? 50` wurde daraus
  // eine FREIGABE. Eine Meldung, die etwas behauptet, das der Code nicht tut.
  // ENG ANGEBUNDEN. Die erste Fassung erlaubte 400 Zeichen zwischen der
  // Meldung und `return null;` — und fand im Sabotage-Lauf das `return null;`
  // des catch-Blocks weiter unten. Der Riegel liess sich also entfernen, ohne
  // dass etwas rot wurde. Jetzt muss die Rueckgabe UNMITTELBAR auf die
  // Meldung folgen.
  pruefe1("eine abgeschnittene Claude-Antwort wird wieder weitergereicht",
    /Grenze erhöhen\.\"\);\s*return null;/.test(ohneKomm),
    "sie muss verworfen werden, nicht bewertet");
  pruefe1("die Abschneide-Meldung behauptet wieder eine Ablehnung",
    !/zählt als Ablehnung/.test(ohneKomm),
    "der Code lehnte nicht ab, er gab frei");

  pruefe1("die Ausfall-Meldung verweist nicht auf den echten Grund",
    /Grund `\s*\n?\s*\+ `steht in den ⛔-Zeilen|steht in den ⛔-Zeilen/.test(ausfallBlock),
    "HTTP-Status und Antworttext stehen dort und sollen nicht neu erfunden werden");

  // ══ DER HANDELSSTIL WIRD GEPRUEFT, NICHT UMGETYPT (15.09.) ═══════════════
  //
  // Bis heute: `(gptData.tradingStyle ?? "DAYTRADING") as …`. `as` prueft
  // nichts. Ein "DAY_TRADING" oder "INTRADAY" lief bis in die Ausfuehrung und
  // traf dort drei Rueckfaelle, die ihn verschluckten — darunter das
  // Stil-Limit `?? 999` im Orchestrator, also eine OFFENE Grenze. Ein fehlender
  // Stil wurde zu DAYTRADING erfunden und als bekannt gespeichert.
  //
  // Entscheidung des Nutzers: offensichtlich dasselbe Wort vereinheitlichen,
  // alles andere wird WAIT. GERECHNET, weil eine Normalisierung in jeder
  // Fassung plausibel aussieht — ob "INTRADAY" durchrutscht, sagt nur der Aufruf.
  const stilRoh = modul.exports.normalisiereStil;
  // Ein Wurf ist ein BEFUND, kein Absturz des Pruefers (Lehre vom 15.09.:
  // `null.replace` riss einen ganzen Pruefer mit, rot aus dem falschen Grund).
  const stilFn = (r) => { try { return stilRoh(r); } catch (e) { return `WIRFT(${e.message})`; } };
  if (typeof stilRoh !== "function") {
    pruefe1("normalisiereStil wird nicht exportiert — der Handelsstil waere wieder ungeprueft", false);
  } else {
    const gleich = [
      ["DAYTRADING", "DAYTRADING"], ["daytrading", "DAYTRADING"], ["Day Trading", "DAYTRADING"],
      ["day_trading", "DAYTRADING"], ["DAY-TRADING", "DAYTRADING"], [" DayTrading ", "DAYTRADING"],
      ["SCALPING", "SCALPING"], ["scalping", "SCALPING"],
      ["SWING", "SWING"], ["Swing", "SWING"], ["Swing Trading", "SWING"], ["swing_trading", "SWING"],
    ];
    const falschZugeordnet = gleich.filter(([roh, soll]) => stilFn(roh) !== soll);
    pruefe1("eine gueltige Schreibweise wird nicht erkannt — ein echtes Signal ginge verloren",
      falschZugeordnet.length === 0,
      falschZugeordnet.map(([r, s]) => `${JSON.stringify(r)} -> ${stilFn(r)} statt ${s}`).join(", "));

    // Was NICHT dasselbe Wort ist, darf nicht zugeordnet werden — sonst wird
    // wieder geraten, nur an anderer Stelle.
    const fremd = ["INTRADAY", "POSITION", "SCALP", "DAY", "SWINGS", "DAYTRADE",
      "DAYTRADINGX", "SCALPINGSWING", "", "   ", null, undefined, 42, {}, ["SWING"]];
    const geraten = fremd.filter((r) => stilFn(r) !== null);
    pruefe1("ein unbekannter oder fehlender Stil wird einem gueltigen zugeordnet — das ist Raten",
      geraten.length === 0,
      geraten.map((r) => `${JSON.stringify(r)} -> ${stilFn(r)}`).join(", "));
  }

  // Und die Pruefung muss an DER Stelle stehen, an der GPT-Rohdaten zum Signal
  // werden — kommentarbereinigt, weil der Kopfkommentar das alte Muster zitiert.
  pruefe1("der GPT-Zweig benutzt die Stil-Pruefung nicht",
    /const stil = normalisiereStil\(gptData\.tradingStyle\)/.test(ohneKomm));
  pruefe1("irgendwo wird der GPT-Stil wieder roh umgetypt",
    !/gptData\.tradingStyle\s*\?\?\s*"/.test(ohneKomm)
    && !/\(gptData\.tradingStyle[^)]*\)\s*as\s/.test(ohneKomm),
    "genau dieses Muster war der Fehler");
  const stilBlock = (ohneKomm.match(/if \(stil === null && gpt\.direction !== "WAIT"\) \{[\s\S]{0,900}?\n      \}/) || [""])[0];
  pruefe1("ein unbekannter Stil setzt das Signal nicht auf WAIT",
    stilBlock !== "" && /direction: "WAIT"/.test(stilBlock) && /confidence: 0/.test(stilBlock),
    "sonst laeuft er mit Platzhalter-Stil in die Ausfuehrung");
  pruefe1("ein verworfener Stil wird nicht benannt geloggt",
    /console\.log\(/.test(stilBlock),
    "ohne Zeile ist die Wirkung auf die Trade-Zahl unsichtbar");
  // Der Konsens darf ein wegen Stil verworfenes Signal nicht wiederbeleben —
  // er wuerde dann gegen die Richtung handeln, die GPT genannt hatte
  // (Entscheidung 04.08.: nur "wenn GPT nicht widerspricht").
  pruefe1("ein stil-verworfenes Signal wird nicht als solches markiert",
    /stilVerworfen = true;/.test(stilBlock));
  pruefe1("der gemessene Konsens kann ein stil- oder richtungs-verworfenes Signal uebernehmen — "
    + "er wuerde gegen GPTs Antwort handeln",
    /if \(gpt\.direction === "WAIT" && !stilVerworfen && !richtungUnbekannt && ta && ta\.atr > 0\)/.test(ohneKomm));

  // ══ DIE RICHTUNG WIRD GEPRUEFT, NICHT UMGETYPT (16.09.) ════════════════════
  // `direction: gptData.direction as …` — mehrere Stellen fragen
  // `direction === "BUY" ? … : …` und behandeln damit JEDEN anderen Wert als
  // SELL. Ein "LONG" lief bis heute als halber Verkauf weiter.
  pruefe1("die GPT-Richtung wird nicht geprueft",
    /const richtung = normalisiereRichtung\(gptData\.direction\);/.test(ohneKomm)
    && /direction: richtung \?\? "WAIT",/.test(ohneKomm)
    && !/direction: gptData\.direction as/.test(ohneKomm));
  const rBlock = (ohneKomm.match(/if \(richtung === null\) \{[\s\S]{0,700}?\n      \}/) || [""])[0];
  pruefe1("eine unbekannte Richtung wird nicht verworfen, benannt und markiert",
    rBlock !== "" && /console\.log\(/.test(rBlock) && /richtungUnbekannt = true;/.test(rBlock)
    && /confidence: 0/.test(rBlock),
    "sonst traegt ein WAIT die Confidence einer Richtung, die es nie gab");
  pruefe1("die Richtungspruefung steht nicht VOR der Stil-Pruefung",
    ohneKomm.indexOf("if (richtung === null) {") > 0
    && ohneKomm.indexOf("if (richtung === null) {") < ohneKomm.indexOf("if (stil === null && gpt.direction !== \"WAIT\") {"),
    "ein Stil ist bei unbekannter Richtung bedeutungslos");

  // ══ GPT GEGEN DEN EIGENEN PROMPT — GEZAEHLT (16.09.) ══════════════════════
  //
  // Am 16.09. in EINEM Zyklus: BUY bei 1D bearish, BUY an der Resistance, WAIT
  // bei "at support + 1D bullish" (laut Prompt ein Lehrbuch-BUY). Damit eine
  // Prompt-Aenderung auf Zahlen statt auf einem Einzelfall beruht, zaehlt
  // `gptRegelbrueche()` das in jedem Zyklus. Gerechnet, weil die Regeln des
  // Prompts ein ODER enthalten ("trend=BULLISH OR signal=BUY") — ein UND an
  // dieser Stelle saehe plausibel aus und zaehlte falsch.
  const rb = modul.exports.gptRegelbrueche;
  const nr = modul.exports.normalisiereRichtung;
  if (typeof rb !== "function" || typeof nr !== "function") {
    pruefe1("gptRegelbrueche / normalisiereRichtung nicht exportiert — GPTs Regelbrueche waeren unzaehlbar", false);
  } else {
    const r = (e) => { try { return rb(e).slice().sort().join("|"); } catch (x) { return `WIRFT(${x.message})`; } };
    const faelle = [
      [{ richtung: "BUY", trend: "BEARISH", signal: "NEUTRAL" }, "BUY ohne bullishen 1D-Trend/Signal", "BUY bei 1D bearish ohne Kaufsignal"],
      [{ richtung: "BUY", trend: "BEARISH", signal: "BUY" }, "", "ODER-Regel: Kaufsignal genuegt"],
      [{ richtung: "BUY", trend: "BEARISH", signal: "STRONG_BUY" }, "", "ODER-Regel: starkes Kaufsignal genuegt"],
      [{ richtung: "BUY", trend: "NEUTRAL", signal: "NEUTRAL" }, "BUY ohne bullishen 1D-Trend/Signal", "neutral ist nicht bullish"],
      [{ richtung: "BUY", trend: "BULLISH", distRes: 0.5 }, "BUY an Resistance", "an der Resistance"],
      [{ richtung: "BUY", trend: "BULLISH", distRes: 1.0 }, "", "genau 1.0 ATR ist nicht 'nahe' (Prompt: strictly below 1.0)"],
      [{ richtung: "BUY", trend: "BULLISH", distRes: -0.1 }, "", "negativer Abstand zaehlt nicht"],
      [{ richtung: "BUY", trend: "BULLISH", distRes: NaN }, "", "unbrauchbarer Abstand zaehlt nicht"],
      [{ richtung: "SELL", trend: "BULLISH", signal: "NEUTRAL", distSup: 0.2 }, "SELL an Support|SELL ohne bearishen 1D-Trend/Signal", "beide SELL-Brueche"],
      [{ richtung: "SELL", trend: "BULLISH", signal: "SELL" }, "", "ODER-Regel: Verkaufssignal genuegt"],
      // Im Sabotage-Lauf entwischt: fuer BUY gab es den STRONG-Fall, fuer SELL nicht.
      [{ richtung: "SELL", trend: "BULLISH", signal: "STRONG_SELL" }, "", "ODER-Regel: starkes Verkaufssignal genuegt"],
      [{ richtung: "WAIT", trend: "BULLISH", distSup: 0.3 }, "WAIT trotz Lehrbuch-BUY (Hinweis)", "Lehrbuch-BUY"],
      [{ richtung: "WAIT", trend: "BEARISH", distRes: 0.3 }, "WAIT trotz Lehrbuch-SELL (Hinweis)", "Lehrbuch-SELL"],
      [{ richtung: "WAIT", trend: "BEARISH", distSup: 0.3 }, "", "Support bei bearishem Trend ist kein Lehrbuch-BUY"],
      [{ richtung: "buy", trend: "BULLISH" }, "", "Kleinschreibung ist dasselbe Wort"],
      [{ richtung: "LONG", trend: "BULLISH" }, "Richtung unbekannt", "LONG ist ein anderes Wort"],
      [{ richtung: undefined }, "Richtung unbekannt", "fehlende Richtung"],
      [{ richtung: "BUY", trend: "", signal: "" }, "", "ohne TA-Daten kein Trend-Bruch behaupten"],
    ];
    const falsch = faelle.filter(([e, soll]) => r(e) !== soll);
    pruefe1("die GPT-Regelbrueche werden falsch gezaehlt",
      falsch.length === 0,
      falsch.map(([e, soll, was]) => `${was}: ${r(e) || "(keiner)"} statt ${soll || "(keiner)"}`).join(" ; "));
    const nrs = (x) => { try { return nr(x); } catch { return "WIRFT"; } };
    pruefe1("die Richtung wird falsch vereinheitlicht",
      nrs(" sell ") === "SELL" && nrs("Wait") === "WAIT" && nrs("BUY") === "BUY"
      && nrs("LONG") === null && nrs("") === null && nrs(5) === null && nrs(null) === null);

    // Die Messdaten haengen UNSICHTBAR am Ergebnis — die Route serialisiert es.
    const sdv = modul.exports.scanDatenVon;
    const arr = [{ symbol: "X" }];
    Object.defineProperty(arr, Symbol.for("zyklus-bilanz.scan"), { value: { maerkte: 1 }, enumerable: false });
    pruefe1("die Scan-Messdaten sind nicht lesbar oder gehen in die Routen-Antwort",
      typeof sdv === "function" && sdv(arr)?.maerkte === 1 && !JSON.stringify(arr).includes("maerkte")
      && sdv([]) === null && sdv(null) === null);
  }

  // Verdrahtung in der Engine (kommentarbereinigt):
  pruefe1("die Regelbrueche werden nicht aus GPTs ROHER Antwort gezaehlt",
    /for \(const bruch of gptRegelbrueche\(\{\s*richtung: gptData\.direction,/.test(ohneKomm)
    && ohneKomm.indexOf("gptRegelbrueche({") < ohneKomm.indexOf("const stil = normalisiereStil(gptData.tradingStyle)"),
    "nach Veto oder Stil-Pruefung waere die Richtung schon WAIT — gemessen wuerde nichts");
  pruefe1("Vetos, Stil-Verwerfungen oder Claude-Aufrufe werden nicht gezaehlt",
    /if \(blockReason\) \{\s*vetoZahl\+\+;/.test(ohneKomm)
    && /stilVerworfen = true;\s*stilVerworfenZahl\+\+;/.test(ohneKomm)
    && /claudeGefragt\+\+;\s*const claudeBeginn = Date\.now\(\);\s*let raw = await callClaude\(/.test(ohneKomm));
  pruefe1("die Messdaten werden nicht unsichtbar ans Ergebnis gehaengt",
    /Object\.defineProperty\(ergebnis, SCAN_DATEN, \{ value: scanDaten, enumerable: false \}\)/.test(ohneKomm)
    && /return ergebnis;/.test(ohneKomm));
  const agentQuelle = read("frontend/lib/agents/analysis-agent.ts")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  pruefe1("der Scan wird nicht an die Zyklus-Bilanz gemeldet",
    /const scan = scanDatenVon\(opportunities\);/.test(agentQuelle)
    && /type: "ANALYSIS:SCAN_DONE"/.test(agentQuelle));
  pruefe1("die Engine meldet den Scan selbst — dann zaehlten auch Dashboard-Scans",
    !/ANALYSIS:SCAN_DONE/.test(ohneKomm),
    "die Engine laeuft auch fuer /api/market-scanner");
  const metaMeldungen = (agentQuelle.match(/gate: "Meta-KI"/g) || []).length;
  pruefe1("nicht jedes Urteil der Meta-KI geht an den Bus",
    metaMeldungen === 3, `${metaMeldungen} Meldestellen, erwartet 3 (abgelehnt, unter Untergrenze, freigegeben)`);

  return {
    titel: `Prompt-Zahlen (${geprueft} Rechnungen, echte Funktion)`,
    funde,
  };
};
