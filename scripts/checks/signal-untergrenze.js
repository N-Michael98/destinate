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

    // ── Die Auto-Approve-Schwelle selbst: GERECHNET (15.09.) ────────────────
    //
    // Die bindende Schwelle der ganzen Kette — hier stirbt derzeit jedes
    // Signal zwischen 70 und 75 ("Confidence 74 < Schwelle 76"). Bis heute
    // wurde sie nur per Text gesucht: `wert < MIN_SIGNAL_CONFIDENCE`. Der Text
    // steht wortgleich AUCH in `wirksameMinConfidence`. Vorgefuehrt: das
    // Zeichen in dieser Funktion auf `>` gedreht — eine gespeicherte 76 wird
    // still zu 70 — und alle 23 Pruefer blieben gruen.
    const was = orchModul.exports.wirksameApproveSchwelle;
    if (typeof was !== "function") {
      funde.push("wirksameApproveSchwelle wird nicht exportiert — die bindende "
        + "Schwelle der Signalkette waere nur per Text geprueft");
      geprueft++;
    } else {
      const stille3 = console.warn;
      let meldungen3 = 0;
      console.warn = () => { meldungen3++; };
      let s;
      try {
        // Jeder Fall GENAU EINMAL — sonst zaehlt die Meldung doppelt (Lehre 09.09.).
        s = {
          live:    was(76),          // der LIVE-Wert vom 09.09.
          grenze:  was(grenze),      // genau die Untergrenze
          darunter: was(grenze - 1), // wirkungslos -> Untergrenze + Meldung
          tief:    was(50),          // weit darunter
          fehlt:   was(undefined),   // nicht gesetzt -> Standard
        };
      } finally { console.warn = stille3; }
      pruefe1("die gespeicherte Schwelle 76 wird veraendert — sie muss GENAU so gelten",
        s.live === 76, `${s.live} — ein gedrehtes Zeichen macht daraus still ${grenze}`);
      pruefe1("genau die Untergrenze wird veraendert", s.grenze === grenze, String(s.grenze));
      pruefe1("ein Wert unter der Untergrenze wird nicht auf die Untergrenze angehoben",
        s.darunter === grenze && s.tief === grenze, `${s.darunter} / ${s.tief}`);
      pruefe1("ohne gespeicherten Wert gilt nicht der Standard 71",
        s.fehlt === 71, String(s.fehlt));
      pruefe1("ein wirkungsloser Approve-Wert wird nicht gemeldet — oder zu oft",
        meldungen3 === 2, `${meldungen3} Meldungen bei 5 Faellen, erwartet 2 (${grenze - 1} und 50)`);

      // Und die Entscheidung muss BEIDE wirksamen Werte zusammenfuehren —
      // kommentarbereinigt, damit ein Beispiel im Kommentar nicht zaehlt.
      const orchCode = orch
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      pruefe1("die Freigabe-Schwelle fuehrt nicht beide wirksamen Werte zusammen",
        /Math\.max\(\s*wirksameApproveSchwelle\(settings\.botSettings\.autoApproveThreshold\)\s*,\s*wirksameMinConfidence\(settings\.riskSettings\?\.minConfidenceScore\)\s*,?\s*\)/.test(orchCode),
        "sonst gilt nur einer der beiden Regler — der andere luegt");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Die LETZTE Untergrenze der Kette: das Chance-Risiko (15.09.)
  //
  // Die Confidence-Grenze oben ist nicht die einzige Hürde, an der Signale
  // sterben — am 08.09. starben DREI von VIER am R/R-Tor (`rr >= 1.5`), mit
  // gemessenen Werten von 0.52, 0.59 und 0.64. Der Trichter meldete davon nur
  // "→ 0 = GO". Wie weit es war, stand nirgends.
  //
  // `rrVerteilung()` macht daraus eine Zahl. Damit gilt hier dieselbe Regel
  // wie für jeden Regler in dieser Datei: die Zahl darf nicht lügen. Zwei
  // Arten, wie sie lügen könnte, sind konkret vorstellbar:
  //
  //   1. `abGrenze` zählt Signale mit, die AUSSERDEM am Risiko-Score
  //      scheitern. Dann verspricht das Log Trades, die eine tiefere Grenze
  //      gar nicht freigäbe.
  //   2. Jemand verwechselt die Beobachtungsmarke mit der Handelsschwelle und
  //      setzt `approved` auf 1.2. Das wäre kein Anzeigefehler mehr, sondern
  //      gelockertes Risiko — still.
  //
  // Beides wird unten geprüft, das zweite am Quelltext, das erste rechnend.
  // ═══════════════════════════════════════════════════════════════════════════
  const engineModul = ladeTsModul("lib/market-scanner/ai-analysis-engine.ts", {
    // Mit dem ECHTEN Wert, nicht mit dem Stellvertreter: das Modul liest die
    // Konstante beim Laden, und ein Proxy führte hier zum Absturz statt zum
    // Befund (dieselbe Falle wie am 09.09. im Orchestrator-Prüfer).
    "broker-config": { MIN_SIGNAL_CONFIDENCE: grenze },
  });
  if (engineModul.fehler) {
    funde.push(`ai-analysis-engine.ts nicht ausführbar — die R/R-Verteilung `
      + `bleibt ungeprüft: ${engineModul.fehler}`);
    geprueft++;
  } else {
    const rv = engineModul.exports.rrVerteilung;
    if (typeof rv !== "function") {
      funde.push("rrVerteilung wird nicht exportiert — die Verteilung der "
        + "abgelehnten Chance-Risiko-Werte wäre wieder unmessbar");
      geprueft++;
    } else {
      // Leere Menge: KEINE Zeile. Sonst sähe "0 Abgelehnte, Median NaN" wie
      // eine Messung aus — genau der Fehler aus dem Dashboard (0/0).
      pruefe1("eine leere Menge ergibt keine Meldung", rv([], 1.2) === null,
        JSON.stringify(rv([], 1.2)));
      pruefe1("undefined stürzt ab statt null zu ergeben",
        rv(undefined, 1.2) === null);

      // Der gemessene Fall vom 08.09. — hier darf nichts freigegeben werden.
      const echt = rv([
        { symbol: "XRPUSD", rr: 0.52, nurRR: true },
        { symbol: "XAGUSD", rr: 0.59, nurRR: true },
        { symbol: "NAS100", rr: 0.64, nurRR: true },
      ], 1.2);
      pruefe1("der gemessene Fall vom 08.09. wird falsch zusammengefasst",
        echt && echt.anzahl === 3 && echt.median === 0.59 && echt.nurRR === 3
        && echt.abGrenze === 0, JSON.stringify(echt));

      // ── DER KERN: `abGrenze` darf NUR nurRR-Einträge zählen ──────────────
      // Ohne diesen Filter meldete das Log "1 würde freikommen", obwohl das
      // Signal am Risiko-Score hängt und von einer tieferen R/R-Grenze nie
      // profitiert. Eine Hoffnung, die nicht eintritt, ist schlimmer als
      // keine Angabe.
      const gemischt = rv([
        { symbol: "A", rr: 1.40, nurRR: false },  // hoch, aber Score-Problem
        { symbol: "B", rr: 0.50, nurRR: true },
      ], 1.2);
      pruefe1("abGrenze zählt Signale mit, die AUSSERDEM am Risiko-Score scheitern",
        gemischt && gemischt.abGrenze === 0,
        `abGrenze=${gemischt && gemischt.abGrenze}, erwartet 0 — 1.40 liegt über 1.2, `
        + "hilft aber nicht, weil nurRR=false");
      pruefe1("nurRR wird nicht gezählt", gemischt && gemischt.nurRR === 1,
        String(gemischt && gemischt.nurRR));

      // Der Median läuft bewusst über ALLE Abgelehnten — er beschreibt, was
      // das Modell liefert, unabhängig vom Ablehnungsgrund. Würde er nur über
      // nurRR laufen, käme hier 0.50 statt 0.95 heraus.
      pruefe1("der Median läuft nicht über alle Abgelehnten",
        gemischt && gemischt.median === 0.95,
        `${gemischt && gemischt.median} — erwartet 0.95 = (0.50+1.40)/2`);

      // Gerade Anzahl: Mittel der beiden mittleren Werte, nicht "irgendeiner".
      const vier = rv([
        { symbol: "A", rr: 4, nurRR: true }, { symbol: "B", rr: 1, nurRR: true },
        { symbol: "C", rr: 3, nurRR: true }, { symbol: "D", rr: 2, nurRR: true },
      ], 1.2);
      pruefe1("der Median bei gerader Anzahl ist falsch",
        vier && vier.median === 2.5, String(vier && vier.median));
      // Drei, nicht vier: die 1 liegt UNTER 1.2. Genau daran ist diese
      // Erwartung beim Schreiben zuerst gescheitert — die Grenze ist ein
      // `>=`, kein "alle mit nurRR".
      pruefe1("abGrenze zählt bei gerader Anzahl falsch",
        vier && vier.abGrenze === 3, `${vier && vier.abGrenze} — erwartet 3 (die 1 liegt unter 1.2)`);

      // GENAU auf der Marke zählt mit. Ohne diesen Fall bliebe ein `>` statt
      // `>=` unentdeckt — keine der Mengen oben liegt auf der Grenze, und die
      // Lücke fiel erst beim Durchgehen der Sabotage-Liste auf.
      const aufDerMarke = rv([{ symbol: "A", rr: 1.2, nurRR: true }], 1.2);
      pruefe1("ein Wert GENAU auf der Marke wird nicht mitgezählt",
        aufDerMarke && aufDerMarke.abGrenze === 1, String(aufDerMarke && aufDerMarke.abGrenze));

      // Unbrauchbare Zahlen dürfen den Median nicht vergiften. `realesChanceRisiko`
      // gibt bei entarteten Setups 0 zurück, aber eine NaN aus einer anderen
      // Quelle würde sonst jede Aussage der Zeile zerstören.
      const mitMuell = rv([
        { symbol: "A", rr: NaN, nurRR: true },
        { symbol: "B", rr: Infinity, nurRR: true },
        { symbol: "C", rr: 1.0, nurRR: true },
      ], 1.2);
      pruefe1("nicht endliche Werte vergiften den Median",
        mitMuell && mitMuell.anzahl === 1 && mitMuell.median === 1.0,
        JSON.stringify(mitMuell));
      pruefe1("eine Menge aus lauter Unsinn ergibt keine Meldung",
        rv([{ symbol: "A", rr: NaN, nurRR: true }], 1.2) === null);
    }

    // ── Die Beobachtungsmarke darf die Handelsschwelle nicht ersetzen ────────
    //
    // Die Entscheidung heisst `rewardRiskRatio >= 1.5` und steht in
    // `simulateClaude` sowie in der Prompt-Regel. Träte RR_PRUEFGRENZE dort
    // auf, wäre das echte Tor still von 1.5 auf 1.2 gerutscht.
    const ohneKomm = engine
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    const pruefgrenzeStellen = (ohneKomm.match(/RR_PRUEFGRENZE/g) || []).length;
    pruefe1("RR_PRUEFGRENZE fehlt — die Was-wäre-wenn-Marke steht wieder als Literal im Log",
      pruefgrenzeStellen >= 2, `${pruefgrenzeStellen} Vorkommen`);
    // Die ZÄHLUNG muss die Konstante bekommen, nicht nur der Beschriftungstext.
    // Im Sabotage-Lauf ist genau das entwischt: das Literal im Aufruf, die
    // Konstante weiter im Log — Zahl und Beschriftung dürfen auseinanderlaufen,
    // ohne dass ein Vorkommen-Zähler etwas merkt.
    pruefe1("rrVerteilung wird nicht mit RR_PRUEFGRENZE gerufen — "
      + "gezählte und genannte Marke könnten auseinanderlaufen",
      /rrVerteilung\(\s*abgelehnteRR\s*,\s*RR_PRUEFGRENZE\s*\)/.test(ohneKomm));
    pruefe1("RR_PRUEFGRENZE steht in der Entscheidung statt nur im Log — "
      + "damit wäre die Handelsschwelle still gesenkt",
      !/approved[\s\S]{0,200}RR_PRUEFGRENZE/.test(ohneKomm)
      && !/RR_PRUEFGRENZE[\s\S]{0,120}approved/.test(ohneKomm));
    pruefe1("die Handelsschwelle 1.5 ist aus dem Rückfall verschwunden",
      /rrRatio\s*>=\s*1\.5/.test(ohneKomm),
      "simulateClaude muss weiter gegen 1.5 entscheiden");

    // Und die Sammlung muss aus DENSELBEN Bedingungen gespeist werden wie die
    // Ablehnungs-Meldung. Zwei getrennte Rechnungen für dieselbe Frage sind der
    // Weg, auf dem die eine später geändert wird und die andere nicht.
    pruefe1("nurRR wird nicht aus den geprüften Ablehnungsgründen abgeleitet",
      /nurRR:\s*rrZuKlein\s*&&\s*!scoreZuHoch/.test(ohneKomm),
      "sonst kann die Sammlung etwas anderes behaupten als die Zeile darüber");
    pruefe1("die Ablehnungs-Meldung nutzt die abgeleiteten Bedingungen nicht",
      /if\s*\(\s*rrZuKlein\s*\)/.test(ohneKomm) && /if\s*\(\s*scoreZuHoch\s*\)/.test(ohneKomm));
  }

  return { titel: `Signal-Untergrenze (${geprueft} Prüfungen, Grenze ${grenze})`, funde };
};
