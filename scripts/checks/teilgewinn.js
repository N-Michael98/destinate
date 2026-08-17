// ─────────────────────────────────────────────────────────────────────────────
// Prüfer 12: Teilgewinn-Riegel — FÜHRT DIE ENTSCHEIDUNG WIRKLICH AUS
//
// DER FUND (11.08.). Im 2-Minuten-Zyklus laufen ZWEI Systeme, die beide
// Teilgewinn nehmen, mit getrennten Merkern und ohne voneinander zu wissen:
//
//   runActiveTradeManager() -> runRiskAgent()   partialDone in Trade.notes
//   danach der Python-Lifecycle in instrumentation.ts
//                                              trade.partial_done nur im RAM
//
// Und `trade.size` im Python-Lifecycle stammt aus der REGISTRIERUNG und wird
// nie aktualisiert (trade_lifecycle_manager.py:205 rechnet `trade.size / 2`).
// Hat der RiskAgent vorher die Hälfte geschlossen, ist diese Menge auf eine
// Grösse bezogen, die es nicht mehr gibt — sie schliesst die GANZE
// Restposition. Die Position läuft dann nie bis zum Ziel bei 2 R.
//
// teilgewinnErlaubt() entscheidet das. Ein struktureller Blick ("steht der
// Riegel da?") genügt hier nicht: ein vertauschtes >= gegen >, eine
// umgedrehte Set-Abfrage oder ein fehlender Nullwert-Fall bliebe unauffällig
// und wirkte am offenen Geld. Deshalb wird die ECHTE Funktion aufgerufen.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");
const { ROOT } = require("./_lib");

function ladeRiskAgent(funde) {
  const tsPfad = path.join(ROOT, "frontend", "node_modules", "typescript");
  if (!fs.existsSync(tsPfad)) {
    funde.push("typescript nicht gefunden — nachholen: cd frontend && npm install");
    return null;
  }
  const ts = require(tsPfad);
  const datei = path.join(ROOT, "frontend", "lib", "agents", "risk-agent.ts");
  const js = ts.transpileModule(fs.readFileSync(datei, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modul = { exports: {} };
  const stellvertreter = () => new Proxy(function () {}, {
    get: (_z, prop) => (prop === "then" || typeof prop === "symbol" ? undefined : stellvertreter()),
    apply: () => { throw new Error("keine Aussenwelt im Prüfstand"); },
    construct: () => ({}),
  });
  try {
    new Function("exports", "require", "module", "__filename", "__dirname", js)(
      modul.exports, stellvertreter, modul, datei, path.dirname(datei));
  } catch (e) {
    funde.push(`risk-agent.ts liess sich nicht ausführen: ${e.message}`);
    return null;
  }
  return modul.exports;
}

module.exports = function pruefe() {
  const funde = [];
  const m = ladeRiskAgent(funde);
  if (!m) return { titel: "Teilgewinn-Riegel (nicht ausführbar)", funde };

  const erlaubt = m.teilgewinnErlaubt;
  if (typeof erlaubt !== "function") {
    funde.push("teilgewinnErlaubt wird nicht exportiert — der Riegel ist ungeprüft");
    return { titel: "Teilgewinn-Riegel (nicht ausführbar)", funde };
  }
  if (typeof m.merkeTeilgewinn !== "function") {
    funde.push("merkeTeilgewinn wird nicht exportiert — der Python-Teilgewinn "
      + "landet nicht in Trade.notes, der RiskAgent nimmt im nächsten Zyklus noch einen");
  }

  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };
  const ruf = (name, ...a) => {
    try { return erlaubt(...a); }
    catch (e) { geprueft++; funde.push(`${name}: teilgewinnErlaubt wirft — ${e.message}`); return null; }
  };

  const leer = new Set();
  const schon = new Set(["DEAL-1"]);

  // 1. Der Normalfall MUSS durchgehen — sonst wäre der Teilgewinn ganz tot.
  //    Ohne diese Prüfung bestünde ein Riegel, der einfach immer nein sagt.
  const gut = ruf("Normalfall", "DEAL-9", 5, 10, leer);
  pruefe1("Normalfall (5 von 10 offen) wird blockiert", gut && gut.erlaubt === true,
    gut ? gut.grund : "null");

  // 2. DER FUND: der RiskAgent war schon dran.
  const a = ruf("bereits genommen", "DEAL-1", 5, 10, schon);
  pruefe1("zweiter Teilgewinn auf derselben Position wird NICHT verhindert",
    a && a.erlaubt === false, a ? a.grund : "null");

  // 3. Die veraltete Grösse: Python will die Hälfte der URSPRÜNGLICHEN Grösse,
  //    offen ist nur noch die Hälfte. Das schlösse die ganze Restposition.
  const b = ruf("Vollschliessung", "DEAL-2", 5, 5, leer);
  pruefe1("Menge = offene Grösse wird NICHT verhindert (Vollschliessung)",
    b && b.erlaubt === false, b ? b.grund : "null");
  const c = ruf("mehr als offen", "DEAL-3", 8, 5, leer);
  pruefe1("Menge > offene Grösse wird NICHT verhindert", c && c.erlaubt === false,
    c ? c.grund : "null");

  // 4. Knapp darunter muss erlaubt bleiben — sonst wäre Riegel 2 zu scharf und
  //    schaltete den Teilgewinn faktisch ab.
  const d = ruf("knapp darunter", "DEAL-4", 4.9, 5, leer);
  pruefe1("knapp unter der offenen Grösse wird fälschlich blockiert",
    d && d.erlaubt === true, d ? d.grund : "null");

  // 5. Unbrauchbare Eingaben: lieber nichts tun als etwas Falsches schliessen.
  for (const [name, menge, offen] of [
    ["Menge 0", 0, 10], ["Menge negativ", -3, 10], ["Menge NaN", NaN, 10],
    ["offen 0", 5, 0], ["offen negativ", 5, -2], ["offen NaN", 5, NaN],
  ]) {
    const r = ruf(name, "DEAL-5", menge, offen, leer);
    pruefe1(`${name} wird nicht abgewiesen`, r && r.erlaubt === false, r ? r.grund : "null");
  }
  const ohneId = ruf("ohne dealId", "", 5, 10, leer);
  pruefe1("fehlende dealId wird nicht abgewiesen", ohneId && ohneId.erlaubt === false);

  // 6. Jede Ablehnung MUSS einen Grund nennen. Ein stiller Riegel ist im
  //    Betrieb nicht von "es gab nichts zu tun" zu unterscheiden — genau
  //    dieser blinde Fleck hat den Fund so lange verdeckt.
  const stumm = [
    ruf("g1", "DEAL-1", 5, 10, schon),
    ruf("g2", "DEAL-6", 5, 5, leer),
    ruf("g3", "DEAL-7", 0, 10, leer),
  ].filter((r) => r && r.erlaubt === false && !r.grund);
  pruefe1("eine Ablehnung nennt keinen Grund", stumm.length === 0,
    `${stumm.length} stumme Ablehnungen`);

  // 7. Die Verdrahtung: nützt alles nichts, wenn instrumentation.ts die
  //    Funktion nicht ruft oder den Teilgewinn hinterher nicht vermerkt.
  const instr = fs.readFileSync(path.join(ROOT, "frontend", "instrumentation.ts"), "utf8");
  pruefe1("instrumentation.ts fragt teilgewinnErlaubt nicht",
    /teilgewinnErlaubt\(\s*tradeId/.test(instr));
  pruefe1("instrumentation.ts vermerkt den Teilgewinn nicht (merkeTeilgewinn)",
    /merkeTeilgewinn\(\s*tradeId/.test(instr));
  pruefe1("instrumentation.ts liest den Teilgewinn-Stand nicht aus Trade.notes",
    /schonTeilgewonnen\s*=\s*teilgewinnStand\(/.test(instr));

  // 7b. Das AUSWERTEN der Notizen — ebenfalls ausgeführt, nicht nur gesehen.
  //     Im Sabotage-Lauf war die frühere, eingebettete Fassung abschaltbar
  //     (`if (false)`), ohne dass etwas rot wurde: die Menge wäre immer leer
  //     geblieben und Riegel 1 hätte nie gegriffen.
  const stand = m.teilgewinnStand;
  if (typeof stand !== "function") {
    pruefe1("teilgewinnStand wird nicht exportiert — das Lesen ist ungeprüft", false);
  } else {
    const n = (o) => ({ notes: JSON.stringify(o) });
    let s1;
    try {
      s1 = stand([
        n({ dealId: "A", partialDone: true, partialSize: 3 }),   // echter Verkauf
        n({ dealId: "B", partialDone: true, partialSize: 0 }),   // zu klein — kein Verkauf
        n({ dealId: "C", partialDone: true }),                   // alte Notiz ohne Menge
        n({ dealId: "D", partialDone: false, partialSize: 3 }),  // Merker nicht gesetzt
        n({ partialDone: true, partialSize: 3 }),                // ohne dealId
        { notes: "{kaputt" },                                     // unlesbar
        { notes: null },
      ]);
    } catch (e) {
      pruefe1(`teilgewinnStand wirft — ${e.message}`, false);
      s1 = null;
    }
    if (s1) {
      pruefe1("echter Teilverkauf wird nicht erkannt", s1.has("A"));
      pruefe1("'zu klein zum Halbieren' wird fälschlich als Verkauf gewertet — "
        + "der Python-Teilgewinn würde dort blockiert", !s1.has("B"));
      pruefe1("alte Notiz ohne partialSize wird fälschlich als Verkauf gewertet", !s1.has("C"));
      pruefe1("partialDone=false wird fälschlich als Verkauf gewertet", !s1.has("D"));
      pruefe1("eine kaputte Notiz reisst die übrigen mit — der Riegel fiele für "
        + "ALLE Positionen aus", s1.size === 1, `${s1.size} statt 1`);
    }
    for (const leer of [null, undefined, []]) {
      let r = null;
      try { r = stand(leer); } catch (e) { pruefe1(`teilgewinnStand(${leer}) wirft — ${e.message}`, false); }
      pruefe1(`teilgewinnStand(${JSON.stringify(leer)}) liefert keine leere Menge`,
        r instanceof Set && r.size === 0);
    }
  }

  // 8. Der RiskAgent muss die geschlossene MENGE festhalten. partialDone allein
  //    unterscheidet nicht, ob wirklich etwas verkauft wurde — er wird auch
  //    gesetzt, wenn die Position zu klein zum Halbieren war. Ohne die Menge
  //    blockierte der Riegel dort einen Teilgewinn, der heute funktioniert.
  const risk = fs.readFileSync(path.join(ROOT, "frontend", "lib", "agents", "risk-agent.ts"), "utf8");

  // JEDER persistMeta-Aufruf, der partialDone setzt, muss auch partialSize
  // mitschreiben — sonst ist an dieser Stelle nicht mehr erkennbar, ob wirklich
  // etwas verkauft wurde.
  //
  // Erster Entwurf suchte nur, OB es irgendwo einen solchen Aufruf gibt. Im
  // Sabotage-Lauf (11.08.) rutschte damit "geschlossene Menge wird nicht
  // festgehalten" durch: der Ausdruck steht an DREI Stellen, und der Treffer
  // in merkeTeilgewinn hielt die Prüfung grün, während der im Teilgewinn-Zweig
  // entfernt war. Ein positionsblinder Riegel schützt die Stelle nicht, die er
  // schützen soll. Jetzt wird JEDER Aufruf einzeln geprüft.
  const aufrufe = [...risk.matchAll(/persistMeta\(\s*dealId\s*,\s*\{([^}]*)\}/g)]
    .map((m) => m[1])
    .filter((inhalt) => /partialDone\s*:\s*true/.test(inhalt));
  pruefe1("kein persistMeta-Aufruf setzt partialDone — der Merker fehlt ganz",
    aufrufe.length >= 3, `${aufrufe.length} gefunden, erwartet 3`);
  const ohneMenge = aufrufe.filter((inhalt) => !/partialSize/.test(inhalt));
  pruefe1("ein persistMeta-Aufruf setzt partialDone ohne partialSize",
    ohneMenge.length === 0,
    ohneMenge.map((x) => `{${x.trim()}}`).join(" | "));
  pruefe1("der Zweig 'zu klein zum Halbieren' setzt partialSize nicht auf 0",
    aufrufe.some((inhalt) => /partialSize\s*:\s*0/.test(inhalt)));

  return { titel: `Teilgewinn-Riegel (${geprueft} Prüfungen, Entscheidung ausgeführt)`, funde };
};
