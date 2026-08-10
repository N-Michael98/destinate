// ─────────────────────────────────────────────────────────────────────────────
// Prüfer 11: Ausstiegs-Schwellen — FÜHRT DIE LOGIK WIRKLICH AUS
//
// Alle bisherigen zehn Prüfer sehen STRUKTUR: ist ein Eintrag da, stimmen zwei
// Tabellen überein, wurde ein Wert verändert. Keiner rechnet. CLAUDE.md sagt
// das auch offen: "Ein Riegel, der vorhanden, aber subtil falsch umgebaut
// wurde, fällt hier nicht auf."
//
// Genau das wäre bei wirksameSchwellen() teuer. Die Funktion entscheidet, wann
// Breakeven, Teilgewinn und Trailing greifen. Ein vertauschtes Vorzeichen, ein
// Faktor statt eines Divisors, eine weggefallene Klemme — alles bliebe
// strukturell unauffällig und würde am offenen Geld wirken.
//
// Dieser Prüfer übersetzt risk-agent.ts mit TypeScripts eigenem Transpiler und
// ruft die ECHTE Funktion auf. Kein Nachbau: ein abgetippter würde beim
// nächsten Umbau auseinanderdriften und genau das verschweigen, was er prüfen
// soll. Die Importe der Datei werden beim Laden gestellt — wirksameSchwellen
// benutzt keinen davon.
//
// Die Marktzahlen sind gemessen (10.08., ATR(14) auf Tageskerzen über
// market_data.get_ohlcv, Stop = 1.5 × ATR wie in ai-analysis-engine.ts).
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");
const { ROOT } = require("./_lib");

// getStyleThresholds DAYTRADING — der Regelwert, gegen den verglichen wird
const REGEL = { bePct: 0.005, partialPct: 0.010, trailPct: 0.015, atrFactor: 1.5 };

// Gemessen am 10.08.: [Symbol, Kurs, ATR(14) Tageskerzen]
const MAERKTE = [
  ["UKOIL", 87.71, 4.9501],
  ["USOIL", 82.11, 4.4999],
  ["BTCUSD", 63822.97, 1365.2653],
  ["EURUSD", 1.1545, 0.0056],
  ["EURGBP", 0.8544, 0.0027],
];

const nahe = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

function ladeFunktion(funde) {
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
    get: () => stellvertreter(),
    apply: () => undefined,
    construct: () => ({}),
  });
  try {
    new Function("exports", "require", "module", "__filename", "__dirname", js)(
      modul.exports, stellvertreter, modul, datei, path.dirname(datei),
    );
  } catch (e) {
    funde.push(`risk-agent.ts liess sich nicht ausfuehren: ${e.message}`);
    return null;
  }
  if (typeof modul.exports.wirksameSchwellen !== "function") {
    funde.push("wirksameSchwellen wird nicht exportiert — Schwellen sind ungeprueft");
    return null;
  }
  return modul.exports.wirksameSchwellen;
}

module.exports = function pruefe() {
  const funde = [];
  const wirksameSchwellen = ladeFunktion(funde);
  if (!wirksameSchwellen) return { titel: "Ausstiegs-Schwellen (nicht ausführbar)", funde };

  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };
  /** Ruft die Funktion ab und macht aus einem Wurf einen BEFUND.
   *
   *  Ohne das reisst eine geworfene Ausnahme den ganzen Prüfer mit: die Meldung
   *  lautet dann "PRÜFER ABGESTÜRZT: Cannot read properties of undefined"
   *  statt zu sagen, WELCHE Prüfung gescheitert ist. Vorgeführt im
   *  Sabotage-Lauf am 10.08. — und es ist kein erfundener Fall: wirft die
   *  Funktion bei fehlender Einstellung, wirft sie im Betrieb genauso und
   *  nimmt die Absicherung der laufenden Position mit. */
  const ruf = (name, ...args) => {
    try {
      return wirksameSchwellen(...args);
    } catch (e) {
      geprueft++;
      funde.push(`${name}: wirksameSchwellen wirft — ${e.message}`);
      return null;
    }
  };

  // 1. Schalter aus -> exakt das bisherige Verhalten. Wäre das verletzt,
  //    änderte sich Handelsverhalten, ohne dass jemand etwas eingeschaltet hat.
  for (const [wie, einst] of [
    ["ohne Feld", undefined],
    ["Schalter false", { exitThresholdsRelativeToStop: false, breakevenAtR: 1, partialAtR: 1.5, trailAtR: 1 }],
  ]) {
    const r = ruf(`Schalter AUS (${wie})`, REGEL, 0.0084, 1.1545, einst);
    pruefe1(
      `Schalter AUS (${wie}) verändert die Regelwerte`,
      r !== null && r.bePct === REGEL.bePct && r.partialPct === REGEL.partialPct
      && r.trailPct === REGEL.trailPct && r.atrFactor === REGEL.atrFactor && r.relativ === false,
      JSON.stringify(r),
    );
  }

  // 2. Der Kern: derselbe R-Wert muss in JEDEM Markt beim selben R auslösen.
  const einst = { exitThresholdsRelativeToStop: true, breakevenAtR: 1.0, partialAtR: 1.5, trailAtR: 1.0 };
  const rWerteAlt = [];
  for (const [name, kurs, atr] of MAERKTE) {
    const slRange = 1.5 * atr;
    const anteil = slRange / kurs;
    const r = ruf(name, REGEL, slRange, kurs, einst);
    if (r === null) continue;
    pruefe1(`${name}: Breakeven löst nicht bei 1.00 R aus`, nahe(r.bePct / anteil, 1.0, 1e-9),
      `${(r.bePct / anteil).toFixed(4)} R`);
    pruefe1(`${name}: Teilgewinn löst nicht bei 1.50 R aus`, nahe(r.partialPct / anteil, 1.5, 1e-9),
      `${(r.partialPct / anteil).toFixed(4)} R`);
    pruefe1(`${name}: Trailing löst nicht bei 1.00 R aus`, nahe(r.trailPct / anteil, 1.0, 1e-9),
      `${(r.trailPct / anteil).toFixed(4)} R`);
    pruefe1(`${name}: atrFactor wurde verändert`, r.atrFactor === REGEL.atrFactor);
    rWerteAlt.push(REGEL.bePct / anteil);
  }

  // 3. Gegenprobe: die feste Regel MUSS auseinanderlaufen. Ohne diese Prüfung
  //    bestünde der Test auch dann, wenn die Marktzahlen alle gleich wären —
  //    und bewiese nichts.
  const spreizungAlt = Math.max(...rWerteAlt) / Math.min(...rWerteAlt);
  pruefe1("feste Prozente laufen NICHT auseinander — Messwerte unbrauchbar",
    spreizungAlt > 10, `Spreizung nur ${spreizungAlt.toFixed(1)}x`);

  // 4. Klemme: ein Tippfehler im Eingabefeld darf die Absicherung nicht kippen.
  const entry = 1.1545, slRange = 0.0084, anteil = slRange / entry;
  const rr = (b) => ruf(`Klemme ${b}`, REGEL, slRange, entry,
    { exitThresholdsRelativeToStop: true, breakevenAtR: b, partialAtR: b, trailAtR: b }) ?? { bePct: NaN };
  pruefe1("0 R wird nicht auf das Minimum geklemmt", nahe(rr(0).bePct, 0.2 * anteil),
    `${(rr(0).bePct / anteil).toFixed(3)} R`);
  pruefe1("999 R wird nicht auf das Maximum geklemmt", nahe(rr(999).bePct, 5.0 * anteil),
    `${(rr(999).bePct / anteil).toFixed(3)} R`);
  pruefe1("NaN fällt nicht auf 1.0 R zurück", nahe(rr(NaN).bePct, 1.0 * anteil),
    `${(rr(NaN).bePct / anteil).toFixed(3)} R`);

  // 5. Unbrauchbare Eingaben -> Regelwerte statt Unsinn (Division durch null).
  for (const [name, sl, en] of [["slRange 0", 0, 1.15], ["entry 0", 0.008, 0], ["entry negativ", 0.008, -5]]) {
    const r = ruf(name, REGEL, sl, en, { exitThresholdsRelativeToStop: true, breakevenAtR: 1, partialAtR: 1.5, trailAtR: 1 });
    pruefe1(`${name}: keine Rückkehr zu den Regelwerten`,
      r !== null && r.bePct === REGEL.bePct && r.relativ === false, JSON.stringify(r));
  }

  return { titel: `Ausstiegs-Schwellen (${geprueft} Rechnungen, 5 Märkte)`, funde };
};
