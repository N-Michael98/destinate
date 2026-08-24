// SNAPSHOT-PRÜFER — hält kritische WERTE fest, nicht nur Strukturen.
//
// WARUM: Die anderen Prüfer sichern ab, dass ein Eintrag EXISTIERT. Sie merken
// nicht, wenn jemand seinen WERT ändert. Vorgeführt am 03.08.: MAX_SIZE für
// BTCUSD von 0.05 auf 5.0 gesetzt — das hundertfache Risiko — und das gesamte
// Netz blieb grün, weil der Schlüssel ja noch da war.
//
// Dieser Prüfer speichert die entscheidenden Zahlen und Texte und meldet jede
// Abweichung MIT der konkreten Differenz. Er verbietet Änderungen nicht, er
// erzwingt nur, dass sie bewusst bestätigt werden:
//
//     node scripts/checks/snapshot.js --update
//
// Die Snapshot-Datei gehört ins Repository. Eine Änderung daran ist im Diff
// sichtbar und muss im Commit begründet werden — genau das ist der Zweck.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ROOT, read, objectBlock } = require("./_lib");

const DATEI = path.join(__dirname, "snapshots", "kritische-werte.json");

/** Zahlenwerte eines Objektliterals: { schluessel: Zahl, ... }
 *  KORREKTUR 03.08.: Das Muster verlangte zuerst nur GROSSBUCHSTABEN. Damit
 *  fielen ausgerechnet die Einstellungen durch (maxTradesPerDay,
 *  autoApproveThreshold, minConfidenceScore) und die AI-Grenzwerte — also
 *  genau die Zahlen, auf die es am meisten ankommt. Jetzt beide Schreibweisen.
 *  Kommentarzeilen werden vorher entfernt, damit Zahlen aus Erklärungen
 *  ("z.B. 0.5") nicht mitgelesen werden. */
function zahlen(block) {
  const ohneKommentare = block.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const out = {};
  for (const m of ohneKommentare.matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*:\s*(-?[0-9.]+)/g)) {
    out[m[1]] = Number(m[2]);
  }
  // ERWEITERT 10.08.: auch true/false erfassen.
  //
  // Bis heute hielt der Snapshot ausschliesslich ZAHLEN — und damit war KEIN
  // EINZIGER SCHALTER gesichert. pyramidingEnabled, blockOverfitMarkets,
  // allowMeasuredConsensus, useFullModelsForScan, tradeLimitEnabled,
  // pauseOnLoss: jeder davon liess sich im Standardwert umdrehen, und das
  // ganze Netz blieb gruen. Das sind Schalter, die ueber Handelsverhalten
  // entscheiden — pyramidingEnabled auf true heisst mehrere Positionen je
  // Symbol, tradeLimitEnabled auf false heisst kein Tageslimit.
  //
  // Aufgefallen beim Einbau von exitThresholdsRelativeToStop (Stufe 2), der
  // aus demselben Grund ungeschuetzt gewesen waere.
  for (const m of ohneKommentare.matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*:\s*(true|false)\b/g)) {
    out[m[1]] = m[2] === "true";
  }
  return out;
}

/** Aktuellen Zustand aus den Quelldateien einsammeln. */
function erfasse() {
  const client   = read("frontend/lib/capital-com/capital-com-client.ts");
  const exec     = read("frontend/lib/capital-com/capital-com-execution.ts");
  const store    = read("frontend/lib/settings/settings-store.ts");
  const risk     = read("frontend/lib/agents/risk-agent.ts");
  const engine   = read("frontend/lib/market-scanner/ai-analysis-engine.ts");
  const filters  = read("frontend/lib/trading-filters/trade-filters.ts");
  const strategien = read("backend/services/trading_strategies.py");
  const stopBlk  = objectBlock(exec, "const DEFAULT_STOP_BY_STYLE");

  // Der GPT-Prompt bestimmt Richtung, Stop und Ziel jedes Trades. Eine stille
  // Änderung daran ist die folgenreichste überhaupt — deshalb als Prüfsumme
  // über den Regelteil festgehalten, samt Zahl der Regelzeilen.
  const regelStart = engine.indexOf("CALIBRATION:");
  const regelEnde  = engine.indexOf("Return ONLY valid JSON");
  const regelText  = regelStart >= 0 && regelEnde > regelStart ? engine.slice(regelStart, regelEnde) : "";

  return {
    epicMap: Object.fromEntries(
      [...objectBlock(client, "export const EPIC_MAP").matchAll(/([A-Z0-9_]+)\s*:\s*"([A-Z0-9_]+)"/g)]
        .map((m) => [m[1], m[2]])
    ),
    minSize:        zahlen(objectBlock(exec, "const MIN_SIZE")),
    maxSize:        zahlen(objectBlock(exec, "const MAX_SIZE")),
    pipValue:       zahlen(objectBlock(exec, "const PIP_VALUE_PER_UNIT")),
    stopScalping:   zahlen(objectBlock(stopBlk, "SCALPING")),
    stopDaytrading: zahlen(objectBlock(stopBlk, "DAYTRADING")),
    stopSwing:      zahlen(objectBlock(stopBlk, "SWING")),
    botDefaults:    zahlen(objectBlock(store, "botSettings:")),
    riskDefaults:   zahlen(objectBlock(store, "riskSettings:")),
    // Exit-Schwellen des RiskAgent: Breakeven, Teilgewinn, Trailing, ATR-Faktor.
    // DAYTRADING steht als `default:`, nicht als `case` — beim ersten Anlauf
    // fehlte es deshalb und wäre ungeschützt geblieben.
    exitSchwellen: [...risk.matchAll(/(?:case "(\w+)"|(default)):\s*return \{ bePct: ([\d.]+), partialPct: ([\d.]+), trailPct: ([\d.]+), atrFactor: ([\d.]+) \}/g)]
      .reduce((a, m) => (a[m[1] ?? "DAYTRADING(default)"] = { bePct: +m[3], partialPct: +m[4], trailPct: +m[5], atrFactor: +m[6] }, a), {}),
    haltedauer: zahlen(objectBlock(risk, "const STYLE_MAX_HOURS")),
    // GRENZEN ist verschachtelt: { beBuffer: {min,max}, atrFactor: {min,max}, … }.
    // Eine flache Erfassung überschrieb min/max bei jeder Gruppe und behielt nur
    // die letzte — statt sechs Werten blieben zwei übrig, und die Klemmen für
    // Breakeven-Puffer und Trailing wären ungeschützt geblieben.
    // Klemme der R-Werte aus den Einstellungen (Stufe 2, 10.08.). Ohne sie
    // würde ein Tippfehler im Eingabefeld — eine 0 oder eine 50 — jede
    // Absicherung sofort oder nie auslösen. Im Sabotage-Lauf liess sie sich
    // auf { min: 0, max: 1000 } aufweiten, ohne dass etwas rot wurde.
    rGrenzen: zahlen(objectBlock(risk, "const R_GRENZEN")),
    aiGrenzen: [...objectBlock(risk, "const GRENZEN").matchAll(/(\w+):\s*\{\s*min:\s*(-?[\d.]+),\s*max:\s*(-?[\d.]+)/g)]
      .reduce((a, m) => (a[m[1]] = { min: +m[2], max: +m[3] }, a), {}),
    gptPrompt: {
      regelZeilen: (regelText.match(/^- /gm) || []).length,
      waitErwaehnungen: (regelText.match(/WAIT/g) || []).length,
      pruefsumme: crypto.createHash("sha256").update(regelText).digest("hex").slice(0, 16),
      // LÜCKE GESCHLOSSEN 04.08.: Erfasst war nur der Regelteil BIS
      // "Return ONLY valid JSON". Das Antwortschema danach war ungeschützt —
      // beim Entfernen von marketBias verschwand ein Feld daraus, und der
      // Snapshot blieb still. Dabei bestimmt genau dieses Schema, welche
      // Felder GPT liefert und damit was Richtung, Stop und Ziel setzt.
      antwortFelder: (() => {
        const a = engine.indexOf('"opportunities": [');
        if (a < 0) return ["SCHEMA NICHT GEFUNDEN"];
        const start = engine.lastIndexOf("{", a);
        let tiefe = 0, ende = -1;
        for (let i = start; i < engine.length; i++) {
          if (engine[i] === "{") tiefe++;
          else if (engine[i] === "}") { tiefe--; if (tiefe === 0) { ende = i; break; } }
        }
        try {
          const o = JSON.parse(engine.slice(start, ende + 1));
          return Object.keys(o.opportunities?.[0] ?? {});
        } catch { return ["SCHEMA UNGUELTIG"]; }
      })(),
    },
    filterReihenfolge: [...filters.matchAll(/blockedBy:\s*"([A-Z_]+)"/g)].map((m) => m[1]),
    // Volatilitaets-Skalierung (23.08.): getVolatilityAdjustedRisk multipliziert
    // das Risiko je Trade nach ATR. Fuenf Zahlen, die unmittelbar die
    // Positionsgroesse bestimmen — und bis heute war KEINE davon gesichert.
    // VORGEFUEHRT, nicht vermutet: die Schwelle von 3.0 auf 30.0 gezogen, damit
    // greift die 0,4x-Klemme fuer sehr hohe Volatilitaet nie mehr — und alle
    // sechzehn Pruefer blieben gruen.
    //
    // Erfasst wird die Kette ALS FOLGE, mitsamt Vergleichszeichen: ">3.0=>0.4".
    // Damit faellt auch auf, wer nur das Zeichen dreht (aus "> 1.5" wird
    // "< 1.5") oder zwei Stufen vertauscht — beides laesst die Zahlenmenge
    // unveraendert und bliebe bei reiner Wertaufnahme unsichtbar.
    volatilitaetsSkalierung: (() => {
      const start = filters.indexOf("export function getVolatilityAdjustedRisk");
      if (start < 0) return "FUNKTION FEHLT";
      const rest = filters.slice(start);
      const ende = rest.indexOf("\n}");
      const rumpf = rest.slice(0, ende < 0 ? rest.length : ende).replace(/\/\/[^\n]*/g, "");
      const grund = rumpf.match(/let\s+multiplier\s*=\s*(-?[0-9.]+)/);
      const boden = rumpf.match(/Math\.max\(\s*(-?[0-9.]+)/);
      // Der Faktor für UNBEKANNTE Volatilität steht als Konstante VOR der
      // Funktion, nicht in ihrem Rumpf — deshalb aus der ganzen Datei gelesen.
      // Ohne diese Zeile wäre er ungesichert, und genau das war der Zustand,
      // der die ganze Kette bis zum 23.08. ungeschützt liess.
      const ohneDaten = filters.match(
        /RISIKO_OHNE_VOLA_DATEN\s*=\s*(-?[0-9.]+)/
      );
      return {
        grundwert: grund ? Number(grund[1]) : null,
        stufen: [...rumpf.matchAll(
          /atrPct\s*([<>]=?)\s*(-?[0-9.]+)\s*\)\s*multiplier\s*=\s*(-?[0-9.]+)/g
        )].map((m) => `${m[1]}${m[2]}=>${m[3]}`),
        untergrenze: boden ? Number(boden[1]) : null,
        ohneDaten: ohneDaten ? Number(ohneDaten[1]) : "KONSTANTE FEHLT",
      };
    })(),
    // Struktur-Stop (05.08.): der gemessene Konsens legt seinen Stop hinter den
    // letzten bestaetigten Wendepunkt statt rein aus ATR. Drei Zahlen
    // entscheiden dabei ueber das Risiko je Trade, und keine davon war bisher
    // erfasst: der Grundfaktor, der Puffer hinter dem Wendepunkt und die
    // Obergrenze, ab der die Struktur verworfen wird. Wer die Obergrenze von
    // 3.0 auf 30 zieht, verdoppelt bis verzehnfacht den Stop-Abstand — kein
    // anderer Pruefer wuerde das bemerken, weil die STRUKTUR unveraendert bleibt.
    // Welche Kerzen die Strategien SEHEN (09.08.).
    //
    // Jede (Intervall, Zeitraum)-Kombination ist ein eigener Netzabruf je
    // Symbol — fuenf Kombinationen sind 150 Abrufe je Zyklus gegen eine
    // Datenquelle, die uns nachweislich begrenzt. Wichtiger noch: der Zeitraum
    // bestimmt, wie viel Vorlauf ein Indikator hat, also WELCHE Zahlen die
    // Strategie liefert. Ein pytest-Test haelt die ANZAHL klein; hier steht,
    // welche es genau sind — eine Verschiebung ist dann im Diff sichtbar und
    // muss im Commit begruendet werden.
    kerzenabrufe: [...strategien.matchAll(/_load\(symbol,\s*"([^"]+)",\s*"([^"]+)"\)/g)]
      .map((m) => `${m[1]}/${m[2]}`)
      .filter((x, i, a) => a.indexOf(x) === i)
      .sort(),
    strukturStop: (() => {
      const b = engine.slice(engine.indexOf("const atrRange = ta.atr"));
      if (!b) return { "BLOCK NICHT GEFUNDEN": true };
      const z = (re) => { const m = b.match(re); return m ? +m[1] : null; };
      return {
        atrFaktor:    z(/const atrRange = ta\.atr \* ([\d.]+)/),
        puffer:       z(/const mitPuffer = roh \+ ta\.atr \* ([\d.]+)/),
        obergrenzeAtr: z(/inAtr <= ([\d.]+)/),
        zielFaktor:   z(/takeProfit: richtung === "BUY" \? einstieg \+ slRange \* ([\d.]+)/),
        // Die Invariante selbst: die Struktur darf nur WEITER machen, nie enger.
        nurWeiter:    /mitPuffer > atrRange/.test(b),
      };
    })(),
  };
}

/** Zwei Zustände vergleichen und die konkreten Unterschiede benennen. */
function vergleiche(alt, neu, pfad = "") {
  const diffs = [];
  const schluessel = new Set([...Object.keys(alt ?? {}), ...Object.keys(neu ?? {})]);
  for (const k of schluessel) {
    const a = alt?.[k], n = neu?.[k];
    const p = pfad ? `${pfad}.${k}` : k;
    if (a !== null && typeof a === "object" && !Array.isArray(a)) { diffs.push(...vergleiche(a, n, p)); continue; }
    const as = JSON.stringify(a), ns = JSON.stringify(n);
    if (as !== ns) {
      if (a === undefined) diffs.push(`${p}: NEU = ${ns}`);
      else if (n === undefined) diffs.push(`${p}: ENTFERNT (war ${as})`);
      else diffs.push(`${p}: ${as} → ${ns}`);
    }
  }
  return diffs;
}

module.exports = function pruefe() {
  const aktuell = erfasse();
  // Blattwerte zählen, nicht nur die oberste Ebene: aiGrenzen und
  // exitSchwellen sind verschachtelt, eine flache Zählung meldete 246 statt
  // 258 und stimmte damit nicht mit der eigenen Dokumentation überein.
  const zaehle = (v) =>
    Array.isArray(v) ? v.length
    : v !== null && typeof v === "object" ? Object.values(v).reduce((n, x) => n + zaehle(x), 0)
    : 1;
  const anzahl = zaehle(aktuell);

  if (!fs.existsSync(DATEI)) {
    return { titel: "Snapshot kritischer Werte", funde: [`Kein Snapshot vorhanden — anlegen mit: node scripts/checks/snapshot.js --update`] };
  }
  const gespeichert = JSON.parse(fs.readFileSync(DATEI, "utf8"));
  const diffs = vergleiche(gespeichert.werte, aktuell);

  if (diffs.length > 0) {
    return {
      titel: `Snapshot kritischer Werte (${anzahl} Werte, Stand ${gespeichert.erstelltAm?.slice(0, 10) ?? "?"})`,
      funde: [
        ...diffs.slice(0, 20).map((d) => `WERT GEÄNDERT: ${d}`),
        ...(diffs.length > 20 ? [`… und ${diffs.length - 20} weitere`] : []),
        "Wenn beabsichtigt: node scripts/checks/snapshot.js --update  (Änderung wird im Diff sichtbar)",
      ],
    };
  }
  return { titel: `Snapshot kritischer Werte (${anzahl} Werte unverändert)`, funde: [] };
};

// ── Direktaufruf: Snapshot neu schreiben ────────────────────────────────────
if (require.main === module) {
  if (process.argv[2] !== "--update") {
    console.log("Aufruf: node scripts/checks/snapshot.js --update");
    process.exit(1);
  }
  const werte = erfasse();
  fs.mkdirSync(path.dirname(DATEI), { recursive: true });
  const vorher = fs.existsSync(DATEI) ? JSON.parse(fs.readFileSync(DATEI, "utf8")).werte : null;
  fs.writeFileSync(DATEI, JSON.stringify({
    hinweis: "Von scripts/checks/snapshot.js erzeugt. Nicht von Hand ändern — mit --update neu schreiben.",
    erstelltAm: new Date().toISOString(),
    werte,
  }, null, 2) + "\n", "utf8");
  const diffs = vorher ? vergleiche(vorher, werte) : [];
  console.log(`Snapshot geschrieben: ${path.relative(ROOT, DATEI)}`);
  if (diffs.length) {
    console.log("Übernommene Änderungen:");
    for (const d of diffs) console.log("  " + d);
  }
}
