// ─────────────────────────────────────────────────────────────────────────────
// Helfer für den Prüfer exit-schwellen: fährt die KETTE ab.
//
// Eigener Prozess, weil die Kette asynchron ist (getSettings) und run-all.js
// synchron läuft — dasselbe Vorgehen wie bei python-services, das pytest über
// execSync startet. Gibt eine Zeile JSON aus: { "funde": [...] }
//
// WOZU. Der Prüfer daneben rechnet wirksameSchwellen() nach. Ob der Schalter
// dort ueberhaupt ANKOMMT, sagt er nicht: die Strecke Oberfläche → Einstellungen
// → RiskAgent lief bis zum 10.08. von keinem Prüfer. Genau an solchen Nähten
// sassen an diesem Tag zwei Fehler (LONG/SHORT statt BUY/SELL, und der
// Endpunkt-Pfad zwischen zwei Diensten) — beide Dienste je für sich geprüft,
// dazwischen niemand.
//
// Ohne Datenbank: loadFromDB fällt auf DEFAULT_SETTINGS zurück. Das ist
// derselbe Pfad wie beim ersten Start des Systems.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

const WURZEL = path.resolve(__dirname, "..", "..", "frontend");
const funde = [];

function lade(relPfad) {
  const ts = require(path.join(WURZEL, "node_modules", "typescript"));
  const datei = path.join(WURZEL, relPfad);
  const js = ts.transpileModule(fs.readFileSync(datei, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modul = { exports: {} };
  // "then" MUSS undefined bleiben — sonst hält await den Stellvertreter für ein
  // Promise, ruft dessen then() auf, und der Lauf hängt still.
  const stellvertreter = () => new Proxy(function () {}, {
    get: (_z, prop) => (prop === "then" || typeof prop === "symbol" ? undefined : stellvertreter()),
    apply: () => { throw new Error("keine Datenbank im Prüfstand"); },
    construct: () => ({}),
  });
  new Function("exports", "require", "module", "__filename", "__dirname", js)(
    modul.exports, stellvertreter, modul, datei, path.dirname(datei));
  return modul.exports;
}

const pruefe = (name, ok, zusatz) => {
  if (!ok) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
};

(async () => {
  let store, risk;
  try {
    store = lade("lib/settings/settings-store.ts");
    risk = lade("lib/agents/risk-agent.ts");
  } catch (e) {
    funde.push(`Module nicht ausführbar: ${e.message}`);
    console.log(JSON.stringify({ funde }));
    return;
  }

  // 1. Die Standardwerte müssen die Felder überhaupt enthalten. Fehlt eines,
  //    kommt beim RiskAgent undefined an und die Umrechnung fällt still aus.
  const s0 = await store.getSettings();
  const r0 = s0.riskSettings || {};
  pruefe("exitThresholdsRelativeToStop fehlt in den Standardwerten",
    "exitThresholdsRelativeToStop" in r0, Object.keys(r0).join(","));
  pruefe("Standard ist nicht AUS — Handelsverhalten würde sich ohne Zutun ändern",
    r0.exitThresholdsRelativeToStop === false, String(r0.exitThresholdsRelativeToStop));
  for (const [feld, wert] of [["breakevenAtR", 1.0], ["partialAtR", 1.5], ["trailAtR", 1.0]]) {
    pruefe(`${feld} steht nicht auf ${wert}`, r0[feld] === wert, String(r0[feld]));
  }

  // 2. Der Schalter aus der Oberfläche muss ankommen — und die übrigen
  //    Risikowerte dabei unberührt lassen.
  await store.updateRiskSettings({ exitThresholdsRelativeToStop: true, breakevenAtR: 0.8 });
  const s1 = await store.getSettings();
  const r1 = s1.riskSettings || {};
  pruefe("Schalter kommt in den Einstellungen nicht an", r1.exitThresholdsRelativeToStop === true);
  pruefe("geänderter R-Wert kommt nicht an", r1.breakevenAtR === 0.8, String(r1.breakevenAtR));
  pruefe("nicht angefasste R-Werte wurden mit verändert",
    r1.partialAtR === 1.5 && r1.trailAtR === 1.0);
  pruefe("andere Risikowerte wurden mit verändert",
    r1.maxRiskPerTradePct === r0.maxRiskPerTradePct
    && r1.maxDailyDrawdownPct === r0.maxDailyDrawdownPct
    && r1.maxTotalDrawdownPct === r0.maxTotalDrawdownPct
    && r1.maxExposurePct === r0.maxExposurePct
    && r1.minConfidenceScore === r0.minConfidenceScore);

  // 3. Genau das Stück, das active-trade-manager weiterreicht — und das der
  //    RiskAgent daraus macht. BTCUSD, gemessen 10.08.
  if (typeof risk.wirksameSchwellen === "function") {
    const REGEL = { bePct: 0.005, partialPct: 0.010, trailPct: 0.015, atrFactor: 1.5 };
    const kurs = 63822.97, slRange = 1.5 * 1365.2653, anteil = slRange / kurs;
    const w = risk.wirksameSchwellen(REGEL, slRange, kurs, {
      exitThresholdsRelativeToStop: r1.exitThresholdsRelativeToStop,
      breakevenAtR: r1.breakevenAtR,
      partialAtR: r1.partialAtR,
      trailAtR: r1.trailAtR,
    });
    pruefe("der eingestellte Wert 0.8 R wirkt nicht beim RiskAgent",
      Math.abs(w.bePct / anteil - 0.8) < 1e-9, `${(w.bePct / anteil).toFixed(4)} R`);

    // 4. Zurückschalten muss das alte Verhalten exakt wiederherstellen.
    await store.updateRiskSettings({ exitThresholdsRelativeToStop: false });
    const s2 = await store.getSettings();
    const w2 = risk.wirksameSchwellen(REGEL, slRange, kurs, {
      exitThresholdsRelativeToStop: s2.riskSettings.exitThresholdsRelativeToStop,
      breakevenAtR: s2.riskSettings.breakevenAtR,
      partialAtR: s2.riskSettings.partialAtR,
      trailAtR: s2.riskSettings.trailAtR,
    });
    pruefe("Zurückschalten stellt die Regelwerte nicht wieder her",
      w2.bePct === REGEL.bePct && w2.partialPct === REGEL.partialPct && w2.relativ === false,
      JSON.stringify(w2));
  }

  console.log(JSON.stringify({ funde }));
})().catch((e) => {
  console.log(JSON.stringify({ funde: [`Kette abgestürzt: ${e.message}`] }));
});
