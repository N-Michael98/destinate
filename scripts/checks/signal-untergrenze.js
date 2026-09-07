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

  return { titel: `Signal-Untergrenze (${geprueft} Prüfungen, Grenze ${grenze})`, funde };
};
