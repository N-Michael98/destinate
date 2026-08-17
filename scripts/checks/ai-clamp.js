// PRÜFT: Die AI kann die Risiko-Werte nicht ausser Grenzen setzen — und sie
//        bekommt die Zahlen, die auf ihrem Etikett stehen.
//
// WARUM: Seit dem 03.08. darf der AI Manager Breakeven-Puffer,
// Trailing-Abstand und Teilgewinn-Anteil am Markt ausrichten. Ohne Klemme
// könnte eine einzige Ausreisser-Antwort (etwa Trailing 50× ATR = praktisch
// kein Stop) den Schutz aushebeln.
//
// UMGEBAUT AM 11.08. — der Prüfer prüfte sich selbst. Teil 2 enthielt eine
// KOPIE von inGrenzen und rechnete diese Kopie gegen bösartige Eingaben durch.
// Nachgewiesen: die echte Klemme liess sich auf `return n;` reduzieren, also
// vollständig entfernen, und der Prüfer blieb grün. Ein Nachbau driftet
// auseinander und verschweigt genau das, was er sichern soll. Jetzt wird die
// ECHTE Funktion geladen und aufgerufen.
//
// Teil 3 ist neu (Fund 11.08.): der Prompt schrieb "Fortschritt Richtung Ziel"
// und bekam profitPct — die blosse Kursbewegung. Gemessen im Moment des
// Breakeven lag das je nach Markt um Faktor 5,9 (UKOIL) bis 103,8 (EURGBP)
// daneben. Die AI soll beurteilen, ob eine Position weit genug ist, und
// bekam dafür eine Zahl, die etwas anderes bedeutete.
const { read, ladeTsModul } = require("./_lib");

module.exports = function pruefe() {
  const funde = [];
  const risk = read("frontend/lib/agents/risk-agent.ts");
  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  // ── Teil 1: Ist die Klemme da und wird sie überall angewendet? ────────────
  if (!/function inGrenzen\(/.test(risk)) {
    funde.push("risk-agent.ts: Funktion 'inGrenzen' fehlt — AI-Werte ungeklemmt");
  }
  for (const feld of ["adjustedBeBuffer", "adjustedAtrFactor", "adjustedPartialRatio"]) {
    const re = new RegExp(`inGrenzen\\(roh\\.${feld}`);
    if (!re.test(risk)) funde.push(`risk-agent.ts: ${feld} läuft nicht durch inGrenzen`);
  }
  for (const g of ["beBuffer", "atrFactor", "partialRatio"]) {
    if (!new RegExp(`${g}:\\s*\\{\\s*min:`).test(risk)) {
      funde.push(`risk-agent.ts: Grenzwerte für ${g} fehlen`);
    }
  }
  // Ein von der AI angepasster Trail darf nie lockerer sein als der Regelwert.
  if (!/kandidatOk/.test(risk)) {
    funde.push("risk-agent.ts: 'kandidatOk' fehlt — AI-Trail wird ohne Gegenprüfung übernommen");
  }
  // SKIP muss an allen drei Massnahmen wirken, sonst ist die AI nur Zierde.
  const skips = (risk.match(/aiDecision\.action\s*!==\s*"SKIP"/g) || []).length;
  pruefe1("SKIP wird nicht an allen drei Massnahmen befolgt",
    skips >= 3, `${skips} von 3 Stellen`);

  // ── Teil 2: die ECHTE Klemme gegen bösartige Eingaben rechnen ─────────────
  const geladen = ladeTsModul("lib/agents/risk-agent.ts");
  if (geladen.fehler) {
    funde.push(geladen.fehler);
    return { titel: "AI-Klemme (nicht ausführbar)", funde };
  }
  const { inGrenzen, fortschrittZumZiel } = geladen.exports;

  if (typeof inGrenzen !== "function") {
    funde.push("inGrenzen wird nicht exportiert — die Klemme bleibt ungeprüft "
      + "(bis 11.08. testete dieser Prüfer eine Kopie und blieb grün, während "
      + "die echte Klemme entfernt war)");
  } else {
    const G = { beBuffer: [0, 0.5], atrFactor: [0.5, 4.0], partialRatio: [0.25, 0.75] };
    const boese = [50, -3, 0, 1e9, -1e9, "viel", null, undefined, NaN, Infinity, -Infinity, "", "0.5abc"];
    for (const [name, [min, max]] of Object.entries(G)) {
      for (const w of boese) {
        let r;
        try { r = inGrenzen(w, min, max); }
        catch (e) { pruefe1(`Klemme ${name}: Eingabe ${String(w)} wirft — ${e.message}`, false); continue; }
        pruefe1(`Klemme ${name}: Eingabe ${String(w)} ergab ${r} — ausserhalb [${min}, ${max}]`,
          r === null || (r >= min && r <= max));
      }
    }
    // Unbrauchbare Werte müssen VERWORFEN werden (null), nicht auf das Minimum
    // geklemmt — sonst setzt ein ausdrückliches null der AI den engsten Wert.
    for (const w of [null, undefined, "", NaN, "viel"]) {
      pruefe1(`Klemme: ${String(w)} wird nicht als 'nicht angegeben' behandelt`,
        inGrenzen(w, 0.5, 4.0) === null, String(inGrenzen(w, 0.5, 4.0)));
    }
    // Und ein gültiger Wert muss durchkommen, sonst wäre ADJUST wirkungslos.
    pruefe1("Klemme lässt einen gültigen Wert nicht durch",
      inGrenzen(2.0, 0.5, 4.0) === 2.0, String(inGrenzen(2.0, 0.5, 4.0)));
    // Der Teilgewinn darf eine Position nie ganz schliessen.
    for (const w of [1.0, 5, 100]) {
      const anteil = inGrenzen(w, 0.25, 0.75) ?? 0.5;
      pruefe1(`Teilgewinn: Anteil ${w} würde die ganze Position schliessen`,
        Math.floor(10 * anteil) < 10);
    }
  }

  // ── Teil 3: bekommt die AI den ECHTEN Fortschritt? ────────────────────────
  if (typeof fortschrittZumZiel !== "function") {
    funde.push("fortschrittZumZiel wird nicht exportiert — der Prompt-Wert ist ungeprüft");
  } else {
    const f = fortschrittZumZiel;
    // Ziel gesetzt: 2 % Bewegung bei 4 % Zielabstand = halber Weg.
    pruefe1("Fortschritt bei gesetztem Ziel falsch",
      Math.abs(f(0.02, 100, 104, 2) - 0.5) < 1e-9, String(f(0.02, 100, 104, 2)));
    // Ohne Ziel gilt 2 R — dieselbe Rückfallregel wie in
    // trade_lifecycle_manager.py und icmarkets-trade-manager.ts.
    pruefe1("Rückfall auf 2× Stop-Spanne fehlt",
      Math.abs(f(0.02, 100, 0, 2) - 0.5) < 1e-9, String(f(0.02, 100, 0, 2)));
    // Ziel erreicht = 1.0
    pruefe1("Ziel erreicht ergibt nicht 1.0",
      Math.abs(f(0.04, 100, 104, 2) - 1.0) < 1e-9, String(f(0.04, 100, 104, 2)));
    // SELL: profitPct ist schon richtungsbereinigt, das Ziel liegt unter dem
    // Einstieg — Math.abs muss das auffangen.
    pruefe1("SELL-Richtung ergibt nicht denselben Fortschritt",
      Math.abs(f(0.02, 100, 96, 2) - 0.5) < 1e-9, String(f(0.02, 100, 96, 2)));
    // Verlust muss negativ herauskommen, nicht als Fortschritt gelten.
    pruefe1("Verlust wird als Fortschritt gewertet", f(-0.02, 100, 104, 2) < 0);
    // Unbrauchbare Eingaben -> 0, nicht NaN/Infinity in den Prompt.
    for (const [name, a] of [
      ["entry 0", [0.02, 0, 104, 2]], ["entry negativ", [0.02, -5, 104, 2]],
      ["kein Ziel und kein Stop", [0.02, 100, 0, 0]],
      ["profitPct NaN", [NaN, 100, 104, 2]],
      ["profitPct Infinity", [Infinity, 100, 104, 2]],
      ["Ziel = Einstieg", [0.02, 100, 100, 0]],
    ]) {
      const r = f(...a);
      pruefe1(`${name} ergibt keinen brauchbaren Wert`, r === 0, String(r));
    }
    // DER KERN: der Wert muss sich von profitPct unterscheiden — sonst wäre
    // der Fund vom 11.08. wieder da. Gemessen mit echten Marktzahlen.
    for (const [name, kurs, atr, mindestens] of [
      // Untergrenzen bewusst UNTER dem echten Wert (UKOIL 2,95 %, EURGBP
      // 51,9 %), aber weit ÜBER profitPct (0,5 %) — geprüft wird, dass hier
      // nicht wieder die blosse Kursbewegung landet, nicht die Nachkommastelle.
      ["UKOIL", 87.71, 4.9501, 2.5], ["EURGBP", 0.8544, 0.0027, 45],
    ]) {
      const slRange = 1.5 * atr;
      const profitPct = 0.005;                    // Moment des Breakeven
      const echt = f(profitPct, kurs, 0, slRange) * 100;
      pruefe1(`${name}: Fortschritt ist wieder profitPct statt des echten Werts`,
        echt >= mindestens, `${echt.toFixed(1)} % statt >= ${mindestens} %`);
    }
  }

  // ── Teil 4: Verdrahtung — bekommt die AI den Wert auch wirklich? ──────────
  const rufe = (risk.match(/askAIManager\(symbol,\s*direction,\s*zielFortschritt,/g) || []).length;
  pruefe1("nicht alle drei AI-Aufrufe übergeben den echten Fortschritt",
    rufe === 3, `${rufe} von 3`);
  pruefe1("askAIManager wird noch mit profitPct als Fortschritt gerufen",
    !/askAIManager\(symbol,\s*direction,\s*profitPct,/.test(risk));
  pruefe1("die Marktlage nennt der AI das Ziel nicht (liveTP)",
    /liveTP:\s*number/.test(risk) && /Ziel steht bei/.test(risk));

  // ── Teil 5: der Zustands-Zaehler (11.08.) ─────────────────────────────────
  //
  // Fiel die AI aus, entstand eine console.warn-Zeile und APPROVE — sonst
  // nichts. Ein stummer Ausfall ueber Tage war nur in Logzeilen sichtbar.
  const st = ladeTsModul("lib/agents/ai-manager-status.ts");
  if (st.fehler) {
    funde.push(st.fehler);
  } else if (typeof st.exports.meldeAIEntscheidung !== "function"
          || typeof st.exports.getAIManagerStatus !== "function") {
    funde.push("ai-manager-status exportiert nicht melde/get — der Ausfall bliebe unsichtbar");
  } else {
    const { meldeAIEntscheidung, getAIManagerStatus, resetAIManagerStatus, AUSFALL_AB_FEHLERN } = st.exports;
    resetAIManagerStatus();
    pruefe1("frisch gestartet meldet nicht 'noch nicht gefragt' (null)",
      getAIManagerStatus().erreichbar === null, String(getAIManagerStatus().erreichbar));
    meldeAIEntscheidung("BREAKEVEN", "APPROVE");
    pruefe1("eine Antwort macht ihn nicht erreichbar", getAIManagerStatus().erreichbar === true);
    for (let i = 0; i < AUSFALL_AB_FEHLERN; i++) meldeAIEntscheidung("TRAIL", "FALLBACK", "kein Guthaben");
    const aus = getAIManagerStatus();
    pruefe1(`${AUSFALL_AB_FEHLERN} Fehlschlaege in Folge gelten nicht als Ausfall`,
      aus.erreichbar === false, String(aus.erreichbar));
    pruefe1("der Fehlergrund wird nicht festgehalten", (aus.letzterFehler || "").includes("Guthaben"));
    pruefe1("der Fallback-Anteil wird nicht berechnet", aus.fallbackAnteilPct > 0);
    meldeAIEntscheidung("BREAKEVEN", "SKIP");
    pruefe1("nach einer Antwort erholt er sich nicht",
      getAIManagerStatus().erreichbar === true && getAIManagerStatus().fehlerInFolge === 0);
    // Zaehlen darf niemals werfen — es laeuft mitten im Handelszyklus.
    for (const arg of [null, undefined, "QUATSCH", 42]) {
      let geworfen = false;
      try { meldeAIEntscheidung(arg, arg); } catch { geworfen = true; }
      pruefe1(`meldeAIEntscheidung(${String(arg)}) wirft — das wuerde den Zyklus abbrechen`, !geworfen);
    }
    resetAIManagerStatus();
  }
  // Verdrahtung: meldet askAIManager wirklich, und faellt der Diagnostics-Agent auf?
  // ZWEI Meldestellen, beide gezaehlt: der catch-Zweig UND der Fall "Antwort
  // kam an, enthielt aber kein JSON". Der zweite ist der heimtueckischere —
  // eine kaputte Antwort sah bis zum 11.08. aus wie ein erfolgreiches APPROVE.
  // Erster Entwurf pruefte nur, OB irgendwo gemeldet wird; im Sabotage-Lauf
  // liess sich damit eine der beiden Stellen ersatzlos streichen.
  const fallbackMeldungen = (risk.match(/meldeAIEntscheidung\(action,\s*"FALLBACK"/g) || []).length;
  pruefe1("nicht beide Ausfall-Wege melden (catch UND Antwort ohne JSON)",
    fallbackMeldungen === 2, `${fallbackMeldungen} von 2`);
  pruefe1("askAIManager meldet erfolgreiche Entscheidungen nicht",
    /meldeAIEntscheidung\(action,\s*akt\)/.test(risk));
  const diag = read("frontend/lib/agents/diagnostics-agent.ts");
  pruefe1("der Diagnostics-Agent meldet einen AI-Ausfall nicht",
    /AI_MANAGER_AUSFALL/.test(diag) && /getAIManagerStatus\(\)/.test(diag));

  // ── Teil 6: Rueckkopplung und Fremd-Eingriff (11.08.) ─────────────────────
  // Auf die SCHREIBSTELLE pruefen, nicht auf das Wort: "aiZusammenfassung"
  // steht auch im Kommentar der Funktion. Im Sabotage-Lauf blieb das Feld
  // deshalb entfernbar, ohne dass etwas rot wurde.
  pruefe1("die AI-Entscheidung wird nicht bei der Position festgehalten",
    /aiZusammenfassung:\s*zaehler/.test(risk) && /merkeAIEntscheidung\(dealId/.test(risk));
  const rufeMerke = (risk.match(/merkeAIEntscheidung\(dealId,/g) || []).length;
  pruefe1("nicht alle drei Massnahmen halten ihre Entscheidung fest",
    rufeMerke === 3, `${rufeMerke} von 3`);
  const bericht = read("analysis-engine/services/periodic_report.py");
  pruefe1("niemand wertet die AI-Entscheidungen aus (Wochenreport)",
    /_ai_manager_breakdown/.test(bericht) && /aiZusammenfassung/.test(bericht));
  pruefe1("der Wochenreport haengt den AI-Abschnitt nicht ein",
    /ai = _ai_manager_breakdown\(days\)/.test(bericht));
  const instr2 = read("frontend/instrumentation.ts");
  // DREI Aktionen des Python-Lifecycle greifen in dieselbe Position ein:
  // Stop nachziehen, Teilgewinn, Zeit-Exit. Jede muss vermerkt werden, sonst
  // entscheidet die AI beim naechsten Mal ueber einen Zustand, den sie nicht
  // kennt. Gezaehlt statt nur gesucht — sonst bliebe eine streichbar.
  const fremdMeldungen = (instr2.match(/merkeFremdAktion\(tradeId/g) || []).length;
  pruefe1("nicht alle drei Eingriffe des Python-Lifecycle werden vermerkt",
    fremdMeldungen === 3, `${fremdMeldungen} von 3 (Stop, Teilgewinn, Zeit-Exit)`);
  pruefe1("der Fremd-Eingriff erreicht die Marktlage nicht",
    /fremdAktion:\s*meta\.fremdAktion/.test(risk)
    && /fremdAktion:\s*dbEntry\?\.fremdAktion/.test(risk));
  pruefe1("der Fremd-Eingriff steht nicht im Prompt",
    /ein zweites System verwaltet dieselbe Position/.test(risk));
  const atm = read("frontend/lib/capital-com/active-trade-manager.ts");
  pruefe1("active-trade-manager liest fremdAktion nicht aus den Notizen",
    /fremdAktion:\s*m\.fremdAktion/.test(atm));

  return { titel: `AI-Klemme (${geprueft} Rechnungen, echte Funktion)`, funde };
};
