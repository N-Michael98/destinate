// PRÜFT: Ohne Kurs wird nicht gehandelt — durch AUSFÜHREN der echten Funktion.
//
// WARUM (24.08.). Die Filterkette prüfte, ob der Kurs FRISCH ist, aber nicht,
// ob es ihn überhaupt gibt. `checkLiquidity` gab bei `bid <= 0` sogar
// ausdrücklich `allowed: true` zurück — ohne Preis lässt sich kein
// Spread-Anteil rechnen, also wurde durchgewunken. Ohne Preis ist aber auch
// die Positionsgrösse, der Einstieg und jede Verlustgrenze geraten.
//
// EHRLICHE EINORDNUNG: über den Livepfad war der Fall nicht erreichbar. Der
// Scanner filtert `markets.filter((m) => m.bid > 0)` und baut die
// Gelegenheiten aus genau dieser Liste (ai-analysis-engine.ts:522 und die
// Schleife in Zeile 791) — nachgeprüft, nicht angenommen. Dies ist eine
// ZUSICHERUNG an der Stelle, an der sie gilt, kein geschlossenes Loch.
//
// WARUM RECHNEND UND NICHT NUR STRUKTURELL. safety-nets prüft, dass der
// Aufruf dasteht und vor der Frische-Prüfung läuft; der Snapshot hält
// PRICE_MISSING in der Filterreihenfolge fest. Beides bliebe grün, wenn
// jemand die Bedingung umbaut — etwa `Number.isFinite` streicht. Dann käme
// ein NaN-Preis durch, denn `NaN <= 0` ist FALSE. Genau diese Sorte Umbau
// findet nur eine Rechnung.
const { read, ladeTsModul } = require("./_lib");

module.exports = function pruefe() {
  const funde = [];
  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  const modul = ladeTsModul("lib/trading-filters/trade-filters.ts");
  if (modul.fehler) return { titel: "Kurs-Riegel", funde: [modul.fehler] };
  const f = modul.exports.checkPriceAvailable;
  if (typeof f !== "function") {
    return {
      titel: "Kurs-Riegel",
      funde: ["checkPriceAvailable wird nicht exportiert — Umbenennung?"],
    };
  }

  const echtesLog = console.log;
  console.log = () => {};
  try {
    // ── Teil 1: alles ohne brauchbaren Preis MUSS blocken ────────────────
    //
    // NaN und Infinity stehen absichtlich mit drin: eine Prüfung, die nur
    // `bid <= 0` schreibt, lässt beide durch. Das ist kein erfundener Fall —
    // ein kaputter Broker-Wert oder ein fehlgeschlagenes parseFloat liefert
    // genau das.
    const ohnePreis = [
      ["bid 0", 0], ["bid negativ", -1.2], ["bid NaN", NaN],
      ["bid Infinity", Infinity], ["bid -Infinity", -Infinity],
      ["bid undefined", undefined], ["bid null", null],
    ];
    for (const [name, bid] of ohnePreis) {
      const r = f("PRUEFUNG", bid, 0.0001);
      pruefe1(`${name} wird NICHT geblockt`, r && r.allowed === false,
        `Ergebnis ${JSON.stringify(r)}`);
      pruefe1(`${name} blockt ohne Begründung`,
        !!(r && typeof r.reason === "string" && r.reason.length > 0));
    }

    // ── Teil 2: unmöglicher Spread ───────────────────────────────────────
    //
    // Ein negativer Spread heisst bid > ask. Das ist keine Marktlage, das
    // sind kaputte Daten — und der Spread-Filter würde damit einen negativen
    // Anteil rechnen und jede Grenze unterschreiten, also durchwinken.
    for (const [name, spread] of [["Spread negativ", -0.0001],
                                  ["Spread NaN", NaN],
                                  ["Spread undefined", undefined]]) {
      const r = f("PRUEFUNG", 1.16, spread);
      pruefe1(`${name} wird NICHT geblockt`, r && r.allowed === false,
        `Ergebnis ${JSON.stringify(r)}`);
    }

    // ── Teil 3: gültige Marktlagen dürfen NICHT blockiert werden ─────────
    //
    // Der teuerste Fehler wäre ein Riegel, der zu viel blockt. Deshalb quer
    // durch die Grössenordnungen der Watchlist: Forex bei 1,16, Gold bei
    // 2400, Krypto bei 64000 — und ein Spread von exakt 0, der erlaubt ist.
    const gueltig = [
      ["Forex", 1.16453, 0.00012], ["Gold", 2400.55, 0.35],
      ["Krypto", 64000, 12.5], ["Index", 18500.5, 1.2],
      ["Spread exakt 0", 1.16, 0], ["sehr kleiner Kurs", 0.00001, 0],
      ["sehr grosser Kurs", 1e9, 1],
    ];
    for (const [name, bid, spread] of gueltig) {
      const r = f("PRUEFUNG", bid, spread);
      pruefe1(`gültige Lage "${name}" wird faelschlich geblockt`,
        r && r.allowed === true, `Ergebnis ${JSON.stringify(r)}`);
    }

    // ── Teil 4: die Eigenschaft über einen Bereich ───────────────────────
    //
    // Punkte prüfen Punkte. Diese Schleife prüft die AUSSAGE: jeder positive,
    // endliche Kurs mit nicht-negativem Spread muss durch, jeder andere nicht.
    let falschGeblockt = 0, falschDurch = 0;
    for (let i = -50; i <= 500; i++) {
      const bid = i / 10;                       // -5,0 bis 50,0
      const r = f("PRUEFUNG", bid, 0.001);
      const sollDurch = Number.isFinite(bid) && bid > 0;
      if (sollDurch && !r.allowed) falschGeblockt++;
      if (!sollDurch && r.allowed) falschDurch++;
    }
    pruefe1("gültige Kurse werden geblockt", falschGeblockt === 0,
      `${falschGeblockt} Fälle`);
    pruefe1("Kurse ohne Wert kommen durch", falschDurch === 0,
      `${falschDurch} Fälle`);
  } finally {
    console.log = echtesLog;
  }

  // ── Teil 5: das Tor steht in der Kette, und zwar zuerst ────────────────
  //
  // Eine tadellose Funktion nützt nichts, wenn die Kette sie nicht ruft.
  // Kommentare und Zeichenketten werden entfernt: `PRICE_MISSING` und der
  // Funktionsname stehen auch in Erklärungen, und ein Prüfer, der einen
  // Kommentar für eine Verdrahtung hält, ist die Fehlerklasse, die in diesem
  // Repository am häufigsten zugeschlagen hat.
  const roh = read("frontend/lib/trading-filters/trade-filters.ts");
  const kette = roh
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // `[^:]` davor — sonst frisst das Muster "https://…" in einer Zeichenkette
    // und mit ihm den ganzen Zeilenrest. Siehe lifecycle-rueckkehr.js:79.
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const posAufruf = kette.indexOf("checkPriceAvailable(symbol, bid, spread)");
  pruefe1("die Kette ruft den Kurs-Riegel nicht auf", posAufruf >= 0);
  pruefe1("der Riegel blockt nicht mit eigenem Grund",
    /blockedBy:\s*"PRICE_MISSING"/.test(kette));
  const posFrische = kette.indexOf("checkPriceFreshness(symbol, priceAgeMinutes");
  pruefe1("der Kurs-Riegel laeuft nicht VOR der Frische-Pruefung",
    posAufruf >= 0 && posFrische >= 0 && posAufruf < posFrische,
    `Riegel bei ${posAufruf}, Frische bei ${posFrische}`);

  return {
    titel: `Kurs-Riegel (${geprueft} Rechnungen, echte Funktion)`,
    funde,
  };
};
