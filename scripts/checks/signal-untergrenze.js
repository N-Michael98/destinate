// ─────────────────────────────────────────────────────────────────────────────
// Prüfer 13: Untergrenze der Signal-Confidence — ein Regler darf nicht lügen
//
// DER FUND (13.08.). Der Regler "Auto-Approve Threshold" liess Werte von 50 bis
// 99 zu. Bevor ein Signal diesen Regler erreicht, wird es aber schon verworfen:
// die Signalkette verlangt an DREI Stellen `confidence >= 70`. Werte zwischen
// 50 und 69 hatten damit KEINERLEI Wirkung — der Regler zeigte eine
// Einstellmöglichkeit an, die es nicht gab.
//
// Beim Nachprüfen kam derselbe Fehler ein zweites Mal heraus: "Min Signal
// Confidence" liess 30 bis 99 zu, geht aber per Math.max in dieselbe Rechnung
// und kann nur VERSCHÄRFEN. Alles unter 70 wurde ebenso verschluckt.
//
// Dieser Prüfer hält beides zusammen: die Zahl darf nur an EINER Stelle stehen,
// alle Riegel müssen sie benutzen, und beide Regler müssen dort beginnen.
//
// BEWUSST NICHT GESENKT: die 70 tiefer zu legen wäre kein Anzeigefehler mehr,
// sondern mehr Risiko — es würden Signale gehandelt, die das System bisher als
// zu unsicher verworfen hat. Das ist eine Entscheidung des Nutzers.
// ─────────────────────────────────────────────────────────────────────────────

const { read, ladeTsModul } = require("./_lib");

module.exports = function pruefe() {
  const funde = [];
  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  // ── Die Zahl selbst: ausgeführt, nicht nur gelesen ────────────────────────
  const geladen = ladeTsModul("lib/broker-config/broker-config-types.ts");
  if (geladen.fehler) {
    funde.push(geladen.fehler);
    return { titel: "Signal-Untergrenze (nicht ausführbar)", funde };
  }
  const grenze = geladen.exports.MIN_SIGNAL_CONFIDENCE;
  pruefe1("MIN_SIGNAL_CONFIDENCE wird nicht exportiert", typeof grenze === "number", String(grenze));
  if (typeof grenze !== "number") {
    return { titel: "Signal-Untergrenze (nicht ausführbar)", funde };
  }
  // Der Wert selbst ist zusätzlich im Snapshot gesichert; hier nur die Bandbreite,
  // in der er überhaupt sinnvoll sein kann.
  pruefe1("MIN_SIGNAL_CONFIDENCE liegt ausserhalb eines sinnvollen Bereichs",
    grenze >= 50 && grenze <= 95, String(grenze));

  const engine = read("frontend/lib/market-scanner/ai-analysis-engine.ts");
  const agent  = read("frontend/lib/agents/analysis-agent.ts");
  const orch   = read("frontend/lib/agents/orchestrator-agent.ts");
  const ui     = read("frontend/components/SettingsDashboard.tsx");

  // ── KEIN hartes Zahlenliteral mehr im Signalpfad ──────────────────────────
  //
  // Gezählt statt gesucht: die Zahl stand an FÜNF Stellen (drei Entscheidungen,
  // zwei Zähler). Eine einzelne zu ersetzen und die anderen stehen zu lassen
  // wäre schlimmer als vorher — dann liefen zwei verschiedene Grenzen.
  for (const [name, quelle] of [
    ["ai-analysis-engine.ts", engine],
    ["analysis-agent.ts", agent],
  ]) {
    const hart = (quelle.match(/(?:gpt\.)?confidence\s*>=\s*\d+/g) || [])
      .filter((t) => !/MIN_SIGNAL_CONFIDENCE/.test(t));
    pruefe1(`${name}: harte Confidence-Grenze statt MIN_SIGNAL_CONFIDENCE`,
      hart.length === 0, hart.join(", "));
  }

  // Und die Konstante MUSS dort wirklich benutzt werden — sonst wäre "keine
  // harte Zahl" auch dann erfüllt, wenn der Riegel ganz entfernt wurde.
  const nutzungEngine = (engine.match(/MIN_SIGNAL_CONFIDENCE/g) || []).length;
  pruefe1("ai-analysis-engine.ts nutzt die Untergrenze nicht an allen vier Stellen",
    nutzungEngine >= 5, `${nutzungEngine} Vorkommen (1 Import + 4 Stellen erwartet)`);
  pruefe1("analysis-agent.ts filtert nicht mehr gegen die Untergrenze",
    /confidence\s*>=\s*MIN_SIGNAL_CONFIDENCE/.test(agent));

  // Die zwei Riegel, die wirklich entscheiden.
  pruefe1("simulateClaude prüft die Untergrenze nicht",
    /approved:.*confidence >= MIN_SIGNAL_CONFIDENCE/.test(engine));
  pruefe1("goSignal prüft die Untergrenze nicht",
    /&& gpt\.confidence >= MIN_SIGNAL_CONFIDENCE/.test(engine));

  // ── Die Regler dürfen nichts anbieten, was nicht wirkt ────────────────────
  for (const feld of ["autoApproveThreshold", "minConfidenceScore"]) {
    const zeile = ui.split("\n").find((z) => z.includes(`field: "${feld}"`)) || "";
    pruefe1(`Regler ${feld} nicht gefunden`, zeile !== "");
    pruefe1(`Regler ${feld} beginnt unter der Untergrenze — er verspricht Werte ohne Wirkung`,
      /min:\s*MIN_SIGNAL_CONFIDENCE/.test(zeile),
      (zeile.match(/min:\s*[^,]+/) || ["?"])[0]);
  }

  // ── Ein gespeicherter Wert darunter muss AUFFALLEN ────────────────────────
  //
  // Der Regler beginnt jetzt bei 70, aber ein älterer gespeicherter Wert oder
  // ein direkter API-Aufruf kann darunter liegen. Stillschweigend hinnehmen
  // wäre genau der Fehler, der hier behoben wird.
  pruefe1("der Orchestrator meldet einen wirkungslosen Wert nicht",
    /function wirksameApproveSchwelle/.test(orch)
    && /wert < MIN_SIGNAL_CONFIDENCE/.test(orch));
  const nutzungOrch = (orch.match(/wirksameApproveSchwelle\(/g) || []).length;
  pruefe1("nicht alle Stellen im Orchestrator nutzen den wirksamen Wert",
    nutzungOrch >= 3, `${nutzungOrch} (1 Definition + Entscheidung + Logzeile erwartet)`);
  pruefe1("die Logzeile zeigt noch den rohen statt des wirksamen Werts",
    !/autoApprove \$\{settings\.botSettings\.autoApproveThreshold/.test(orch));

  // ══ Die Untergrenze muss NACH der Meta-Anpassung noch gelten (07.09.) ════
  //
  // Die Signalkette verlangt an drei Stellen `confidence >= 70`. Der
  // Meta-Schritt SENKT die Confidence danach aber noch — sein Prompt verlangt
  // ausdruecklich "Confidence < 72 → adjustedConfidence reduzieren" — und das
  // Ergebnis landete unveraendert in `approved`. Im Log vom 04.09. sichtbar:
  //
  //   [orchestrator] 🚫 … EURUSD: Confidence 68 < Schwelle 77
  //
  // Eine 68 haette die Kette gar nicht erreichen duerfen.
  //
  // SCHWERER WOG DER ZWEITE TEIL: `adjustedConfidence` kam UNGEPRUEFT aus der
  // Modellantwort. Fehlte das Feld, stand `undefined` in der Confidence — und
  // der Riegel lautet `if (o.gpt.confidence < threshold)`. `undefined < 77` ist
  // FALSE, das Signal waere also nicht verworfen worden, sondern haette die
  // Freigabeschwelle vollstaendig umgangen. Dieselbe Falle wie `NaN <= 0` beim
  // Kurs-Riegel am 24.08.
  const analyseModul = ladeTsModul("lib/agents/analysis-agent.ts");
  if (analyseModul.fehler) {
    funde.push(`analysis-agent nicht ladbar: ${analyseModul.fehler}`);
  } else if (typeof analyseModul.exports.gepruefteConfidence !== "function") {
    funde.push("gepruefteConfidence wird nicht exportiert — die angepasste "
      + "Confidence bleibt ungeprueft");
  } else {
    const gc = analyseModul.exports.gepruefteConfidence;
    pruefe1("ein brauchbarer Wert wird nicht uebernommen", gc(75, 70) === 75,
      String(gc(75, 70)));
    // DER GEFAEHRLICHE FALL: fehlt das Feld, darf NIE undefined durchkommen.
    for (const [name, roh] of [
      ["fehlend", undefined], ["null", null], ["leer", ""],
      ["NaN", NaN], ["Text", "abc"],
    ]) {
      pruefe1(`unbrauchbare Confidence (${name}) kommt durch — `
        + `\`undefined < Schwelle\` ist FALSE und umgeht den Riegel`,
        gc(roh, 70) === 70, String(gc(roh, 70)));
    }
    pruefe1("eine Zahl als Text wird verworfen", gc("72", 70) === 72,
      String(gc("72", 70)));
    pruefe1("ein Wert ueber 100 wird nicht geklemmt", gc(150, 70) === 100,
      String(gc(150, 70)));
    pruefe1("ein negativer Wert wird nicht geklemmt", gc(-5, 70) === 0,
      String(gc(-5, 70)));
    // Eine echte 0 ist eine MESSUNG, kein fehlender Wert.
    pruefe1("eine echte 0 wird als 'fehlt' behandelt", gc(0, 70) === 0,
      String(gc(0, 70)));
  }

  // Kommentare MUESSEN weg, bevor gezaehlt wird. Beim ersten Lauf am 07.09.
  // schlug diese Pruefung an — weil der Kommentar ueber der korrigierten Zeile
  // die alte Fassung `confidence: meta.adjustedConfidence` zitiert. Genau die
  // Fehlerklasse aus CLAUDE.md: ein Wort im Kommentar ist keine Verwendung.
  const agentQ = read("frontend/lib/agents/analysis-agent.ts")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  pruefe1("die angepasste Confidence wird wieder ungeprueft uebernommen",
    /confidence: angepasst/.test(agentQ)
    && !/confidence: meta\.adjustedConfidence/.test(agentQ),
    "sonst landet undefined in der Confidence");
  pruefe1("die Untergrenze gilt nach der Meta-Anpassung nicht mehr",
    /angepasst < MIN_SIGNAL_CONFIDENCE/.test(agentQ),
    "ein auf 68 gesenktes Signal bliebe sonst in `approved`");

  // ══ DIE ZUORDNUNG DER META-URTEILE (09.09.) ══════════════════════════════
  //
  // DER FUND aus der Kettenkontrolle. Die Meta-Urteile wurden unter
  // `r.symbol` abgelegt und mit `opp.symbol` gesucht — ein EXAKTER
  // Zeichenvergleich. Ein Fehlschlag endet in
  //
  //   if (!meta || !meta.approve)  ->  rejected: "Meta-AI hat abgelehnt"
  //
  // Schreibt das Modell also "EUR/USD" statt "EURUSD", wird der Kandidat
  // VERWORFEN — und im Log steht eine Ablehnung, die nie stattgefunden hat.
  // Eine verfehlte Zuordnung war von einer echten Ablehnung nicht zu
  // unterscheiden.
  //
  // Das Tor ist seit dem Aufladen des Anthropic-Guthabens wieder scharf: am
  // 08.09. fiel die Meta-KI aus und liess im Rueckfall alles durch.
  if (analyseModul.fehler) {
    funde.push("analysis-agent nicht ladbar — die Zuordnung bleibt ungeprueft");
    geprueft++;
  } else if (typeof analyseModul.exports.schluessel !== "function") {
    funde.push("schluessel wird nicht exportiert — die Zuordnung der "
      + "Meta-Urteile bleibt ein exakter Zeichenvergleich");
    geprueft++;
  } else {
    const s = analyseModul.exports.schluessel;
    // Alle Schreibweisen desselben Marktes muessen denselben Schluessel geben.
    for (const [roh, soll] of [
      ["EURUSD", "EURUSD"], ["EUR/USD", "EURUSD"], ["eurusd", "EURUSD"],
      [" EURUSD ", "EURUSD"], ["EUR USD", "EURUSD"], ["eur-usd", "EURUSD"],
      ["XAUUSD", "XAUUSD"], ["NAS100", "NAS100"],
      [null, ""], [undefined, ""], ["", ""],
    ]) {
      pruefe1(`schluessel(${JSON.stringify(roh)}) falsch`, s(roh) === soll,
        `${JSON.stringify(s(roh))} statt ${JSON.stringify(soll)}`);
    }
    // Und VERSCHIEDENE Maerkte duerfen NICHT zusammenfallen — sonst bekaeme
    // ein Symbol das Urteil eines anderen.
    const watchlist = ["NAS100","SPX500","UK100","GER40","DJ30","JPN225",
      "XAUUSD","USOIL","UKOIL","XAGUSD","NATGAS","EURUSD","GBPUSD","USDJPY",
      "USDCHF","AUDUSD","USDCAD","NZDUSD","EURGBP","GBPJPY","EURJPY","BTCUSD",
      "ETHUSD","LTCUSD","XRPUSD","ADAUSD","SOLUSD","DOTUSD","LNKUSD","BNBUSD"];
    const schluesselMenge = new Set(watchlist.map(s));
    pruefe1("zwei verschiedene Maerkte fallen auf denselben Schluessel",
      schluesselMenge.size === watchlist.length,
      `${schluesselMenge.size} Schluessel fuer ${watchlist.length} Symbole`);
    // Beide Seiten muessen ihn benutzen — Ablegen UND Nachschlagen.
    pruefe1("die Meta-Urteile werden ohne Schluessel abgelegt",
      /decisions\.set\(schluessel\(/.test(agentQ));
    pruefe1("die Meta-Urteile werden ohne Schluessel nachgeschlagen",
      /metaDecisions\.get\(schluessel\(opp\.symbol\)\)/.test(agentQ));
    // Und eine verfehlte Zuordnung muss AUFFALLEN, statt als Ablehnung zu enden.
    pruefe1("eine verfehlte Zuordnung wird nicht gemeldet",
      /KEINES passt zu einem Kandidaten/.test(agentQ),
      "sonst sieht sie aus wie eine Ablehnung, die nie stattfand");
  }

  // ══ DER BYPASS-REGLER DARF EBENFALLS NICHT LUEGEN (08.09.) ═══════════════
  //
  // Dieselbe Fehlerklasse wie oben, eine Einstellung weiter. Die Oberflaeche
  // verspricht woertlich "Limit erreicht → trotzdem Trade wenn Score ≥
  // Bypass-Wert". Beide Regler laufen von 70 bis 99, und gerechnet wird
  // `Math.max(baseThreshold, bypassScore)`. Liegt der Bypass UNTER der
  // Freigabe-Schwelle, gilt weiterhin die Schwelle:
  //
  //   autoApprove 90, Bypass 70  ->  es gilt 90, nicht 70
  //   autoApprove 77, Bypass 75  ->  es gilt 77, nicht 75
  //
  // An der Rechnung ist nichts falsch — ein Bypass darf die Freigabe nie
  // aufweichen. Falsch war das Schweigen.
  //
  // AUSGEFUEHRT, nicht gelesen: die echte Funktion wird gerufen.
  // MIT der echten Untergrenze laden. Ohne sie bekommt das Modul den
  // Stellvertreter, und `wirksameMinConfidence` bringt ihn beim Formatieren
  // der Meldung zum Werfen ("keine Aussenwelt im Pruefstand") — der Pruefer
  // stuerzte ab statt zu pruefen. `grenze` stammt aus der echten Datei, die
  // oben schon geladen und geprueft wurde.
  const orchModul = ladeTsModul("lib/agents/orchestrator-agent.ts", {
    "broker-config": { MIN_SIGNAL_CONFIDENCE: grenze },
  });
  if (orchModul.fehler) {
    funde.push(`orchestrator-agent nicht ladbar: ${orchModul.fehler}`);
    geprueft++;
  } else if (typeof orchModul.exports.wirksamerBypass !== "function") {
    funde.push("wirksamerBypass wird nicht exportiert — ein wirkungsloser "
      + "Bypass-Wert bliebe unbemerkt");
    geprueft++;
  } else {
    const wb = orchModul.exports.wirksamerBypass;
    const stilleWarnung = console.warn;
    let warnungen = 0;
    console.warn = () => { warnungen++; };
    try {
      // JEDER Fall wird GENAU EINMAL gerufen und das Ergebnis gemerkt.
      // Die erste Fassung rief `wb(...)` in der Bedingung UND im
      // Meldungstext — also doppelt, und zaehlte damit vier Warnungen statt
      // zwei. Ein Prueffehler, kein Codefehler: wer Warnungen zaehlt, darf
      // die gepruefte Funktion nicht mehrfach aufrufen.
      const e = {
        live:   wb(81, 77),        // der LIVE eingestellte Fall (08.09.)
        knapp:  wb(75, 77),        // Bypass unter der Schwelle
        weit:   wb(70, 90),        // Bypass weit unter der Schwelle
        gleich: wb(80, 80),        // Gleichstand
        ohne:   wb(undefined, 77), // kein Bypass gesetzt
        null_:  wb(0, 77),         // Bypass 0 = ausgeschaltet
      };
      pruefe1("ein Bypass UEBER der Schwelle wirkt nicht", e.live === 81, String(e.live));
      pruefe1("ein Bypass UNTER der Schwelle weicht die Freigabe auf",
        e.knapp === 77, `${e.knapp} statt 77 — der Bypass darf nie lockern`);
      pruefe1("ein weit tieferer Bypass weicht die Freigabe auf", e.weit === 90, String(e.weit));
      pruefe1("Gleichstand wird falsch behandelt", e.gleich === 80, String(e.gleich));
      pruefe1("ohne Bypass gilt nicht die Schwelle", e.ohne === 77, String(e.ohne));
      // 0 heisst "ausgeschaltet" — das ist kein wirkungsloser Regler, sondern
      // eine bewusste Einstellung und darf deshalb NICHT melden.
      pruefe1("ein ausgeschalteter Bypass (0) wird faelschlich gemeldet",
        e.null_ === 77, String(e.null_));
    } finally {
      console.warn = stilleWarnung;
    }
    // Und es muss GEMELDET werden — sonst faellt ein toter Regler nie auf.
    // Erwartet: genau zwei Meldungen (75/77 und 70/90). Gleichstand, "kein
    // Bypass" und 0 duerfen NICHT melden, sonst waere die Warnung Rauschen.
    pruefe1("ein wirkungsloser Bypass wird nicht gemeldet — oder zu oft",
      warnungen === 2, `${warnungen} Meldungen bei 6 Faellen, erwartet 2`);
    // Die Verdrahtung: die Funktion muss auch WIRKLICH gerufen werden.
    pruefe1("der Zyklus benutzt den geprueften Bypass nicht",
      /wirksamerBypass\(bypassScore, baseThreshold\)/.test(orch),
      "sonst rechnet die Funktion, und der Zyklus nimmt weiter Math.max");

    // ══ UND DIE MIN-CONFIDENCE — dritter Regler derselben Klasse (09.09.) ══
    //
    // Am 13.08. wurde BEIDES erkannt: der Regler in der Oberflaeche beginnt
    // seither bei MIN_SIGNAL_CONFIDENCE, weil tiefere Werte in `Math.max`
    // ohnehin verschluckt werden. Die Approve-Schwelle bekam dazu
    // `wirksameApproveSchwelle()` mit Meldung — die Min-Confidence NICHT.
    //
    // Der gespeicherte Wert von damals blieb stehen. Am 09.09. im
    // Einstellungs-Bild sichtbar: der Regler zeigt 69 %, sein Bereich beginnt
    // bei 70. Und im Betriebslog steht er in JEDEM Zyklus:
    //
    //   Confidence 74 < Schwelle 76 (autoApprove 76, minConfidence 69)
    //
    // Er wirkt nicht, und niemand sagt es.
    const wmc = orchModul.exports.wirksameMinConfidence;
    if (typeof wmc !== "function") {
      funde.push("wirksameMinConfidence wird nicht exportiert — ein "
        + "wirkungsloser Min-Confidence-Wert bliebe unbemerkt");
      geprueft++;
    } else {
      const stille2 = console.warn;
      let meldungen = 0;
      console.warn = () => { meldungen++; };
      let w;
      try {
        // Jeder Fall GENAU EINMAL gerufen — sonst zaehlt die Meldung doppelt.
        w = {
          alt:    wmc(69),         // der LIVE gespeicherte Altbestand
          grenze: wmc(70),         // genau die Untergrenze
          hoeher: wmc(80),         // darueber
          aus:    wmc(0),          // nicht gesetzt
          fehlt:  wmc(undefined),  // gar kein Wert
        };
      } finally { console.warn = stille2; }
      pruefe1("der Altbestand 69 wird veraendert statt nur gemeldet",
        w.alt === 69, `${w.alt} — die Rechnung darf sich NICHT aendern`);
      pruefe1("genau die Untergrenze wird faelschlich beanstandet",
        w.grenze === 70, String(w.grenze));
      pruefe1("ein hoeherer Wert wird veraendert", w.hoeher === 80, String(w.hoeher));
      pruefe1("ein nicht gesetzter Wert ergibt nicht 0", w.aus === 0 && w.fehlt === 0,
        `${w.aus} / ${w.fehlt}`);
      // GEMELDET werden darf nur der eine Fall — 0 heisst "nicht gesetzt".
      pruefe1("ein wirkungsloser Min-Confidence-Wert wird nicht gemeldet — oder zu oft",
        meldungen === 1, `${meldungen} Meldungen bei 5 Faellen, erwartet 1`);
      pruefe1("der Zyklus benutzt die gepruefte Min-Confidence nicht",
        /wirksameMinConfidence\(settings\.riskSettings\?\.minConfidenceScore\)/.test(orch),
        "sonst rechnet die Funktion, und der Zyklus nimmt weiter den Rohwert");
    }
  }

  return { titel: `Signal-Untergrenze (${geprueft} Prüfungen, Grenze ${grenze})`, funde };
};
