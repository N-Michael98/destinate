// PRÜFT: Die Sicherheitsnetze des Handelspfads sind vorhanden und verdrahtet.
//
// WARUM: Mehrere davon waren schon einmal gebaut, aber wirkungslos — der
// Duplikat-Schutz las jahrelang die falschen Feldnamen, der Killswitch baute
// nur einen Bericht ohne Wirkung, sechs Einstellungen wurden nirgends gelesen.
// Dieser Prüfer stellt sicher, dass sie nicht wieder still verschwinden.
//
// EHRLICHE ABGRENZUNG: geprüft wird das VORHANDENSEIN und die Verdrahtung im
// Quelltext, nicht das Laufzeitverhalten.
const fs = require("fs");
const path = require("path");
const { read, ladeTsModul, objectBlock, ROOT, sourceFiles } = require("./_lib");
const { execFileSync } = require("child_process");

/** Benutzt ein Prüfer die naive Kommentar-Entfernung ohne URL-Schutz?
 *
 * WARUM DAS HIERHER GEHÖRT. Fast jeder strukturelle Prüfer entfernt vor dem
 * Zählen Kommentare und Zeichenketten — sonst gilt ein Name in einem Kommentar
 * als Verwendung (die Fehlerklasse, die 2026 sechsmal zuschlug). Wer dabei
 * `//[^\n]*` ohne `[^:]` davor schreibt, frisst jede URL in einer Zeichenkette
 * UND den ganzen Zeilenrest dahinter. Vorgeführt am 24.08.:
 *
 *   'const url = "https://x/v1"; const r = checkPriceAvailable(...)'
 *      naiv   -> 'const url = "https:'          checkPriceAvailable WEG
 *      [^:]   -> unverändert
 *
 * Ein Prüfer mit kaputtem Textfilter wird grundlos rot — oder übersieht still
 * etwas. Damit ist das Netz selbst betroffen, nicht nur ein einzelner Prüfer.
 * lifecycle-rueckkehr.js löst es seit jeher richtig; beim Bau von
 * vola-skalierung und kurs-riegel ist mir derselbe Fehler zweimal
 * unterlaufen — deshalb dieser Riegel.
 */
function pruefeTextfilter() {
  const funde = [];
  const ordner = __dirname;
  for (const datei of fs.readdirSync(ordner).filter((d) => d.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(ordner, datei), "utf8");
    // ZEILENWEISE und ohne Kommentarzeilen. Die erste Fassung meldete diese
    // Datei selbst, weil das Muster in der Erklärung darüber vorkommt — ein
    // Prüfer, der sich an seiner eigenen Dokumentation stört, wird ignoriert,
    // und dann nützt er nichts mehr.
    let naiv = 0;
    for (const zeile of src.split("\n")) {
      const stelle = zeile.indexOf(".replace(/\\/\\/[^\\n]*/");
      if (stelle < 0) continue;
      const kommentar = zeile.indexOf("//");
      const inKommentar = kommentar >= 0 && kommentar < stelle;
      if (!inKommentar) naiv++;
    }
    if (naiv > 0) {
      funde.push(
        `${datei}: ${naiv}x naive Kommentar-Entfernung ohne (^|[^:]) — frisst URLs`
      );
    }
  }
  return funde;
}

// ASYNC seit 07.09.: der Killswitch-Teil unten RUFT die echten
// Ausfuehrungsfunktionen auf, und die sind async. `run-all.js` erwartet das.
module.exports = async function pruefe() {
  const funde = [];
  const filters = read("frontend/lib/trading-filters/trade-filters.ts");
  const orch    = read("frontend/lib/agents/orchestrator-agent.ts");
  const instr   = read("frontend/instrumentation.ts");
  const exec    = read("frontend/lib/capital-com/capital-com-execution.ts");
  const engine  = read("frontend/lib/market-scanner/ai-analysis-engine.ts");
  const atm     = read("frontend/lib/capital-com/active-trade-manager.ts");
  const risk    = read("frontend/lib/agents/risk-agent.ts");

  const pruefungen = [
    // 24.08.: der Kurs-Frische-Filter war bis heute der erste. Seither läuft
    // die Prüfung DAVOR, ob es überhaupt einen Kurs gibt — Frische eines
    // nicht vorhandenen Kurses zu prüfen ist sinnlos. Die alte Beschriftung
    // sagte "als erster Filter" und wäre damit zu einer falschen Aussage
    // geworden; ein Prüfer, der etwas Unwahres behauptet, ist schlimmer als
    // keiner.
    ["Kurs-Vorhanden-Filter ist verdrahtet",        /checkPriceAvailable\(symbol, bid, spread\)/, filters],
    ["Kurs-Vorhanden blockt mit eigenem Grund",     /blockedBy:\s*"PRICE_MISSING"/, filters],
    ["Kurs-Frische-Filter ist verdrahtet",          /checkPriceFreshness\(symbol, priceAgeMinutes, maxPriceAgeMinutes\)/, filters],
    ["Kurs-Frische kommt aus den Einstellungen",    /maxPriceAgeMinutes:\s*settings\.botSettings\.maxPriceAgeMinutes/, orch],
    ["Duplikat-/Pyramiding-Schutz verdrahtet",      /pyramidingEnabled/, orch],
    ["Gesamt-Drawdown-Grenze verdrahtet",           /maxTotalDrawdownPct:\s*settings\.riskSettings/, orch],
    ["Exposure-Grenze verdrahtet",                  /maxExposurePct:\s*settings\.riskSettings/, orch],
    // 13.08.: die dritte Verlust-Grenze war als einzige NICHT einstellbar — sie
    // stand als Standardwert in der Signatur von checkWeeklyLossLimit, und der
    // einzige Aufrufer uebergab nichts. Jetzt neben ihren beiden Geschwistern.
    ["Wochenverlust-Grenze verdrahtet",             /maxWeeklyLossPct:\s*settings\.riskSettings/, orch],
    ["Wochenverlust-Grenze erreicht den Filter",    /checkWeeklyLossLimit\(currentBalance,\s*maxWeeklyLossPct\)/, filters],
    ["Killswitch sperrt den Orchestrator",          /isKillswitchActive\(\)/, instr],
    ["Reentranz-Sperre Orchestrator",               /orchestratorRunning/, instr],
    ["Reentranz-Sperre Positions-Monitor",          /positionMonitorRunning/, instr],
    ["MAX_SIZE-Klemme im Ausführungspfad",          /MAX_SIZE\[epic\]/, exec],
    ["Epic-Tabellen-Selbstprüfung beim Start",      /assertEpicTablesComplete\(\)/, exec],
    ["Kein Signal ohne Stop-Loss",                  /gpt\.stopLoss > 0/, engine],
    ["Kein Signal ohne Take-Profit",                /gpt\.takeProfit > 0/, engine],
    ["Signal-Trichter wird gezählt",                /trichter\.go\+\+/, engine],
    // Stufe 2 (10.08.). Beide Zeilen liessen sich im Sabotage-Lauf ersatzlos
    // streichen, ohne dass etwas rot wurde: die Einstellung kam dann nie beim
    // RiskAgent an, der Schalter in der Oberfläche wäre wirkungslos gewesen —
    // und zwar STILL, weil das Ausbleiben einer Umrechnung genauso aussieht
    // wie "Schalter steht auf AUS".
    ["Ausstiegs-Schwellen werden an den RiskAgent übergeben", /exitSchwellen,?\s*\}\)/, atm],
    ["Ausstiegs-Schwellen werden im RiskAgent angewandt",     /wirksameSchwellen\(regelSchwellen,/, risk],
  ];

  for (const [name, muster, src] of pruefungen) {
    if (!muster.test(src)) funde.push(`FEHLT: ${name}`);
  }

  // Killswitch muss auch die Broker-Sitzungen sperren, sonst ist die Verbindung
  // nach zwei Minuten Keep-Alive wieder da.
  for (const datei of ["frontend/lib/capital-com/capital-com-session.ts", "frontend/lib/icmarkets/icmarkets-session.ts"]) {
    if (!/isKillswitchActive/.test(read(datei))) funde.push(`FEHLT: Killswitch-Sperre in ${datei}`);
  }

  // REIHENFOLGE, nicht nur Vorhandensein (24.08.). Beide Aufrufe können da
  // sein und trotzdem in der falschen Ordnung stehen — ein Muster sieht das
  // nicht. Der Kurs-Vorhanden-Riegel MUSS vor der Frische-Prüfung laufen:
  // das Alter eines nicht vorhandenen Kurses zu prüfen ergibt nichts, und
  // die Frische-Prüfung läuft ausserdem nur, wenn maxPriceAgeMinutes gesetzt
  // ist — ein fehlender Kurs käme dann ganz ungeprüft durch.
  // `[^:]` vor dem `//`, sonst frisst das Muster jede URL in einer Zeichenkette
  // und den Zeilenrest dahinter (siehe lifecycle-rueckkehr.js:79).
  const kette = filters
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const posVorhanden = kette.indexOf("checkPriceAvailable(symbol, bid, spread)");
  const posFrische = kette.indexOf("checkPriceFreshness(symbol, priceAgeMinutes");
  if (posVorhanden < 0 || posFrische < 0) {
    funde.push("FEHLT: einer der beiden Kurs-Filter ist nicht auffindbar");
  } else if (posVorhanden > posFrische) {
    funde.push("REIHENFOLGE: checkPriceAvailable läuft NACH checkPriceFreshness");
  }
  // Und er darf nicht hinter einer Einstellung stehen, die ihn abschalten kann.
  const vorher = posVorhanden >= 0 ? kette.slice(Math.max(0, posVorhanden - 260), posVorhanden) : "";
  if (/if\s*\([^)]*maxPriceAgeMinutes[^)]*\)\s*\{[^}]*$/.test(vorher)) {
    funde.push("Kurs-Vorhanden-Riegel steht in einem bedingten Block");
  }

  // Das Netz prüft auch sich selbst: ein Prüfer mit kaputtem Textfilter macht
  // jede andere strukturelle Prüfung unzuverlässig.
  funde.push(...pruefeTextfilter());

  // ── Keine erfundenen Preise in den Analyse-Routen (25.08.) ──────────────
  //
  // GEFUNDEN BEI DER ANALYSE der Dashboard-Module. In
  // /api/gpt-analyst/analyze stand als letzter Rückfall:
  //
  //   const price = ind?.price ?? (sym === "XAUUSD" ? 2340 : ... : 19000);
  //
  // Fällt Python aus — und dafür gibt es seit dem 19.08. eine eigene
  // Überwachung —, wurden aus diesen Fantasiezahlen Einstieg, Stop und Ziel
  // abgeleitet. In /api/claude-risk/assess stand `?? 0`, woraus atr=0,
  // entry=stop=target=0 und R:R=NaN entstand; genau das ging in den Prompt an
  // Claude.
  //
  // Beide Routen überspringen jetzt Symbole ohne Preis und MELDEN sie.
  // Geprüft wird das Verhalten an seinem Kennzeichen: der Melde-Liste.
  const analyseRouten = [
    ["frontend/app/api/gpt-analyst/analyze/route.ts", "skippedNoPrice", /2340|67500|19000/],
    ["frontend/app/api/claude-risk/assess/route.ts", "skippedNoData", /\?\?\s*0\s*;/],
  ];
  for (const [datei, feld, verbotenesMuster] of analyseRouten) {
    const src = read(datei)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    if (!src.includes(feld)) {
      funde.push(`FEHLT: ${datei} meldet übersprungene Symbole nicht (${feld})`);
    }
    if (verbotenesMuster.test(src)) {
      funde.push(`${datei}: erfundener Preis-Rückfall ist zurück`);
    }
    if (!/Number\.isFinite\(/.test(src)) {
      funde.push(`FEHLT: ${datei} prüft den Preis nicht mit Number.isFinite`);
    }
  }

  // ── Die Herkunft der Analyse ist in der Oberfläche sichtbar ─────────────
  //
  // Die Kacheln hiessen "Live Claude Risk Review" und "Live-AI-Analyse" —
  // auch dann, wenn gar keine AI gefragt wurde, weil kein Schlüssel
  // hinterlegt ist und der regelbasierte Rückfall gerechnet hat. Beides ist
  // brauchbar, aber es ist nicht dasselbe.
  // OHNE KOMMENTARE. Die erste Fassung suchte im Rohtext — und fand
  // "CLAUDE_REAL" in der Erklärung, die ich selbst danebengeschrieben hatte.
  // Im Sabotage-Lauf liess sich der Vergleich durch `false` ersetzen und der
  // Prüfer blieb grün. Genau die Fehlerklasse, die hier am häufigsten
  // zuschlägt — diesmal in meinem eigenen Prüfer.
  const seite = read("frontend/app/page.tsx")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  for (const [marke, quelle] of [["CLAUDE_REAL", "riskSource"], ["GPT_REAL", "gptSource"]]) {
    // Nicht bloss "der Name kommt vor", sondern: er wird VERGLICHEN.
    const muster = new RegExp(`${quelle}\\s*===\\s*"${marke}"`);
    if (!muster.test(seite)) {
      funde.push(`FEHLT: page.tsx unterscheidet ${marke} nicht vom Rückfall`);
    }
  }

  // ── Keine erfundenen Handelsempfehlungen in der Oberfläche (26.08.) ─────
  //
  // ANLASS. Unter `app/` lagen zwei Seiten einer älteren Generation, die
  // vollständige Handelsanweisungen aus einer fest verdrahteten Tabelle
  // rendern — Gold SELL, Einstieg 3345, Stop 3365, Ziel 3290, „Strong Sell",
  // Confidence 91, dazu erfundene Nachrichten. Nichts davon war gerechnet,
  // nichts davon aktuell (der echte Goldkurs stand bei ~3358). Wer die Seite
  // aufrief, sah konkrete Anweisungen, die aus nichts stammten.
  //
  // WAS GEPRÜFT WIRD: Richtung UND Einstieg UND Stop UND Ziel als LITERALE
  // innerhalb desselben Blocks. Das ist eine vollständige Empfehlung, und die
  // darf in der Oberfläche nur aus einer Rechnung kommen, nie aus dem
  // Quelltext. Einzelne Zahlen sind erlaubt — ein Schwellwert oder eine
  // Beispiel-Grösse ist kein Signal.
  //
  // `api/` ist ausgenommen: dort steht mit `TradeTicketBuilder.build(...)` ein
  // legitimer Aufbau mit Stellungsargumenten, kein Literal-Block.
  {
    const APP = path.join(__dirname, "..", "..", "frontend", "app");
    const UEBER = new Set(["generated", "api"]);
    const dateien = [];
    (function lauf(d) {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (UEBER.has(e.name)) continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) lauf(p);
        else if (/\.tsx?$/.test(e.name)) dateien.push(p);
      }
    })(APP);

    const EMPFEHLUNG = new RegExp(
      "direction\\s*:\\s*[\"'](BUY|SELL|LONG|SHORT)[\"'][\\s\\S]{0,400}?"
      + "entry\\s*:\\s*[\"']?[\\d.]+[\"']?[\\s\\S]{0,300}?"
      + "stopLoss\\s*:\\s*[\"']?[\\d.]+[\"']?[\\s\\S]{0,300}?"
      + "takeProfit\\s*:\\s*[\"']?[\\d.]+[\"']?", "g");

    for (const datei of dateien) {
      const src = fs.readFileSync(datei, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      const treffer = [...src.matchAll(EMPFEHLUNG)];
      if (treffer.length > 0) {
        const rel = path.relative(path.join(__dirname, "..", ".."), datei)
          .split("\\").join("/");
        funde.push(
          `ERFUNDENE HANDELSEMPFEHLUNG: ${rel} — ${treffer.length} Block/Blöcke `
          + `mit Richtung, Einstieg, Stop und Ziel als feste Literale. `
          + `Eine Empfehlung in der Oberfläche muss gerechnet sein.`
        );
      }
    }
  }

  // ── Der Brute-Force-Zähler räumt auf (26.08.) ───────────────────────────
  //
  // HEISST SEIT 07.09. proxy.ts — Next.js 16 hat die Dateikonvention
  // umbenannt (`middleware` ist abgekündigt). Der Inhalt ist derselbe; nur
  // der Pfad hier und der Funktionsname in der Datei haben sich geändert.
  // Zusätzlich geprüft wird jetzt, dass die alte Datei WIRKLICH weg ist:
  // lägen beide da, wäre nicht mehr erkennbar, welche greift.
  //
  // ANLASS. `bruteForceMap` in proxy.ts bekam für JEDE anonyme Anfrage
  // einen Eintrag und hat ihn nie wieder entfernt — eine IP, die einmal
  // vorbeikommt, blieb bis zum nächsten Deploy stehen. Ein öffentlich
  // erreichbarer Server wird dauerhaft von Scannern abgeklopft; die Karte
  // wuchs also monoton. Kein Absturz, aber ein Leck, und es lief seit dem
  // ersten Tag.
  //
  // Belegt verhaltensneutral: 25 520 Anfragen durch beide Fassungen, NULL
  // abweichende Entscheidungen bei 88 echten Auslösungen. Entfernt werden nur
  // Einträge, deren Fenster ohnehin abgelaufen ist.
  //
  // OHNE KOMMENTARE — der Name steht auch in der Erklärung darüber.
  {
    const mw = read("frontend/proxy.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    if (!/function\s+bruteForceAufraeumen/.test(mw)) {
      funde.push("FEHLT: proxy.ts räumt bruteForceMap nicht auf — Speicherleck");
    }
    // Die umbenannte Datei muss den Einstiegspunkt auch WIRKLICH exportieren.
    // Ein Rename der Datei ohne Rename der Funktion ergibt einen Proxy, den
    // Next.js nie aufruft — und damit fielen Anmeldung, IP-Blockliste und
    // Brute-Force-Erkennung STILL aus, ohne Fehlermeldung.
    if (!/export\s+async\s+function\s+proxy\s*\(/.test(mw)) {
      funde.push("FEHLT: proxy.ts exportiert keine Funktion `proxy` — "
        + "Next.js 16 ruft dann nichts auf (Auth/Blockliste still aus)");
    }
    // `export const runtime` wirft in einer Proxy-Datei (Next-16-Doku,
    // proxy.md Abschnitt "Runtime"). Beim Umbenennen stehengelassen hätte es
    // den Proxy für JEDE Anfrage zum Werfen gebracht.
    if (/export\s+const\s+runtime\s*=/.test(mw)) {
      funde.push("proxy.ts setzt `runtime` — das wirft in einer Proxy-Datei "
        + "(Next-16-Doku proxy.md, Abschnitt Runtime)");
    }
    // Und die alte Datei darf nicht danebenliegen.
    if (require("fs").existsSync(
      require("path").join(__dirname, "../../frontend/middleware.ts")
    )) {
      funde.push("frontend/middleware.ts liegt noch da — neben proxy.ts ist "
        + "nicht mehr erkennbar, welche Datei greift");
    }
    if (!/bruteForceMap\.delete\(/.test(mw)) {
      funde.push("FEHLT: bruteForceAufraeumen löscht nichts");
    }
    // Nur ABGELAUFENE Einträge dürfen weg. Eine Verdrängung ohne Fensterprüfung
    // würde einem Angreifer seinen Zähler zurücksetzen.
    if (!/now\s*-\s*eintrag\.firstSeen\s*>\s*BRUTE_WINDOW_MS/.test(mw)) {
      funde.push(
        "FEHLT: das Aufräumen prüft das Zeitfenster nicht — es würde laufende "
        + "Zähler löschen und damit die Brute-Force-Erkennung aushebeln"
      );
    }
    // Und es muss auch GERUFEN werden.
    if (!/bruteForceAufraeumen\(now\)/.test(mw)) {
      funde.push("FEHLT: bruteForceAufraeumen wird nirgends aufgerufen");
    }
  }

  // ── Die letzte Stufe des Signal-Trichters ist ablesbar (27.08.) ─────────
  //
  // ANLASS. Der Bot stand fest, und der Trichter meldete nur
  // "SL/TP gesetzt 3 → Risiko-Freigabe (R/R≥1.5) 0 = GO". Drei Signale
  // erreichten die letzte Stufe, keines kam durch — und WORAN war aus dem Log
  // nicht zu erkennen. Die Beschriftung nennt nur das Chance-Risiko, die echte
  // Bedingung ist `riskScore < 60 && rr >= 1.5`. Es konnte beides sein.
  //
  // Ausserdem gab sich der regelbasierte Rückfall als echte Claude-Antwort aus:
  // `simulateClaude()` lieferte `source: "CLAUDE_REAL"`, und `CLAUDE_SIMULATED`
  // war im ganzen Programm nirgends gesetzt.
  {
    const roh = read("frontend/lib/market-scanner/ai-analysis-engine.ts");
    const ohne = roh
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

    // 1. Der Rückfall darf sich nicht als echt ausgeben.
    const simBlock = ohne.slice(
      ohne.indexOf("function simulateClaude"),
      ohne.indexOf("function simulateClaude") + 900
    );
    if (/source:\s*"CLAUDE_REAL"/.test(simBlock)) {
      funde.push(
        'simulateClaude() gibt sich als "CLAUDE_REAL" aus — eine Regel-Rechnung '
        + "als Antwort des echten Modells ausgewiesen"
      );
    }
    if (!/source:\s*"CLAUDE_SIMULATED"/.test(simBlock)) {
      funde.push('simulateClaude() kennzeichnet sich nicht als "CLAUDE_SIMULATED"');
    }

    // 2. Die Ablehnung an der letzten Stufe muss die ZAHLEN nennen.
    if (!/NICHT freigegeben/.test(roh)) {
      funde.push(
        "FEHLT: keine Meldung, warum ein Signal an der letzten Stufe scheitert — "
        + "dann steht wieder nur '0 = GO' im Log"
      );
    }
    if (!/rewardRiskRatio\.toFixed\(2\)/.test(ohne)) {
      funde.push("FEHLT: der R/R-Wert wird bei der Ablehnung nicht ausgegeben");
    }
    if (!/riskScore\s*>=\s*60/.test(ohne)) {
      funde.push("FEHLT: der Risiko-Score wird bei der Ablehnung nicht geprüft/genannt");
    }
    // Der Risiko-Score ist NUR im echten Pfad eine Bedingung — wer ihn auch im
    // Rückfall nennt, gibt einen Grund an, den es dort nicht gibt.
    if (!/claude\.source\s*===\s*"CLAUDE_REAL"\s*&&\s*claude\.riskScore/.test(ohne)) {
      funde.push(
        "der Risiko-Score wird ohne Herkunfts-Prüfung als Ablehnungsgrund genannt — "
        + "im regelbasierten Rückfall ist er gar keine Bedingung"
      );
    }

    // 3. Eine Simulation im Handelspfad darf nicht still laufen.
    if (!/handelbare\(s\) Signal\(e\) ohne Claude bewertet/.test(roh)) {
      funde.push(
        "FEHLT: es wird nicht gemeldet, wenn der regelbasierte Rückfall ein "
        + "handelbares Signal bewertet hat"
      );
    }
  }

  // ══ Das Handelszeit-Tor RECHNEN (07.09.) ═════════════════════════════════
  //
  // `isWithinTradingSession()` entscheidet ueber JEDEN neuen Trade — und war
  // von keinem einzigen Pruefer abgesichert. Eine verrutschte Grenze
  // (>= statt >, 21 statt 22, ein vergessener Wochentag) haette den Bot
  // entweder ausserhalb der Handelszeit eroeffnen lassen oder ihn stumm
  // stillgelegt. Beides faellt erst im Log auf, wenn es zu spaet ist.
  //
  // Seit dem 07.09. haengt daran zusaetzlich der teure Teil: ausserhalb der
  // Session wird die Analyse gar nicht mehr gerechnet.
  let zusatz = 0;
  const torPruefung = (name, bedingung, extra) => {
    zusatz++;
    if (!bedingung) funde.push(`${name}${extra ? ` — ${extra}` : ""}`);
  };

  const orchModul = ladeTsModul("lib/agents/orchestrator-agent.ts");
  if (orchModul.fehler) {
    funde.push(`orchestrator-agent nicht ladbar: ${orchModul.fehler}`);
  } else if (typeof orchModul.exports.isWithinTradingSession !== "function") {
    funde.push("isWithinTradingSession wird nicht exportiert — das Tor, das "
      + "ueber jeden neuen Trade entscheidet, bleibt ungeprueft");
  } else {
    const imFenster = orchModul.exports.isWithinTradingSession;
    // 07.09.2026 ist ein Montag, 11.09. ein Freitag, 12.09. Samstag,
    // 06.09. Sonntag — nachgerechnet, nicht angenommen.
    for (const [name, iso, soll] of [
      ["Montag 07:59 UTC — eine Minute zu frueh", "2026-09-07T07:59:00Z", false],
      ["Montag 08:00 UTC — London oeffnet", "2026-09-07T08:00:00Z", true],
      ["Montag 21:59 UTC — letzte Minute", "2026-09-07T21:59:00Z", true],
      ["Montag 22:00 UTC — New York schliesst", "2026-09-07T22:00:00Z", false],
      ["Freitag 21:59 UTC — Wochenschluss", "2026-09-11T21:59:00Z", true],
      ["Samstag 12:00 UTC", "2026-09-12T12:00:00Z", false],
      ["Sonntag 12:00 UTC", "2026-09-06T12:00:00Z", false],
    ]) {
      const ist = imFenster(new Date(iso));
      torPruefung(`Handelsfenster falsch: ${name}`, ist === soll,
        `ist ${ist}, soll ${soll}`);
    }
  }

  // Strukturell: die teure Analyse muss VOR dem Ruecksprung stehen bleiben —
  // sonst rechnet der Zyklus wieder fuer nichts.
  torPruefung("ausserhalb der Session wird die Analyse wieder gerechnet",
    // Seit 16.09. gibt der Ruecksprung seinen Grund zurueck (Zyklus-Bilanz).
    /if \(blockNewTrades\) \{[\s\S]{0,600}?return(?: "[^"]*")?;\s*\}\s*const analysisResult = await runAnalysisAgent/
      .test(orch),
    "der Ruecksprung muss VOR runAnalysisAgent stehen, nicht danach");
  torPruefung("es steht nicht im Log, dass die Analyse ausgelassen wurde",
    /Analyse AUSGELASSEN/.test(orch),
    "sonst sieht ein stiller Zyklus wie ein Ausfall aus");

  // ══ DER NOTAUS SPERRT JEDE NEUE ORDER — AUSGEFUEHRT (07.09.) ═════════════
  //
  // DER FUND. `isKillswitchActive()` wurde an KEINER Ausfuehrungsstelle
  // abgefragt. Der Notaus wirkte nur MITTELBAR: `triggerKillswitch()` baut die
  // Broker-Sitzung ab, danach schlaegt der `!session`-Riegel an.
  //
  // Das ist kein geschlossenes Loch gewesen, aber eine Deckung mit Zeitfenster:
  // `disconnectBrokers()` ist ein fire-and-forget-IIFE (killswitch-engine.ts),
  // und darin geht erst ein NETZAUFRUF zu Capital.com raus, bevor
  // `global.__capital_session__ = null` gesetzt wird. Bis dahin ist die Sitzung
  // gueltig. Bei IC Markets ist es schwaecher: der erste Riegel dort
  // (`isICMarketsConfigured()`) prueft Zugangsdaten, nicht die Sitzung — den
  // beruehrt der Killswitch gar nicht.
  //
  // Geprueft wird RECHNEND, nicht nach Wortlaut: das echte Modul wird geladen,
  // der Killswitch-Stellvertreter auf "aktiv" gestellt und die echte
  // Ausfuehrungsfunktion GERUFEN.
  //
  // Der zweite Teil ist der eigentliche Beweis: mit AKTIVER Sitzung. Stuende
  // der Riegel hinter der Sitzungspruefung, waere er im Ernstfall — genau im
  // Rennfenster — wirkungslos. Dieselbe Fehlerklasse wie am 07.09. beim
  // Modell-Rueckfall: "ein Netz, das nur in eine Richtung greift".
  const brokerFaelle = [
    {
      name: "Capital.com",
      pfad: "lib/capital-com/capital-com-execution.ts",
      funktion: "executeCapitalDemoOrder",
      // Eine Sitzung, die es WIRKLICH gibt — sonst faenge der !session-Riegel
      // den Fall ab und der Test bewiese nichts ueber den Killswitch.
      sitzung: {
        getCapitalSession: () => ({
          apiKey: "x", cst: "y", securityToken: "z",
          balance: 10000, currency: "USD", accountId: "A1",
        }),
      },
      sitzungsModul: "capital-com-session",
      req: {
        symbol: "EURUSD", direction: "BUY", riskPercent: 1,
        accountBalance: 10000, stopLossPrice: 1.05, takeProfitPrice: 1.15,
        confidence: 80, strategy: "T", tradingStyle: "DAYTRADING",
      },
    },
    {
      name: "IC Markets",
      pfad: "lib/icmarkets/icmarkets-execution.ts",
      funktion: "executeICMarketsOrder",
      sitzung: {
        getICMarketsSession: () => ({ accessToken: "t", accountId: 1, balance: 10000 }),
      },
      sitzungsModul: "icmarkets-session",
      req: {
        symbol: "EURUSD", direction: "BUY", riskPercent: 1,
        accountBalance: 10000, stopLossPrice: 1.05, takeProfitPrice: 1.15,
        confidence: 80, tradingStyle: "DAYTRADING",
      },
    },
  ];

  // Die echten Funktionen loggen. Ohne Daempfung stuenden ihre Zeilen mitten
  // in der Pruefausgabe und man haelt sie fuer einen Befund.
  const echtesLog = console.log, echteWarnung = console.warn, echterFehler = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try {
  for (const f of brokerFaelle) {
    const laden = (aktiv) => ladeTsModul(f.pfad, {
      "killswitch-engine": { isKillswitchActive: () => aktiv },
      [f.sitzungsModul]: f.sitzung,
      // Der Broker-Client MUSS explodieren, wenn er trotzdem gerufen wird —
      // sonst koennte ein durchgerutschter Auftrag als "ok: false" enden und
      // wie ein greifender Riegel aussehen.
      "icmarkets-client": {
        isICMarketsConfigured: () => true,
        icPlaceOrder: () => { throw new Error("ORDER RAUSGEGANGEN trotz Killswitch"); },
        icGetPrice: () => { throw new Error("PREISABFRAGE trotz Killswitch"); },
      },
      "capital-com-client": {
        EPIC_MAP: { EURUSD: "EURUSD" },
        capitalPlaceOrder: () => { throw new Error("ORDER RAUSGEGANGEN trotz Killswitch"); },
        capitalGetPositions: () => { throw new Error("POSITIONSABFRAGE trotz Killswitch"); },
        capitalClosePosition: () => { throw new Error("SCHLIESSEN trotz Killswitch"); },
      },
    });

    const modul = laden(true);
    if (modul.fehler) {
      torPruefung(`${f.name}: Ausfuehrungsmodul nicht ladbar`, false, modul.fehler);
      continue;
    }
    const fn = modul.exports[f.funktion];
    if (typeof fn !== "function") {
      torPruefung(`${f.name}: ${f.funktion} wird nicht exportiert`, false, "Umbenennung?");
      continue;
    }

    let ergebnis = null;
    let geworfen = null;
    try {
      ergebnis = await fn(f.req);
    } catch (e) { geworfen = e; }

    // 1. Kein Wurf — ein geworfener Fehler wuerde die Handelsschleife toeten.
    torPruefung(`${f.name}: der Killswitch-Riegel WIRFT statt zurueckzugeben`,
      geworfen === null,
      geworfen ? String(geworfen.message) : "");
    // 2. Die Order wird abgelehnt — bei GUELTIGER Sitzung.
    torPruefung(`${f.name}: bei aktivem Killswitch wird trotzdem ausgefuehrt`,
      ergebnis !== null && ergebnis.ok === false,
      JSON.stringify(ergebnis)?.slice(0, 160));
    // 3. Und zwar MIT NENNUNG des Grundes — sonst ist im Log nicht zu sehen,
    //    warum nichts passiert, und ein Notaus sieht aus wie ein Ausfall.
    torPruefung(`${f.name}: die Ablehnung nennt den Killswitch nicht`,
      typeof ergebnis?.error === "string" && /Killswitch/i.test(ergebnis.error),
      String(ergebnis?.error).slice(0, 120));

    // 4. GEGENPROBE: ohne Killswitch darf der Riegel NICHT greifen. Ein Riegel,
    //    der immer sperrt, wuerde den Handel komplett anhalten — das faellt
    //    sonst erst im Betrieb auf. Hier explodiert der Client-Stellvertreter
    //    absichtlich: dass es bis dorthin kommt, IST der Beweis, dass der
    //    Killswitch-Riegel nicht mehr im Weg steht.
    const offen = laden(false);
    let e2 = null, r2 = null;
    try { r2 = await offen.exports[f.funktion](f.req); } catch (e) { e2 = e; }
    const kamDurch = (e2 !== null)
      || (r2 && !(typeof r2.error === "string" && /Killswitch/i.test(r2.error)));
    torPruefung(`${f.name}: der Riegel sperrt AUCH OHNE Killswitch — der Handel stuende still`,
      kamDurch, JSON.stringify(r2)?.slice(0, 160));
  }
  } finally {
    console.log = echtesLog; console.warn = echteWarnung; console.error = echterFehler;
  }

  // ══ IC-MARKETS: DIE MCP-SITZUNG WIRD WIRKLICH ERNEUERT — AUSGEFUEHRT ═════
  //
  // DER FUND (08.09., aus dem Betriebslog). Alle zwei Minuten stand dort:
  //
  //   [IC Markets] Keep-alive failed (IC Markets MCP error: HTTP 404 —
  //   {"jsonrpc":"2.0","error":{"code":-32000,
  //    "message":"Session not found; re-initialize"},"id":null})
  //
  // Der Wiederherstellungszweig in `mcpCall` lautete `text.includes("session")`
  // — mit KLEINEM s. In der Antwort steht "Session" mit grossem S, und ein
  // kleingeschriebenes "session" kommt darin nicht vor. Die Bedingung war also
  // immer false: es wurde geworfen statt neu angemeldet. Der Server sagte
  // woertlich "re-initialize", und genau das ist nie passiert.
  //
  // Dass die geworfene Meldung im Log steht, BEWEIST es: sie stammt aus der
  // Zeile UNTER dem Zweig.
  //
  // Geprueft wird rechnend, mit gestelltem `fetch` — eine Struktur-Pruefung
  // saehe den Unterschied zwischen "session" und /session/i nicht an.
  {
    const icPfad = path.join(__dirname, "../../frontend/lib/icmarkets/icmarkets-client.ts");
    if (!fs.existsSync(icPfad)) {
      torPruefung("icmarkets-client.ts fehlt", false, icPfad);
    } else {
      const SITZUNGSFEHLER = '{"jsonrpc":"2.0","error":{"code":-32000,'
        + '"message":"Session not found; re-initialize"},"id":null}';

      // `immerKaputt`: der Server gibt den Sitzungsfehler IMMER zurueck.
      // Damit wird der zweite Teil geprueft — dass EIN Versuch reicht und die
      // Rekursion nicht endlos laeuft.
      const bauen = (immerKaputt) => {
        const zaehler = { initialize: 0, toolsCall: 0 };
        const echtesFetch = global.fetch;
        global.fetch = async (_url, opts) => {
          const body = JSON.parse(String(opts?.body ?? "{}"));
          if (body.method === "initialize") {
            zaehler.initialize++;
            return {
              ok: true, status: 200,
              headers: { get: (h) => (h === "mcp-session-id" ? "SID-NEU" : null) },
              json: async () => ({ result: {} }),
              text: async () => "{}",
            };
          }
          zaehler.toolsCall++;
          // NOTBREMSE im Pruefstand. Ohne Wiederholungs-Riegel ruft sich
          // `mcpCall` ueber `return mcpCall(...)` selbst auf — und weil das
          // ASYNCHRON geschieht, waechst kein Stack: es gaebe keinen
          // Ueberlauf, sondern eine Endlosschleife, die den Pruefer AUFHAENGT
          // statt ihn rot zu machen. Ein Pruefer, der haengt, meldet nichts.
          if (zaehler.toolsCall > 5) {
            throw new Error("Pruefstand-Notbremse: mehr als 5 Versuche — "
              + "die Wiederholung ist nicht begrenzt");
          }
          // Erster Aufruf scheitert immer; danach nur noch, wenn immerKaputt.
          if (zaehler.toolsCall === 1 || immerKaputt) {
            return {
              ok: false, status: 404,
              headers: { get: () => null },
              text: async () => SITZUNGSFEHLER,
              json: async () => ({}),
            };
          }
          return {
            ok: true, status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({ result: { balance: 1234 } }),
            text: async () => "{}",
          };
        };
        // Der Zustand liegt auf `global` — zwischen den Faellen zuruecksetzen,
        // sonst traegt der zweite die Sitzung des ersten.
        global.__icmarkets_mcp_session__ = null;
        const modul = ladeTsModul("lib/icmarkets/icmarkets-client.ts", {});
        return { modul, zaehler, aufraeumen: () => { global.fetch = echtesFetch; } };
      };

      const stillesLog = console.warn;
      console.warn = () => {};
      try {
        // ── Fall 1: Sitzung abgelaufen, Neuanmeldung hilft ────────────────
        const a = bauen(false);
        if (a.modul.fehler) {
          torPruefung("icmarkets-client nicht ladbar", false, a.modul.fehler);
          a.aufraeumen();
        } else {
          let ergebnis = null, fehler = null;
          try { ergebnis = await a.modul.exports.mcpCall("get_account", {}); }
          catch (e) { fehler = e; }
          a.aufraeumen();
          torPruefung("eine abgelaufene MCP-Sitzung wird NICHT erneuert — "
            + "der Keep-alive scheitert dann alle 2 Minuten endlos",
            fehler === null && ergebnis !== null,
            fehler ? String(fehler.message).slice(0, 120) : "");
          torPruefung("nach dem Sitzungsfehler wurde nicht neu angemeldet",
            a.zaehler.initialize >= 2,
            `initialize ${a.zaehler.initialize}x (1x beim Start + 1x nach dem Fehler erwartet)`);
          torPruefung("der Aufruf wurde nach der Neuanmeldung nicht wiederholt",
            a.zaehler.toolsCall === 2, `tools/call ${a.zaehler.toolsCall}x`);
        }

        // ── Fall 2: Sitzung bleibt kaputt — GENAU EIN Versuch ─────────────
        //
        // Der Zweig war tot; ihn zu beleben legt frei, dass `mcpCall` sich
        // selbst aufruft. Ohne Riegel waere daraus eine Endlosrekursion
        // geworden — ein neuer Fehler, schlimmer als der behobene.
        const b = bauen(true);
        if (!b.modul.fehler) {
          let fehler2 = null;
          try { await b.modul.exports.mcpCall("get_account", {}); }
          catch (e) { fehler2 = e; }
          b.aufraeumen();
          torPruefung("eine dauerhaft kaputte Sitzung wirft nicht, sondern laeuft weiter",
            fehler2 !== null, "erwartet wird ein Fehler nach einem Versuch");
          torPruefung("die Wiederholung ist nicht begrenzt — Gefahr der Endlosrekursion",
            b.zaehler.toolsCall === 2, `tools/call ${b.zaehler.toolsCall}x statt genau 2x`);
          // Und der Beweis, dass es NICHT an einem Stack-Overflow lag:
          torPruefung("der Abbruch kam nicht vom Sitzungsfehler",
            fehler2 !== null && /HTTP 404/.test(String(fehler2.message)),
            String(fehler2?.message).slice(0, 100));
        } else {
          b.aufraeumen();
        }
      } finally {
        console.warn = stillesLog;
      }

      // Der Zustand gehoert auf `global` — beide Seiten (API-Routen und die
      // 2-Minuten-Schleife aus instrumentation.ts) benutzen diese Datei.
      const icQuell = read("frontend/lib/icmarkets/icmarkets-client.ts")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      torPruefung("die MCP-Sitzungskennung liegt wieder modul-scoped",
        !/^\s*let\s+mcpSessionId/m.test(icQuell)
        && /global\.__icmarkets_mcp_session__/.test(icQuell),
        "API-Routen und die Keep-alive-Schleife saehen sonst verschiedene Kopien");
      // Und das Ergebnis des Reconnect-Versuchs muss im Log stehen.
      const icSess = read("frontend/lib/icmarkets/icmarkets-session.ts")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      torPruefung("das Ergebnis des Reconnect-Versuchs wird verworfen",
        /const\s+\w+\s*=\s*await autoReconnectICMarkets\(\)/.test(icSess)
        && /Reconnect/.test(icSess),
        "sonst steht im Log nur 'attempting reconnect' und nie, ob es klappte");
    }
  }

  // ══ JEDES ausgefallene KI-TOR MELDET SICH — AUSGEFUEHRT (08.09.) ═════════
  //
  // DER FUND. Am 08.09. war das Anthropic-Guthaben leer. Ueber Telegram kam
  // stuendlich GENAU EINE Meldung — die des Orchestrators. Ausgefallen waren
  // aber fuenf Tore:
  //
  //   Orchestrator AI Manager     proceed: true                 meldete
  //   ExecutionAgent AI Manager   approve: true, beide Broker    meldete
  //   Meta-KI (analysis-agent)    ALLE Kandidaten approved       schwieg
  //   Risk-Agent AI (Ausstiege)   action: "APPROVE"              schwieg
  //   Security-Watchdog           return null, keine Eskalation  schwieg
  //
  // Der Text sagte dazu "andere Sicherheitsschichten bleiben aktiv". Fuer die
  // NICHT-KI-Schichten stimmt das; fuer die anderen KI-Tore nicht. Am
  // schwersten wog der Watchdog: ohne Beurteilung kann `handleAttack()` nicht
  // laufen, der automatische Killswitch bei einem Angriff loest NICHT aus.
  //
  // Dazu stand `alertAIGateFallback` ZWEIMAL wortgleich im Code, jede Fassung
  // mit eigenem modul-scoped Zeitstempel — dieselbe Entscheidung an zwei
  // Stellen, in diesem Projekt die haeufigste Fehlerklasse.
  const torModul = ladeTsModul("lib/ai-gate/ai-gate-alert.ts", {});
  if (torModul.fehler) {
    torPruefung("ai-gate-alert nicht ladbar", false, torModul.fehler);
  } else if (typeof torModul.exports.alarmFaellig !== "function") {
    torPruefung("alarmFaellig wird nicht exportiert", false, "Umbenennung?");
  } else {
    const faellig = torModul.exports.alarmFaellig;
    global.__ai_gate_alert__ = {};
    const t0 = 1_000_000_000_000;
    torPruefung("die erste Meldung eines Tors wird unterdrueckt",
      faellig("Watchdog", t0) === true);
    torPruefung("dasselbe Tor meldet sich innerhalb der Stunde erneut",
      faellig("Watchdog", t0 + 59 * 60 * 1000) === false);
    torPruefung("nach einer Stunde meldet sich dasselbe Tor nicht wieder",
      faellig("Watchdog", t0 + 60 * 60 * 1000 + 1) === true);
    // DER KERN: die Drossel gilt JE TOR. Ein gemeinsamer Zeitstempel haette
    // den zweiten Ausfall fuer eine Stunde verschluckt — und genau die
    // Vollstaendigkeit ist der Zweck.
    global.__ai_gate_alert__ = {};
    faellig("Orchestrator", t0);
    torPruefung("ein zweites Tor wird von der Drossel des ersten verschluckt",
      faellig("Meta-KI", t0) === true, "die Drossel muss JE TOR gelten");
    torPruefung("ein drittes Tor ebenfalls",
      faellig("Risk-Agent", t0) === true);
    // Der Zustand gehoert auf `global`.
    torPruefung("der Drosselungs-Zustand liegt nicht auf global",
      global.__ai_gate_alert__ && typeof global.__ai_gate_alert__ === "object"
      && global.__ai_gate_alert__["Orchestrator"] === t0,
      "modul-scoped saehen Routen und Schleife verschiedene Drosseln");
    // Jedes Tor braucht einen eigenen Folgentext — sonst meldet es zwar, sagt
    // aber nicht, was jetzt fehlt.
    const folgen = torModul.exports.TOR_FOLGE ?? {};
    for (const tor of ["Orchestrator", "ExecutionAgent", "Meta-KI", "Risk-Agent", "Watchdog"]) {
      torPruefung(`Tor "${tor}" hat keinen eigenen Folgentext`,
        typeof folgen[tor] === "string" && folgen[tor].length > 20, String(folgen[tor]));
    }
    torPruefung("der Watchdog-Text nennt den ausbleibenden Killswitch nicht",
      /[Kk]illswitch/.test(String(folgen["Watchdog"] ?? "")),
      "ohne Beurteilung kann handleAttack() nicht ausloesen");
  }

  // Und alle FUENF Tore muessen die gemeinsame Meldung wirklich rufen.
  // Kommentare weg — die Begruendungen oben nennen die Tore namentlich.
  const ohneKomm = (p) => read(p)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  for (const [name, datei] of [
    ["Orchestrator", "frontend/lib/agents/orchestrator-agent.ts"],
    ["ExecutionAgent", "frontend/lib/agents/execution-agent.ts"],
    ["Meta-KI", "frontend/lib/agents/analysis-agent.ts"],
    ["Risk-Agent", "frontend/lib/agents/risk-agent.ts"],
    ["Watchdog", "frontend/lib/security-watchdog/claude-watchdog.ts"],
  ]) {
    torPruefung(`Tor "${name}" meldet seinen Ausfall nicht`,
      /meldeAIGateAusfall/.test(ohneKomm(datei)),
      "der Ausfall stuende dann nur in der Serverkonsole");
  }

  // ── JEDER stille Ausgang des Watchdogs muss melden ───────────────────────
  //
  // Die Pruefung darueber sucht den Namen EINMAL je Datei. Der Watchdog hat
  // aber ZWEI Ausgaenge, die `null` zurueckgeben — den API-Fehler und die
  // Antwort ohne Textblock. Im Sabotage-Lauf vom 08.09. liess sich deshalb
  // jede der beiden Meldungen einzeln entfernen, ohne dass etwas rot wurde:
  // die jeweils andere erfuellte die Suche. Genau die Fehlerklasse, vor der
  // CLAUDE.md warnt — ein Treffer an EINER Stelle ist kein Beweis fuer die
  // andere.
  //
  // Beide Ausgaenge bedeuten dasselbe: nicht beurteilt, also keine Eskalation
  // und kein automatischer Killswitch.
  {
    const wd = ohneKomm("frontend/lib/security-watchdog/claude-watchdog.ts");
    const stellen = [...wd.matchAll(/return null;/g)];
    torPruefung("der Watchdog hat keine null-Ausgaenge mehr — Pruefung ins Leere",
      stellen.length >= 2, `${stellen.length} gefunden, 2 erwartet`);
    let ungemeldet = 0;
    for (const m of stellen) {
      const davor = wd.slice(Math.max(0, m.index - 300), m.index);
      if (!/meldeAIGateAusfall/.test(davor)) ungemeldet++;
    }
    torPruefung("ein stiller Ausgang des Watchdogs meldet nichts",
      ungemeldet === 0,
      `${ungemeldet} von ${stellen.length} `
      + `return-null-Ausgaengen ohne Meldung — keine Eskalation, kein Killswitch`);
  }
  // Die alte, zu weit gefasste Behauptung darf nicht zurueckkehren.
  torPruefung("die Meldung behauptet wieder pauschal, andere Schichten seien aktiv",
    !/andere Sicherheitsschichten bleiben aktiv/.test(ohneKomm("frontend/lib/ai-gate/ai-gate-alert.ts")),
    "vier von fuenf KI-Toren koennen GLEICHZEITIG aus sein");
  // Und keine zweite Fassung der Drossel mehr.
  for (const datei of ["frontend/lib/agents/orchestrator-agent.ts",
                       "frontend/lib/agents/execution-agent.ts"]) {
    torPruefung(`${datei.split("/").pop()}: eigene Drossel wieder eingebaut`,
      !/last\w*GateAlertAt/.test(ohneKomm(datei)),
      "zwei Kopien derselben Entscheidung");
  }

  // ══ KEIN ZEIT-EXIT AUF GERATENEM STIL — BEIDE BROKER (08.09.) ════════════
  //
  // DER FUND aus der Generalkontrolle. Der Riegel existierte seit dem 19.08.
  // NUR im Capital.com-Pfad (`risk-agent.ts`, `stilGeraten`). Die Begruendung
  // dort woertlich: "Waere die Position in Wirklichkeit SWING gedacht (168 h),
  // wuerde sie 144 Stunden zu frueh geschlossen. Das ist kein Schutz mehr, das
  // ist ein Eingriff auf einer Annahme, und er kostet echtes Geld."
  //
  // Bei IC MARKETS fehlte er. Dort stand
  //   tradingStyle: m.tradingStyle ?? m.strategy ?? "DAYTRADING"
  // und im Speicher-Rueckfall ebenso — und direkt danach schloss der Zeit-Exit
  // auf genau diesem geratenen Wert. Dieselbe Fehlerklasse, ein Broker
  // behoben, der andere nicht.
  //
  // Kommentare weg: die Begruendungen in beiden Dateien nennen den Namen.
  {
    const ohne = (p) => read(p)
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    for (const [name, datei] of [
      ["Capital.com", "frontend/lib/agents/risk-agent.ts"],
      ["IC Markets", "frontend/lib/icmarkets/icmarkets-trade-manager.ts"],
    ]) {
      const q = ohne(datei);
      torPruefung(`${name}: kein Riegel gegen den Zeit-Exit auf geratenem Stil`,
        /stilGeraten/.test(q),
        "ein Eingriff auf einer Annahme, der Geld kostet");
      // BEIDE Quellen einzeln pruefen, nicht per ODER. Die erste Fassung
      // erlaubte "abgeleitet ODER fest true" — im Sabotage-Lauf liess sich
      // damit die ABGELEITETE Kennzeichnung auf `false` setzen, waehrend der
      // Speicher-Rueckfall mit `true` die Pruefung gruen hielt. Ein Treffer an
      // EINER Stelle ist kein Beweis fuer die andere (CLAUDE.md).
      torPruefung(`${name}: der geratene Stil wird nicht aus den Daten ABGELEITET`,
        /stilGeraten:\s*!/.test(q),
        "ohne Ableitung ist die Kennzeichnung eine Behauptung");
    }
    // Und im IC-Pfad muss die Bedingung WIRKLICH vor dem Schliessen stehen.
    const ic = ohne("frontend/lib/icmarkets/icmarkets-trade-manager.ts");
    // IC hat ZWEI Quellen (Datenbank-Notizen und Speicher-Karte) und deshalb
    // zwei Stellen, an denen der Stil entstehen kann. Capital.com deckt beide
    // in EINEM abgeleiteten Ausdruck ab (`!dbEntry && !hatSpeicher`) und
    // braucht kein literales `true` — die erste Fassung dieser Pruefung
    // verlangte es von beiden und wurde bei Capital.com zu Unrecht rot.
    // Hier gilt es: der Speicher-Rueckfall ohne jede Quelle MUSS als geraten
    // gelten, sonst faellt genau der ungedeckteste Fall durch.
    torPruefung("IC Markets: der Speicher-Rueckfall gilt nicht als geraten",
      /tradingStyle: "DAYTRADING",\s*stilGeraten: true/.test(ic),
      "genau dort ist der Stil am wenigsten belegt");
    torPruefung("IC Markets: der Zeit-Exit prueft den geratenen Stil nicht",
      /ageHours >= maxHours && meta\.stilGeraten === true/.test(ic),
      "sonst schliesst er weiter auf DAYTRADING");
    torPruefung("IC Markets: das Aussetzen wird nicht gemeldet",
      /Zeit-Exit AUSGESETZT/.test(ic),
      "ein stiller Verzicht ist von einem Ausfall nicht zu unterscheiden");
    // Breakeven/Teilgewinn/Trailing duerfen NICHT mit ausgesetzt werden — die
    // haengen am echten Broker-Stop, nicht am Stil.
    //
    // Die erste Fassung dieser Pruefung suchte `partialDone` und `stilGeraten`
    // innerhalb von 80 Zeichen — und schlug an, weil beide im selben
    // Objekt-Literal stehen. Ein Fehlalarm im PRUEFER, keine Kopplung im Code.
    // Jetzt wird gezaehlt, WO die Entscheidung `meta.stilGeraten` faellt: sie
    // darf genau EINMAL abgefragt werden, und zwar im Zeit-Exit.
    // GENAU ZWEI Stellen, und beide benannt (15.09. geschaerft):
    //   1. der Zeit-Exit — die einzige ENTSCHEIDUNG, die davon abhaengen darf
    //   2. die Meldung — sie entscheidet nichts, sie macht das Raten sichtbar
    //
    // Die erste Fassung verlangte GENAU EINE Stelle. Als am 15.09. die Meldung
    // dazukam (der Capital-Pfad meldet seit dem 19.08., IC schwieg bis dahin),
    // schlug sie an — zu Recht, denn sie konnte "Entscheidung" und "Meldung"
    // nicht unterscheiden. Statt die Zahl stumpf hochzusetzen wird jetzt
    // geprueft, WOFUER die beiden Stellen da sind. Eine dritte faellt weiter
    // auf.
    const entscheidungen = (ic.match(/meta\.stilGeraten/g) || []).length;
    torPruefung("IC Markets: `meta.stilGeraten` wird an mehr als zwei Stellen gelesen",
      entscheidungen === 2,
      `${entscheidungen}x — erlaubt sind Zeit-Exit und Meldung, sonst nichts`);
    torPruefung("IC Markets: die zweite Stelle ist keine Meldung, sondern eine Entscheidung",
      /meta\.stilGeraten === true && !gerateneGemeldetIC\.has\(positionId\)/.test(ic),
      "nur der Zeit-Exit darf vom geratenen Stil abhaengen");
    // Und das Raten muss gemeldet werden, SOBALD es passiert — nicht erst,
    // wenn der Zeit-Exit greifen wuerde. Genau das war die Luecke gegenueber
    // dem Capital-Pfad.
    torPruefung("IC Markets: die geratene Confidence wird nicht gemeldet",
      /Stil und Confidence GERATEN/.test(ic),
      "Capital meldet beides seit dem 19.08. — IC schwieg");
    // Das Meldungs-Gedaechtnis darf nicht wachsen (Leck-Klasse vom 26.08.).
    torPruefung("IC Markets: das Meldungs-Gedaechtnis wird nie aufgeraeumt",
      /gerateneGemeldetIC\.delete\(/.test(ic),
      "ein Set, das nur waechst — dasselbe Leck wie in der Brute-Force-Karte");
  }

  // ══ ZWEI SAMMLUNGEN OHNE OBERGRENZE — AUSGEFUEHRT (08.09.) ═══════════════
  //
  // Aus der Generalkontrolle: jede wachsende Sammlung im Programm wurde auf
  // ihre Kuerzung geprueft. `anomalies` und `heartbeats` im Diagnostics-Agent
  // sind durch ihre Schluessel begrenzt (Typ:Symbol bzw. Agent-Name), der
  // Symbol-Cache des IC-Clients durch die Zahl der Symbole. ZWEI waren es
  // nicht:
  //
  //  - `_recentMessages` im Telegram-Modul: an VIER Stellen befuellt, an
  //    keiner gekuerzt. Telegram bekommt stuendliche Tor-Meldungen, jede
  //    Ausfuehrung und die taeglichen Reports — die Liste wuchs mit jeder je
  //    gesendeten Nachricht. Dass nur wenige gebraucht werden, stand schon im
  //    Lesepfad: `slice(-50)`.
  //  - `portfolioBrainMemory`: `unshift` ohne Deckel, und jeder Eintrag traegt
  //    den vollstaendigen Report.
  //
  // Dieselbe Klasse wie das Leck in der Brute-Force-Karte (26.08.). Geprueft
  // wird RECHNEND — eine Struktur-Pruefung saehe eine Obergrenze, aber nicht,
  // ob sie greift.
  {
    const tg = ladeTsModul("lib/telegram-notifications/telegram-engine.ts", {});
    if (tg.fehler || typeof tg.exports.sendTelegramMessage !== "function") {
      torPruefung("telegram-engine nicht ausfuehrbar", false, tg.fehler ?? "Export fehlt");
    } else {
      const max = tg.exports.TELEGRAM_VERLAUF_MAX;
      torPruefung("die Telegram-Liste hat keine Obergrenze",
        typeof max === "number" && max > 0, String(max));
      tg.exports.telegramVerlaufLeeren();
      // Ohne Token/Chat-ID landet jede Nachricht als SIMULATED im Verlauf —
      // genau der Pfad, der ohne Netz laeuft.
      for (let i = 0; i < max + 25; i++) {
        await tg.exports.sendTelegramMessage("TRADES", `test ${i}`, "NORMAL", "Pruefer");
      }
      const laenge = tg.exports.telegramVerlaufLaenge();
      torPruefung("die Telegram-Liste waechst ueber ihre Obergrenze hinaus",
        laenge === max, `${laenge} statt ${max} nach ${max + 25} Nachrichten`);
      tg.exports.telegramVerlaufLeeren();

      // STRUKTURELL DAZU, und das ist noetig: der Prueflauf oben erreicht nur
      // den SIMULATED-Pfad (ohne Bot-Token). Die beiden Stellen fuer SENT und
      // FAILED laufen nur mit echtem Token und echter Antwort — im
      // Sabotage-Lauf liess sich genau dort `merkeNachricht` wieder durch ein
      // direktes `push` ersetzen, ohne dass etwas rot wurde. Deshalb: das
      // direkte Anhaengen darf es GENAU EINMAL geben, naemlich in der
      // kuerzenden Funktion selbst.
      const tgQ = read("frontend/lib/telegram-notifications/telegram-engine.ts")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      const direkt = (tgQ.match(/_recentMessages\.push\(/g) || []).length;
      torPruefung("es gibt wieder mehr als eine Stelle, die direkt anhaengt",
        direkt === 1, `${direkt}x — eine Obergrenze an drei von vier Stellen ist keine`);
      torPruefung("die kuerzende Funktion fehlt",
        /function merkeNachricht\([\s\S]{0,200}?_recentMessages\.push\(/.test(tgQ));
    }

    const pb = ladeTsModul("lib/portfolio-brain/portfolio-brain-memory.ts", {});
    if (pb.fehler || typeof pb.exports.savePortfolioBrainMemory !== "function") {
      torPruefung("portfolio-brain-memory nicht ausfuehrbar", false, pb.fehler ?? "Export fehlt");
    } else {
      const max = pb.exports.PORTFOLIO_BRAIN_MEMORY_MAX;
      torPruefung("die Portfolio-Brain-Liste hat keine Obergrenze",
        typeof max === "number" && max > 0, String(max));
      // UNTERSCHEIDBARE Eintraege — sonst laesst sich nicht pruefen, WELCHER
      // beim Kuerzen herausfliegt. Die erste Fassung schickte lauter gleiche
      // und fragte nur, ob der erste existiert; im Sabotage-Lauf liess sich
      // `pop()` durch `shift()` ersetzen (der NEUESTE fliegt raus), und der
      // Pruefer blieb gruen.
      for (let i = 0; i < max + 20; i++) {
        pb.exports.savePortfolioBrainMemory({ version: `V${i}`, status: "OK", mode: "TEST" });
      }
      const liste = pb.exports.getPortfolioBrainMemory();
      torPruefung("die Portfolio-Brain-Liste waechst ueber ihre Obergrenze hinaus",
        liste.length === max, `${liste.length} statt ${max} nach ${max + 20} Eintraegen`);
      torPruefung("beim Kuerzen fliegt der NEUESTE Eintrag heraus statt der aelteste",
        liste[0]?.version === `V${max + 19}`,
        `vorne steht ${liste[0]?.version}, erwartet V${max + 19}`);
      torPruefung("die aeltesten Eintraege bleiben stehen statt zu weichen",
        !liste.some((e) => e.version === "V0"),
        "V0 ist der aelteste und muss als erster weichen");
    }
  }

  // ══ DER TAGESVERLUST-RIEGEL UEBERLEBT EINEN DEPLOY (09.09.) ══════════════
  //
  // DER FUND aus der Kettenkontrolle. Der Tagesstart-Kontostand lag in einer
  // modul-scoped Variablen (`const _dayStart: Record<string, number> = {}`) und
  // war nach jedem Deploy leer. Der erste Aufruf danach schrieb den AKTUELLEN
  // Kontostand als "Tagesstart" fest:
  //
  //   Tagesstart 1600 -> Verlust auf 1540 (-3,75 %) -> Deploy ->
  //   "Tagesstart" 1540 -> gemessener Verlust 0,0 % -> Schutz aus
  //
  // Dass es anders sein muss, stand SCHON IN DERSELBEN DATEI: die Wochen-
  // Grenze zwei Funktionen tiefer legt ihren Startwert seit dem 13.08. in
  // Redis, mit dem Kommentar "Redis-persistent, ueberlebt Deploys".
  //
  // WIRKUNGSRICHTUNG ehrlich benannt: der Fehler machte den Schutz SCHWAECHER.
  // Er ist NICHT die Ursache fuer ausbleibende Trades.
  //
  // Geprueft wird RECHNEND mit gestelltem Redis — eine Struktur-Pruefung saehe
  // einen Schluessel, aber nicht, ob der Riegel danach greift.
  {
    const bauFilter = (speicher) => ladeTsModul("lib/trading-filters/trade-filters.ts", {
      "redis-cache": {
        cacheGet: async (k) => (k in speicher ? speicher[k] : null),
        cacheSet: async (k, v) => { speicher[k] = v; return true; },
      },
    });
    const speicher = {};
    const f1 = bauFilter(speicher);
    if (f1.fehler || typeof f1.exports.checkDailyLossLimit !== "function") {
      torPruefung("checkDailyLossLimit nicht ausfuehrbar", false, f1.fehler ?? "Export fehlt");
    } else {
      const stillesLog = console.log;
      console.log = () => {};
      try {
        // Erster Lauf des Tages: Startwert merken, nicht blocken.
        const a = await f1.exports.checkDailyLossLimit(1600, 3);
        torPruefung("der erste Lauf des Tages blockt bereits", a.allowed === true,
          JSON.stringify(a));
        // Verlust unter der Grenze -> weiter erlaubt.
        const b = await f1.exports.checkDailyLossLimit(1570, 3);
        torPruefung("ein Verlust UNTER der Grenze blockt schon",
          b.allowed === true, `1600->1570 = -1.9 % ${JSON.stringify(b)}`);
        // Verlust ueber der Grenze -> blocken.
        const c = await f1.exports.checkDailyLossLimit(1540, 3);
        torPruefung("ein Verlust UEBER der Grenze blockt nicht",
          c.allowed === false, `1600->1540 = -3.75 % ${JSON.stringify(c)}`);

        // ── DER KERN: nach einem "Deploy" muss der Riegel weiter greifen ───
        //
        // Ein Deploy = neue Modul-Instanz, aber DERSELBE Redis-Inhalt. Vorher
        // war der Tagesstart damit weg und der Verlust wieder 0 %.
        const f2 = bauFilter(speicher);
        const d = await f2.exports.checkDailyLossLimit(1540, 3);
        torPruefung("nach einem Deploy ist der Tagesverlust-Riegel wieder offen — "
          + "der Startkontostand ging verloren",
          d.allowed === false, JSON.stringify(d));

        // Gegenprobe: ein LEERER Speicher (neuer Tag) darf nicht blocken.
        const f3 = bauFilter({});
        const e2 = await f3.exports.checkDailyLossLimit(1540, 3);
        torPruefung("ein neuer Tag blockt sofort", e2.allowed === true,
          JSON.stringify(e2));
        // Und ein Redis-Ausfall darf den Handel NICHT anhalten.
        const f4 = ladeTsModul("lib/trading-filters/trade-filters.ts", {
          "redis-cache": {
            cacheGet: async () => { throw new Error("Redis weg"); },
            cacheSet: async () => { throw new Error("Redis weg"); },
          },
        });
        const g = await f4.exports.checkDailyLossLimit(1540, 3);
        torPruefung("ein Redis-Ausfall haelt den Handel an",
          g.allowed === true, JSON.stringify(g));
      } finally {
        console.log = stillesLog;
      }
    }
    // ── DER GESAMT-DRAWDOWN-RIEGEL MUSS SICH MELDEN (09.09.) ──────────────
    //
    // DER FUND, und er hat eine Woche gekostet. Am 09.09. 15:33 stand im Log:
    //
    //   [filter] 🔴 GESAMT-DRAWDOWN: -10.72% vom Höchststand 1749.66 >= 10%
    //   [orchestrator] 🚫 XRPUSD GEBLOCKT [TOTAL_DRAWDOWN_LIMIT]
    //
    // XRPUSD hatte Confidence 77 und war durch ALLE vorherigen Tore. Der
    // Riegel hielt jeden Trade auf — und meldete NICHTS. `sendTelegram` stand
    // in dieser Datei ausschliesslich in der Wochen-Grenze.
    //
    // Er ist ausserdem eine SACKGASSE: gemessen wird vom hoechsten je
    // gesehenen Kontostand. Ohne offene Positionen kann der Stand nicht
    // steigen, und ohne steigenden Stand wird nicht gehandelt.
    {
      const speicher2 = {};
      const gesendet = [];
      const bauDD = () => ladeTsModul("lib/trading-filters/trade-filters.ts", {
        "redis-cache": {
          cacheGet: async (k) => (k in speicher2 ? speicher2[k] : null),
          cacheSet: async (k, v) => { speicher2[k] = v; return true; },
        },
        "telegram-sender": { telegramZeit: () => "27.9.2026, 14:48:11 MESZ", telegramDatum: () => "27.9.2026", sendTelegram: async (t) => { gesendet.push(t); } },
      });
      const d1 = bauDD();
      if (d1.fehler || typeof d1.exports.checkTotalDrawdownLimit !== "function") {
        torPruefung("checkTotalDrawdownLimit nicht ausfuehrbar", false,
          d1.fehler ?? "Export fehlt");
      } else {
        const stillesLog2 = console.log;
        console.log = () => {};
        try {
          const f = d1.exports.checkTotalDrawdownLimit;
          // Hoechststand setzen (die echten Zahlen aus dem Log vom 09.09.).
          const a = await f(1749.66, 10);
          torPruefung("ein neuer Hoechststand blockt", a.allowed === true, JSON.stringify(a));
          // Knapp darunter: erlaubt.
          const b = await f(1600, 10);
          torPruefung("ein Drawdown UNTER der Grenze blockt schon",
            b.allowed === true, `-8.6 % ${JSON.stringify(b)}`);
          // Der echte Fall: 1562.14 -> -10.72 %.
          const c = await f(1562.14, 10);
          torPruefung("der echte Fall vom 09.09. blockt nicht",
            c.allowed === false, `-10.72 % ${JSON.stringify(c)}`);
          torPruefung("die Sperre wird nicht gemeldet — sie sperrte tagelang still",
            gesendet.length === 1, `${gesendet.length} Meldungen`);
          // Die Meldung muss den AUSWEG nennen — sonst sucht man wieder tagelang.
          const txt = gesendet[0] ?? "";
          torPruefung("die Meldung nennt den noetigen Kontostand nicht",
            /1574\.69/.test(txt), txt.slice(0, 80));
          torPruefung("die Meldung nennt die Einstellung nicht",
            /Max Total Drawdown/.test(txt));
          torPruefung("die Meldung sagt nicht, dass es sich nicht von selbst loest",
            /nicht von selbst/.test(txt));
          // NICHT bei jedem Zyklus melden — sonst ist es Rauschen.
          await f(1562.14, 10);
          await f(1562.14, 10);
          torPruefung("die Meldung wiederholt sich bei jedem Zyklus",
            gesendet.length === 1, `${gesendet.length} nach drei Sperren`);
          // Neuer Hoechststand -> die Meldung darf wieder kommen.
          await f(1800, 10);
          const e3 = await f(1500, 10);
          torPruefung("nach einem neuen Hoechststand blockt der Riegel nicht",
            e3.allowed === false, JSON.stringify(e3));
          torPruefung("nach einem neuen Hoechststand meldet er nicht erneut",
            gesendet.length === 2, `${gesendet.length} Meldungen`);
          // ── DER FALL VOM 28.09. UND DIE STUMME SPERRE (29.09.) ──────────
          //
          // Gemeldet wurde: "-84.63% (Limit: -15%), Hoechststand 10000.00,
          // Aktueller Stand 1536.53". Der Nutzer setzte das Demokonto danach
          // auf GENAU 10000.00 zurueck.
          //
          // Und genau da lag der Fehler: `alerted` wurde nur geloescht, wenn
          // ein NEUER Hoechststand entstand. `10000 > 10000` ist falsch —
          // also blieb die Drossel gesetzt, und die NAECHSTE Sperre waere
          // stumm gewesen. Exakt die Fehlerklasse, gegen die dieser Riegel
          // am 09.09. geschrieben wurde.
          //
          // Eigener Speicher, damit der Fall oben nicht hineinwirkt.
          const sp3 = { peak_balance: { peak: 10000 } };
          const ges3 = [];
          const d3 = ladeTsModul("lib/trading-filters/trade-filters.ts", {
            "redis-cache": {
              cacheGet: async (k) => (k in sp3 ? sp3[k] : null),
              cacheSet: async (k, v) => { sp3[k] = JSON.parse(JSON.stringify(v)); return true; },
            },
            "telegram-sender": {
              telegramZeit: () => "28.9.2026, 20:18:37 MESZ", telegramDatum: () => "28.9.2026",
              sendTelegram: async (t) => { ges3.push(String(t)); },
            },
          });
          const f3 = d3.exports.checkTotalDrawdownLimit;
          const s1 = await f3(1536.53, 15);
          torPruefung("der Fall vom 28.09. sperrt nicht",
            s1.allowed === false && /84\.6/.test(s1.reason), JSON.stringify(s1));
          torPruefung("der Fall vom 28.09. meldet sich nicht",
            ges3.length === 1 && ges3[0].includes("10000.00") && ges3[0].includes("1536.53"),
            `${ges3.length} Meldung(en)`);
          // Konto zurueck auf GENAU den Hoechststand.
          const s2 = await f3(10000, 30);
          torPruefung("nach dem Zuruecksetzen auf den Hoechststand bleibt gesperrt",
            s2.allowed === true, JSON.stringify(s2));
          torPruefung("die Melde-Drossel bleibt haengen, wenn die Sperre endet",
            sp3.peak_balance.alerted === undefined,
            `alerted=${sp3.peak_balance.alerted} — bleibt sie true, sperrt der naechste Einbruch STUMM`);
          torPruefung("der Hoechststand wird beim Loesen der Drossel verfaelscht",
            sp3.peak_balance.peak === 10000, String(sp3.peak_balance.peak));
          // Und jetzt der naechste Einbruch — er MUSS sich melden.
          const s3 = await f3(6000, 30);
          torPruefung("der naechste Einbruch sperrt nicht",
            s3.allowed === false && /40\.0/.test(s3.reason), JSON.stringify(s3));
          torPruefung("der naechste Einbruch sperrt STUMM",
            ges3.length === 2, `${ges3.length} Meldungen — erwartet 2`);

          // ── /peakreset — DER WEG AUS DER SACKGASSE (29.09.) ─────────────
          //
          // Der Gesamt-Drawdown misst vom hoechsten je gesehenen Kontostand,
          // und der liegt ein JAHR in Redis. Bis zum 29.09. gab es aus einer
          // Sperre genau zwei Auswege: Kontostand ueber den Hoechststand
          // heben oder die Grenze hochziehen. Nach einem Demokonto-Reset —
          // oder nach einem Hoechststand, der gar nicht echt war — war das
          // eine Sackgasse.
          //
          // Geprueft wird die KETTE, nicht der Text: Sperre -> Reset ->
          // naechster Zyklus nimmt den aktuellen Kontostand -> Sperre weg,
          // Schutz sofort wieder aktiv vom neuen Bezugspunkt.
          const sp4 = {};
          const ges4 = [];
          const d4 = ladeTsModul("lib/trading-filters/trade-filters.ts", {
            "redis-cache": {
              cacheGet: async (k) => (k in sp4 ? sp4[k] : null),
              cacheSet: async (k, v) => { sp4[k] = JSON.parse(JSON.stringify(v)); return true; },
              cacheDel: async (k) => { delete sp4[k]; return true; },
            },
            "telegram-sender": {
              telegramZeit: () => "29.9.2026, 12:00:00 MESZ", telegramDatum: () => "29.9.2026",
              sendTelegram: async (t) => { ges4.push(String(t)); },
            },
          });
          const pr = d4.exports.peakZuruecksetzen;
          const SCHL = d4.exports.PEAK_SCHLUESSEL;
          if (typeof pr !== "function" || typeof SCHL !== "string") {
            torPruefung("peakZuruecksetzen/PEAK_SCHLUESSEL nicht exportiert", false,
              `${typeof pr} / ${typeof SCHL} — ohne sie gibt es keinen Weg aus einer Sperre`);
          } else {
            const f4 = d4.exports.checkTotalDrawdownLimit;
            await f4(10000, 15);
            const vorher = await f4(1536.53, 15);
            torPruefung("der Pruefstand ist gar nicht gesperrt — Reset waere nicht pruefbar",
              vorher.allowed === false, JSON.stringify(vorher));
            const r4 = await pr();
            torPruefung("der Reset gelingt nicht", r4.ok === true, JSON.stringify(r4));
            torPruefung("der Reset verschweigt den alten Hoechststand",
              r4.alt === 10000, `${r4.alt} — ohne ihn waere der Reset still`);
            torPruefung("der Hoechststand liegt noch im Speicher",
              sp4[SCHL] === undefined, JSON.stringify(sp4[SCHL] ?? null));
            const nachher = await f4(1536.53, 15);
            torPruefung("die Sperre besteht nach dem Reset weiter",
              nachher.allowed === true, JSON.stringify(nachher));
            torPruefung("der neue Hoechststand ist nicht der aktuelle Kontostand",
              sp4[SCHL]?.peak === 1536.53, JSON.stringify(sp4[SCHL]));
            const wieder = await f4(1200, 15);
            torPruefung("der Schutz greift nach dem Reset nicht mehr",
              wieder.allowed === false && /21\.9/.test(wieder.reason), JSON.stringify(wieder));
            // Ein Reset ohne gespeicherten Wert darf nicht werfen und nichts erfinden.
            await pr();
            const leer4 = await pr();
            torPruefung("ein Reset ohne gespeicherten Wert wirft oder erfindet eine Zahl",
              leer4.ok === true && leer4.alt === null, JSON.stringify(leer4));
          }
          // Bei Redis-Ausfall darf der Reset nicht so tun, als haette er geklappt.
          const d5 = ladeTsModul("lib/trading-filters/trade-filters.ts", {
            "redis-cache": {
              cacheGet: async () => { throw new Error("Redis weg"); },
              cacheDel: async () => { throw new Error("Redis weg"); },
            },
          });
          if (typeof d5.exports.peakZuruecksetzen === "function") {
            const k5 = await d5.exports.peakZuruecksetzen();
            torPruefung("ein Reset bei Redis-Ausfall meldet Erfolg",
              k5.ok === false && typeof k5.fehler === "string", JSON.stringify(k5));
          }

          // Redis weg -> nicht blockieren.
          const d2 = ladeTsModul("lib/trading-filters/trade-filters.ts", {
            "redis-cache": {
              cacheGet: async () => { throw new Error("Redis weg"); },
              cacheSet: async () => { throw new Error("Redis weg"); },
            },
          });
          const g2 = await d2.exports.checkTotalDrawdownLimit(1000, 10);
          torPruefung("ein Redis-Ausfall sperrt den Handel",
            g2.allowed === true, JSON.stringify(g2));
        } finally {
          console.log = stillesLog2;
        }
      }
    }

    // ── KEIN ERFUNDENER KONTOSTAND (29.09.) ────────────────────────────────
    //
    // Zwei Stellen machten aus "unbekannt" eine Messung, an der Stelle, die
    // ueber Geld entscheidet:
    //
    //   orchestrator-agent.ts  capitalBalance: session.balance > 0 ? … : 10000
    //   orchestrator-agent.ts  ueberwachtesKapital(umfang) || 10000
    //
    // `risk-scope.ts` ist ausdruecklich dafuer gebaut, einen Kontostand <= 0
    // zu verwerfen und "KEIN Konto" zu melden — der Aufrufer hat das
    // unerreichbar gemacht. Daran haengen der Gesamt-Drawdown (der
    // Hoechststand wird ein JAHR lang gespeichert), die Tages- und
    // Wochengrenze und die POSITIONSGROESSE.
    //
    // Davor sitzt der Broker: `connectCapital` speicherte eine Sitzung auch
    // dann, wenn die Kontoabfrage fehlschlug — mit `balance: 0` und
    // `return { ok: true }`. Erst beides zusammen ergab den Phantom-
    // Hoechststand von 10000 vom 28.09.
    //
    // Kommentare vorher weg: die Begruendungen im Quelltext zitieren die
    // alten Zeilen woertlich.
    {
      const ohneK = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      const orchQ = ohneK(read("frontend/lib/agents/orchestrator-agent.ts"));
      const sessQ = ohneK(read("frontend/lib/capital-com/capital-com-session.ts"));

      torPruefung("der Orchestrator erfindet wieder einen Kontostand von 10000",
        !/ueberwachtesKapital\([^)]*\)\s*\|\|/.test(orchQ)
        && !/capitalBalance:\s*session\.balance\s*>\s*0\s*\?/.test(orchQ),
        "aus 'unbekannt' darf keine Messung werden — der Hoechststand haelt ein Jahr");
      torPruefung("ein Zyklus ohne Kontostand laeuft weiter",
        /Kein ueberwachter Kontostand/.test(orchQ) && /return "Kein Kontostand"/.test(orchQ),
        "ohne Kontostand rechnet keine Verlustgrenze richtig");

      // Und beim Broker: die Kontoabfrage MUSS geprueft werden, BEVOR die
      // Sitzung gespeichert wird. Reihenfolge per Index, nicht per Naehe.
      const iAbfrage = sessQ.indexOf("const accountsResult = await capitalGetAccounts");
      const iPruef = sessQ.indexOf("if (!accountsResult.ok");
      const iSpeichern = sessQ.indexOf("global.__capital_session__ = {");
      torPruefung("die Kontoabfrage wird nicht geprueft, bevor die Sitzung gespeichert wird",
        iAbfrage >= 0 && iPruef > iAbfrage && iSpeichern > iPruef,
        `Abfrage@${iAbfrage} Pruefung@${iPruef} Speichern@${iSpeichern}`);
      torPruefung("ein fehlender Kontostand wird wieder zu 0 gemacht",
        !/balance:\s*primaryAccount\?\.balance\s*\?\?\s*0/.test(sessQ),
        "`?? 0` macht aus einem fehlenden Feld eine Null");
      torPruefung("eine Anmeldung ohne Kontostand meldet trotzdem Erfolg",
        /Anmeldung erfolgreich, aber KEIN Kontostand/.test(sessQ)
        && /return \{ ok: false, error: `Kontoabfrage fehlgeschlagen/.test(sessQ),
        "sonst gilt eine Sitzung mit Kontostand 0 als verbunden");
      torPruefung("der frische Kontostand aus dem Redis-Ping wird nur geloggt",
        /cached\.balance = frisch!\.balance/.test(sessQ),
        "sonst rechnet der erste Zyklus nach einem Neustart auf einem alten Stand");

      // ── /peakreset: Schluessel EINMAL, Passwort PFLICHT (29.09.) ─────────
      const filtQ = ohneK(read("frontend/lib/trading-filters/trade-filters.ts"));
      const hookQ = ohneK(read("frontend/app/api/telegram/webhook/route.ts"));

      // Der Schluesselname darf genau einmal als Zeichenkette vorkommen.
      // Zwei Stellen waeren die naechste stille Abweichung bei einer
      // Umbenennung — dieselbe Fehlerklasse wie bei den Epic-Tabellen.
      const alleQuellen = sourceFiles([".ts", ".tsx"])
        .filter((f) => f.startsWith("frontend/"))
        .map((f) => ohneK(read(f)));
      const literale = alleQuellen.reduce(
        (n, q) => n + (q.match(/["']peak_balance["']/g) || []).length, 0);
      torPruefung("der Schluessel 'peak_balance' steht an mehr als einer Stelle",
        literale === 1, `${literale} Vorkommen — erwartet genau 1 (PEAK_SCHLUESSEL)`);
      torPruefung("checkTotalDrawdownLimit nutzt den gemeinsamen Schluessel nicht",
        /const KEY = PEAK_SCHLUESSEL/.test(filtQ));

      // Der Befehl SENKT den Schutz — er muss hinter dem Admin-Passwort
      // stehen, nie direkt ausfuehren.
      torPruefung("/peakreset fuehrt ohne Passwort-Bestaetigung aus",
        /pendingConfirm\.set\(chatId, \{ action: "peakreset"/.test(hookQ)
        && /pending\.action === "peakreset"/.test(hookQ),
        "sonst genuegt eine Nachricht, um den Drawdown-Schutz zurueckzusetzen");
      torPruefung("/peakreset warnt nicht davor, dass es den Schutz senkt",
        /SENKT den Schutz/.test(hookQ));

      // ── DER WEBHOOK WIRD AUSGEFUEHRT, NICHT GELESEN (29.09.) ────────────
      //
      // Zwei Funde im Bestaetigungs-Pfad, beide aelter als /peakreset:
      //
      //  A) Die Fehlmeldung gab die Eingabe aus:
      //     `Eingabe: <code>${text.slice(0, 20)}***</code>`. Ein Tippfehler im
      //     LETZTEN Zeichen schickte damit bis zu zwanzig RICHTIGE Zeichen des
      //     Admin-Passworts im Klartext in den Chat — und ein Telegram-Verlauf
      //     laesst sich nicht zurueckholen.
      //
      //  B) Die Pruefung steht VOR der Befehlsauswertung. Wer innerhalb der 60
      //     Sekunden `/status` schickte, dessen Befehl galt als Passwortversuch:
      //     falscher Alarm, und ueber (A) stand der Befehl im Alarmtext.
      //
      // Beides ist mit einem Regex nicht ehrlich pruefbar — es haengt an der
      // REIHENFOLGE der Zweige. Deshalb laeuft hier die echte `POST`-Funktion
      // mit echten Nachrichten. `fetch` ist ersetzt, es geht nichts nach
      // aussen; Umgebungsvariablen werden gesichert und zurueckgestellt.
      {
        const chat = "123456789";
        const pw = "MeinSehrGeheimesPasswort";
        const altEnv = {
          TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
          TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
          KILLSWITCH_PASSWORD: process.env.KILLSWITCH_PASSWORD,
        };
        const altFetch = global.fetch;
        const antworten = [];
        const alarme = [];
        try {
          process.env.TELEGRAM_CHAT_ID = chat;
          process.env.TELEGRAM_BOT_TOKEN = "T".repeat(20);
          process.env.KILLSWITCH_PASSWORD = pw;
          // Der falsche fetch muss sich wie der ECHTE verhalten: Telegram
          // antwortet mit einem JSON-Koerper, den `reply()` seit dem 26.10.
          // ueber `res.text()` liest. Ein Stellvertreter ohne `text()` wuerde
          // den Pruefstand gegen etwas laufen lassen, das es nicht gibt.
          const okAntwort = () => ({
            ok: true, status: 200,
            text: async () => JSON.stringify({ ok: true, result: {} }),
            json: async () => ({ ok: true }),
          });
          global.fetch = async (_u, init) => {
            antworten.push(String(JSON.parse(String(init?.body ?? "{}")).text ?? ""));
            return okAntwort();
          };
          const wh = ladeTsModul("app/api/telegram/webhook/route.ts", {
            "next/server": { NextResponse: { json: (x) => ({ __json: x }) } },
            "telegram-notifications/telegram-sender": {
              sendTelegram: async (t) => { alarme.push(String(t)); return true; },
              telegramZeit: () => "29.9.2026, 22:20:06 MESZ", telegramDatum: () => "29.9.2026",
            },
            "lib/killswitch": {
              getKillswitchReport: () => ({ triggered: false, armed: true, systemLocked: false, stages: [], summary: "ok" }),
              triggerKillswitch: () => ({ triggered: true }), resetKillswitch: () => ({ triggered: false }),
            },
            // Seit dem 27.10. nennt /status den laufenden Stand. Ohne diesen
            // Ersatz liefe der Pruefstand gegen den Stellvertreter und meldete
            // einen Fehler, den es im Betrieb nicht gibt.
            "laufzeit/laufzeit-stand": ladeTsModul("lib/laufzeit/laufzeit-stand.ts").exports,
            // Seit dem 29.10. nennt /status, WARUM nicht gehandelt wird.
            // Ohne diesen Ersatz liefe der Aufruf gegen den Stellvertreter,
            // der beim Aufruf wirft — der Pruefstand meldete dann einen
            // Fehler, den es im Betrieb nicht gibt. (Die Datenquellen
            // DUERFEN weiter werfen: sie liegen in `sicher()` und ergeben
            // dort "unbekannt" — genau der Fall, den die Funktion abdeckt.)
            "handels-lage/handels-lage": ladeTsModul("lib/handels-lage/handels-lage.ts").exports,
            "trading-filters/trade-filters": {
              PEAK_SCHLUESSEL: "peak_balance",
              peakZuruecksetzen: async () => ({ ok: true, alt: 10000 }),
            },
            "cache/redis-cache": { cacheGet: async () => ({ peak: 10000 }), cacheSet: async () => true, cacheDel: async () => true },
            "capital-com/capital-com-session": { getCapitalSession: () => ({ balance: 9982.56 }) },
          });
          if (wh.fehler || typeof wh.exports.POST !== "function") {
            torPruefung("der Telegram-Webhook ist nicht ausfuehrbar", false,
              wh.fehler ?? "POST wird nicht exportiert");
          } else {
            const schicke = (text) => wh.exports.POST({
              json: async () => ({ message: { chat: { id: Number(chat) }, from: { first_name: "Pruefstand" }, text } }),
            });

            await schicke("/peakreset");
            torPruefung("/peakreset fragt nicht nach dem Passwort",
              (antworten.at(-1) ?? "").includes("Admin-Passwort"), (antworten.at(-1) ?? "").slice(0, 60));

            // B: ein Befehl darf die Bestaetigung abbrechen, nicht ausloesen.
            const vorAlarme = alarme.length;
            await schicke("/status");
            const letzte = antworten.slice(-2);
            torPruefung("ein Befehl innerhalb der Bestaetigung gilt als Passwort",
              letzte.some((a) => a.includes("abgebrochen")), letzte[0]?.slice(0, 70) ?? "");
            torPruefung("ein Befehl innerhalb der Bestaetigung loest einen Fehlalarm aus",
              alarme.length === vorAlarme, `${alarme.length - vorAlarme} neue Alarme`);
            torPruefung("der abgebrochene Befehl wird gar nicht ausgefuehrt",
              letzte.some((a) => /System Status/i.test(a)), letzte.at(-1)?.slice(0, 50) ?? "");

            // A: ein falsches Passwort darf nirgends stehen.
            await schicke("/peakreset");
            const tippfehler = pw.slice(0, -1) + "X";
            await schicke(tippfehler);
            const alarm = alarme.at(-1) ?? "";
            torPruefung("ein falsches Passwort loest keinen Alarm aus",
              /Falsches Admin-Passwort/.test(alarm), alarm.slice(0, 60));
            torPruefung("der Alarm plaudert die Eingabe aus",
              !alarm.includes(tippfehler.slice(0, 10)),
              "ein Tippfehler im letzten Zeichen gaebe sonst das halbe Passwort preis");
            torPruefung("der Alarm nennt die Laenge nicht",
              alarm.includes(`${tippfehler.length} Zeichen`), `${tippfehler.length} Zeichen erwartet`);

            // Und das richtige Passwort muss weiter funktionieren.
            await schicke("/peakreset");
            await schicke(pw);
            torPruefung("das RICHTIGE Passwort wird nicht mehr angenommen",
              alarme.some((a) => /ZURÜCKGESETZT/.test(a))
              || /zurückgesetzt/i.test(antworten.at(-1) ?? ""),
              (antworten.at(-1) ?? "").slice(0, 60));

            // ── reply() DARF EINEN FEHLSCHLAG NICHT VERSCHLUCKEN (26.10.) ──
            //
            // Bis heute stand dort `.catch(() => {})` und sonst nichts.
            // Telegram lehnt mit HTTP 200 und `{ok:false, description}` ab —
            // der Befehl verpuffte spurlos. Dieselbe Fehlerklasse wie bei
            // `sendTelegram` am 25.10., nur in der eigenen Funktion des
            // Webhooks, durch die JEDE Antwort geht.
            //
            // Geprueft wird AUSGEFUEHRT: der echte POST gegen einen fetch,
            // der die Ablehnung spielt, und die Konsolenausgabe wird gezaehlt.
            // Ein Regex auf den Quelltext koennte nicht zeigen, ob die Meldung
            // im richtigen Zweig steht.
            const altErr = console.error;
            const meldungen = [];
            const faelle = [
              ["abgelehnt (ok:false)", async () => ({
                ok: true, status: 200,
                text: async () => JSON.stringify({
                  ok: false, error_code: 400, description: "message is too long" }),
              })],
              ["unlesbare Antwort", async () => ({
                ok: true, status: 200, text: async () => "<html>kaputt</html>" })],
              ["leere Antwort", async () => ({
                ok: false, status: 502, text: async () => "" })],
              ["Netzfehler", async () => { throw new Error("ECONNRESET"); }],
            ];
            for (const [name, antwort] of faelle) {
              meldungen.length = 0;
              console.error = (...a) => { meldungen.push(a.join(" ")); };
              try {
                global.fetch = async (_u, init) => {
                  if (init) JSON.parse(String(init.body ?? "{}"));
                  return antwort();
                };
                await schicke("/status");
              } finally { console.error = altErr; }
              torPruefung(`reply() verschluckt einen Fehlschlag: ${name} — `
                + "der Befehl verpufft dann spurlos",
                meldungen.some((m) => /NICHT zugestellt/.test(m)),
                `${meldungen.length} Meldungen: ${meldungen.join(" | ").slice(0, 90)}`);
            }
            // Der GRUND muss drinstehen, nicht nur "fehlgeschlagen".
            meldungen.length = 0;
            console.error = (...a) => { meldungen.push(a.join(" ")); };
            try {
              global.fetch = async () => ({
                ok: true, status: 200,
                text: async () => JSON.stringify({
                  ok: false, error_code: 429, description: "Too Many Requests: retry after 30" }),
              });
              await schicke("/status");
            } finally { console.error = altErr; }
            torPruefung("die Meldung nennt den GRUND nicht — sonst muss man ihn "
              + "spaeter raten",
              meldungen.some((m) => /Too Many Requests/.test(m) && /429/.test(m)),
              meldungen.join(" | ").slice(0, 120));

            // GEGENPROBE: ein GELUNGENER Versand darf NICHT melden. Ohne sie
            // waere eine Pruefung gruen, die bei jeder Antwort Alarm schlaegt.
            meldungen.length = 0;
            console.error = (...a) => { meldungen.push(a.join(" ")); };
            try {
              global.fetch = async (_u, init) => {
                antworten.push(String(JSON.parse(String(init?.body ?? "{}")).text ?? ""));
                return okAntwort();
              };
              await schicke("/status");
            } finally { console.error = altErr; }
            torPruefung("ein GELUNGENER Versand meldet einen Fehlschlag",
              !meldungen.some((m) => /NICHT zugestellt/.test(m)),
              meldungen.join(" | ").slice(0, 120));
          }
        } finally {
          global.fetch = altFetch;
          for (const [k, v] of Object.entries(altEnv)) {
            if (v === undefined) delete process.env[k]; else process.env[k] = v;
          }
        }
      }

      // ── /edge DURCH DIE ECHTE ROUTE (27.10.) ───────────────────────────
      //
      // Die Verdrahtung war bisher nur STRUKTURELL geprueft (Regex auf den
      // ausgeschnittenen Block). Eine entwischte Sabotage hat gezeigt, dass
      // das zu wenig ist: die Ablehnung einer unbrauchbaren Tagesangabe liess
      // sich ersatzlos entfernen, ohne dass ein Pruefer rot wurde — `/edge
      // abc` haette dann still ALLES gerechnet und sich als Fenster ausgegeben.
      //
      // Jetzt laeuft der ECHTE POST gegen eine ersetzte Datenbank: Befehl →
      // Tagesangabe → Abfrage → Fenster → Text. Dabei wird auch geprueft,
      // WOMIT `findMany` wirklich gerufen wurde — das beweist die Spalten zur
      // Laufzeit, nicht nur ihren Wortlaut im Quelltext.
      {
        const chat = "424242";
        const altEnv2 = {
          TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
          TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
          RAILWAY_GIT_COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA,
          RAILWAY_GIT_BRANCH: process.env.RAILWAY_GIT_BRANCH,
        };
        const altFetch2 = global.fetch;
        const antw = [];
        const abfragen = [];
        try {
          process.env.TELEGRAM_CHAT_ID = chat;
          process.env.TELEGRAM_BOT_TOKEN = "T".repeat(20);
          process.env.RAILWAY_GIT_COMMIT_SHA = "a02fc4a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6";
          process.env.RAILWAY_GIT_BRANCH = "main";
          global.fetch = async (_u, init) => {
            antw.push(String(JSON.parse(String(init?.body ?? "{}")).text ?? ""));
            return { ok: true, status: 200, text: async () => '{"ok":true}' };
          };
          const trE = ladeTsModul("lib/capital-com/capital-trade-tracker.ts");
          const ewE = trE.fehler ? trE : ladeTsModul("lib/expectancy/erwartungswert.ts",
            { "capital-trade-tracker": trE.exports });
          const lzE = ladeTsModul("lib/laufzeit/laufzeit-stand.ts");

          // ── WELCHER STAND LÄUFT? (27.10.) ───────────────────────────────
          //
          // Anlass: ein Fix wurde 22:59:36 gepusht und 23:01 ausprobiert.
          // Railway war noch am Bauen, der Bot sagte "Unbekannter Befehl",
          // und es gab keine Moeglichkeit das festzustellen ausser Raten.
          const lz = lzE.exports?.laufzeitStand;
          const dauer = lzE.exports?.dauerText;
          const zeilenFn = lzE.exports?.laufzeitZeilen;
          if (lzE.fehler || typeof lz !== "function") {
            torPruefung("laufzeitStand ist nicht ausfuehrbar", false,
              lzE.fehler ?? "nicht exportiert");
          } else {
            const JETZT = 1_800_000_000_000;
            const HASH = "a02fc4a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6";

            torPruefung("dauerText rechnet falsch",
              dauer(45) === "45 s" && dauer(420) === "7 min"
              && dauer(7980) === "2 h 13 min" && dauer(172800) === "2 d",
              [45, 420, 7980, 172800].map(dauer).join(" | "));
            torPruefung("eine unbekannte Laufzeit wird zu einer Zahl erfunden",
              dauer(-1) === "unbekannt" && dauer(NaN) === "unbekannt",
              `${dauer(-1)} / ${dauer(NaN)}`);

            const ok = lz({ RAILWAY_GIT_COMMIT_SHA: HASH, RAILWAY_GIT_BRANCH: "main" },
              420, JETZT);
            torPruefung("der Commit wird nicht aus der Umgebung gelesen",
              ok.commit === "a02fc4a" && ok.quelle === "RAILWAY_GIT_COMMIT_SHA"
              && ok.branch === "main", JSON.stringify(ok));
            torPruefung("der Startzeitpunkt wird falsch gerechnet",
              ok.startMs === JETZT - 420_000, String(ok.startMs));

            // Fehlt die Variable, heisst das UNBEKANNT mit Grund — nicht
            // "keine Aenderung" und schon gar keine erfundene Kennung.
            const fehlt = lz({}, 60, JETZT);
            torPruefung("eine fehlende Commit-Variable wird verschwiegen",
              fehlt.commit === null && fehlt.quelle === null
              && /keine der Variablen/.test(fehlt.grund)
              && /RAILWAY_GIT_COMMIT_SHA/.test(fehlt.grund),
              JSON.stringify(fehlt));

            // CLAUDE.md, 27.09.: "eine Deploy-Kennung ist KEIN Commit-Hash".
            //
            // Der Wert ist BEWUSST hexadezimal: mit "abc-123-def" wuerde ihn
            // schon die Hash-Pruefung abweisen, und der Testfall koennte den
            // Fehler gar nicht ausdruecken — die Sabotage „Deployment-ID in
            // die Quellenliste" blieb damit gruen. Vorgefuehrt.
            const deployId = lz({ RAILWAY_DEPLOYMENT_ID: "abc1234def5678" }, 60, JETZT);
            torPruefung("eine Deployment-ID wird als Commit ausgegeben — "
              + "genau der Fehler, vor dem CLAUDE.md warnt",
              deployId.commit === null, JSON.stringify(deployId));

            // Ein unbrauchbarer Wert: gemeldet, aber NICHT in den Chat
            // zurueckgeschickt (Regel vom 29.09.).
            const krumm = lz({ RAILWAY_GIT_COMMIT_SHA: "nicht-ein-hash-sondern-text" },
              60, JETZT);
            torPruefung("ein unbrauchbarer Wert wird als Commit durchgereicht",
              krumm.commit === null && /27 Zeichen/.test(krumm.grund),
              JSON.stringify(krumm));
            torPruefung("der unbrauchbare WERT landet in der Meldung",
              !krumm.grund.includes("nicht-ein-hash"), krumm.grund);

            // Die ERSTE gesetzte Variable entscheidet — sonst verdeckt die
            // zweite einen Tippfehler in der ersten, und man sucht falsch.
            const beide = lz({ RAILWAY_GIT_COMMIT_SHA: "kaputt!", GIT_COMMIT_SHA: HASH },
              60, JETZT);
            torPruefung("eine zweite Variable verdeckt den Fehler in der ersten",
              beide.commit === null && beide.quelle === "RAILWAY_GIT_COMMIT_SHA",
              JSON.stringify(beide));

            const zOk = zeilenFn(ok, "27.10.2026, 23:05:12 MEZ");
            torPruefung("die Zeilen nennen Commit und Startzeit nicht",
              zOk.join(" ").includes("a02fc4a") && /7 min/.test(zOk.join(" "))
              && /23:05:12/.test(zOk.join(" ")), JSON.stringify(zOk));
            // Der GRUND muss mit, nicht nur das Wort "unbekannt" — sonst
            // weiss niemand, ob die Variable fehlt, falsch ist oder der
            // Dienst sie gar nicht setzt. Eine Pruefung auf /unbekannt/
            // allein blieb bei entferntem Grund gruen.
            const zFehlt = zeilenFn(fehlt, null).join(" ");
            torPruefung("ohne Commit fehlt der GRUND in der Anzeige",
              /unbekannt/.test(zFehlt) && /keine der Variablen/.test(zFehlt)
              && /RAILWAY_GIT_COMMIT_SHA/.test(zFehlt), zFehlt);
          }
          // 40 Zeilen von gestern, 40 aus dem Juni — das Fenster MUSS trennen.
          const heute = new Date();
          const vorTagen = (n) => new Date(heute.getTime() - n * 86400000).toISOString();
          const zeilenDb = [
            ...Array.from({ length: 40 }, () => ({
              profitLoss: 12, notes: '{"exitReason":"ZIEL"}',
              result: "WIN", updatedAt: vorTagen(3) })),
            ...Array.from({ length: 40 }, () => ({
              profitLoss: -8, notes: '{"exitReason":"STOP"}',
              result: "LOSS", updatedAt: vorTagen(200) })),
          ];
          const whE = ewE.fehler ? ewE : ladeTsModul("app/api/telegram/webhook/route.ts", {
            "next/server": { NextResponse: { json: (x) => ({ __json: x }) } },
            "telegram-notifications/telegram-sender": {
              sendTelegram: async () => true,
              // Der Stellvertreter gibt das ARGUMENT zurueck, nicht eine feste
              // Zeichenkette: nur so laesst sich pruefen, dass die Startzeit
              // wirklich DURCH den Formatierer geht (und nicht z. B. als
              // toISOString danebenlaeuft) und WELCHER Zeitpunkt ankommt.
              telegramZeit: (d) => (d === undefined ? "JETZT" : `ZEIT:${d.getTime()}`),
              telegramDatum: () => "27.10.2026",
            },
            "lib/killswitch": {
              getKillswitchReport: () => ({ triggered: false, armed: true, systemLocked: false, stages: [], summary: "ok" }),
            },
            "app/lib/prisma": {
              getPrisma: () => ({ trade: { findMany: async (a) => { abfragen.push(a); return zeilenDb; } } }),
            },
            "expectancy/erwartungswert": ewE.exports,
            "laufzeit/laufzeit-stand": lzE.exports,
            "handels-lage/handels-lage": ladeTsModul("lib/handels-lage/handels-lage.ts").exports,
          });
          if (whE.fehler || typeof whE.exports?.POST !== "function") {
            torPruefung("/edge ist nicht end-to-end ausfuehrbar", false,
              whE.fehler ?? "POST fehlt");
          } else {
            const edge = (text) => whE.exports.POST({
              json: async () => ({ message: { chat: { id: Number(chat) }, from: { first_name: "P" }, text } }),
            });

            await edge("/edge 60");
            const mitF = antw.at(-1) ?? "";
            torPruefung("/edge 60 rechnet kein Fenster — die Tagesangabe "
              + "verpufft auf dem Weg zur Rechnung",
              /Zeitraum: <b>letzte 60 Tage<\/b>/.test(mitF)
              && /Gewertet: <b>40<\/b>/.test(mitF) && /vor dem Fenster: 40/.test(mitF),
              mitF.replace(/\n/g, " ").slice(0, 160));
            torPruefung("im Fenster bleibt der Altbestand in der Rechnung",
              /101|0 Verlust|40 Gewinn/.test(mitF) && !/40 Verlust/.test(mitF),
              mitF.replace(/\n/g, " ").slice(0, 160));

            // Die Spalten zur LAUFZEIT, nicht nur im Quelltext.
            const sel = abfragen.at(-1)?.select ?? {};
            torPruefung("/edge fragt die noetigen Spalten nicht ab "
              + "(profitLoss/notes/result/updatedAt)",
              sel.profitLoss === true && sel.notes === true
              && sel.result === true && sel.updatedAt === true,
              JSON.stringify(abfragen.at(-1) ?? null));
            torPruefung("/edge liest offene Trades mit (zur Laufzeit geprueft)",
              abfragen.at(-1)?.where?.status?.not === "OPEN",
              JSON.stringify(abfragen.at(-1)?.where ?? null));

            await edge("/edge");
            torPruefung("/edge ohne Angabe rechnet nicht mehr alles",
              /Zeitraum: <b>alles<\/b>/.test(antw.at(-1) ?? "")
              && /Gewertet: <b>80<\/b>/.test(antw.at(-1) ?? ""),
              (antw.at(-1) ?? "").replace(/\n/g, " ").slice(0, 140));

            // DER KERN dieser Runde: eine unbrauchbare Angabe darf NICHT
            // still zu "alles" werden — sonst sieht die Antwort nach Fenster
            // aus und ist keines.
            // Die DREI letzten sind die eigentlich gefaehrlichen und fehlten
            // zuerst: `Number()` ist zwar streng, aber nicht ueberall —
            // Number("1e5")=100000, Number("0x10")=16, Number("6e2")=600.
            // Ohne sie laesst sich `/^\d+$/` auf `/^\d/` verkuerzen, ohne dass
            // ein Testfall das merkt. Vorgefuehrt: mit abc/0/-5/1e allein
            // blieb genau diese Sabotage gruen.
            for (const schlecht of ["/edge abc", "/edge 0", "/edge -5", "/edge 1e",
              "/edge 1e5", "/edge 0x10", "/edge 6e2"]) {
              const vorher = abfragen.length;
              await edge(schlecht);
              const a = antw.at(-1) ?? "";
              torPruefung(`'${schlecht}' wird still zu einer Gesamtrechnung, `
                + "statt abgelehnt zu werden",
                /keine Anzahl Tage/.test(a) && !/Gewertet:/.test(a),
                a.replace(/\n/g, " ").slice(0, 110));
              torPruefung(`'${schlecht}' fragt trotzdem die Datenbank ab`,
                abfragen.length === vorher,
                `${abfragen.length - vorher} Abfragen nach der Ablehnung`);
            }

            // DIE EINGABE DARF NICHT IN DEN CHAT ZURUECK (Regel 29.09.).
            //
            // Ein Telegram-Verlauf liegt auf jedem angemeldeten Geraet und auf
            // Telegrams Servern und laesst sich nicht zurueckholen. Wer sich
            // vertippt und `/edge <etwas Vertrauliches>` schickt, haette es
            // sonst dauerhaft dort stehen. Die Meldung braucht das Argument
            // nicht — Laenge und die richtige Form erklaeren alles.
            // /status muss den laufenden Stand nennen — END-TO-END durch die
            // echte POST-Funktion, mit der echten Umgebungsvariablen.
            await edge("/status");
            const aStatus = antw.at(-1) ?? "";
            torPruefung("/status nennt den laufenden Commit nicht — dann ist "
              + "'ist mein Fix schon oben?' nur zu erraten",
              /Laufender Stand/.test(aStatus) && /a02fc4a/.test(aStatus)
              && /\(main\)/.test(aStatus), aStatus.replace(/\n/g, " ").slice(0, 200));
            torPruefung("/status nennt die Laufzeit nicht",
              /Läuft seit:/.test(aStatus), aStatus.replace(/\n/g, " ").slice(0, 200));
            // Die Startzeit muss DURCH telegramZeit() gehen — ein nacktes
            // toISOString() waere die Falle vom 27.09. (Zeitzone des
            // Prozesses), und der Pruefer auf `.toLocale…` sieht sie nicht.
            torPruefung("die Startzeit geht nicht durch telegramZeit() — eine "
              + "andere Formatierung traegt die Zeitzone des Prozesses",
              /Start ZEIT:\d+/.test(aStatus), aStatus.replace(/\n/g, " ").slice(0, 200));
            // Und sie muss aus `process.uptime()` kommen. Die ECHTE Uptime
            // taugt dafuer NICHT als Massstab: der Pruefer-Prozess laeuft an
            // dieser Stelle erst 0.04 s (gemessen), eine Pruefung auf "mehr
            // als eine halbe Sekunde" haengt also an der Wanduhr statt am
            // Verhalten. Deshalb wird die Uptime hier GESETZT und das
            // Ergebnis dagegen gerechnet.
            const altUptime = process.uptime;
            let mitUptime = "";
            try {
              process.uptime = () => 3600;          // genau eine Stunde
              await edge("/status");
              mitUptime = antw.at(-1) ?? "";
            } finally { process.uptime = altUptime; }
            torPruefung("die Laufzeit kommt nicht aus process.uptime() "
              + "(3600 s muessen '1 h' ergeben)",
              /Läuft seit: <b>1 h<\/b>/.test(mitUptime),
              mitUptime.replace(/\n/g, " ").slice(0, 200));
            const startTs = Number((mitUptime.match(/Start ZEIT:(\d+)/) ?? [])[1] ?? 0);
            torPruefung("der Startzeitpunkt wird nicht aus der Uptime gerechnet",
              startTs > 0 && Math.abs((Date.now() - 3_600_000) - startTs) < 5_000,
              `Abweichung ${(((Date.now() - 3_600_000) - startTs) / 1000).toFixed(1)} s`);
            // Der VOLLE Hash gehoert nicht in den Chat — sieben Zeichen
            // identifizieren den Commit eindeutig genug.
            torPruefung("der volle Commit-Hash wird in den Chat geschrieben",
              !aStatus.includes("a02fc4a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6"),
              aStatus.replace(/\n/g, " ").slice(0, 200));

            const geheim = "geheim123xyz";          // 12 Zeichen
            await edge(`/edge ${geheim}`);
            const aGeheim = antw.at(-1) ?? "";
            torPruefung("die Ablehnung schickt die Eingabe in den Chat zurueck "
              + "— ein Telegram-Verlauf laesst sich nicht zurueckholen",
              !aGeheim.includes(geheim) && !aGeheim.includes("geheim"),
              aGeheim.replace(/\n/g, " ").slice(0, 120));
            torPruefung("die Ablehnung sagt gar nichts ueber die Eingabe — "
              + "dann weiss man nicht, ob sie ueberhaupt ankam",
              /12 Zeichen/.test(aGeheim) && /keine Anzahl Tage/.test(aGeheim),
              aGeheim.replace(/\n/g, " ").slice(0, 120));
            // Gegenprobe: ein TEIL der Eingabe darf auch nicht durchrutschen.
            await edge("/edge abcdefghijklmnopqrstuvwxyz");
            torPruefung("ein gekuerztes Echo der Eingabe rutscht durch",
              !/abcdefghij/.test(antw.at(-1) ?? ""),
              (antw.at(-1) ?? "").replace(/\n/g, " ").slice(0, 120));
          }
        } finally {
          global.fetch = altFetch2;
          for (const [k, v] of Object.entries(altEnv2)) {
            if (v === undefined) delete process.env[k]; else process.env[k] = v;
          }
        }
      }

      // ── JEDER BEFEHL MUSS IN DER HILFE STEHEN (29.09.) ──────────────────
      //
      // Es gab ZWEI Befehlslisten: eine kurze in `/status`, eine lange in
      // `/help`. Beim Einbau von `/peakreset` wurde nur `/help` nachgezogen —
      // der neue Befehl war ueber `/status` nicht auffindbar. Aufgefallen ist
      // das erst beim Gegenlesen eines Screenshots.
      //
      // Exakt die Fehlerklasse aus dem Dashboard (Menueeintrag ohne
      // Render-Zeile, 26.08.): zwei Listen, die deckungsgleich sein muessen,
      // und eine wird vergessen. `SYSTEM_BEFEHLE` ist jetzt die eine Liste.
      //
      // Geprueft wird DYNAMISCH: welche Befehle behandelt der Webhook
      // ueberhaupt? Eine feste Aufzaehlung im Pruefer waere genau dieselbe
      // Falle eine Ebene hoeher.
      {
        const roh = read("frontend/app/api/telegram/webhook/route.ts");
        const quell = roh.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

        // Alle behandelten Befehle: `textLower === "/x"` und `.startsWith("/x "`.
        const behandelt = new Set();
        for (const m of quell.matchAll(/textLower === "(\/[a-zä-ü]+)"/g)) behandelt.add(m[1]);
        for (const m of quell.matchAll(/textLower\.startsWith\("(\/[a-zä-ü]+) "\)/g)) behandelt.add(m[1]);

        // Der Hilfetext: alles zwischen `textLower === "/help"` und dem
        // Ende seiner Antwort. Dazu die gemeinsame Liste.
        const hilfeAb = quell.indexOf('textLower === "/help"');
        const hilfeText = hilfeAb >= 0 ? quell.slice(hilfeAb, hilfeAb + 2000) : "";
        const listeAb = quell.indexOf("const SYSTEM_BEFEHLE");
        const listeText = listeAb >= 0 ? quell.slice(listeAb, listeAb + 800) : "";
        const dokumentiert = `${hilfeText}\n${listeText}`;

        torPruefung("der Pruefstand findet gar keine Befehle — er greift ins Leere",
          behandelt.size >= 10, `${behandelt.size} Befehle gefunden`);
        const fehlend = [...behandelt].filter((b) => !dokumentiert.includes(b));
        torPruefung("ein Befehl fehlt in der Hilfe",
          fehlend.length === 0,
          fehlend.length ? `nicht dokumentiert: ${fehlend.join(", ")}` : `${behandelt.size} Befehle, alle dokumentiert`);

        // Und die EINE Liste muss von beiden Ausgaben benutzt werden.
        //
        // BEGRENZT AM NAECHSTEN BEFEHL, nicht an einer Zeichenzahl. Die erste
        // Fassung nahm 700 Zeichen ab `textLower === "/status"` — und das
        // reichte bis in den `/help`-Block hinein, der `${SYSTEM_BEFEHLE}`
        // ebenfalls enthaelt. Die Sabotage "/status bekommt wieder eine eigene
        // Liste" blieb dadurch GRUEN. Dasselbe Zeichen-Fenster-Problem wie am
        // selben Tag in prompt-zahlen: ein Fenster beweist Naehe, nicht
        // Zugehoerigkeit.
        const statusAb = quell.indexOf('textLower === "/status"');
        const statusBis = statusAb >= 0 ? quell.indexOf('textLower === "/help"', statusAb) : -1;
        const statusText = statusAb >= 0
          ? quell.slice(statusAb, statusBis > statusAb ? statusBis : statusAb + 700)
          : "";
        torPruefung("/status hat wieder eine eigene Befehlsliste",
          /\$\{SYSTEM_BEFEHLE\}/.test(statusText),
          "zwei Listen driften auseinander — genau so fehlte /peakreset");
        torPruefung("/help hat wieder eine eigene Befehlsliste",
          /\$\{SYSTEM_BEFEHLE\}/.test(hilfeText),
          "die Systembefehle gehoeren aus SYSTEM_BEFEHLE");
      }

      // ── KEIN STILLER AUFFANG MEHR IN DER BESTAETIGUNGS-KETTE ────────────
      //
      // Der letzte Zweig war `} else {` mit dem vollstaendigen Shutdown
      // darin. Jede NICHT erkannte Aktion loeste damit nach korrektem
      // Passwort einen Killswitch aus — inklusive Schliessen aller
      // Positionen. Wer eine neue Aktion einbaut und den Zweig vergisst,
      // haette unbemerkt den Notaus verdrahtet.
      torPruefung("der Killswitch haengt wieder am Auffang-Zweig",
        /pending\.action === "killswitch"/.test(hookQ),
        "eine unbekannte Aktion darf NIE einen Shutdown ausloesen");
      torPruefung("eine unbekannte Bestaetigungs-Aktion tut still nichts",
        /Unbekannte Bestaetigungs-Aktion/.test(hookQ),
        "sie darf nichts tun — aber das auch sagen");
    }

    // Und die modul-scoped Variable darf nicht zurueckkehren.
    const tfQ = read("frontend/lib/trading-filters/trade-filters.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    torPruefung("der Tagesstart liegt wieder modul-scoped",
      !/const _dayStart/.test(tfQ),
      "nach einem Deploy waere der Schutz wieder aus");
    torPruefung("der Aufruf wartet nicht auf den nun asynchronen Riegel",
      /await checkDailyLossLimit\(/.test(tfQ),
      "ohne await waere `allowed` undefined und der Riegel wirkungslos");
  }

  // ══ IC MARKETS HANDELT NICHT UNBEOBACHTET MIT (15.09.) ═══════════════════
  //
  // DER FUND. Der ExecutionAgent schickte jede Order an BEIDE Broker: der
  // Rueckfall der KI lautet `brokers: ["CAPITAL", "IC_MARKETS"]`, bei
  // `skipAIValidation` steht dasselbe fest im Code, und das einzige Tor davor
  // war `isICMarketsConnected()`. Laut Betriebslog stand die Sitzung
  // (`[IC Markets] keep-alive ✅ balance=19864.27`).
  //
  // Nachgerechnet:
  //   Broker        Kontostand   Risiko/Trade   6 gleichzeitig
  //   Capital.com      1562.14          15.62            93.73
  //   IC Markets      19864.27         198.64          1191.86
  //
  // IC wird mit dem EIGENEN Kontostand dimensioniert (12.7-faches Risiko) —
  // und KEINE der sieben Schutzschichten sieht dieses Konto. Sie rechnen alle
  // mit der Capital-Positionsliste und dem Capital-Kontostand.
  //
  // Dazu ein erreichbares Aufschaukeln: `ok` gilt, sobald EIN Broker
  // erfolgreich war. Scheitert Capital und gelingt IC, steht die Position nur
  // bei IC — und weil der Duplikat-Schutz nur Capital liest, kaeme sie im
  // naechsten Zyklus noch einmal dazu.
  //
  // Vorgabe des Nutzers: IC vorerst beiseite, aber so bauen, dass es spaeter
  // integriert werden kann. Deshalb ZWEI Dinge: ein Schalter (Standard AUS)
  // und `risk-scope.ts` als die EINE Stelle, die sagt, welche Konten unter
  // Schutz stehen.
  {
    const rs = ladeTsModul("lib/risk-scope/risk-scope.ts", {});
    if (rs.fehler || typeof rs.exports.risikoUmfang !== "function") {
      torPruefung("risk-scope nicht ausfuehrbar", false, rs.fehler ?? "Export fehlt");
    } else {
      const { risikoUmfang, ueberwachtesKapital, lueckeMeldung } = rs.exports;
      // Heutiger Normalfall: nur Capital, IC aus -> keine Luecke.
      const a = risikoUmfang({ capitalBalance: 1562.14, capitalAvailable: 1500, icFuehrtAus: false });
      torPruefung("Capital steht nicht unter Schutz",
        a.konten.length === 1 && a.konten[0].broker === "CAPITAL_COM",
        JSON.stringify(a.konten));
      torPruefung("ohne IC-Ausfuehrung wird faelschlich eine Luecke gemeldet",
        a.nichtUeberwacht.length === 0 && lueckeMeldung(a) === null,
        JSON.stringify(a.nichtUeberwacht));
      torPruefung("das ueberwachte Kapital stimmt nicht",
        Math.abs(ueberwachtesKapital(a) - 1562.14) < 0.001,
        String(ueberwachtesKapital(a)));

      // DER KERN: handelt IC, MUSS die Luecke benannt werden.
      const b = risikoUmfang({ capitalBalance: 1562.14, icFuehrtAus: true, icBalance: 19864.27 });
      torPruefung("handelndes IC wird NICHT als unbeobachtet gemeldet",
        b.nichtUeberwacht.includes("IC_MARKETS"), JSON.stringify(b.nichtUeberwacht));
      const m = lueckeMeldung(b);
      torPruefung("die Luecken-Meldung fehlt", typeof m === "string" && m.length > 40, String(m));
      torPruefung("die Luecken-Meldung nennt den Broker nicht",
        /IC_MARKETS/.test(String(m)));
      torPruefung("die Luecken-Meldung sagt nicht, dass keine Grenze greift",
        /KEINER/.test(String(m)) || /keiner/.test(String(m)), String(m).slice(0, 90));
      // Das IC-Kapital darf NICHT mitgezaehlt werden, solange es nicht
      // ueberwacht ist — sonst rechneten die Grenzen mit Geld, das sie nicht
      // schuetzen, und der Drawdown saehe kuenstlich klein aus.
      torPruefung("unbeobachtetes IC-Kapital wird mitgezaehlt",
        Math.abs(ueberwachtesKapital(b) - 1562.14) < 0.001,
        `${ueberwachtesKapital(b)} — es darf NUR Capital sein`);
      // Unbrauchbare Eingaben ergeben kein Konto (statt eines Null-Kontos).
      const c = risikoUmfang({ capitalBalance: 0, icFuehrtAus: false });
      const d = risikoUmfang({ capitalBalance: NaN, icFuehrtAus: false });
      torPruefung("ein Kontostand 0 oder NaN ergibt ein Konto",
        c.konten.length === 0 && d.konten.length === 0,
        `${c.konten.length} / ${d.konten.length}`);
    }

    // ── Der Schalter: IC bekommt nur mit ausdruecklicher Freigabe Orders ───
    const ohneK = (p) => read(p)
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    const exec = ohneK("frontend/lib/agents/execution-agent.ts");
    // Seit 16.09. ueber die gesicherte Liste `brokers` (eine KI-Antwort ohne
    // Broker-Liste warf vorher eine TypeError). Die UND-Verknuepfung mit der
    // Freigabe bleibt Pflicht, und `brokers` muss aus der KI-Antwort stammen.
    torPruefung("IC bekommt wieder ohne Freigabe Orders",
      /useIC = brokers\.includes\("IC_MARKETS"\) && icFreigegeben/.test(exec)
      && /const brokers: string\[\] = Array\.isArray\(aiDecision\.brokers\)/.test(exec)
      && !/aiDecision\.brokers\.includes\(/.test(exec),
      "der KI-Rueckfall enthaelt IC_MARKETS — sie darf es nicht allein freigeben");
    torPruefung("die Freigabe wird nicht aus den Einstellungen gelesen",
      /icMarketsExecutionEnabled === true/.test(exec));
    // Standard MUSS AUS sein.
    const store = ohneK("frontend/lib/settings/settings-store.ts");
    torPruefung("die IC-Ausfuehrung ist standardmaessig EIN",
      /icMarketsExecutionEnabled:\s*false/.test(store),
      "ein unbeobachteter Broker darf nicht der Standard sein");
    // Und der Orchestrator muss den Umfang wirklich benutzen.
    const orchK = ohneK("frontend/lib/agents/orchestrator-agent.ts");
    torPruefung("der Zyklus bestimmt den Risiko-Umfang nicht",
      /risikoUmfang\(\{/.test(orchK) && /ueberwachtesKapital\(umfang\)/.test(orchK),
      "sonst steht nirgends, welche Konten die Grenzen erfassen");
    torPruefung("eine Luecke wird im Zyklus nicht gemeldet",
      /lueckeMeldung\(umfang\)/.test(orchK) && /console\.warn\(luecke\)/.test(orchK));
    // `icFuehrtAus` muss BEIDES verlangen — Sitzung UND Freigabe.
    torPruefung("der Umfang haelt IC schon bei blosser Sitzung fuer handelnd",
      /icMarketsExecutionEnabled === true\s*\n?\s*&& isICMarketsConnected\(\)/.test(orchK),
      "eine stehende Sitzung allein ist keine Ausfuehrung");
  }

  // ══ NUR ZWEI ROUTEN DUERFEN ORDERS PLATZIEREN (15.09.) ═══════════════════
  //
  // ANLASS. Am 07.09. stellte sich heraus, dass `POST /api/auto-execute`
  // echte Orders ausloeste — ohne Killswitch, ohne Handelszeitfenster, ohne
  // Filterkette, und mit Gelegenheiten aus dem Request-Body. Gefunden wurde
  // das nur, weil jemand gezielt danach gesucht hat. NICHTS im Netz haette
  // eine zweite solche Route bemerkt.
  //
  // Am 15.09. wurden deshalb ALLE 150 API-Routen durchgemessen: 68 haben
  // keinen Aufrufer im Quelltext (kommentarbereinigt — die erste Zaehlung
  // ergab 65, weil Namen in Kommentaren als Aufruf galten). Das ist fuer sich kein Fehler — aber eine
  // davon koennte morgen Orders platzieren, und niemand wuerde es sehen.
  //
  // Diese Pruefung dreht das um: es wird nicht gesucht, was tot ist, sondern
  // festgehalten, WER ueberhaupt Orders platzieren darf. Kommt eine dritte
  // Route dazu, wird sie hier rot — ganz gleich, ob sie aufgerufen wird.
  //
  // Kommentare und Zeichenketten raus: die Begruendung oben nennt
  // `auto-execute` und die Funktionsnamen, und in der stillgelegten Route
  // stehen sie ebenfalls im Kopfkommentar.
  {
    const apiWurzel = path.join(__dirname, "../../frontend/app/api");
    const ORDER = /executeCapitalDemoOrder\s*\(|executeICMarketsOrder\s*\(|capitalPlaceOrder\s*\(|icPlaceOrder\s*\(|runExecutionAgent\s*\(/;
    const ERLAUBT = ["/api/capital-com/execute", "/api/icmarkets/execute"];

    const routen = [];
    (function suche(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) suche(p);
        else if (e.name === "route.ts") routen.push(p);
      }
    })(apiWurzel);

    const platzierer = [];
    for (const p of routen) {
      const code = fs.readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/`(?:[^`\\]|\\.)*`/g, "``");
      if (ORDER.test(code)) {
        platzierer.push("/api/" + path.relative(apiWurzel, p)
          .replace(/\\/g, "/").replace(/\/route\.ts$/, ""));
      }
    }
    platzierer.sort();

    torPruefung("es gibt keine Route mehr, die Orders platziert — Pruefung ins Leere",
      platzierer.length > 0, "erwartet werden genau zwei");
    torPruefung("eine NEUE Route platziert Orders",
      platzierer.every((r) => ERLAUBT.includes(r)),
      `unerwartet: ${platzierer.filter((r) => !ERLAUBT.includes(r)).join(", ")}`);
    torPruefung("eine der beiden erlaubten Routen platziert keine Orders mehr",
      ERLAUBT.every((r) => platzierer.includes(r)),
      `gefunden: ${platzierer.join(", ")}`);

    // ── OHNE STOP KEINE ORDER (28.10.) ─────────────────────────────────────
    //
    // Gefunden am 28.10.: `LiveExecutionMonitor.tsx` (Dashboard-Ansicht
    // "live-execution") schickt beim GO-Knopf weder stopLossPrice noch
    // takeProfitPrice. Die Route reicht das durch, und capital-com-client
    // laesst `stopLevel` dann weg — die Order ginge OHNE Stop zum Broker,
    // waehrend die Groesse ueber DEFAULT_STOP_BY_STYLE fuer einen Stop
    // gerechnet wird, den es nicht gibt.
    //
    // Der automatische Pfad ist nachweislich NICHT betroffen: goSignal
    // verlangt stopLoss > 0 UND takeProfit > 0, und `approved` entsteht
    // ausschliesslich aus goSignals.
    {
      // Die ECHTE EPIC_MAP durchreichen, keine Kopie: `capital-com-execution`
      // laeuft auf Modulebene ueber `Object.entries(EPIC_MAP)` (Zeile 160) —
      // mit einem leeren Ersatz wirft das Modul beim Laden. Und eine
      // nachgebaute Karte pruefte gegen die eigene Annahme.
      const klient = ladeTsModul("lib/capital-com/capital-com-client.ts");
      const ex = klient.fehler ? klient
        : ladeTsModul("lib/capital-com/capital-com-execution.ts", {
          "killswitch": { isKillswitchActive: () => false },
          "capital-com-session": { getCapitalSession: () => null },
          "capital-com-client": klient.exports,
        });
      const riegel = ex.exports?.ordersRiegel;
      if (ex.fehler || typeof riegel !== "function") {
        torPruefung("ordersRiegel ist nicht ausfuehrbar — ohne ihn kann eine "
          + "Order ohne Stop herausgehen", false, ex.fehler ?? "nicht exportiert");
      } else {
        torPruefung("ein gueltiges Paar aus Stop und Ziel wird abgelehnt",
          riegel(1.2345, 1.2500) === "", riegel(1.2345, 1.2500));
        // Jede Form von "kein Stop" muss greifen.
        for (const [wert, name] of [[undefined, "undefined"], [null, "null"],
          [0, "0"], [-1, "negativ"], ["1.23", "Text"], [NaN, "NaN"],
          [Infinity, "Infinity"]]) {
          torPruefung(`eine Order ohne brauchbaren Stop (${name}) wird nicht `
            + "geblockt", riegel(wert, 1.25) !== "", `Grund: "${riegel(wert, 1.25)}"`);
        }
        // Und dasselbe fuer das Ziel — ohne Ziel rechnet `ausstiegsgrund()`
        // auf einer Spanne, die es nicht gibt.
        for (const [wert, name] of [[undefined, "undefined"], [0, "0"], [NaN, "NaN"]]) {
          torPruefung(`eine Order ohne brauchbares Ziel (${name}) wird nicht geblockt`,
            riegel(1.2345, wert) !== "", `Grund: "${riegel(1.2345, wert)}"`);
        }
        // Der GRUND muss drinstehen — sonst raet man spaeter.
        torPruefung("der Grund nennt nicht, WELCHER Wert fehlt",
          /Stop-Kurs/.test(riegel(undefined, 1.25))
          && /Ziel-Kurs/.test(riegel(1.2345, undefined)),
          `${riegel(undefined, 1.25)} / ${riegel(1.2345, undefined)}`);
        // Und WAS mit ihm ist. Ausgefuehrt belegt (28.10.): `Number.isFinite`
        // allein blockt undefined, null, Text, NaN und Infinity — die zwei
        // Zweige davor sind fuer das BLOCKIEREN redundant und dienen
        // ausschliesslich der Meldung. Also wird die Meldung geprueft, sonst
        // waeren die Zweige unbewiesen und ihre Entfernung bliebe gruen.
        for (const [wert, muster, name] of [
          [undefined, /fehlt/, "fehlt"],
          [null, /fehlt/, "fehlt (null)"],
          ["1.23", /keine Zahl \(string\)/, "keine Zahl"],
          [NaN, /nicht endlich/, "nicht endlich"],
          [0, /ist 0/, "ist 0"],
        ]) {
          torPruefung(`die Meldung sagt nicht, WAS mit dem Stop ist (${name})`,
            muster.test(riegel(wert, 1.25)), `"${riegel(wert, 1.25)}"`);
        }
        // NaN ist die Falle: `NaN <= 0` ist FALSE (Lehre checkPriceAvailable).
        torPruefung("ein NaN-Stop rutscht durch — `NaN <= 0` ist FALSE",
          riegel(NaN, 1.25) !== "", `Grund: "${riegel(NaN, 1.25)}"`);
      }

      // VERDRAHTUNG: der Riegel muss VOR der Orderplatzierung stehen. Beide
      // Positionen werden auf Existenz geprueft und DANN verglichen — ein
      // `indexOf(...) < -1` kann nie wahr werden (Lehre vom 25.10.).
      const exQuell = read("frontend/lib/capital-com/capital-com-execution.ts");
      const iRiegel = exQuell.indexOf("const riegel = ordersRiegel(");
      const iOrder = exQuell.indexOf("await capitalPlaceOrder(");
      torPruefung("ordersRiegel wird in executeCapitalDemoOrder gar nicht gerufen",
        iRiegel >= 0, `gefunden@${iRiegel}`);
      torPruefung("capitalPlaceOrder ist nicht mehr auffindbar — die "
        + "Reihenfolge waere ungeprueft", iOrder >= 0, `gefunden@${iOrder}`);
      torPruefung("der Stop-Riegel steht NACH der Orderplatzierung",
        iRiegel >= 0 && iOrder >= 0 && iRiegel < iOrder,
        `riegel@${iRiegel} order@${iOrder}`);

      // ── WER ORDERS AUSLOEST, MUSS EINEN STOP MITSCHICKEN (28.10.) ──────
      //
      // Anlass: `LiveExecutionMonitor.tsx` rief `/api/capital-com/execute`
      // auf und schickte WEDER stopLossPrice NOCH takeProfitPrice. Der
      // Laufzeit-Riegel faengt das zwar, aber dann scheitert der Knopf
      // sichtbar statt gar nicht erst zu existieren — besser ist, dass eine
      // solche Stelle gar nicht entsteht.
      //
      // EHRLICH ZUR REICHWEITE: geprueft wird auf DATEI-Ebene — kommt
      // `stopLossPrice` in der Datei ueberhaupt vor, die eine Order-Route
      // ruft? Das ist grob und beweist nicht, dass der Wert auch IN diesem
      // Aufruf landet. Genau dafuer gibt es `ordersRiegel()`, der zur
      // Laufzeit greift. Hier geht es um den Fall, den wir hatten: eine
      // Komponente, die den Stop NIRGENDS erwaehnt.
      //
      // Kommentarbereinigt, sonst zaehlte eine Erwaehnung im Kommentar als
      // Verwendung (die Fehlerklasse, die 2026 sechsmal zuschlug).
      {
        const ORDER_ROUTEN = ["/api/capital-com/execute", "/api/icmarkets/execute"];
        const ohneK = (s) => s
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .split("\n").map((z) => z.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
        const ausloeser = [];
        for (const f of sourceFiles([".ts", ".tsx"])) {
          if (!f.startsWith("frontend/")) continue;
          if (f.includes("app/api/")) continue;          // die Routen selbst
          const q = ohneK(read(f));
          if (!ORDER_ROUTEN.some((r) => q.includes(`"${r}"`))) continue;
          ausloeser.push({ f, hatStop: /\bstopLossPrice\b/.test(q) });
        }
        // Selbstpruefung: findet die Suche ueberhaupt etwas? MarketScannerPanel
        // loest nachweislich Orders aus — ohne diesen Treffer waere ein
        // "alles sauber" wertlos.
        torPruefung("die Suche nach Order-Ausloesern findet nichts — "
          + "'keine Befunde' waere dann bedeutungslos",
          ausloeser.some((a) => a.f.includes("MarketScannerPanel")),
          `gefunden: ${ausloeser.map((a) => a.f).join(", ") || "keine"}`);
        const ohneStop = ausloeser.filter((a) => !a.hatStop);
        torPruefung("eine Komponente loest Orders aus, ohne einen Stop zu "
          + "kennen — genau der Fund vom 28.10.",
          ohneStop.length === 0, ohneStop.map((a) => a.f).join(", "));
      }

      // ── EIN FELD OHNE EMPFAENGER IST EIN FEHLER (28.10.) ───────────────
      //
      // `/api/execution-queue-position-sync` holt den Capital-Reconnect
      // bewusst OHNE `await` (die Antwort soll nicht blockieren) und schickt
      // deshalb `capitalComActive` und `reconnectError` mit. Beide Felder
      // hatten bis heute KEINEN Leser — dieselbe Klasse wie ein Abo am Bus
      // ohne Sender (17.09.): die Zeile sieht nach Information aus und geht
      // ins Leere.
      //
      // Geprueft werden BEIDE Richtungen. Faellt das Feld aus der Route,
      // hoert die Anzeige auf zu lesen, oder wird sie auf ZWEI Werte
      // verkuerzt (`!report.capitalComActive`, womit eine fehlende Antwort
      // wieder "nicht verbunden" hiesse — der Fehler vom 30.09.), wird das
      // rot.
      {
        const ohneK2 = (q) => q
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .split("\n").map((zl) => zl.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
        // SELBSTPRUEFUNG an Faellen, die hier vollstaendig kontrolliert sind
        // — nicht am Dateiinhalt, sonst haengt sie an einer Kommentar-
        // Formulierung. Beide Richtungen: ein Treffer MUSS kommen, ein
        // Kommentar-Treffer darf NICHT kommen.
        torPruefung("die Kommentar-Bereinigung findet eine echte Verwendung nicht",
          ohneK2("const x = report.capitalComActive;").includes("report.capitalComActive"),
          "must-hit fehlgeschlagen");
        torPruefung("die Kommentar-Bereinigung zaehlt ein Wort im KOMMENTAR "
          + "als Verwendung — dann beweist 'wird gelesen' nichts",
          !ohneK2("/* report.capitalComActive */").includes("report.capitalComActive")
          && !ohneK2("// report.reconnectError").includes("report.reconnectError"),
          "must-not-hit fehlgeschlagen");
        const rPfad = "frontend/app/api/execution-queue-position-sync/route.ts";
        const pPfad = "frontend/components/ExecutionQueuePositionSyncPanel.tsx";
        const R = ohneK2(read(rPfad));
        const P = ohneK2(read(pPfad));

        // NUR DER ANTWORT-RUMPF ZAEHLT. Die erste Fassung suchte den
        // Feldnamen in der ganzen Datei — und fand die ZEILE
        // `const capitalComActive = isCapitalConnected();`. Die Sabotage
        // "Feld nicht mehr mitschicken" blieb damit gruen, weil der Name
        // woanders weiterlebte: "ein Wort an einer anderen Stelle ist keine
        // Verwendung". Jetzt per Klammerzaehler ausgeschnitten.
        //
        // NICHT `objectBlock` aus `_lib`: das zaehlt nur `{}` ohne
        // Zeichenketten-Bewusstsein (eine `}` in einem Text schliesst dort
        // den Block — die Falle vom 30.09. bei `metaAntwortLesen`) und wirft
        // statt `null` zu liefern. Hier wird ab der Marke selbst gezaehlt,
        // damit auch `json(...)` ohne direktes `{` greift.
        const rumpfAb = (src, marke) => {
          const p = src.indexOf(marke);
          if (p < 0) return null;
          let tiefe = 0;
          for (let i = p + marke.length - 1; i < src.length; i++) {
            const c = src[i];
            if (c === "(" || c === "{" || c === "[") tiefe++;
            else if (c === ")" || c === "}" || c === "]") {
              tiefe--;
              if (tiefe === 0) return src.slice(p, i + 1);
            } else if (c === '"' || c === "'" || c === "`") {
              const q = c; i++;
              while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; }
            }
          }
          return null;
        };
        // Selbstpruefung des Ausschneiders, an kontrollierten Faellen:
        // der Name im Rumpf MUSS drin sein, der Name davor NICHT.
        {
          const probe = rumpfAb('const a = 1;\nreturn J({ ok: true, b: a });', "J(");
          torPruefung("der Klammerzaehler schneidet den Antwort-Rumpf falsch aus",
            probe !== null && /\bb\b/.test(probe) && !/const a/.test(probe),
            `ausgeschnitten: ${String(probe).slice(0, 60)}`);
        }
        const antwort = rumpfAb(R, "NextResponse.json(");
        torPruefung("der Antwort-Rumpf der Sync-Route ist nicht auffindbar — "
          + "ohne ihn beweist jede Feld-Pruefung darunter nichts",
          antwort !== null && antwort.length > 20, rPfad);
        const inAntwort = antwort ?? "";

        for (const feld of ["capitalComActive", "reconnectError"]) {
          torPruefung(`die Route schickt \`${feld}\` nicht mehr mit — die `
            + "Anzeige zeigte dann dauerhaft 'unbekannt' und saehe dabei wie "
            + "ein ehrliches Ergebnis aus",
            new RegExp(`\\b${feld}\\b`).test(inAntwort), rPfad);
          // MIT WORTGRENZE. `includes` waere eine Teilzeichenkette: eine
          // Umbenennung auf `capitalComActiveXX` enthaelt den alten Namen
          // und waere gruen geblieben — genau der Messfehler vom 30.09.
          torPruefung(`niemand LIEST \`${feld}\` — ein Feld ohne Empfaenger `
            + "geht ins Leere (Klasse 17.09.)",
            new RegExp(`report\\.${feld}\\b`).test(P), pPfad);
        }

        // ── UND DIE DREIWERTIGKEIT WIRD GERECHNET, NICHT GELESEN ───────
        //
        // Als Ternaer-Kette im JSX stand `=== false` ZWEIMAL da (Farbe und
        // Text). Eine Sabotage am Text-Zweig liess den Wortlaut im
        // Farb-Zweig stehen — strukturell unauffaellig, und die Anzeige
        // behauptete bei fehlender Antwort wieder "nicht verbunden".
        // Deshalb liegt die Entscheidung jetzt in `brokerLage()` und wird
        // hier mit allen drei Eingaben AUSGEFUEHRT.
        const bl = ladeTsModul("lib/broker-lage/broker-lage.ts");
        const brokerLage = bl.exports?.brokerLage;
        if (bl.fehler || typeof brokerLage !== "function") {
          torPruefung("brokerLage() ist nicht ausfuehrbar", false,
            bl.fehler ?? "nicht exportiert");
        } else {
          const an = brokerLage(true, null);
          const aus = brokerLage(false, "HTTP 401");
          const ausOhneGrund = brokerLage(false, null);
          const unbekannt = brokerLage(undefined, null);
          const unbekanntNull = brokerLage(null, null);
          torPruefung("brokerLage(true) meldet nicht 'verbunden'",
            an.art === "verbunden" && /verbunden/.test(an.text)
            && !/nicht verbunden/.test(an.text), JSON.stringify(an));
          torPruefung("brokerLage(false) meldet nicht 'nicht verbunden'",
            aus.art === "getrennt" && /nicht verbunden/.test(aus.text),
            JSON.stringify(aus));
          torPruefung("brokerLage(false) verschweigt den GRUND — "
            + "\"wer den Grund nicht mitschreibt, muss ihn spaeter raten\"",
            aus.text.includes("HTTP 401"), JSON.stringify(aus));
          torPruefung("ein FEHLENDER Grund wird nicht benannt — eine leere "
            + "Stelle sieht aus wie ein Grund",
            /nicht gemeldet/.test(ausOhneGrund.text), JSON.stringify(ausOhneGrund));
          // DER KERN: undefined/null darf NICHT wie false aussehen.
          torPruefung("brokerLage(undefined) ist nicht UNBEKANNT — eine "
            + "fehlende Antwort hiesse damit 'nicht verbunden' (30.09.)",
            unbekannt.art === "unbekannt" && /unbekannt/.test(unbekannt.text)
            && unbekannt.art !== aus.art && unbekannt.text !== aus.text,
            JSON.stringify(unbekannt));
          torPruefung("brokerLage(null) ist nicht UNBEKANNT",
            unbekanntNull.art === "unbekannt", JSON.stringify(unbekanntNull));
          // Und die Gegenprobe: ein wahrheitswertiger Vergleich statt
          // `=== true` machte aus jedem Wert ein "verbunden".
          torPruefung("brokerLage() prueft nicht strikt auf `true` — ein "
            + "wahrheitswertiger Vergleich macht aus allem 'verbunden'",
            brokerLage("ja", null).art === "unbekannt"
            && brokerLage(1, null).art === "unbekannt",
            `"ja" => ${brokerLage("ja", null).art}, 1 => ${brokerLage(1, null).art}`);
          // Alle drei Texte muessen sich unterscheiden — sonst ist die
          // Dreiwertigkeit nur im Typ, nicht in der Anzeige.
          torPruefung("zwei der drei Lagen zeigen denselben Text",
            new Set([an.text, aus.text, unbekannt.text]).size === 3,
            `${an.text} | ${aus.text} | ${unbekannt.text}`);
        }
        // Die Anzeige muss die Funktion auch BENUTZEN — eine gepruefte
        // Funktion ohne Aufrufstelle beweist nichts (Fehlerklasse 30.09.).
        torPruefung("die Anzeige ruft brokerLage() nicht auf — eine "
          + "gepruefte Funktion ohne Aufrufstelle beweist nichts",
          /brokerLage\(report\.capitalComActive, report\.reconnectError\)/.test(P),
          pPfad);
        torPruefung("die Anzeige vergleicht das Feld wieder selbst, statt "
          + "die Funktion zu benutzen — zwei Stellen laufen auseinander",
          !/report\.capitalComActive ===/.test(P)
          && !/!report\.capitalComActive/.test(P), pPfad);
      }

      // ── /hebel — WAS WUERDE ETWAS AENDERN? (29.10.) ────────────────────
      //
      // `/edge` sagt, DASS kein Edge da ist. `/hebel` gruppiert dieselben
      // Trades nach den Groessen, an denen man drehen kann.
      //
      // DIE WICHTIGSTE ZUSICHERUNG: je Gruppe muss DIESELBE Zahl
      // herauskommen wie bei `/edge`. Eine zweite Formel waere eine zweite
      // Wahrheit — und am 26.10. hat sich genau so eine Antwort um den
      // Faktor 5.32 selbst widersprochen.
      {
        const hb = ladeTsModul("lib/hebel/hebel.ts", {
          "expectancy/erwartungswert": ladeTsModul("lib/expectancy/erwartungswert.ts").exports,
        });
        const ewMod = ladeTsModul("lib/expectancy/erwartungswert.ts");
        const hebelBericht = hb.exports?.hebelBericht;
        const hebelText = hb.exports?.hebelText;
        const rrBand = hb.exports?.rrBand;
        const befundVon = hb.exports?.befundVon;
        const erwartungswert = ewMod.exports?.erwartungswert;
        if (hb.fehler || typeof hebelBericht !== "function"
          || typeof hebelText !== "function" || typeof rrBand !== "function"
          || typeof befundVon !== "function" || typeof erwartungswert !== "function") {
          torPruefung("hebel.ts ist nicht ausfuehrbar", false,
            hb.fehler ?? ewMod.fehler ?? "nicht exportiert");
        } else {
          // ── rrBand: die Schwelle liegt bei 1.5, und 0 ist KEIN R/R ──
          //
          // `riskReward` hat im Schema `@default(0)`. Eine 0 als Band
          // "< 1.5" zu zaehlen hiesse, "nie geschrieben" als Messung
          // auszugeben — derselbe Fehler wie bei `profitLoss` am 26.10.
          for (const [wert, band] of [[0, "ohne Angabe"], [null, "ohne Angabe"],
            [Number.NaN, "ohne Angabe"], [-1, "ohne Angabe"],
            [1.49, "< 1.5 (unter der Einstiegs-Schwelle)"],
            [1.5, "1.5 – 1.99"], [1.99, "1.5 – 1.99"], [2, "2.0 – 2.99"],
            [2.99, "2.0 – 2.99"], [3, "≥ 3.0"], [10, "≥ 3.0"]]) {
            const b = rrBand(Number.isFinite(wert) ? wert : (wert === null ? null : wert));
            torPruefung(`rrBand(${String(wert)}) ergibt nicht "${band}"`,
              b === band, `bekam: ${b}`);
          }

          // ── Zeilen bauen: 40 Gewinner/Verlierer in EINEM Markt ──────
          const zeilenH = [];
          for (let i = 0; i < 40; i++) {
            zeilenH.push({
              profitLoss: i % 3 === 0 ? 10 : -4,
              notes: JSON.stringify({ stil: "DAYTRADING" }),
              result: i % 3 === 0 ? "WIN" : "LOSS",
              updatedAt: "2026-10-20T10:00:00.000Z",
              riskReward: 2.0, market: "EURUSD", direction: "BUY",
              strategy: "Trend",
            });
          }
          // ABSICHTLICH UNBEQUEM: zehn Breakeven dazu. Ohne sie sind
          // `trefferquote` (ueber alle gewerteten) und
          // `trefferquoteEntschieden` (ueber die entschiedenen) zufaellig
          // GLEICH — ein vertauschter Nenner faellt dann nicht auf. Genau
          // so ist die Sabotage H8 zuerst entwischt.
          for (let i = 0; i < 10; i++) {
            zeilenH.push({
              profitLoss: 0, notes: JSON.stringify({ stil: "DAYTRADING" }),
              result: "BREAKEVEN", updatedAt: "2026-10-20T10:00:00.000Z",
              riskReward: 2.0, market: "EURUSD", direction: "BUY",
              strategy: "Trend",
            });
          }
          const direkt = erwartungswert(zeilenH, null);
          // SELBSTPRUEFUNG der Testdaten: verlieren sie die Eigenschaft,
          // ist die Nenner-Pruefung darunter wertlos.
          torPruefung("die Testdaten enthalten keinen Breakeven — die "
            + "Pruefung auf den NENNER kann den Fehler dann gar nicht "
            + "ausdruecken",
            direkt.breakeven > 0 && direkt.entschieden < direkt.gewertet,
            `be=${direkt.breakeven} entschieden=${direkt.entschieden} `
            + `gewertet=${direkt.gewertet}`);
          torPruefung("die beiden Trefferquoten sind in den Testdaten "
            + "GLEICH — dann beweist ein Vergleich nichts",
            direkt.trefferquote !== direkt.trefferquoteEntschieden,
            `${direkt.trefferquote} vs ${direkt.trefferquoteEntschieden}`);
          const dims = hebelBericht(zeilenH, null);
          const marktDim = dims.find((d) => d.titel === "Markt");
          const eineGruppe = marktDim?.gruppen?.[0];
          torPruefung("die Markt-Dimension fehlt oder ist leer",
            !!eineGruppe && eineGruppe.name === "EURUSD",
            JSON.stringify(marktDim?.gruppen?.map((g) => g.name)));
          torPruefung("/hebel rechnet eine ANDERE Zahl als /edge — dann "
            + "koennen sich beide Befehle widersprechen",
            !!eineGruppe && eineGruppe.ew === direkt.erwartungswert
            && eineGruppe.gewertet === direkt.gewertet,
            `hebel=${eineGruppe?.ew} edge=${direkt.erwartungswert}`);
          torPruefung("die Trefferquote je Gruppe hat einen anderen Nenner "
            + "als bei /edge",
            !!eineGruppe && eineGruppe.trefferquote === direkt.trefferquoteEntschieden,
            `${eineGruppe?.trefferquote} vs ${direkt.trefferquoteEntschieden}`);

          // ── Das FENSTER muss durchgereicht werden ──────────────────
          //
          // Ohne diese Pruefung rechnete `/hebel 60` stillschweigend
          // ALLES und saehe dabei wie ein Fenster aus. `jetzt` ist
          // injizierbar, damit die Pruefung nicht an der Wanduhr haengt.
          const altZeilen = zeilenH.map((r) => ({
            ...r, updatedAt: "2026-01-05T10:00:00.000Z",
          }));
          const mitFenster = hebelBericht(altZeilen,
            { tage: 30, jetzt: new Date("2026-10-29T12:00:00.000Z") });
          const gFenster = mitFenster.find((d) => d.titel === "Markt")?.gruppen?.[0];
          torPruefung("das Zeitfenster wird nicht durchgereicht — /hebel 60 "
            + "rechnete dann alles und saehe wie ein Fenster aus",
            !!gFenster && gFenster.gewertet === 0,
            JSON.stringify(gFenster));
          // Gegenprobe: OHNE Fenster muessen dieselben Zeilen zaehlen.
          const ohneFenster = hebelBericht(altZeilen, null);
          const gOhne = ohneFenster.find((d) => d.titel === "Markt")?.gruppen?.[0];
          torPruefung("ohne Fenster werden die alten Zeilen trotzdem "
            + "verworfen — dann waere das Fenster immer an",
            !!gOhne && gOhne.gewertet === 50, JSON.stringify(gOhne));

          // ── Unter MIN_TRADES wird KEIN Erwartungswert ausgegeben ────
          const wenig = hebelBericht(zeilenH.slice(0, 5), null);
          const wenigGruppe = wenig.find((d) => d.titel === "Markt")?.gruppen?.[0];
          torPruefung("eine Gruppe unter MIN_TRADES bekommt trotzdem einen "
            + "Erwartungswert — ein Ausreisser verschiebt den dann komplett",
            !!wenigGruppe && wenigGruppe.belastbar === false
            && wenigGruppe.ew === null, JSON.stringify(wenigGruppe));

          // ── Der Befund braucht ZWEI belastbare Gruppen ──────────────
          torPruefung("ein Befund wird ohne jede belastbare Gruppe behauptet",
            /kein Befund/.test(befundVon([{ name: "A", ew: 5, gewertet: 3,
              trefferquote: null, rr: null, belastbar: false }])), "");
          torPruefung("ein Befund wird aus EINER Gruppe behauptet — ohne "
            + "Vergleich ist das keine Erkenntnis",
            /ohne Vergleichsgruppe/.test(befundVon([{ name: "A", ew: 5,
              gewertet: 50, trefferquote: 50, rr: 1, belastbar: true }])), "");
          const beide = befundVon([
            { name: "A", ew: -5, gewertet: 50, trefferquote: 40, rr: 0.5, belastbar: true },
            { name: "B", ew: 3, gewertet: 60, trefferquote: 55, rr: 1.4, belastbar: true },
            { name: "C", ew: 99, gewertet: 4, trefferquote: 90, rr: 9, belastbar: false },
          ]);
          torPruefung("der Befund nennt nicht die beste UND die "
            + "schlechteste belastbare Gruppe samt Unterschied",
            /„B"/.test(beide) && /„A"/.test(beide) && /8\.00/.test(beide), beide);
          torPruefung("eine NICHT belastbare Gruppe geht in den Befund ein "
            + "— 4 Trades mit EW 99 sind Rauschen, kein Hebel",
            !/„C"/.test(beide), beide);

          // ── Der Text sagt, was er NICHT weiss ───────────────────────
          const tH = hebelText(dims, 60);
          torPruefung("der Text verschweigt, dass ein Unterschied keine "
            + "Zusage ist",
            /keine Zusage/.test(tH) && /MENGE der Trades/.test(tH), tH.slice(-300));
          torPruefung("der Text behauptet eine Confidence-Empfehlung — die "
            + "`Trade`-Tabelle hat gar keine Confidence-Spalte",
            /Nicht berechenbar/.test(tH) && /Confidence/.test(tH), tH.slice(-300));
          torPruefung("das Fenster steht nicht in der Antwort",
            /letzte <b>60<\/b> Tage/.test(tH), tH.slice(0, 200));
          torPruefung("ohne Fenster wird ein Fenster vorgetaeuscht",
            /Zeitraum: <b>alles<\/b>/.test(hebelText(dims, null)), "");
        }

        // ── UND DIE VERDRAHTUNG ────────────────────────────────────────
        const whH = read("frontend/app/api/telegram/webhook/route.ts");
        torPruefung("/hebel wird nicht behandelt",
          /textLower === "\/hebel"/.test(whH), "webhook");
        torPruefung("/hebel ruft hebelBericht\/hebelText nicht auf",
          /hebelBericht\(zeilen/.test(whH) && /hebelText\(/.test(whH), "webhook");
        // Dieselben vier Spalten wie /edge — sonst waeren die Ausschluesse
        // andere und die Zahlen koennten auseinanderlaufen.
        for (const spalte of ["profitLoss", "notes", "result", "updatedAt",
          "riskReward", "market", "direction", "strategy"]) {
          torPruefung(`/hebel liest die Spalte \`${spalte}\` nicht mit`,
            new RegExp(`${spalte}: true`).test(whH), spalte);
        }
        torPruefung("/hebel echot die Eingabe zurueck — ein Telegram-Verlauf "
          + "laesst sich nicht zurueckholen (29.09.)",
          !/\/hebel \$\{arg/.test(whH), "webhook");
        torPruefung("/hebel prueft das Argument nicht streng auf Ziffern "
          + "(`parseInt(\"1e\")` ergibt 1)",
          (whH.match(/\/\^\\d\+\$\/\.test\(arg\)/g) || []).length >= 2, "webhook");
      }

      // ── WARUM KEIN TRADE? (29.10.) ─────────────────────────────────────
      //
      // Vom 23. bis 29.10. wurde keine Position eroeffnet, und `/status`
      // antwortete durchgehend `System: ONLINE` — die Zeile misst nur den
      // Killswitch. Drei Ausgaenge des Zyklus beenden ihn mit EINER
      // Logzeile und OHNE Telegram-Meldung; sieben Tage Schweigen sehen bei
      // allen dreien gleich aus.
      //
      // `handelsLage()` wird deshalb GERECHNET, nicht gelesen: eine
      // Ternaer-Kette im Antworttext waere strukturell pruefbar, aber nicht
      // rechnerisch — genau daran scheiterte die Broker-Lage am 28.10.
      {
        const hl = ladeTsModul("lib/handels-lage/handels-lage.ts");
        const handelsLage = hl.exports?.handelsLage;
        if (hl.fehler || typeof handelsLage !== "function") {
          torPruefung("handelsLage() ist nicht ausfuehrbar", false,
            hl.fehler ?? "nicht exportiert");
        } else {
          const LEER = {
            brokerVerbunden: null, modus: null, offenePositionen: null,
            maxGleichzeitig: null, tagesZaehler: null, tagesLimit: null,
            tagesLimitAktiv: null, kontostand: null, hoechststand: null,
            maxDrawdownProzent: null, inHandelszeit: null, zyklenHeute: null,
            ausgaenge: null, trichter: null,
          };
          const mit = (o) => handelsLage({ ...LEER, ...o });
          const txt = (r) => r.zeilen.join("\n");

          // ALLES BEKANNT — sonst greift das „unbekannt"-Urteil VOR den
          // GO-Zweigen und der Fall ist gar nicht erreichbar. Genau so
          // sind die drei Tor-Pruefungen zuerst fehlgeschlagen.
          const BEKANNT = {
            brokerVerbunden: true, modus: "AUTO", offenePositionen: 0,
            maxGleichzeitig: 6, tagesZaehler: 0, tagesLimit: 21,
            tagesLimitAktiv: true, kontostand: 1870.57,
            hoechststand: 1990.36, maxDrawdownProzent: 10,
            inHandelszeit: true, zyklenHeute: 258, ausgaenge: { "x": 1 },
          };

          // 1. ALLES UNBEKANNT darf NICHTS behaupten — weder "blockiert"
          //    noch "in Ordnung". Das ist der haeufigste Fall, wenn es
          //    wirklich brennt.
          const nichts = mit({});
          torPruefung("bei lauter unbekannten Werten wird ein Blocker "
            + "behauptet — eine fehlende Angabe ist kein Befund",
            nichts.blocker.length === 0, JSON.stringify(nichts.blocker));
          torPruefung("bei lauter unbekannten Werten meldet nichts "
            + "\"unbekannt\" — dann sieht ein Totalausfall wie ein gesundes "
            + "System aus",
            nichts.unbekannt.length >= 6 && /unbekannt/i.test(txt(nichts)),
            JSON.stringify(nichts.unbekannt));
          torPruefung("bei unbekannten Werten wird trotzdem \"verbunden\" "
            + "oder \"AUTO\" behauptet",
            !/✅ Broker/.test(txt(nichts)) && !/✅ Modus/.test(txt(nichts)),
            txt(nichts).slice(0, 120));

          // 2. Die drei stillen Ausgaenge des Zyklus — je einzeln.
          const ohneBroker = mit({ brokerVerbunden: false });
          torPruefung("eine fehlende Broker-Sitzung wird nicht als Blocker "
            + "gemeldet — genau dieser Ausgang ist im Log stumm",
            ohneBroker.blocker.some((b) => /Broker-Sitzung/.test(b)),
            JSON.stringify(ohneBroker.blocker));
          const manuell = mit({ modus: "MANUAL" });
          torPruefung("Modus MANUAL wird nicht als Blocker gemeldet — "
            + "DEFAULT_SETTINGS steht auf MANUAL, ein DB-Ausfall genuegt",
            manuell.blocker.some((b) => /MANUAL/.test(b) && /AUTO/.test(b)),
            JSON.stringify(manuell.blocker));
          const voll = mit({ offenePositionen: 3, maxGleichzeitig: 3 });
          torPruefung("ein erreichtes Positions-Limit wird nicht gemeldet",
            voll.blocker.some((b) => /3 von 3/.test(b)),
            JSON.stringify(voll.blocker));
          const platz = mit({ offenePositionen: 1, maxGleichzeitig: 3 });
          torPruefung("1 von 3 Positionen gilt faelschlich als Limit",
            platz.blocker.length === 0, JSON.stringify(platz.blocker));

          // 3. Tageslimit — inklusive der Gegenprobe "Limit ausgeschaltet".
          const tagVoll = mit({ tagesZaehler: 5, tagesLimit: 5, tagesLimitAktiv: true });
          torPruefung("ein erreichtes Tageslimit wird nicht gemeldet",
            tagVoll.blocker.some((b) => /Tageslimit/.test(b)),
            JSON.stringify(tagVoll.blocker));
          const tagAus = mit({ tagesZaehler: 9, tagesLimit: 5, tagesLimitAktiv: false });
          torPruefung("ein AUSGESCHALTETES Tageslimit blockt angeblich",
            tagAus.blocker.length === 0, JSON.stringify(tagAus.blocker));

          // 4. Gesamt-Drawdown — die Sperre, die sich nicht selbst heilt.
          const ddRot = mit({ hoechststand: 2000, kontostand: 1700, maxDrawdownProzent: 10 });
          torPruefung("ein ueberschrittener Gesamt-Drawdown wird nicht "
            + "gemeldet — sein Telegram-Alarm feuert nur EINMAL je Hoechststand",
            ddRot.blocker.some((b) => /Drawdown/.test(b) && /15\.00/.test(b)),
            JSON.stringify(ddRot.blocker));
          torPruefung("der Ausweg /peakreset wird nicht genannt",
            /peakreset/.test(JSON.stringify(ddRot.blocker)),
            JSON.stringify(ddRot.blocker));
          const ddGruen = mit({ hoechststand: 2000, kontostand: 1900, maxDrawdownProzent: 10 });
          torPruefung("ein eingehaltener Drawdown blockt angeblich",
            ddGruen.blocker.length === 0, JSON.stringify(ddGruen.blocker));
          // Ein Hoechststand von 0 ist keine Messung, sondern unbekannt —
          // sonst waere jede Division eine erfundene Zahl.
          const ddNull = mit({ hoechststand: 0, kontostand: 500, maxDrawdownProzent: 10 });
          torPruefung("ein Hoechststand von 0 wird gerechnet statt als "
            + "unbekannt gemeldet",
            ddNull.blocker.length === 0 && ddNull.unbekannt.includes("Gesamt-Drawdown"),
            JSON.stringify(ddNull));
          const ddNaN = mit({ hoechststand: Number.NaN, kontostand: 500, maxDrawdownProzent: 10 });
          torPruefung("ein NaN-Hoechststand gilt als Zahl",
            ddNaN.unbekannt.includes("Gesamt-Drawdown"), JSON.stringify(ddNaN.unbekannt));

          // 5. Laufen ueberhaupt Zyklen?
          const keineZyklen = mit({ zyklenHeute: 0 });
          torPruefung("0 Zyklen heute wird nicht als Blocker gemeldet — "
            + "eine tote Schleife sieht sonst aus wie ein ruhiger Tag",
            keineZyklen.blocker.some((b) => /KEIN einziger Zyklus/.test(b)),
            JSON.stringify(keineZyklen.blocker));

          // 6. Die Ausgaenge, nach Haeufigkeit — die Zahl, die alles sagt.
          // ABSICHTLICH VERKEHRT EINGETRAGEN. Die erste Fassung listete den
          // haeufigsten Ausgang schon an erster Stelle — `Object.entries`
          // behaelt die Reihenfolge, also kam ohne Sortierung dasselbe
          // heraus und die Sabotage "Sortierung entfernt" blieb gruen.
          // Ein Testfall, der den Fehler nicht ausdruecken kann, beweist
          // nichts (30.09., und seitdem mehrfach).
          const mitAusgang = mit({
            zyklenHeute: 288,
            ausgaenge: { "Modus nicht AUTO": 88, "Capital nicht verbunden": 200, "Leer": 0 },
          });
          const tA = txt(mitAusgang);
          torPruefung("die Ausgaenge stehen nicht in der Antwort",
            /Capital nicht verbunden: 200/.test(tA), tA.slice(0, 160));
          torPruefung("die Ausgaenge sind nicht nach Haeufigkeit sortiert — "
            + "der haeufigste ist der gesuchte",
            tA.indexOf("Capital nicht verbunden") < tA.indexOf("Modus nicht AUTO"), "");
          torPruefung("ein Ausgang mit Anzahl 0 wird mitgezaehlt",
            !/Leer/.test(tA), tA.slice(0, 160));

          // 7. Der gesunde Fall — ohne ihn beweist nichts, dass der Riegel
          //    nicht einfach immer rot ist (Lehre vom 15.09.).
          const gesund = mit({
            brokerVerbunden: true, modus: "AUTO", offenePositionen: 1,
            maxGleichzeitig: 3, tagesZaehler: 0, tagesLimit: 5,
            tagesLimitAktiv: true, kontostand: 1950, hoechststand: 2000,
            maxDrawdownProzent: 10, inHandelszeit: true, zyklenHeute: 288,
            ausgaenge: { "Analyse ohne GO": 288 },
          });
          torPruefung("ein gesundes System meldet trotzdem einen Blocker",
            gesund.blocker.length === 0 && gesund.unbekannt.length === 0,
            JSON.stringify({ b: gesund.blocker, u: gesund.unbekannt }));
          // NUR DIE URTEILSZEILE. Die erste Fassung suchte im GANZEN Text —
          // ein ersetztes Urteil blieb damit gruen, solange die Woerter
          // irgendwo anders noch standen. "Ein Zeichen-Fenster beweist
          // Naehe, nicht Zugehoerigkeit" (22.09.), hier in der Spielart
          // "irgendwo in derselben Antwort".
          const urteil = gesund.zeilen[gesund.zeilen.length - 1] ?? "";
          torPruefung("das Urteil beim gesunden System verweist nicht auf "
            + "den Trichter — dort stirbt das Signal dann naemlich",
            /Trichter/.test(urteil) && /Tagesbilanz/.test(urteil), urteil);
          torPruefung("das Urteil behauptet \"alles in Ordnung\", statt zu "
            + "sagen, dass nur KEIN TOR blockt — das ist nicht dasselbe",
            /Kein Tor blockt/.test(urteil), urteil);
          // ── DER TRICHTER (29.10.) ──────────────────────────────────
          //
          // Das Urteil verwies auf die Zyklus-Tagesbilanz, statt zu
          // antworten — dabei liegen dieselben Zahlen in derselben
          // Tagessumme. "Jede Stufe braucht eine eigene Zahl" (22.09.),
          // hier eine Ebene weiter vorn: ein Verweis ist keine Zahl.
          const TRICHTER = {
            scans: 162, maerkte: 4860, richtungen: 36, vetos: 2,
            stilVerworfen: 1, ohneVolleDaten: 5,
            ohneVolleDatenGrund: { "Strategien": 5 },
            unterGrenze: 20, confMin: 65, confMax: 68, ohneGptAntwort: 5,
            rrAbgelehnt: 7, ohneStopZiel: 1, go: 0,
          };
          const tr = mit({ brokerVerbunden: true, modus: "AUTO",
            offenePositionen: 0, maxGleichzeitig: 6, tagesZaehler: 0,
            tagesLimit: 21, tagesLimitAktiv: true, kontostand: 1870.57,
            hoechststand: 1990.36, maxDrawdownProzent: 10,
            inHandelszeit: true, zyklenHeute: 258, ausgaenge: { "x": 1 },
            trichter: TRICHTER });
          const tTr = txt(tr);
          torPruefung("der Trichter fehlt in der Antwort — das Urteil "
            + "verwiese dann wieder auf eine andere Nachricht",
            /Trichter heute/.test(tTr), tTr.slice(-200));
          for (const [name, zahlText] of [["Richtungssignale", "36"],
            ["KI-Veto", "2"], ["unter der Confidence-Grenze", "20"],
            ["an der Risiko-Freigabe gescheitert", "7"],
            ["ohne Stop/Ziel von GPT", "1"], ["GO", "0"]]) {
            // OHNE REGEX. Die Stufennamen enthalten `/` und `(`; ein
            // Escapen im Ersetzungstext hat diese Stelle schon einmal
            // zerlegt, weil `$&` in `String.replace` fuer den gefundenen
            // Text steht. Eine Zeilensuche braucht das alles nicht.
            const zeile = tTr.split("\n").find((l) => l.includes(name)) ?? "";
            torPruefung(`die Trichter-Stufe "${name}" fehlt oder traegt `
              + "nicht ihre eigene Zahl",
              zeile !== "" && zeile.includes(zahlText), `${name} -> ${zeile}`);
          }
          // ── „WAIT" IST NICHT „KEINE ANTWORT" (30.10.) ──────────────
          //
          // Am 30.10. standen 0 Richtungen aus 3210 Analysen in der
          // Bilanz. Ob GPT ablehnte oder gar nicht antwortete, war daraus
          // NICHT zu beantworten — beides wurde als WAIT gezaehlt.
          torPruefung("die Zahl der Maerkte OHNE GPT-Antwort fehlt — dann "
            + "ist ein Ausfall von einem Urteil nicht zu unterscheiden",
            /ohne GPT-Antwort: 5/.test(tTr), tTr.slice(0, 300));
          torPruefung("bei 0 ohne Antwort wird trotzdem der Zusatz "
            + "\"kein Urteil\" behauptet",
            !/ohne GPT-Antwort: 0 \(als WAIT/.test(
              txt(mit({ ...BEKANNT, trichter: { ...TRICHTER, ohneGptAntwort: 0 } }))),
            "0-Fall");
          torPruefung("eine unbekannte Zahl ohne GPT-Antwort wird zu 0 — "
            + "aus \"nicht gemessen\" wird damit eine Messung",
            /ohne GPT-Antwort: unbekannt/.test(
              txt(mit({ ...BEKANNT, trichter: { ...TRICHTER, ohneGptAntwort: null } }))),
            "null-Fall");
          torPruefung("der GRUND des Datenausfalls fehlt — die Zahl allein "
            + "sagt nicht, WELCHER Dienst weg war (22.09.)",
            /Strategien 5/.test(tTr), tTr.slice(0, 200));
          torPruefung("die Confidence-Spanne fehlt",
            /\(65–68\)/.test(tTr), tTr.slice(0, 200));
          // DAS URTEIL muss die groesste Stufe NENNEN, nicht verweisen.
          const urteilTr = tr.zeilen[tr.zeilen.length - 1] ?? "";
          torPruefung("das Urteil nennt die groesste Trichter-Stufe nicht — "
            + "ein Verweis auf eine andere Nachricht ist keine Antwort",
            /Grösste Stufe/.test(urteilTr)
            && /unter der Confidence-Grenze/.test(urteilTr), urteilTr);
          // Gegenprobe: mit GO > 0 liegt es NICHT an der Signalkette.
          const trGo = mit({ brokerVerbunden: true, modus: "AUTO",
            offenePositionen: 0, maxGleichzeitig: 6, tagesZaehler: 0,
            tagesLimit: 21, tagesLimitAktiv: true, kontostand: 1870.57,
            hoechststand: 1990.36, maxDrawdownProzent: 10,
            inHandelszeit: true, zyklenHeute: 258, ausgaenge: { "x": 1 },
            trichter: { ...TRICHTER, go: 3 } });
          const urteilGo = trGo.zeilen[trGo.zeilen.length - 1] ?? "";
          torPruefung("bei GO > 0 behauptet das Urteil weiter, das Signal "
            + "sterbe im Trichter — dann liegt es an der Ausfuehrung",
            /Ausführung/.test(urteilGo) && !/Grösste Stufe/.test(urteilGo),
            urteilGo);
          // Eine unbekannte Stufe wird NICHT zu 0.
          const trLuecke = mit({ trichter: { ...TRICHTER, rrAbgelehnt: null } });
          torPruefung("eine unbekannte Trichter-Stufe wird als 0 gezeigt — "
            + "aus \"nicht gemessen\" wird damit eine Messung",
            /an der Risiko-Freigabe gescheitert: unbekannt/.test(txt(trLuecke)),
            txt(trLuecke).slice(0, 240));
          // Ohne Analyse gibt es keinen Trichter — und das wird gesagt.
          const trOhne = mit({ trichter: { ...TRICHTER, scans: 0 } });
          torPruefung("bei 0 Analysen wird ein Trichter vorgetaeuscht",
            /kein einziger Zyklus kam bis zur Analyse/.test(txt(trOhne)),
            txt(trOhne).slice(0, 200));


          // ── DIE TORE NACH DEM GO (30.10.) ──────────────────────────
          //
          // Im Live-Lauf standen `GO: 2` und als Ausgang „Keine Kandidaten
          // nach Filter: 2" — und das Urteil sagte „liegt es an der
          // Ausfuehrung". Die Filterkette des Orchestrators ist NICHT die
          // Ausfuehrung. Welches Tor es war, liegt als `tore` in derselben
          // Tagessumme.
          const MIT_TOR = {
            ...TRICHTER, go: 2,
            tore: {
              "Schwelle": { ja: 0, nein: 2, fallback: 0,
                gruende: { "Confidence 66 < Schwelle 70": 2 } },
              "Meta-KI": { ja: 2, nein: 0, fallback: 0, gruende: {} },
            },
          };
          const trTor = mit({ ...BEKANNT, trichter: MIT_TOR });
          const tTor = txt(trTor);
          torPruefung("die Tore nach dem GO fehlen in der Antwort — dann "
            + "steht dort GO 2 und kein Trade, ohne jede Erklaerung",
            /Tore nach dem GO/.test(tTor), tTor.slice(-300));
          torPruefung("ein Tor nennt seine ja\/nein-Zahlen nicht",
            /Schwelle: ja 0 · nein 2/.test(tTor), tTor.slice(-300));
          torPruefung("der GRUND des Tores fehlt — die Zahl allein sagt "
            + "nicht, WARUM es zu war",
            /Confidence 66 < Schwelle 70 \(2\)/.test(tTor), tTor.slice(-300));
          torPruefung("die Tor-Testdaten lassen Angaben offen — dann greift "
            + "das unbekannt-Urteil VOR den GO-Zweigen und der Fall ist gar "
            + "nicht erreichbar",
            trTor.unbekannt.length === 0, JSON.stringify(trTor.unbekannt));
          const urteilTor = trTor.zeilen[trTor.zeilen.length - 1] ?? "";
          torPruefung("das Urteil zeigt bei abgelehnten Toren weiter auf "
            + "die AUSFUEHRUNG — genau der Fehler vom 30.10.",
            /Toren DANACH/.test(urteilTor) && !/liegt es an der Ausführung/.test(urteilTor),
            urteilTor);
          torPruefung("das Urteil nennt das groesste ablehnende Tor nicht",
            /Schwelle/.test(urteilTor) && /2/.test(urteilTor), urteilTor);
          // GEGENPROBE: hat KEIN Tor abgelehnt, ist die Ausfuehrung dran.
          const trTorJa = mit({ ...BEKANNT, trichter: { ...TRICHTER, go: 2,
            tore: { "Meta-KI": { ja: 2, nein: 0, fallback: 0, gruende: {} } } } });
          const urteilJa = trTorJa.zeilen[trTorJa.zeilen.length - 1] ?? "";
          torPruefung("ohne ablehnendes Tor wird trotzdem ein Tor "
            + "beschuldigt — dann zeigt das Urteil immer woandershin",
            /Ausführung/.test(urteilJa) && !/Toren DANACH/.test(urteilJa),
            urteilJa);
        }

        // ── UND DIE VERDRAHTUNG (Klasse 30.09.) ─────────────────────────
        //
        // Eine gerechnete Funktion beweist nichts ueber ihre Aufrufstelle.
        // Jeder Feldname wird hier an der QUELLE geholt, nicht aus dem
        // Gedaechtnis: aus `DEFAULT_SETTINGS` per Klammerzaehler und aus den
        // Exporten der jeweiligen Module.
        const wPfad = "frontend/app/api/telegram/webhook/route.ts";
        const W = read(wPfad);
        torPruefung("/status ruft handelsLage() nicht auf",
          /lageZeilen = handelsLage\(\{/.test(W), wPfad);
        torPruefung("der Block steht nicht in der Antwort von /status",
          /Warum kein Trade\?/.test(W) && /\$\{lageZeilen\.join/.test(W), wPfad);
        {
          const st = read("frontend/lib/settings/settings-store.ts");
          let bot = "", risk = "";
          try { bot = objectBlock(st, "botSettings:"); } catch { bot = ""; }
          try { risk = objectBlock(st, "riskSettings:"); } catch { risk = ""; }
          torPruefung("die Einstellungs-Bloecke sind nicht auffindbar — "
            + "ohne sie beweist jede Feldnamen-Pruefung darunter nichts",
            bot.length > 50 && risk.length > 20, `bot=${bot.length} risk=${risk.length}`);
          for (const feld of ["mode", "maxConcurrentPositions", "maxTradesPerDay",
            "tradeLimitEnabled"]) {
            torPruefung(`\`${feld}\` steht nicht in botSettings — /status liest `
              + "dann einen Namen, den es nicht gibt (Fehler vom 30.09.)",
              new RegExp(`\\b${feld}\\s*:`).test(bot)
              && new RegExp(`botSettings\\?\\.${feld}\\b`).test(W), feld);
          }
          torPruefung("`maxTotalDrawdownPct` steht nicht in riskSettings",
            /\bmaxTotalDrawdownPct\s*:/.test(risk)
            && /riskSettings\?\.maxTotalDrawdownPct\b/.test(W), "riskSettings");
        }
        // Die Schluessel kommen aus ihren Modulen, nicht als Zeichenkette.
        torPruefung("der Hoechststand wird nicht ueber PEAK_SCHLUESSEL gelesen",
          /PEAK_SCHLUESSEL/.test(W) && !/"peak_balance"/.test(W), wPfad);
        torPruefung("die Tagessumme wird nicht ueber TAGESSUMME_SCHLUESSEL "
          + "und handelstag() gelesen",
          /TAGESSUMME_SCHLUESSEL\(handelstag\(\)\)/.test(W), wPfad);
        // EIN LESEPFAD SCHREIBT GEMEINSAMEN ZUSTAND NICHT (07.09.).
        torPruefung("/status LEGT `__daily_trades__` an oder schreibt hinein "
          + "— genau so verlor der Orchestrator am 07.09. sein Tageslimit",
          !/global\.__daily_trades__\s*=/.test(W)
          && !/global\.__daily_trades__\s*\?\?=/.test(W), wPfad);
        torPruefung("bei fremdem Datum wird NICHT dieselbe Quelle gelesen "
          + "wie der Besitzer (Redis daily_trades:<Datum>)",
          /daily_trades:\$\{heuteKey\}/.test(W), wPfad);
        // Der Befehl wird gelesen, WENN etwas kaputt ist — er darf an
        // keiner Quelle haengenbleiben.
        // AN DIE ZUWEISUNG GEBUNDEN, nicht an die Datei. Die erste Fassung
        // suchte `await Promise.all([` irgendwo — und fand ein zweites,
        // unbeteiligtes Vorkommen in einem anderen Befehl. Die Sabotage an
        // der Faktensammlung blieb damit gruen: "ein Treffer beweist nichts
        // ueber die andere Stelle" (25.10.).
        // ── GEZAEHLT WIRD, WO ENTSCHIEDEN WIRD (30.10.) ────────────────
        //
        // Der Zaehler `ohneGptAntwortZahl` muss in GENAU dem Zweig stehen,
        // der die Entscheidung trifft. Steht er woanders, koennen Zahl und
        // Verhalten auseinanderlaufen — die Regel vom 22.09., dort fuer die
        // Logzeile, hier fuer die Bilanz.
        {
          const ai = read("frontend/lib/market-scanner/ai-analysis-engine.ts");
          const marke = "} else if (hasGPT) {";
          const p = ai.indexOf(marke);
          torPruefung("der Zweig `else if (hasGPT)` ist nicht auffindbar — "
            + "ohne ihn beweist die Pruefung darunter nichts",
            p >= 0, `indexOf = ${p}`);
          // Den Zweig per Klammerzaehler ausschneiden: ein Zeichen-Fenster
          // bewiese nur Naehe, nicht Zugehoerigkeit (22.09.).
          let zweig = "";
          if (p >= 0) {
            let tiefe = 0;
            for (let i = ai.indexOf("{", p); i < ai.length; i++) {
              if (ai[i] === "{") tiefe++;
              else if (ai[i] === "}") { tiefe--; if (tiefe === 0) { zweig = ai.slice(p, i + 1); break; } }
            }
          }
          torPruefung("der Zaehler steht NICHT im Zweig, der entscheidet — "
            + "Zahl und Verhalten koennen dann auseinanderlaufen",
            zweig.includes("ohneGptAntwortZahl++")
            && zweig.includes("noSignal(market)"), `${zweig.length} Zeichen`);
          // Und die Gegenprobe: der Zaehler darf NICHT auch im Zweig stehen,
          // der eine ECHTE Antwort verarbeitet — sonst zaehlt er Urteile mit.
          const echt = ai.indexOf("if (hasGPT && gptData?.direction) {");
          const echterZweig = echt >= 0 && p > echt ? ai.slice(echt, p) : "";
          torPruefung("der Zaehler laeuft auch im Zweig mit ECHTER Antwort "
            + "— dann zaehlt er Urteile als Ausfall",
            echterZweig.length > 100 && !echterZweig.includes("ohneGptAntwortZahl++"),
            `${echterZweig.length} Zeichen`);
          torPruefung("die ScanDaten tragen `ohneGptAntwort` nicht",
            /ohneGptAntwort: ohneGptAntwortZahl,/.test(ai), "ScanDaten");
          // Die Tagesbilanz muss die Zahl auch NENNEN.
          const zb = read("frontend/lib/zyklus-bilanz/zyklus-bilanz.ts");
          torPruefung("die ZYKLUS-Zeile nennt die Zahl ohne GPT-Antwort "
            + "nicht — dort bleibt \"30W\" sonst mehrdeutig",
            /ohne GPT-Antwort \$\{s\.ohneGptAntwort\}/.test(zb), "bilanzZeile");
          torPruefung("die Tagesbilanz nennt die Zahl ohne GPT-Antwort nicht",
            /davon OHNE GPT-Antwort/.test(zb), "zyklus-bilanz");
          torPruefung("die Tagessumme addiert `ohneGptAntwort` nicht mit "
            + "`zahl()` auf BEIDEN Seiten — eine Summe von gestern hat das "
            + "Feld noch nicht",
            /t\.ohneGptAntwort = zahl\(t\.ohneGptAntwort\) \+ zahl\(s\.ohneGptAntwort\);/.test(zb),
            "tagessummeAddieren");
        }

        // DIE TRICHTER-FELDER HEISSEN WIE IN `Tagessumme` — an der QUELLE
        // geholt, nicht aus dem Gedaechtnis (Fehler vom 30.09.).
        {
          const zb = read("frontend/lib/zyklus-bilanz/zyklus-bilanz.ts");
          let typ = "";
          try { typ = objectBlock(zb, "export type Tagessumme ="); } catch { typ = ""; }
          torPruefung("der Typ `Tagessumme` ist nicht auffindbar — ohne ihn "
            + "beweist jede Feldnamen-Pruefung darunter nichts",
            typ.length > 100, `${typ.length} Zeichen`);
          for (const feld of ["scans", "maerkte", "gpt", "vetos", "stilVerworfen",
            "ohneVolleDaten", "ohneVolleDatenGrund", "unterGrenze", "confMin",
            "confMax", "rrAbgelehnt", "ohneStopZiel", "go", "tore",
            "ohneGptAntwort"]) {
            torPruefung(`\`${feld}\` steht nicht in \`Tagessumme\` — /status `
              + "liest dann einen Namen, den es nicht gibt",
              new RegExp(`\\b${feld}\\s*:`).test(typ)
              && new RegExp(`tagessumme\\.${feld}\\b`).test(W), feld);
          }
          // BUY UND SELL. Nur BUY zu zaehlen haette die Richtungssignale
          // halbiert — und die groesste Trichter-Stufe damit verschoben.
          torPruefung("die Richtungssignale zaehlen nicht BUY UND SELL",
            W.includes("tagessumme.gpt.BUY + tagessumme.gpt.SELL"), wPfad);
          torPruefung("der Trichter wird gar nicht uebergeben",
            /trichter: tagessumme/.test(W), wPfad);
        }
        torPruefung("die Faktensammlung laeuft NACHEINANDER — sieben "
          + "Quellen mal fuenf Sekunden waeren 35 s bis zur Antwort",
          /\[einst, sitzung, offeneZahl, hoechst, tagessumme, inZeit, tagesZaehler\]\s*=\s*await Promise\.all\(\[/.test(W), wPfad);
        torPruefung("die Faktensammlung hat keine Zeitgrenze — /status "
          + "haengt dann an einem toten Broker",
          /setTimeout\(\(\) => r\(null\), \d+\)/.test(W), wPfad);
        torPruefung("die ONLINE-Zeile sagt nicht mehr, dass sie NUR den "
          + "Killswitch misst",
          /nur der Killswitch/.test(W), wPfad);
      }

      // ── UND DAS VERHALTEN, NICHT DER WORTLAUT ──────────────────────────
      //
      // Die Pruefungen oben fangen `if (riegel) {` → `if (false) {` NICHT:
      // der Riegel wird dann gerechnet und das Ergebnis WEGGEWORFEN, der
      // Wortlaut steht weiter da. Genau die Fehlerklasse vom 30.09.
      // ("ein Regex prueft den Wortlaut, nicht das Verhalten").
      //
      // Deshalb laeuft hier die ECHTE Funktion gegen einen gezaehlten
      // `capitalPlaceOrder`. Ohne Stop darf er NULL mal gerufen werden.
      {
        let platziert = 0;
        const ex2 = klient.fehler ? klient
          : ladeTsModul("lib/capital-com/capital-com-execution.ts", {
            "killswitch": { isKillswitchActive: () => false },
            "capital-com-session": {
              getCapitalSession: () => ({ apiKey: "k", cst: "c", securityToken: "s" }),
            },
            "capital-com-client": {
              ...klient.exports,
              capitalPlaceOrder: async () => { platziert++; return { ok: true, dealId: "D1" }; },
            },
          });
        const f = ex2.exports?.executeCapitalDemoOrder;
        if (ex2.fehler || typeof f !== "function") {
          torPruefung("executeCapitalDemoOrder ist nicht ausfuehrbar", false,
            ex2.fehler ?? "nicht exportiert");
        } else {
          const basis = { symbol: "EURUSD", direction: "BUY", riskPercent: 1,
            accountBalance: 2000, currentPrice: 1.0850, tradingStyle: "DAYTRADING" };

          platziert = 0;
          const ohneStop = await f({ ...basis, takeProfitPrice: 1.0950 });
          torPruefung("eine Order OHNE Stop wird trotzdem platziert",
            platziert === 0 && ohneStop?.ok === false
            && /STOP_FEHLT/.test(String(ohneStop?.error)),
            `platziert=${platziert} ok=${ohneStop?.ok} error=${ohneStop?.error}`);

          platziert = 0;
          const ohneZiel = await f({ ...basis, stopLossPrice: 1.0800 });
          torPruefung("eine Order OHNE Ziel wird trotzdem platziert",
            platziert === 0 && ohneZiel?.ok === false,
            `platziert=${platziert} error=${ohneZiel?.error}`);

          // GEGENPROBE: mit Stop UND Ziel muss die Order durchgehen — sonst
          // waere der Riegel zu streng und wuerde den echten Handel blocken.
          platziert = 0;
          const vollstaendig = await f({ ...basis, stopLossPrice: 1.0800, takeProfitPrice: 1.0950 });
          torPruefung("eine vollstaendige Order wird vom Riegel geblockt — "
            + "der echte Handel stuende still",
            platziert === 1 && vollstaendig?.ok === true,
            `platziert=${platziert} ok=${vollstaendig?.ok} error=${vollstaendig?.error}`);
        }
      }
    }
    // Und der stillgelegte Pfad bleibt still — doppelt gesichert, weil genau
    // er der Anlass war.
    torPruefung("der stillgelegte /api/auto-execute platziert wieder Orders",
      !platzierer.includes("/api/auto-execute"),
      "er hatte weder Killswitch noch Filterkette");
  }

  // ══ KEINE ERFUNDENE CONFIDENCE IM DASHBOARD (15.09.) ═════════════════════
  //
  // DER FUND. Zwei Anzeige-Manager gaben eine Confidence BEDINGUNGSLOS
  // zurueck: `claude-risk-manager.ts` immer 85, `gpt-analyst-manager.ts`
  // immer 80. Beide Routen werden vom Dashboard gelesen, dort zu einem
  // "Average score" verrechnet und mit Auto-Refresh alle 20 Sekunden
  // angezeigt — ein konstanter Wert sah aus wie eine laufende Messung.
  //
  // NACHGERECHNET, und es war schlimmer als konstant:
  //   CLAUDE_REAL      -> der Prompt verlangt GAR KEINE confidence
  //                       -> `0 + undefined` = NaN -> die Kachel zeigte "NaN%"
  //   CLAUDE_RISK_LIVE -> Rueckfall, bedingungslos 85 -> "85%"
  //
  // DER UNTERSCHIED ZWISCHEN DEN BEIDEN ENGINES IST WESENTLICH und wird hier
  // festgehalten, damit ihn niemand einebnet:
  //   - claude-risk: der Prompt verlangt KEINE Confidence -> das Feld ist
  //     ganz entfallen, die Kachel zeigt stattdessen "Freigegeben x/y".
  //   - gpt-analyst: der Prompt verlangt `"confidence": 60-95` -> das Feld
  //     BLEIBT (echte Modellantwort), nur der Rueckfall erfindet es nicht
  //     mehr. Fehlt es, steht "—".
  //
  // Beide Manager sind NICHT im Handelspfad — `--impact` zeigt sie nur an
  // ihren eigenen Routen. Es ging um die Anzeige, nicht um Geld.
  {
    const ohneK2 = (p) => read(p)
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    const crm = ohneK2("frontend/lib/claude-risk-engine/claude-risk-manager.ts");
    const gam = ohneK2("frontend/lib/gpt-analyst-engine/gpt-analyst-manager.ts");
    torPruefung("claude-risk-manager erfindet wieder eine Confidence",
      !/confidence\s*:\s*[0-9]/.test(crm),
      "der Prompt der Route verlangt gar keine — sie waere frei erfunden");
    torPruefung("gpt-analyst-manager erfindet wieder eine Confidence",
      !/confidence\s*:\s*[0-9]/.test(gam),
      "der Rueckfall darf die echte Modellzahl nicht nachahmen");

    // Der ECHTE GPT-Pfad muss seine Confidence behalten — sonst waere aus dem
    // Fix ein Datenverlust geworden.
    const gptRoute = read("frontend/app/api/gpt-analyst/analyze/route.ts");
    torPruefung("der GPT-Prompt verlangt keine Confidence mehr",
      /"confidence":\s*60-95/.test(gptRoute),
      "die echte Modellzahl darf nicht mit dem Rueckfall mitentfernt werden");

    // Und die Anzeige darf NICHT mehr blind ueber alle Eintraege mitteln —
    // genau das ergab NaN, sobald ein Eintrag das Feld nicht hatte.
    const seite = ohneK2("frontend/app/page.tsx");
    torPruefung("die Confidence wird wieder blind ueber alle Eintraege gemittelt",
      /mitConfidence\.reduce\(/.test(seite)
      && !/analyses\.reduce\(\(sum, item\) => sum \+ item\.confidence/.test(seite),
      "`0 + undefined` ergibt NaN — die Kachel zeigte dann 'NaN%'");
    // UND die Wache muss ueber DERSELBEN Liste laufen wie die Summe.
    //
    // Im Sabotage-Lauf vom 15.09. liess sich `mitConfidence.length > 0` durch
    // `analyses.length > 0` ersetzen, ohne dass etwas rot wurde — die Summe
    // lief weiter ueber `mitConfidence`. Genau diese Mischung bringt NaN
    // zurueck: gibt es Analysen, aber keine davon mit Confidence, rechnet
    // `0 / 0`. Eine Pruefung, die nur die Summe ansieht, sieht das nicht.
    torPruefung("die Wache der Confidence-Mittelung laeuft ueber eine ANDERE Liste als die Summe",
      /mitConfidence\.length > 0/.test(seite),
      "`0 / 0` ergibt NaN — Wache und Summe muessen dieselbe Liste benutzen");
    torPruefung("eine fehlende Confidence wird wieder als Zahl dargestellt",
      /typeof item\.confidence === "number" \? `\$\{item\.confidence\}%` : "—"/.test(seite),
      "fehlt sie, gehoert dort '—' hin");
    torPruefung("der Claude-Risk-Bereich zeigt wieder eine Confidence",
      !/risks\.reduce\(\(sum, item\) => sum \+ item\.confidence/.test(seite),
      "dort gibt es keine — die Kachel zeigt jetzt 'Freigegeben'");
  }

  // ══ QUARANTÄNE: erfundene Zahlen erreichen den Handelspfad nicht (15.09.) ══
  //
  // DER BEFUND. `broker-execution-quality-learning` gibt feste Latenzen aus:
  // 28, 34, 58, 74, 62 ms. Hier wird keine Latenz gemessen — die Zahlen sind
  // erfunden. Bisher galt das als "toter Ballast, 0 UI-Aufrufer". Beim
  // Nachmessen am 15.09. stimmte das so nicht: es ist eine KETTE aus fuenf
  // Motoren, und sie endet in Broker-GEWICHTEN.
  //
  //   broker-execution-quality-learning   (erfundene Latenz/Spread/Slippage)
  //     -> adaptive-broker-weighting      (macht daraus Gewichte 0..100)
  //       -> autonomous-broker-optimization
  //         -> broker-reputation-memory
  //           -> broker-evolution-intelligence
  //
  // Gemessen ueber die System-Karte: 14 Aufrufer, alle innerhalb derselben
  // Familie plus vier API-Routen, die niemand ruft. Der Handelspfad wird NICHT
  // erreicht — heute.
  //
  // WARUM DAS TROTZDEM EIN RIEGEL BRAUCHT. Genau diese Fehlerklasse hat hier
  // schon dreimal zugeschlagen: `?? 50` im Risiko-Tor, `confidence: 85` im
  // Dashboard, die festen Zeilen in `market-health.ts`. Jedes Mal gab sich
  // etwas Erfundenes als Messung aus. Wuerde jemand `adaptive-broker-weighting`
  // an die Broker-Auswahl haengen — der Name legt es nahe, und die Funktion
  // sieht fertig aus — entschiede eine erfundene Latenz mit, ueber welchen
  // Broker echtes Geld laeuft. Niemand wuerde es bemerken.
  //
  // Diese Pruefung ist das Gegenstueck zur Order-Positivliste oben: dort wird
  // festgehalten, wer Orders platzieren DARF, hier, wen der Handelspfad NICHT
  // anfassen darf. Loeschen waere die Alternative — das ist eine Entscheidung
  // des Nutzers. Bis dahin ist die Grenze wenigstens bewacht statt bloss
  // behauptet.
  {
    // Module, die Zahlen ERFINDEN statt zu messen. Nachgeprueft, nicht geraten:
    // jedes hat feste Zahlenprofile im Quelltext und keine Datenquelle.
    const QUARANTAENE = [
      "lib/broker-execution-quality-learning",
      "lib/adaptive-broker-weighting",
      "lib/autonomous-broker-optimization",
      "lib/broker-reputation-memory",
      "lib/broker-evolution-intelligence",
      "lib/broker-performance-memory",
      "lib/dynamic-position-allocation",
    ];
    // Der Handelspfad, von dem aus gesucht wird. Das sind genau die Dateien
    // mit erhoehtem Risiko aus CLAUDE.md plus der Einstiegspunkt.
    const HANDELSPFAD = [
      "instrumentation.ts",
      "lib/agents/orchestrator-agent.ts",
      "lib/agents/execution-agent.ts",
      "lib/agents/risk-agent.ts",
      "lib/trading-filters/trade-filters.ts",
      "lib/capital-com/capital-com-execution.ts",
      "lib/market-scanner/ai-analysis-engine.ts",
    ];

    const wurzel = path.join(__dirname, "../../frontend");
    const liesCode = (rel) => {
      for (const endung of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const p = path.join(wurzel, rel + endung);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          return { pfad: (rel + endung).replace(/\\/g, "/"), code: fs.readFileSync(p, "utf8") };
        }
      }
      return null;
    };

    // Statisch UND dynamisch (`await import(...)`) — von letzteren gibt es in
    // diesem Programm ueber neunzig, und genau sie waeren der bequeme Weg,
    // eine Simulation nachtraeglich anzuhaengen.
    const importe = (code, vonDatei) => {
      const ohne = code
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      const angaben = [];
      const muster = /(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g;
      let m;
      while ((m = muster.exec(ohne)) !== null) angaben.push(m[1]);
      const basis = path.posix.dirname(vonDatei);
      return angaben
        .map((a) => {
          if (a.startsWith("@/")) return a.slice(2);
          if (a.startsWith(".")) return path.posix.normalize(path.posix.join(basis, a));
          return null;                       // Pakete interessieren hier nicht
        })
        .filter(Boolean);
    };

    // Breitensuche ueber den Handelspfad. Tiefe begrenzt, damit ein Zyklus
    // den Pruefer nicht haengen laesst — `gesehen` verhindert das ohnehin.
    const gesehen = new Set();
    const warteschlange = [...HANDELSPFAD];
    const verstoesse = [];
    while (warteschlange.length > 0) {
      const rel = warteschlange.shift();
      if (gesehen.has(rel)) continue;
      gesehen.add(rel);
      const datei = liesCode(rel);
      if (!datei) continue;
      for (const ziel of importe(datei.code, datei.pfad)) {
        const verboten = QUARANTAENE.find((q) => ziel === q || ziel.startsWith(q + "/"));
        if (verboten) {
          // Nur der ERSTE Uebertritt wird gemeldet, und danach NICHT
          // weitergelaufen. Sonst meldet der Pruefer auch noch jede interne
          // Kante der Quarantaene-Familie: beim Sabotage-Lauf waren das ueber
          // 5000 Zeichen fuer einen einzigen Import. Ein Befund, den niemand
          // liest, wird ignoriert — und dann nuetzt der Riegel nichts.
          verstoesse.push(`${datei.pfad} → ${ziel}`);
          continue;
        }
        if (!gesehen.has(ziel)) warteschlange.push(ziel);
      }
    }

    const einmalig = [...new Set(verstoesse)];
    torPruefung("der Handelspfad erreicht ein Modul mit ERFUNDENEN Zahlen",
      einmalig.length === 0,
      einmalig.slice(0, 5).join(" ; ") + (einmalig.length > 5 ? ` … (+${einmalig.length - 5})` : ""));

    // Und die Suche muss wirklich gelaufen sein. Ohne diesen Nachweis waere
    // die Pruefung oben auch dann gruen, wenn kein einziger Pfad aufloesbar
    // war — ein Pruefer, der nichts findet, weil er nichts angesehen hat, ist
    // die gefaehrlichste Sorte.
    //
    // BENANNTE Dateien statt einer Zahl. Beim Bau stand hier zuerst
    // `gesehen.size >= 100`; gemessen wurden 65, und die Pruefung wurde rot,
    // ohne dass etwas kaputt war. Eine geratene Zahl haette ich dann einfach
    // angepasst — und damit nie erfahren, ob der Lauf die richtigen Dateien
    // trifft. Diese Liste kann man nicht stillschweigend passend machen:
    // fehlt eine, ist die Verdrahtung wirklich unterbrochen.
    const norm = (s) => s.replace(/(\/index)?\.(ts|tsx)$/, "");
    const erreicht = new Set([...gesehen].map(norm));
    const MUSS_ERREICHT = [
      "lib/killswitch",
      "lib/capital-com/capital-com-client",
      "lib/capital-com/capital-com-execution",
      "lib/settings/settings-store",
      "lib/agents/execution-agent",
      "lib/agents/analysis-agent",
      "lib/trading-filters/trade-filters",
      "lib/agents/risk-agent",
      "lib/market-scanner/ai-analysis-engine",
      "lib/telegram-notifications/telegram-sender",
      "lib/risk-scope/risk-scope",
    ];
    const nichtErreicht = MUSS_ERREICHT.filter((m) => !erreicht.has(m));
    torPruefung("die Quarantaene-Suche erreicht den echten Handelspfad nicht — "
      + "dann sagt ihr gruenes Ergebnis nichts aus",
      nichtErreicht.length === 0,
      `nicht erreicht: ${nichtErreicht.join(", ")} (${gesehen.size} Dateien besucht)`);

    // Die Module muessen auch noch existieren — sonst prueft die Liste ins
    // Leere, und nach einem spaeteren Loeschen bliebe ein toter Riegel stehen,
    // der Sicherheit vortaeuscht.
    const fehlende = QUARANTAENE.filter((q) => !fs.existsSync(path.join(wurzel, q)));
    torPruefung("die Quarantaene-Liste nennt Module, die es nicht mehr gibt — "
      + "entweder Liste kuerzen oder Loeschung rueckgaengig",
      fehlende.length === 0, fehlende.join(", "));
  }

  // ══ DIE ÜBERANPASSUNGS-SPERRE MUSS IN BEIDE RICHTUNGEN EHRLICH SEIN ══════
  //
  // `blockOverfitMarkets` steht auf AUS. Der Snapshot sichert genau das — den
  // STANDARDWERT. Dass der Schalter etwas TUT, wenn man ihn einschaltet, und
  // vor allem: dass er NICHTS tut, solange er aus ist, prueft bisher niemand.
  //
  // Beide Richtungen sind gefaehrlich, und die zweite mehr:
  //
  //   AN, aber wirkungslos  -> der Nutzer glaubt sich geschuetzt und ist es
  //                            nicht. Die Klasse "ein Regler darf nicht
  //                            luegen" (13.08., 08.09., 09.09. -- dreimal).
  //   AUS, aber wirksam     -> Maerkte werden gesperrt, die niemand gesperrt
  //                            hat. Seit dem 30.06. ist die Trade-Zahl das
  //                            Problem dieses Programms; ein still gesetzter
  //                            Ausschluss waere genau die falsche Richtung und
  //                            im Log von "kein Signal" nicht zu unterscheiden.
  //
  // Das `if (sperren)` ist die einzige Zeile zwischen beiden Zustaenden.
  {
    const orch = read("frontend/lib/agents/orchestrator-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

    // STRIKT `=== true`. Ein `?? false` oder eine truthy-Pruefung wuerde einen
    // gespeicherten String "false" als EIN lesen — dieselbe Falle wie bei den
    // Einstellungen, die aus der Datenbank kommen.
    torPruefung("die Ueberanpassungs-Sperre prueft nicht strikt auf true",
      /blockOverfitMarkets\s*===\s*true/.test(orch),
      "alles andere liest einen gespeicherten String als EIN");

    // Die Liste darf NUR gefuellt werden, wenn der Schalter an ist.
    torPruefung("die Sperrliste wird unabhaengig vom Schalter gefuellt — "
      + "dann sperrt sie IMMER, auch wenn der Nutzer sie aus hat",
      /if\s*\(\s*sperren\s*\)\s*ueberangepasst\s*=/.test(orch),
      "das `if (sperren)` ist die einzige Zeile zwischen AN und AUS");

    // Und umgekehrt: sie muss auch wirklich angewandt werden, sonst ist der
    // Schalter im AN-Zustand eine Attrappe.
    torPruefung("die Sperrliste wird nirgends angewandt — der Schalter waere "
      + "im AN-Zustand eine Attrappe",
      /ueberangepasst\.includes\(\s*o\.symbol\s*\)/.test(orch));

    // Der Ausschluss muss benannt werden. Ein stiller Ausschluss ist im Log
    // nicht von "kein Signal" zu unterscheiden — der Fund vom 06.08.
    torPruefung("ein Walk-Forward-Ausschluss wird nicht benannt",
      /verworfen\.push\([^)]*Walk-Forward/.test(orch),
      "sonst sieht ein gesperrter Markt aus wie gar kein Signal");

    // Die Logzeile muss BEIDE Zustaende unterscheiden. Meldete sie immer
    // "werden GESPERRT", glaubte man dem Schutz auch im AUS-Zustand.
    torPruefung("die Walk-Forward-Meldung unterscheidet AN und AUS nicht",
      /sperren\s*\?\s*"[^"]*GESPERRT[^"]*"\s*:\s*"[^"]*nicht gesperrt/.test(orch));

    // Und der Standard bleibt AUS. Steht zwar im Snapshot, aber dort als eine
    // Zahl unter 299 — hier steht dabei, WARUM: die Datengrundlage war am
    // 15.09. 16 Trades, n=1..4 je Symbol. Das traegt keine Sperre.
    const speicher = read("frontend/lib/settings/settings-store.ts");
    torPruefung("der Standard der Ueberanpassungs-Sperre ist nicht mehr AUS",
      /blockOverfitMarkets:\s*false/.test(speicher),
      "einschalten ist eine Entscheidung des Nutzers, kein Standard");
  }

  // ══ EIN ABSTURZ IM ZYKLUS ERREICHT DEN NUTZER (15.09.) ═══════════════════
  //
  // Bis heute lief ein sterbender Orchestrator-Zyklus in ein
  // `console.error` — also ins Railway-Log. Der Nutzer liest Telegram. Von
  // aussen war ein Zyklus, der bei JEDEM Lauf stirbt, nicht von „gerade keine
  // Gelegenheit" zu unterscheiden. Genau dieses Muster hat den Stillstand seit
  // dem 30.06. so lange getragen.
  //
  // Die Drossel ist der schwierige Teil und wird deshalb GERECHNET, nicht nur
  // gesucht: alle 5 Minuten dieselbe Nachricht waeren zwoelf pro Stunde, und
  // dann schaltet man die Benachrichtigungen ab — ein Alarm, der nervt, ist
  // schlechter als keiner. Umgekehrt darf eine Drossel den Alarm nie ganz
  // verschlucken.
  {
    const modul = ladeTsModul("lib/zyklus-alarm/zyklus-alarm.ts");
    if (modul.fehler) {
      funde.push(`zyklus-alarm.ts nicht ausfuehrbar — die Absturz-Meldung `
        + `bleibt ungeprueft: ${modul.fehler}`);
      zusatz++;
    } else {
      const ent = modul.exports.alarmEntscheidung;
      const RUHE = modul.exports.ALARM_RUHE_MS;
      if (typeof ent !== "function") {
        funde.push("alarmEntscheidung wird nicht exportiert — die Drossel waere ungeprueft");
        zusatz++;
      } else {
        torPruefung("die Ruhezeit ist keine sinnvolle Dauer",
          RUHE >= 5 * 60_000 && RUHE <= 6 * 60 * 60_000, `${RUHE} ms`);

        const z = {};
        const t0 = 1_000_000;
        const a = ent("orch", "boom", t0, z);
        torPruefung("der ERSTE Absturz wird nicht gemeldet",
          a.melden === true && a.unterdrueckt === 0, JSON.stringify(a));

        // Gleicher Fehler waehrend der Ruhezeit: zaehlen, nicht melden.
        const b = ent("orch", "boom", t0 + 5 * 60_000, z);
        const c = ent("orch", "boom", t0 + 10 * 60_000, z);
        torPruefung("derselbe Fehler wird alle 5 Minuten erneut gemeldet",
          b.melden === false && c.melden === false, `${b.melden} / ${c.melden}`);
        torPruefung("die unterdrueckten Faelle werden nicht mitgezaehlt",
          b.unterdrueckt === 1 && c.unterdrueckt === 2, `${b.unterdrueckt} / ${c.unterdrueckt}`);

        // Nach der Ruhezeit wieder melden — MIT der Zahl der geschluckten.
        // Ohne die waere nicht zu erkennen, ob es einmal oder dauernd kracht.
        const d = ent("orch", "boom", t0 + RUHE, z);
        torPruefung("nach der Ruhezeit wird nicht wieder gemeldet",
          d.melden === true, String(d.melden));
        torPruefung("die geschluckten Faelle werden nicht mitgeteilt",
          d.unterdrueckt === 2, `${d.unterdrueckt} — erwartet 2`);

        // Und danach faengt die Zaehlung bei 0 an, sonst waechst sie ewig.
        const e = ent("orch", "boom", t0 + RUHE + 60_000, z);
        torPruefung("der Zaehler wird nach einer Meldung nicht zurueckgesetzt",
          e.unterdrueckt === 1, `${e.unterdrueckt} — erwartet 1`);

        // Ein ANDERER Fehler ist neue Information -> sofort.
        const f = ent("orch", "ganz anderer Fehler", t0 + RUHE + 2 * 60_000, z);
        torPruefung("ein NEUER Fehlertext wird von der Drossel verschluckt",
          f.melden === true, "eine andere Meldung ist neue Information");

        // Genau AUF der Ruhezeit zaehlt als vorbei (`>=`). Ohne diesen Fall
        // bliebe ein `>` unentdeckt — dieselbe Luecke wie heute bei der
        // R/R-Verteilung.
        const g = {};
        ent("x", "b", 0, g);
        torPruefung("genau auf der Ruhezeit wird noch geschluckt",
          ent("x", "b", RUHE, g).melden === true);

        // Bereiche sind unabhaengig: ein kaputter Positionswaechter darf nicht
        // vom Orchestrator gedrosselt werden.
        const h = {};
        ent("A", "boom", 0, h);
        torPruefung("zwei verschiedene Bereiche drosseln sich gegenseitig",
          ent("B", "boom", 0, h).melden === true);

        // IM ZWEIFEL MELDEN. Eine kaputte oder rueckwaerts laufende Uhr darf
        // einen Alarm nicht verschlucken — das waere genau der Fehler, den
        // dieses Modul beheben soll.
        const i = {};
        ent("A", "boom", 1000, i);
        torPruefung("eine unbrauchbare Uhr (NaN) verschluckt den Alarm",
          ent("A", "boom", NaN, i).melden === true);
        const j = {};
        ent("A", "boom", 1_000_000, j);
        torPruefung("eine rueckwaerts laufende Uhr verschluckt den Alarm",
          ent("A", "boom", 1000, j).melden === true);
      }

      // Der gemeinsame Zustand gehoert auf `global` — modul-scoped sehen
      // Route und Schleife verschiedene Kopien (28.07. Killswitch, 26.08.
      // Preis-Cache). Eine Drossel pro Kopie meldete mehrfach.
      const alarmQuelle = read("frontend/lib/zyklus-alarm/zyklus-alarm.ts")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      // BEIDE Stellen einzeln. Die erste Fassung suchte nur, OB der Name
      // irgendwo vorkommt — im Sabotage-Lauf durfte die Anlege-Zeile deshalb
      // ersatzlos verschwinden, weil der Name eine Zeile weiter im Aufruf noch
      // stand. Genau die Fehlerklasse „ein Wort ist keine Verwendung", nur
      // eine Ebene feiner: DIESE Verwendung ist nicht die gesuchte.
      torPruefung("der Drossel-Zustand wird nicht auf global ANGELEGT",
        /global\.__zyklus_alarm__\s*\?\?=/.test(alarmQuelle),
        "modul-scoped sehen Route und Schleife verschiedene Kopien (28.07., 26.08.)");
      // `[\s\S]{0,120}?` statt `[^)]*`: die erste Fassung kam an `Date.now()`
      // nicht vorbei — die Klammer darin beendete die Zeichenklasse. Damit war
      // die Pruefung IMMER rot, und im Sabotage-Lauf sah alles nach 12/12 aus,
      // weil jeder Lauf ohnehin rot war. Ein Pruefer, der nie gruen wird, ist
      // genauso wertlos wie einer, der nie rot wird — er beweist nichts.
      torPruefung("die Entscheidung laeuft nicht ueber den globalen Zustand",
        /alarmEntscheidung\([\s\S]{0,120}?global\.__zyklus_alarm__\s*\)/.test(alarmQuelle),
        "sonst drosselt sie auf einer Kopie, die niemand sonst sieht");
      torPruefung("der Alarm kann die Schleife mit in den Abgrund ziehen",
        /catch\s*\{/.test(alarmQuelle) && /Promise<boolean>/.test(alarmQuelle),
        "meldeZyklusFehler muss alles abfangen und darf nie werfen");

      // Und die Verdrahtung: der Orchestrator-catch MUSS ihn rufen.
      const instr = read("frontend/instrumentation.ts")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      torPruefung("der Orchestrator-Zyklus meldet einen Absturz nicht mehr",
        /meldeZyklusFehler\(/.test(instr),
        "sonst stirbt der Zyklus wieder still ins Railway-Log");
      torPruefung("die Absturz-Meldung haengt nicht am Orchestrator-Fehler",
        /\[orchestrator\] Zyklus-Fehler[\s\S]{0,700}meldeZyklusFehler\(/.test(instr),
        "sie muss in genau diesem catch stehen, nicht irgendwo");
      // `void` statt `await`: der naechste Tick darf nicht auf Telegram warten.
      torPruefung("der Zyklus wartet auf die Telegram-Meldung",
        /void\s+meldeZyklusFehler\(/.test(instr),
        "await hier haengt den naechsten Tick an eine Netzanfrage");
    }
  }

  // ══ DER AGENT-BUS IST EIN BUS — FUER DEN GANZEN PROZESS (16.09.) ═════════
  //
  // Vorher: `export const agentBus = new AgentBus()` (modul-scoped, dasselbe
  // Muster wie Killswitch 28.07. und Preis-Cache 26.08.), und
  // `Promise.resolve(h(event))` liess einen SYNCHRON werfenden Empfaenger den
  // Sender mitreissen. Nachgebildet wie in `preis-cache`: das Modul wird
  // ZWEIMAL geladen, gesendet wird ueber die eine Kopie, empfangen ueber die
  // andere.
  {
    const altBus = global.__agent_bus__;
    delete global.__agent_bus__;
    try {
      const kopieA = ladeTsModul("lib/agents/agent-bus.ts");
      const kopieB = ladeTsModul("lib/agents/agent-bus.ts");
      if (kopieA.fehler || kopieB.fehler) {
        funde.push(`agent-bus.ts nicht ausfuehrbar: ${kopieA.fehler ?? kopieB.fehler}`);
        zusatz++;
      } else {
        const busA = kopieA.exports.agentBus;
        const busB = kopieB.exports.agentBus;
        torPruefung("zwei Modulkopien haben zwei verschiedene Busse — Sender und Empfaenger reden aneinander vorbei",
          busA === busB && global.__agent_bus__ === busA,
          "der Bus gehoert auf global (28.07. Killswitch, 26.08. Preis-Cache)");

        const stille = console.error;
        const stilleLog = console.log;
        console.error = () => {};
        console.log = () => {};
        let empfangen = 0;
        let warf = null;
        try {
          busB.subscribe("CYCLE:FINISHED", () => { throw new Error("synchron kaputt"); });
          busB.subscribe("CYCLE:FINISHED", async () => { throw new Error("asynchron kaputt"); });
          busB.subscribe("CYCLE:FINISHED", () => { empfangen++; });
          try {
            busA.publish({ type: "CYCLE:FINISHED", agentId: "Pruefstand", timestamp: "x", payload: {} });
          } catch (e) { warf = e.message; }
          // Der asynchrone Fehler wird erst im naechsten Takt protokolliert —
          // vorher die Konsole zurueckzusetzen, liess Stapelspuren in die
          // Pruefer-Ausgabe laufen.
          await new Promise((r) => setImmediate(r));
        } finally {
          console.error = stille;
          console.log = stilleLog;
        }
        torPruefung("ein synchron werfender Empfaenger reisst den SENDER mit",
          warf === null, `publish() warf: ${warf}`);
        torPruefung("nach einem werfenden Empfaenger werden die uebrigen nicht mehr beliefert",
          empfangen === 1, `${empfangen} Zustellungen, erwartet 1`);

        // Das Ereignisprotokoll bleibt begrenzt.
        console.log = () => {};
        try {
          for (let i = 0; i < 700; i++) {
            busA.publish({ type: "RISK:HEARTBEAT", agentId: "Pruefstand", timestamp: String(i), payload: {} });
          }
        } finally { console.log = stilleLog; }
        const log = busA.getRecentEvents(undefined, 10_000);
        torPruefung("das Ereignisprotokoll des Busses waechst unbegrenzt",
          log.length === 500, `${log.length} Eintraege nach ueber 700 Ereignissen`);

        // Die Tor-Meldung wirft nie und kommt an.
        const melde = kopieA.exports.meldeTorEntscheidung;
        let torEmpfangen = null;
        busB.subscribe("GATE:DECISION", (ev) => { torEmpfangen = ev.payload; });
        let torWarf = false;
        try { melde("Pruefstand", { gate: "Meta-KI", symbol: "EURUSD", approve: false, reason: "test" }); }
        catch { torWarf = true; }
        torPruefung("eine Tor-Entscheidung kommt nicht ueber den Bus an",
          !torWarf && torEmpfangen && torEmpfangen.gate === "Meta-KI" && torEmpfangen.approve === false,
          JSON.stringify(torEmpfangen));
      }
    } finally {
      if (altBus === undefined) delete global.__agent_bus__;
      else global.__agent_bus__ = altBus;
    }
    const busCode = read("frontend/lib/agents/agent-bus.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("der Bus wird wieder modul-scoped angelegt",
      /export const agentBus: AgentBus = \(global\.__agent_bus__ \?\?= new AgentBus\(\)\);/.test(busCode)
      && !/export const agentBus\s*=\s*new AgentBus\(\)/.test(busCode));
    const exAblehnung = read("frontend/lib/agents/execution-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("eine KI-Ablehnung wird wieder als geschlossener Trade gemeldet",
      !/EXECUTION:TRADE_CLOSED/.test(exAblehnung)
      && /meldeTorEntscheidung\(AGENT_ID, \{\s*gate: "Ausfuehrungs-KI"/.test(exAblehnung),
      "es war nie ein Trade offen");
  }

  // ══ DIE ZYKLUS-BILANZ HOERT DEN BUS WIRKLICH AB (16.09.) ═════════════════
  //
  // Die Bilanz ist der erste echte Empfaenger der Tor-Entscheidungen. Geprueft
  // wird sie einmal VOLLSTAENDIG ueber den echten Bus: Zyklus-Start, Scan,
  // Tore, Trade, Ende — und am Schluss muss die Tagessumme im (hier
  // nachgebildeten) Redis stehen. Dazu die reinen Funktionen einzeln.
  {
    const altBus = global.__agent_bus__;
    const altBilanz = global.__zyklus_bilanz__;
    delete global.__agent_bus__;
    delete global.__zyklus_bilanz__;
    const speicher = new Map();
    const gesendet = [];
    const busModul = ladeTsModul("lib/agents/agent-bus.ts");
    const bilanzModul = busModul.fehler ? busModul : ladeTsModul("lib/zyklus-bilanz/zyklus-bilanz.ts", {
      "agent-bus": busModul.exports,
      "redis-cache": {
        cacheGet: async (k) => (speicher.has(k) ? JSON.parse(speicher.get(k)) : null),
        cacheSet: async (k, v) => { speicher.set(k, JSON.stringify(v)); },
      },
      "telegram-sender": { telegramZeit: () => "27.9.2026, 14:48:11 MESZ", telegramDatum: () => "27.9.2026", sendTelegram: async (t) => { gesendet.push(t); return true; } },
    });
    try {
      if (bilanzModul.fehler) {
        funde.push(`zyklus-bilanz.ts nicht ausfuehrbar: ${bilanzModul.fehler}`);
        zusatz++;
      } else {
        const B = bilanzModul.exports;
        const bus = busModul.exports.agentBus;

        // ── reine Funktionen ──
        torPruefung("gleichartige Gruende werden nicht zusammengezaehlt",
          B.grundSchluessel("Confidence 74 < Schwelle 76 (autoApprove 76, minConfidence 69)")
          === B.grundSchluessel("Confidence 73 < Schwelle 77 (autoApprove 77, minConfidence 70)")
          && B.grundSchluessel("Confidence 74 < Schwelle 76") === "Confidence # < Schwelle #",
          B.grundSchluessel("Confidence 74 < Schwelle 76 (x)"));
        torPruefung("der Handelstag ist nicht das UTC-Datum",
          B.handelstag(new Date("2026-09-17T01:30:00+02:00")) === "2026-09-16"
          && B.handelstag(new Date("2026-09-16T23:30:00Z")) === "2026-09-16");
        const html = B.tagesbilanzText({
          ...B.leereTagessumme("2026-09-16"), zyklen: 1,
          tore: { "Schwelle": { ja: 0, nein: 1, fallback: 0, gruende: { "Confidence # < Schwelle # <b>&": 1 } } },
        });
        const tags = (html.match(/<[^>]*>/g) || []).filter((t) => t !== "<b>" && t !== "</b>");
        torPruefung("ein Grund mit < oder & bricht die Telegram-Nachricht (HTML)",
          tags.length === 0 && /&lt;b&gt;&amp;/.test(html), tags.join(" "));
        torPruefung("ein reines Sperr-Tor zeigt ein irrefuehrendes '0 ja'",
          /Schwelle: 1 nein/.test(html) && !/0 ja/.test(html));

        // Tagessumme: neuer Tag setzt zurueck, gleicher Tag addiert, Eingabe bleibt unberuehrt.
        const b1 = B.neueBilanz(0);
        b1.ende = 60_000; b1.ausgang = "Keine freigegebenen Signale";
        b1.scan = { maerkte: 30, gpt: { WAIT: 25, BUY: 3, SELL: 2 }, vetos: 2, stilVerworfen: 0,
          unterGrenze: [66, 60, 62], go: 0, rrAbgelehnt: 0, claudeGefragt: 0,
          regelbrueche: { "BUY an Resistance": 2 }, dauerMs: { GPT: 20000 },
          kontext: { news: false, performance: true, mtfSymbole: 30 } };
        B.bilanzVerbuchen(b1, { type: "GATE:DECISION", payload: { gate: "Meta-KI", approve: false, reason: "RSI 72" } });
        B.bilanzVerbuchen(b1, { type: "GATE:DECISION", payload: { gate: "Meta-KI", approve: "false", reason: "Muell" } });
        B.bilanzVerbuchen(b1, { type: "GATE:DECISION", payload: { gate: "Ausfuehrungs-KI", approve: true, reason: "fallback", fallback: true } });
        const t1 = B.tagessummeAddieren(null, b1, "2026-09-16");
        const t1Kopie = JSON.stringify(t1);
        const t2 = B.tagessummeAddieren(t1, b1, "2026-09-16");
        const t3 = B.tagessummeAddieren(t2, b1, "2026-09-17");
        torPruefung("die Tagessumme zaehlt falsch",
          t1.zyklen === 1 && t1.gpt.BUY === 3 && t1.vetos === 2 && t1.unterGrenze === 3
          && t1.confMin === 60 && t1.confMax === 66 && t1.regelbrueche["BUY an Resistance"] === 2
          && t2.zyklen === 2 && t2.gpt.WAIT === 50 && t2.ausgaenge["Keine freigegebenen Signale"] === 2,
          JSON.stringify({ z1: t1.zyklen, z2: t2.zyklen, min: t1.confMin, max: t1.confMax }));
        torPruefung("die Tagessumme veraendert ihre Eingabe",
          JSON.stringify(t1) === t1Kopie, "sonst zaehlt ein wiederholter Aufruf doppelt");
        torPruefung("ein neuer Handelstag beginnt nicht bei null",
          t3.zyklen === 1 && t3.datum === "2026-09-17");
        torPruefung("ein kaputtes Tor-Ereignis wird mitgezaehlt",
          t1.tore["Meta-KI"]?.nein === 1 && t1.tore["Meta-KI"]?.ja === 0,
          JSON.stringify(t1.tore["Meta-KI"]));
        torPruefung("ein KI-Rueckfall wird als Zustimmung gezaehlt, ohne als Rueckfall zu erscheinen",
          t1.tore["Ausfuehrungs-KI"]?.fallback === 1);
        // Obergrenzen
        const viel = B.neueBilanz(0);
        for (let i = 0; i < 300; i++) {
          B.bilanzVerbuchen(viel, { type: "GATE:DECISION", payload: { gate: "Schwelle", approve: false, reason: `Grund Nummer ${i} ${"x".repeat(i % 40)}` } });
        }
        const tViel = B.tagessummeAddieren(null, viel, "2026-09-16");
        torPruefung("die Zyklus- oder Tagesbilanz waechst unbegrenzt",
          viel.tore.length === 200 && Object.keys(tViel.tore["Schwelle"].gruende).length <= 26,
          `${viel.tore.length} Tore, ${Object.keys(tViel.tore["Schwelle"].gruende).length} Gruende`);

        // ── ein ganzer Zyklus ueber den ECHTEN Bus ──
        const stilleLog = console.log;
        const zeilen = [];
        console.log = (...a) => { zeilen.push(a.join(" ")); };
        try {
          // GLEICHZEITIG und danach noch einmal — keiner darf doppelt anmelden.
          // Die zweite Pruefung im Modul (nach dem await) schuetzt genau den
          // gleichzeitigen Fall; ein Nacheinander-Test saehe ihn nie.
          await Promise.all([B.bilanzAbonnieren(), B.bilanzAbonnieren()]);
          await B.bilanzAbonnieren();
          // Ein Scan AUSSERHALB eines Zyklus (Dashboard-Route) darf nicht zaehlen.
          bus.publish({ type: "ANALYSIS:SCAN_DONE", agentId: "Route", timestamp: "", payload: { scan: b1.scan } });
          bus.publish({ type: "CYCLE:STARTED", agentId: "OrchestratorAgent", timestamp: "", payload: {} });
          bus.publish({ type: "ANALYSIS:SCAN_DONE", agentId: "AnalysisAgent", timestamp: "", payload: { scan: b1.scan } });
          busModul.exports.meldeTorEntscheidung("AnalysisAgent", { gate: "Meta-KI", symbol: "EURUSD", approve: false, reason: "TA-Signal widerspricht" });
          bus.publish({ type: "EXECUTION:TRADE_OPENED", agentId: "ExecutionAgent", timestamp: "", payload: { symbol: "GBPUSD", direction: "BUY" } });
          bus.publish({ type: "CYCLE:FINISHED", agentId: "OrchestratorAgent", timestamp: "", payload: { ausgang: "1 Trade(s) eröffnet" } });
          await new Promise((r) => setTimeout(r, 20));
          // Nach dem Ende: ein verirrtes Ereignis darf keinen halben Zustand anlegen.
          bus.publish({ type: "ANALYSIS:SCAN_DONE", agentId: "Route", timestamp: "", payload: { scan: b1.scan } });
          bus.publish({ type: "GATE:DECISION", agentId: "Route", timestamp: "", payload: { gate: "Meta-KI", approve: false, reason: "x" } });
        } finally { console.log = stilleLog; }
        torPruefung("ausserhalb eines Zyklus bleibt ein halber Bilanz-Zustand haengen",
          global.__zyklus_bilanz__ && global.__zyklus_bilanz__.aktuell === null,
          "ein Ereignis ohne laufenden Zyklus gehoert zu keinem Zyklus");
        const tag = B.handelstag();
        const gespeichert = speicher.has(`zyklus:tag:${tag}`) ? JSON.parse(speicher.get(`zyklus:tag:${tag}`)) : null;
        torPruefung("die Zyklus-Bilanz kommt nicht ueber den Bus zusammen",
          gespeichert && gespeichert.zyklen === 1 && gespeichert.scans === 1 && gespeichert.trades === 1
          && gespeichert.tore["Meta-KI"]?.nein === 1,
          JSON.stringify(gespeichert && { z: gespeichert.zyklen, s: gespeichert.scans, t: gespeichert.trades }));
        torPruefung("die Zeile pro Zyklus fehlt oder nennt den Ausgang nicht",
          zeilen.filter((z) => z.startsWith("[zyklus] 📋")).length === 1
          && zeilen.some((z) => /Ausgang: 1 Trade\(s\) eröffnet/.test(z) && /Meta-KI nein EURUSD/.test(z)),
          zeilen.filter((z) => z.startsWith("[zyklus]")).join(" / ").slice(0, 160));

        // Versand — auch an einem Tag OHNE Zyklus.
        const ok = await B.tagesbilanzSenden("2000-01-01");
        torPruefung("an einem Tag ohne Zyklus geht keine Bilanz raus",
          ok === true && gesendet.length === 1 && /KEIN Handelszyklus/.test(gesendet[0]),
          "genau diese Tage (Trade-Duerre) blieben bisher stumm");
      }
    } finally {
      if (altBus === undefined) delete global.__agent_bus__; else global.__agent_bus__ = altBus;
      if (altBilanz === undefined) delete global.__zyklus_bilanz__; else global.__zyklus_bilanz__ = altBilanz;
    }

    // ── Verdrahtung (kommentarbereinigt) ──
    const oq = read("frontend/lib/agents/orchestrator-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    const huelle = (oq.match(/export async function runOrchestratorCycle\(\): Promise<void> \{[\s\S]*?\n\}/) || [""])[0];
    torPruefung("der Zyklus meldet Anfang oder Ende nicht an den Bus",
      // `\} finally \{` UNMITTELBAR vor der Meldung. Die erste Fassung fand
      // ein leeres `finally {}` und das FINISHED weiter unten — nach einem
      // Absturz fehlte dann die Zyklus-Zeile (im Sabotage-Lauf entwischt).
      /type: "CYCLE:STARTED"[\s\S]*ausgang = await zyklusInnen\(\);[\s\S]*\} finally \{\s*agentBus\.publish\(\{ type: "CYCLE:FINISHED"/.test(huelle),
      "das Ende gehoert in finally — auch ein Absturz ist ein Ausgang");
    torPruefung("ein Absturz wird verschluckt statt weitergeworfen",
      /catch \(err\) \{[\s\S]*?throw err;/.test(huelle),
      "instrumentation.ts meldet Abstuerze nur, wenn sie ankommen");
    const innen = (oq.match(/async function zyklusInnen\(\): Promise<string> \{[\s\S]*?\n\}/) || [""])[0];
    torPruefung("ein Ausgang des Zyklus nennt keinen Grund",
      innen !== "" && !/\breturn;/.test(innen) && (innen.match(/return "/g) || []).length >= 12,
      `${(innen.match(/return "/g) || []).length} benannte Ausgaenge`);
    for (const [gate, mindestens] of [["Orchestrator-KI", 1], ["Walk-Forward", 1], ["Schwelle", 2], ["Stil-Limit", 1], ["Duplikat", 5], ["Filterkette", 1]]) {
      const anz = (oq.match(new RegExp(`gate: "${gate}"`, "g")) || []).length;
      torPruefung(`das Tor "${gate}" meldet seine Entscheidungen nicht`, anz >= mindestens, `${anz} Stellen, erwartet ${mindestens}`);
    }
    torPruefung("die gemeldete Orchestrator-Entscheidung kann von der wirksamen abweichen",
      /approve: !!aiDecision\.proceed,/.test(oq) && /if \(!aiDecision\.proceed\) \{/.test(oq));
    torPruefung("ein Broker-Fehler wird nicht gemeldet — oder eine KI-Ablehnung doppelt",
      /if \(!execResult\.skippedByAI\) \{\s*agentBus\.publish\(\{ type: "EXECUTION:TRADE_FAILED"/.test(oq));
    const iq = read("frontend/instrumentation.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("die Tagesbilanz wird nicht nach Handelsschluss verschickt",
      /cron\.schedule\("5 22 \* \* 1-5", async \(\) => \{[\s\S]{0,200}tagesbilanzSenden\(\)[\s\S]{0,120}\{ timezone: "UTC" \}\)/.test(iq),
      "Handelsfenster endet Mo–Fr 22:00 UTC");
  }

  // ══ EIN OVERRIDE UMGEHT DAS CHANCE-RISIKO NICHT (16.09.) ═════════════════
  //
  // Die 1.5er-Huerde wird im Scanner auf GPTs Stop und Ziel gerechnet. Ein
  // Admin-Override (`/apply` per Telegram) ersetzt GENAU DIESE beiden Werte
  // danach — die Order konnte mit einem Chance-Risiko von 0.5 rausgehen,
  // waehrend jedes andere Signal an 1.5 scheitert. Und der Stil des Overrides
  // wurde nur umgetypt, obwohl er Haltedauer, Stop-Tabelle und Stil-Tageslimit
  // bestimmt.
  {
    const orchM2 = ladeTsModul("lib/agents/orchestrator-agent.ts", {
      "broker-config": { MIN_SIGNAL_CONFIDENCE: 70 },
    });
    const rr = orchM2.exports?.ueberschreibungRR;
    const MINRR = orchM2.exports?.OVERRIDE_MIN_RR;
    if (orchM2.fehler || typeof rr !== "function") {
      funde.push(`ueberschreibungRR nicht ausfuehrbar: ${orchM2.fehler ?? "nicht exportiert"}`);
      zusatz++;
    } else {
      const f = (e, sl, tp, buy) => { try { return rr(e, sl, tp, buy); } catch (x) { return `WIRFT ${x.message}`; } };
      torPruefung("die Override-Huerde ist nicht dieselbe wie im Scanner (1.5)", MINRR === 1.5, String(MINRR));
      torPruefung("das Chance-Risiko eines Overrides wird falsch gerechnet",
        f(100, 99, 102, true) === 2 && f(100, 98, 101, true) === 0.5
        && f(100, 101, 98, false) === 2 && f(100, 102, 99, false) === 0.5,
        `${f(100, 99, 102, true)} / ${f(100, 98, 101, true)} / ${f(100, 101, 98, false)}`);
      torPruefung("ein Stop oder Ziel auf der FALSCHEN Seite ergibt nicht 0",
        f(100, 101, 102, true) === 0 && f(100, 99, 99.5, true) === 0
        && f(100, 99, 98, false) === 0 && f(100, 101, 102, false) === 0,
        "ein Ziel unter dem Einstieg bei BUY waere ein sofortiger Verlust");
      const muell = [
        [0, 99, 102, true], [NaN, 99, 102, true], [100, undefined, 102, true],
        [100, 99, undefined, true], [100, NaN, 102, true], [100, 100, 102, true],
      ];
      const nichtNull = muell.filter((m) => f(...m) !== 0);
      torPruefung("unbrauchbare Order-Werte ergeben ein Chance-Risiko > 0",
        nichtNull.length === 0, JSON.stringify(nichtNull));
    }
    const oq3 = read("frontend/lib/agents/orchestrator-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("ein Override-Stil wird wieder ungeprueft uebernommen",
      /const ovStil = normalisiereStil\(override\.style\);/.test(oq3)
      && !/^\s*style = override\.style;/m.test(oq3),
      "er bestimmt Haltedauer, Stop-Tabelle und Stil-Tageslimit");
    torPruefung("ueberschriebene Stop-/Ziel-Werte werden nicht erneut gegen das Chance-Risiko geprueft",
      // Fenster gross genug fuer Meldung UND Bus-Ereignis dazwischen — mit 400
      // Zeichen schlug die Pruefung am eigenen Code fehl.
      /if \(ueberschrieben\) \{[\s\S]{0,200}?if \(!\(rrOverride >= OVERRIDE_MIN_RR\)\) \{[\s\S]{0,900}?continue;/.test(oq3));
    torPruefung("die Override-Pruefung laeuft auch ohne Override — das waere eine neue Huerde fuer alle",
      /ueberschrieben = true;/.test(oq3)
      && (oq3.match(/ueberschrieben = true;/g) || []).length === 2
      && /let ueberschrieben = false;/.test(oq3),
      "sie gilt nur, wenn ein Override Stop oder Ziel wirklich ersetzt hat");
    // Den AUFRUF zaehlen, nicht den Namen: im Sabotage-Lauf blieb
    // `{ gate: "Override" … }` als toter Ausdruck stehen und die Zaehlung
    // stimmte weiter. Ein Wort ist kein Melden.
    torPruefung("die Override-Entscheidung geht nicht an die Zyklus-Bilanz",
      (oq3.match(/meldeTorEntscheidung\(AGENT_ID, \{\s*gate: "Override"/g) || []).length === 2);
  }

  // ══ UEBERWACHUNG: HAENGER, MULTI-TIMEFRAME, EHRLICHE DIAGNOSE (16.09.) ═══
  //
  // Drei stille Stellen:
  //  1. Haengt eine Schleife wirklich, schrieb sie nur "ueberspringe diesen
  //     Tick" — alle 2 bzw. 5 Minuten, und niemand erfuhr es.
  //  2. Im Multi-Timeframe-Abruf verschluckte JEDER der beiden Aufrufe seinen
  //     Fehler selbst; die dafuer gebaute Warnung konnte nie ausloesen.
  //  3. Der Diagnose-Zustand lag modul-scoped: `GET /api/diagnostics-agent`
  //     sah eine leere Kopie und meldete "Alle 0 Agents aktiv".
  {
    const iq2 = read("frontend/instrumentation.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    for (const [name, zaehler, bereich] of [
      ["Handelszyklus", "orchestratorSkips", "Orchestrator \\(5-Minuten-Zyklus\\)"],
      ["Positionswaechter", "positionMonitorSkips", "Positionswaechter \\(2-Minuten-Schleife\\)"],
    ]) {
      const block = new RegExp(
        `${zaehler}\\+\\+;[\\s\\S]{0,400}?if \\(${zaehler} >= 3\\) \\{[\\s\\S]{0,500}?void meldeZyklusFehler\\("${bereich}", new Error\\(`
      );
      // Der Rücksetzer muss NACH dem Ueberspringen-Zweig stehen. `${zaehler} = 0;`
      // allein traf auch die Deklaration `let ${zaehler} = 0;` — im Sabotage-Lauf
      // liess sich der echte Rücksetzer deshalb ersatzlos streichen.
      torPruefung(`ein haengender ${name} meldet sich nicht`,
        block.test(iq2) && new RegExp(`return;\\s*\\}\\s*${zaehler} = 0;`).test(iq2),
        "drei Auslassungen in Folge, und der Zaehler muss beim naechsten echten Lauf zurueckgesetzt werden");
      // Der Text darf die ZAHL nicht enthalten — sonst ist er bei jeder
      // Meldung neu und umgeht die 30-Minuten-Drossel (zyklus-alarm).
      const meldung = (iq2.match(new RegExp(`void meldeZyklusFehler\\("${bereich}", new Error\\(([\\s\\S]{0,400}?)\\)\\);`)) || ["", ""])[1];
      torPruefung(`die Haenger-Meldung des ${name} enthaelt eine veraenderliche Zahl`,
        meldung !== "" && !new RegExp(`\\$\\{${zaehler}`).test(meldung),
        "ein wechselnder Text umgeht die Drossel — alle paar Minuten eine Nachricht");
    }

    const mq = read("frontend/lib/market-scanner/ai-analysis-engine.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    const mtfBlock = (mq.match(/async function fetchMultiTimeframeSummary[\s\S]*?\n\}/) || [""])[0];
    torPruefung("ein Multi-Timeframe-Abruf verschluckt seinen Fehler wieder selbst",
      mtfBlock !== "" && !/\.catch\(\(\) => null\)/.test(mtfBlock)
      && /HTTP \$\{r\.status\}/.test(mtfBlock) && /fehlgeschlagen nach/.test(mtfBlock),
      "dann kann die Warnung im catch nie ausloesen");
    torPruefung("ein Teilausfall des Multi-Timeframe bleibt unsichtbar",
      /Multi-Timeframe nur fuer \$\{result\.size\}\/\$\{symbols\.length\}/.test(mtfBlock),
      "12 von 30 Symbolen ohne 1H/1W war bisher nirgends zu sehen");

    // ── Diagnose: Zustand wirklich geteilt? ──
    const altDiag = global.__diagnose_zustand__;
    delete global.__diagnose_zustand__;
    try {
      const dA = ladeTsModul("lib/agents/diagnostics-agent.ts");
      const dB = ladeTsModul("lib/agents/diagnostics-agent.ts");
      if (dA.fehler || dB.fehler) {
        funde.push(`diagnostics-agent nicht ausfuehrbar: ${dA.fehler ?? dB.fehler}`);
        zusatz++;
      } else {
        // Ueber den GETEILTEN Zustand schreiben (so wie es der Ereignis-Handler
        // tut), ueber die ANDERE Kopie den Bericht erzeugen — genau der Fall
        // der Route. Fehlt der globale Zustand, ist DAS der Befund; im
        // Sabotage-Lauf stuerzte der Pruefer hier ab statt zu melden.
        const geteilt = global.__diagnose_zustand__;
        if (!geteilt || !(geteilt.heartbeats instanceof Map)) {
          torPruefung("der Diagnose-Zustand wird nicht auf global angelegt — "
            + "die Route sieht dann eine leere Kopie und meldet 'Alle 0 Agents aktiv'",
            false, String(geteilt === undefined ? "kein global.__diagnose_zustand__" : typeof geteilt.heartbeats));
        } else {
          geteilt.heartbeats.set("RiskAgent", {
            agentId: "RiskAgent", lastSeen: new Date().toISOString(),
            cycleCount: 1, errorCount: 0, status: "OK",
          });
          const bericht = dB.exports.getDiagnosticsReport();
          torPruefung("zwei Modulkopien der Diagnose sehen verschiedene Zustaende — "
            + "die Route meldet dann 'Alle 0 Agents aktiv'",
            bericht && bericht.agents?.length === 1 && bericht.agents[0].agentId === "RiskAgent",
            JSON.stringify(bericht && bericht.summary));
        }
      }
    } finally {
      if (altDiag === undefined) delete global.__diagnose_zustand__;
      else global.__diagnose_zustand__ = altDiag;
    }
    const dq = read("frontend/lib/agents/diagnostics-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("der Diagnose-Zustand liegt wieder modul-scoped",
      /global\.__diagnose_zustand__ \?\?=/.test(dq)
      && !/^const anomalies = new Map/m.test(dq));
    torPruefung("der Handelszyklus wird nicht als Herzschlag abgehoert",
      /"CYCLE:STARTED",/.test(dq) && /const knownAgents = \["RiskAgent", "OrchestratorAgent"\]/.test(dq),
      "ohne abonnierten Herzschlag stand der OrchestratorAgent zwar in der Liste, wurde aber nie geprueft");
    torPruefung("die Diagnose behauptet wieder, alle Agenten zu ueberwachen",
      !/überwacht alle Agents/.test(dq),
      "von drei genannten kam nur bei einem je ein Herzschlag an");

    // ── Diagnose: meldet sie sich doppelt an? Und springt der Alarm durch? ──
    //
    // GERECHNET, nicht gelesen (17.09.). Zwei Aufrufer von
    // initDiagnosticsAgent(): instrumentation.ts und die Route. Das sind
    // verschiedene Modulkopien. Solange die Sperre modul-scoped war, meldeten
    // sich BEIDE am selben (globalen) Bus an — jedes Ereignis doppelt gezaehlt,
    // und der Alarm bei `count === 3` wurde mit 2 → 4 uebersprungen.
    //
    // Der Pruefstand baut genau das nach: EIN Bus, ZWEI Modulkopien, ein
    // Ereignis. Was danach im Bericht steht, ist die Antwort.
    const altBus = global.__agent_bus__;
    const altDiag2 = global.__diagnose_zustand__;
    const altInterval = global.setInterval;
    const uhren = [];
    global.setInterval = (...a) => { const h = altInterval(...a); uhren.push(h); return h; };
    delete global.__agent_bus__;
    delete global.__diagnose_zustand__;
    try {
      const busModul = ladeTsModul("lib/agents/agent-bus.ts");
      const alarme = [];
      const ersatz = {
        "agent-bus": busModul.exports,
        "telegram-notifications/telegram-sender": {
          sendTelegram: async (m) => { alarme.push(String(m)); return true; },
          telegramZeit: () => "27.9.2026, 14:48:11 MESZ",
          telegramDatum: () => "27.9.2026",
        },
      };
      const d1 = ladeTsModul("lib/agents/diagnostics-agent.ts", ersatz);
      const d2 = ladeTsModul("lib/agents/diagnostics-agent.ts", ersatz);
      if (busModul.fehler || d1.fehler || d2.fehler) {
        funde.push(`Diagnose-Pruefstand nicht lauffaehig: ${busModul.fehler ?? d1.fehler ?? d2.fehler}`);
        zusatz++;
      } else {
        const bus = busModul.exports.agentBus;
        const fehlerEreignis = (symbol) => ({
          type: "RISK:ERROR", agentId: "RiskAgent", timestamp: new Date().toISOString(),
          payload: { symbol, error: "Testfehler" },
        });
        d1.exports.initDiagnosticsAgent();
        d2.exports.initDiagnosticsAgent();   // zweite Kopie — darf NICHTS bewirken
        torPruefung("zwei Modulkopien der Diagnose melden sich beide am Bus an",
          bus.subscriberCount("RISK:ERROR") === 1,
          `${bus.subscriberCount("RISK:ERROR")} Empfaenger statt 1 — jedes Ereignis wird doppelt verbucht`);

        bus.publish(fehlerEreignis("EURUSD"));
        const b1 = d2.exports.getDiagnosticsReport();
        const a1 = (b1.anomalies ?? []).find((a) => a.type === "RISK_ERROR");
        torPruefung("ein Ereignis wird mehrfach verbucht",
          !!a1 && a1.count === 1 && b1.recentErrors.length === 1,
          `count=${a1 && a1.count}, Fehler=${b1.recentErrors.length} (erwartet je 1)`);

        // Alarm: bei Schwelle 3 genau EINE Meldung, und keine weitere danach.
        bus.publish(fehlerEreignis("EURUSD"));
        bus.publish(fehlerEreignis("EURUSD"));
        bus.publish(fehlerEreignis("EURUSD"));
        await new Promise((r) => setTimeout(r, 20));
        torPruefung("der Anomalie-Alarm geht nicht oder mehrfach raus",
          alarme.filter((m) => m.includes("RISK_ERROR")).length === 1,
          `${alarme.filter((m) => m.includes("RISK_ERROR")).length} Alarme statt genau 1`);

        // UND: der Merker gehoert an den EINZELNEN Datensatz. Liegt er am
        // Modul, verschluckt die erste gemeldete Anomalie alle weiteren —
        // ein Python-Ausfall bliebe stumm, weil vorher ein RISK_ERROR kam.
        alarme.length = 0;
        bus.publish(fehlerEreignis("GBPUSD"));
        bus.publish(fehlerEreignis("GBPUSD"));
        bus.publish(fehlerEreignis("GBPUSD"));
        await new Promise((r) => setTimeout(r, 20));
        torPruefung("eine zweite Anomalie bekommt keinen eigenen Alarm mehr",
          alarme.filter((m) => m.includes("GBPUSD")).length === 1,
          `${alarme.filter((m) => m.includes("GBPUSD")).length} Alarme fuer die zweite Anomalie statt 1`);
      }
    } catch (e) {
      funde.push(`Diagnose-Pruefstand abgebrochen: ${e instanceof Error ? e.message : String(e)}`);
      zusatz++;
    } finally {
      for (const h of uhren) clearInterval(h);
      global.setInterval = altInterval;
      if (altBus === undefined) delete global.__agent_bus__; else global.__agent_bus__ = altBus;
      if (altDiag2 === undefined) delete global.__diagnose_zustand__; else global.__diagnose_zustand__ = altDiag2;
    }
  }

  // ══ KEIN STILLER AUSGANG AUS DER KANDIDATEN-SCHLEIFE (18.09.) ═══════════
  //
  // GEFUNDEN AN DER ERSTEN TAGESBILANZ: nach dem Duplikat-Tor blieben 10
  // Kandidaten, ausgefuehrt wurden 6 — fuer vier nannte die Bilanz keinen
  // Grund. Ursache waren die beiden `break` der Schleife (ein Trade je Zyklus,
  // `maxTradesThisCycle`): sie beenden die Pruefung, ohne etwas zu melden.
  // Jeder `continue` darin meldet sein Tor; die `break` taten es nicht.
  //
  // Diese Pruefung zaehlt die Ausgaenge im Quelltext und verlangt, dass JEDER
  // begleitet ist. Kommt morgen ein neuer `continue` dazu, wird sie rot.
  {
    const oq = read("frontend/lib/agents/orchestrator-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    // `\r?\n`: die Datei hat CRLF — ein blosses `\n` im Muster trifft nichts
    // (erster Lauf meldete deshalb "0 Zeichen", die Selbstpruefung hat es
    // gefangen).
    const schleife = (oq.match(/for \(const \[index, candidate\] of candidates\.entries\(\)\)[\s\S]*?\r?\n  \}\r?\n/) || [""])[0];
    torPruefung("die Kandidaten-Schleife ist nicht mehr auffindbar — die Pruefung waere blind",
      schleife.length > 2000, `${schleife.length} Zeichen`);
    if (schleife.length > 2000) {
      // JEDES `continue` braucht eine EIGENE Meldung, nicht bloss genug
      // Meldungen insgesamt. Die erste Fassung verglich nur die Summen —
      // die Sabotage "ein continue ohne Tor-Meldung" blieb damit gruen, weil
      // andere Tore doppelt melden (ja UND nein). Jetzt wird der Text an jedem
      // `continue` zerlegt: in jedem Abschnitt muss ein Aufruf stehen.
      const abschnitte = schleife.split("continue;").slice(0, -1);
      const ohneTor = abschnitte.filter((t) => !/meldeTorEntscheidung\(AGENT_ID, \{/.test(t)).length;
      torPruefung("ein `continue` in der Kandidaten-Schleife meldet kein Tor",
        ohneTor === 0, `${ohneTor} von ${abschnitte.length} Ausgaengen ohne eigene Meldung`);
      // Beide `break` muessen die Zahl der uebersprungenen Kandidaten setzen.
      torPruefung("ein `break` beendet die Pruefung wieder stillschweigend",
        /nichtGeprueft = candidates\.length - index;[\s\S]{0,200}?break;/.test(schleife)
        && /nichtGeprueft = candidates\.length - index - 1;[\s\S]{0,120}?break;/.test(schleife),
        "dann fehlen die uebersprungenen Kandidaten in der Bilanz");
      // Den AUFRUF zaehlen, nicht den Namen: eine Sabotage liess
      // `void ({ gate: "Zyklus-Limit" … })` als toten Ausdruck stehen und
      // blieb gruen. Dieselbe Falle wie beim Override-Tor am 16.09.
      torPruefung("die uebersprungenen Kandidaten gehen nicht an die Bilanz",
        /if \(nichtGeprueft > 0\) \{[\s\S]{0,400}?meldeTorEntscheidung\(AGENT_ID, \{\s*gate: "Zyklus-Limit"/.test(oq),
        "genau eine Meldung je Zyklus, mit der Zahl");
      torPruefung('"Zyklus-Limit" fehlt in der Liste GateName',
        /\| "Zyklus-Limit"/.test(read("frontend/lib/agents/agent-bus.ts")));

      // ── KEIN STILLER AUSFALL NACH EINEM TRADE (20.09.) ──────────────────
      //
      // `postTradeActions` hatte DREI leere `catch { /* non-fatal */ }`:
      // Telegram-Meldung, Python-Registrierung und Journal-Zeile. Der letzte
      // ist der teuerste — ohne Zeile hat die Position fuer immer keinen
      // Handelsstil, keinen Teilgewinn-Riegel und keinen Risiko-Zustand, und
      // sie wird spaeter mit `stil=UNBEKANNT` rekonstruiert. Am 18.09. liefen
      // genau zwei solche Positionen, und es gab KEINE Spur, warum.
      const ptaStart = oq.indexOf("async function postTradeActions");
      const pta = ptaStart >= 0 ? oq.slice(ptaStart, ptaStart + 4500) : "";
      torPruefung("postTradeActions ist nicht mehr auffindbar — die Pruefung waere blind",
        pta.length > 1500 && /saveCapitalTradeToJournal/.test(pta), `${pta.length} Zeichen`);
      if (pta.length > 1500) {
        const stille = (pta.match(/catch\s*\{\s*\}/g) || []).length
          + (pta.match(/catch\s*\{\s*\/\*[^*]*\*\/\s*\}/g) || []).length;
        torPruefung("ein Ausfall nach dem Trade wird wieder stillschweigend verschluckt",
          stille === 0, `${stille} leere catch-Bloecke in postTradeActions`);
        torPruefung("ein gescheiterter Journal-Schreibvorgang bleibt unsichtbar",
          /JOURNAL-ZEILE NICHT GESCHRIEBEN/.test(pta),
          "ohne Zeile: kein Handelsstil, kein Teilgewinn-Riegel, kein Risiko-Zustand");
        torPruefung("eine gescheiterte Python-Registrierung bleibt unsichtbar",
          /Python-Lifecycle-Registrierung `\s*\+ `fehlgeschlagen/.test(pta)
          || /Python-Lifecycle-Registrierung/.test(pta),
          "dann fehlt die zweite Absicherungsschicht, ohne dass es jemand merkt");
      }
    }
  }

  // ══ DIE BROKER-ZEIT IST ORTSZEIT — UMRECHNUNG GERECHNET (22.09.) ═════════
  //
  // GEMESSEN im Betrieb: updateTime="2026-09-22T19:04:06.857" bei einem Kurs,
  // der fuenf Sekunden alt war, und KEIN UTC-Feld. Als UTC gelesen lag jeder
  // Kurs zwei Stunden in der Zukunft; `ageInMinutes` klemmte das auf 0, und
  // die eingestellten 30 Minuten des Frische-Filters wirkten wie 150.
  //
  // Diese Umrechnung entscheidet jetzt mit, welcher Kurs geblockt wird und
  // wann eine Position geschlossen wird. Sie wird deshalb GERECHNET, mit genau
  // den gemessenen Zeichenketten.
  {
    const cm = ladeTsModul("lib/capital-com/capital-com-client.ts");
    const bz = cm.exports?.brokerZeitNachUtc;
    if (cm.fehler || typeof bz !== "function") {
      funde.push(`brokerZeitNachUtc nicht ausfuehrbar: ${cm.fehler ?? "nicht exportiert"}`);
      zusatz++;
    } else {
      for (const [name, ein, soll] of [
        ["die gemessene Kurszeit vom 22.09.", "2026-09-22T19:04:06.857", "2026-09-22T17:04:06.857Z"],
        ["die gemessene Positionszeit vom 22.09.", "2026-09-22T12:14:41.813", "2026-09-22T10:14:41.813Z"],
        ["Winterzeit (ab 25.10. nur noch 1 h)", "2026-11-15T12:00:00", "2026-11-15T11:00:00.000Z"],
        ["eine Zeit MIT Z bleibt unveraendert", "2026-09-22T17:04:06.857Z", "2026-09-22T17:04:06.857Z"],
        ["eine Zeit mit Versatz wird nicht doppelt gerechnet", "2026-09-22T19:04:06+02:00", "2026-09-22T17:04:06.000Z"],
        ["Leerzeichen statt T", "2026-09-22 19:04:06", "2026-09-22T17:04:06.000Z"],
        ["leer bleibt leer (nicht 'jetzt')", "", ""],
        ["Unsinn bleibt leer", "morgen frueh", ""],
        ["eine Zahl bleibt leer", 12345, ""],
      ]) {
        torPruefung(`brokerZeitNachUtc: ${name}`, bz(ein) === soll, `${JSON.stringify(ein)} -> ${JSON.stringify(bz(ein))}, erwartet ${JSON.stringify(soll)}`);
      }
      // Die Millisekunden duerfen NICHT verrutschen: `Intl` formatiert nur bis
      // zur Sekunde, und der Rest landete zuerst im Versatz (".857" wurde
      // ".571"). Gefangen vom Test, nicht vom Auge.
      torPruefung("brokerZeitNachUtc verliert Millisekunden",
        /\.857Z$/.test(bz("2026-09-22T19:04:06.857")) && /\.001Z$/.test(bz("2026-01-05T12:00:00.001")),
        `${bz("2026-09-22T19:04:06.857")} / ${bz("2026-01-05T12:00:00.001")}`);
      // Und die Umrechnung muss an ALLEN fuenf Stellen benutzt werden.
      const cq = read("frontend/lib/capital-com/capital-com-client.ts")
        .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      const felder = "updateTime|createdDate|openDate|closeDate";
      const roh = (cq.match(new RegExp(`(${felder}): String\\(`, "g")) || []).length;
      const umgerechnet = (cq.match(new RegExp(`(${felder}): brokerZeitNachUtc\\(`, "g")) || []).length;
      torPruefung("eine Broker-Zeit geht wieder ununmgerechnet durch",
        roh === 0 && umgerechnet === 7, `${roh} roh, ${umgerechnet} umgerechnet (erwartet 0 und 7)`);
      // Und keine erfundene Zeit als Rueckfall — der Klassiker "?? jetzt".
      torPruefung("eine fehlende Broker-Zeit wird wieder durch 'jetzt' ersetzt",
        !new RegExp(`(${felder}):[^\\n]*new Date\\(\\)\\.toISOString\\(\\)`).test(cq),
        "ein Trade von vorgestern saehe aus, als waere er gerade beendet worden");
      torPruefung("die Zeitzonen-Selbstpruefung ist nicht verdrahtet",
        /zeitzonenSelbstpruefung\(markets\.map\(\(m\) => m\.updateTime\)\)/.test(cq)
        && /ZEITZONE STIMMT NICHT/.test(read("frontend/lib/capital-com/capital-com-client.ts")),
        "ohne sie faellt eine falsche Zone (Winterzeit!) wieder still aus");
    }

    // Und die Gegenseite: eine Zukunft darf nicht mehr als "frisch" gelten.
    const om = ladeTsModul("lib/agents/orchestrator-agent.ts", { "broker-config": { MIN_SIGNAL_CONFIDENCE: 70 } });
    const aim = om.exports?.ageInMinutes;
    if (om.fehler || typeof aim !== "function") {
      funde.push(`ageInMinutes nicht ausfuehrbar: ${om.fehler ?? "nicht exportiert"}`);
      zusatz++;
    } else {
      const jetzt = Date.now();
      const iso = (versatzMin) => new Date(jetzt + versatzMin * 60000).toISOString();
      torPruefung("ein 45 Minuten alter Kurs wird nicht als 45 Minuten alt gemeldet",
        Math.abs((aim(iso(-45)) ?? -1) - 45) < 0.2, String(aim(iso(-45))));
      torPruefung("kleiner Uhren-Versatz (1 Min Zukunft) ergibt nicht 0",
        aim(iso(1)) === 0, String(aim(iso(1))));
      torPruefung("zwei Stunden Zukunft gelten wieder als frisch statt als UNBEKANNT",
        aim(iso(120)) === null, `${aim(iso(120))} — genau diese Klemme hat den Fehler versteckt`);
      torPruefung("unlesbare Zeit ist nicht unbekannt", aim("morgen") === null, String(aim("morgen")));
    }
  }

  // ══ DIE ZEITSTEMPEL-MESSUNG: RICHTIG GERECHNET, EINMAL, OHNE WIRKUNG ═════
  //
  // (22.09.) `createdDate` liegt nachweislich 2 h daneben. Bevor die Ursache
  // behoben wird, misst der Client einmal, welche Felder Capital.com wirklich
  // liefert. Eine Messung, die falsch rechnet, jeden Aufruf wiederholt oder
  // bei Unsinn wirft, waere schlimmer als keine.
  {
    const altZs = global.__zeitstempel_gemessen__;
    delete global.__zeitstempel_gemessen__;
    const logs = [];
    const altLog = console.log;
    console.log = (...a) => logs.push(a.join(" "));
    try {
      const c1 = ladeTsModul("lib/capital-com/capital-com-client.ts");
      const c2 = ladeTsModul("lib/capital-com/capital-com-client.ts");
      const zm1 = c1.exports?.zeitstempelMessen, zm2 = c2.exports?.zeitstempelMessen;
      if (c1.fehler || typeof zm1 !== "function" || typeof zm2 !== "function") {
        console.log = altLog;
        funde.push(`zeitstempelMessen nicht ausfuehrbar: ${c1.fehler ?? "nicht exportiert"}`);
        zusatz++;
      } else {
        // Die echten Zeiten vom 22.09.: Ortszeit ohne Zone, UTC daneben.
        zm1("positionen", { createdDate: "2026-09-22T12:14:41.813", createdDateUTC: "2026-09-22T10:14:41.813" });
        zm2("positionen", { createdDate: "2026-09-22T12:14:41.813", createdDateUTC: "2026-09-22T10:14:41.813" });
        zm1("kurse", { updateTime: "2026-09-22T12:15:00", updateTimeUTC: undefined });
        // Unsinn NACH einem Zuruecksetzen der Sperre — sonst kehrt die Funktion
        // vorher zurueck und der Test prueft gar nichts (erste Fassung: die
        // Sabotage "Fehler durchreichen" blieb gruen). Ein Wert, dessen
        // Umwandlung in Text WIRFT, ist der echte Ernstfall.
        const merk = global.__zeitstempel_gemessen__;
        delete global.__zeitstempel_gemessen__;
        let geworfen = false;
        try {
          zm1("kurse", { updateTime: { toString() { throw new Error("kaputt"); } } });
        } catch { geworfen = true; }
        global.__zeitstempel_gemessen__ = merk;
        console.log = altLog;
        const pos = logs.filter((l) => l.includes("(positionen,"));
        const kurse = logs.filter((l) => l.includes("(kurse,"));
        torPruefung("die Zeitstempel-Messung rechnet den Versatz falsch",
          pos.length >= 1 && /Versatz createdDate − createdDateUTC = 120\.0 min/.test(pos[0]),
          pos[0] ? pos[0].slice(0, 160) : "keine Ausgabe");
        torPruefung("die Zeitstempel-Messung meldet sich je Modulkopie erneut",
          pos.length === 1 && kurse.length === 1,
          `${pos.length} Positions-, ${kurse.length} Kurs-Meldungen, erwartet je 1`);
        torPruefung("ein fehlendes UTC-Feld wird nicht als FEHLT benannt",
          kurse.length === 1 && /updateTimeUTC=FEHLT/.test(kurse[0]),
          kurse[0] ? kurse[0].slice(0, 160) : "keine Ausgabe");
        torPruefung("die Zeitstempel-Messung wirft bei unsinnigen Werten", !geworfen);
      }
      const cq = read("frontend/lib/capital-com/capital-com-client.ts");
      torPruefung("die Zeitstempel-Messung ist nicht an Positionen UND Kursen angeschlossen",
        /zeitstempelMessen\("positionen", \{ createdDate: pos\.createdDate, createdDateUTC: pos\.createdDateUTC \}\)/.test(cq)
        && /zeitstempelMessen\("kurse", \{ updateTime: snap\.updateTime, updateTimeUTC: snap\.updateTimeUTC \}\)/.test(cq),
        "sonst misst sie nur eine der beiden Fragen");
    } finally {
      console.log = altLog;
      if (altZs === undefined) delete global.__zeitstempel_gemessen__; else global.__zeitstempel_gemessen__ = altZs;
    }
  }

  // ══ DIE UNBEKANNT-DIAGNOSE LIEST NUR (21.09.) ═══════════════════════════
  //
  // Sie fragt die Datenbank, warum eine Position mit `stil=UNBEKANNT`
  // nachregistriert wurde. Eine Diagnose, die dabei SCHREIBT, waere schlimmer
  // als keine: sie liefe genau dann, wenn der Zustand ohnehin unklar ist.
  {
    const iq = read("frontend/instrumentation.ts");
    const start = iq.indexOf("WARUM UNBEKANNT? DIE DATENBANK SELBST FRAGEN");
    const block = start >= 0 ? iq.slice(start, start + 3500) : "";
    torPruefung("die UNBEKANNT-Diagnose ist nicht mehr auffindbar",
      block.length > 1000, `${block.length} Zeichen`);
    if (block.length > 1000) {
      const ende = block.indexOf("} else {");
      const rumpf = ende > 0 ? block.slice(0, ende) : block;
      torPruefung("die UNBEKANNT-Diagnose schreibt in die Datenbank",
        !/\b(UPDATE|INSERT|DELETE)\b/i.test(rumpf.replace(/(^|[^:])\/\/[^\n]*/g, "$1"))
        && /SELECT id, status, strategy, notes/.test(rumpf),
        "eine Diagnose darf den Zustand, den sie untersucht, nicht veraendern");
      // Das Fenster muss am ERÖFFNEN haengen, nicht an "jetzt" (21.09.):
      // sonst verliert eine laenger laufende Position ihre urspruengliche Zeile,
      // und die Diagnose meldet genau die falsche Antwort.
      // KEIN ZEITFENSTER (22.09.): `createdDate` des Brokers liegt nachweislich
      // zwei Stunden daneben, und beide Fenster-Fassungen haben deshalb die
      // falsche Antwort geliefert. Die Diagnose darf an keiner Uhr haengen.
      torPruefung("die UNBEKANNT-Diagnose haengt wieder an einem Zeitfenster",
        /WHERE market = \$1 ORDER BY id DESC LIMIT 8/.test(rumpf)
        && !/INTERVAL/.test(rumpf.replace(/(^|[^:])\/\/[^\n]*/g, "$1")),
        "createdDate ist Ortszeit, als UTC gelesen: jedes Fenster daran schliesst die Zeilen aus");
      torPruefung("die UNBEKANNT-Diagnose laeuft bei jeder Registrierung statt nur im Fall",
        /if \(t\.tradingStyle === "UNBEKANNT"\) \{/.test(rumpf),
        "sonst eine Datenbankabfrage je Position und Neustart ohne Anlass");
    }
  }

  // ══ TAGESBILANZ: EIN ABSTURZ DARF NICHT AUS DER LISTE FALLEN (18.09.) ════
  //
  // GEFUNDEN AN DER ERSTEN ECHTEN TAGESBILANZ (17.09.): 259 Zyklen, aber die
  // sechs gezeigten Ausgaenge ergaben zusammen nur 258. Die Liste war auf
  // `.slice(0, 6)` gedeckelt — der seltenste Ausgang fiel raus. Und der
  // seltenste ist der wichtigste: ein "Absturz: …" kommt einmal vor und waere
  // genau deshalb unsichtbar gewesen.
  //
  // GERECHNET mit der echten Funktion, nicht gelesen.
  {
    const zb = ladeTsModul("lib/zyklus-bilanz/zyklus-bilanz.ts");
    const tb = zb.exports?.tagesbilanzText;
    const leer = zb.exports?.leereTagessumme;
    if (zb.fehler || typeof tb !== "function" || typeof leer !== "function") {
      funde.push(`Tagesbilanz nicht ausfuehrbar: ${zb.fehler ?? "tagesbilanzText/leereTagessumme fehlt"}`);
      zusatz++;
    } else {
      const summe = leer("2026-09-17");
      summe.zyklen = 259;
      summe.ausgaenge = {
        "Ausserhalb Handelszeit": 96, "Keine Kandidaten nach Filter": 69,
        "Keine freigegebenen Signale": 46, "Max. Positionen erreicht": 26,
        "Alle Kandidaten gescheitert": 15, "# Trade eroeffnet": 6,
        "Orchestrator-KI pausiert": 3, "Broker nicht verbunden": 2,
        "Killswitch aktiv": 1, "Absturz: Cannot read properties of undefined": 1,
      };
      const text = tb(summe);
      torPruefung("ein Absturz faellt aus der Ausgangs-Liste der Tagesbilanz",
        text.includes("Absturz: Cannot read properties of undefined"),
        "er ist selten, steht deshalb hinten — und war genau deshalb unsichtbar");
      torPruefung("ein Killswitch-Ausgang faellt aus der Liste",
        text.includes("Killswitch aktiv"));
      torPruefung("ein Absturz wird in der Tagesbilanz nicht hervorgehoben",
        /❗ Absturz/.test(text), "zwischen zehn Zeilen liest ihn sonst niemand");
      // Eigener Datensatz mit UEBERZAEHLIGEN: die erste Fassung dieser
      // Pruefung liess "keine weitere-Zeile" als gueltig durchgehen — und
      // genau das war der Sabotage-Fall. Mit zehn Ausgaengen gibt es gar keine
      // Ueberzaehligen (acht + Absturz + Killswitch), also muessen es mehr sein.
      const viele = leer("2026-09-17");
      viele.zyklen = 300;
      viele.ausgaenge = {
        A: 96, B: 69, C: 46, D: 26, E: 15, F: 6, G: 5, H: 4, I: 3, J: 2,
        "Absturz: irgendwas": 1,
      };
      const vielText = tb(viele);
      torPruefung("weggelassene Ausgaenge werden verschwiegen statt gezaehlt",
        /\(\d+ weitere Ausgaenge, \d+ Zyklen\)/.test(vielText),
        "die Summe der Zeilen muss zur Zyklenzahl fuehren");
      torPruefung("bei vielen Ausgaengen faellt der Absturz doch heraus",
        vielText.includes("Absturz: irgendwas"));
      // ── DIE RECHNUNG MUSS AUFGEHEN (20.09.) ──────────────────────────────
      //
      // GEFUNDEN AN DER TAGESBILANZ vom 18.09.: "Claude gefragt 364",
      // "Risiko-Freigabe gescheitert 200", "GO 144" — 364-200-144 = 20
      // Signale waren weder das eine noch das andere. Sie starben an der Stufe
      // `trichter.slTp` (GPT lieferte Richtung und Confidence, aber keinen
      // Stop oder kein Ziel) und hatten keine eigene Zahl. Am 17.09. ging die
      // Rechnung noch auf — die Luecke zeigt sich nur an Tagen, an denen sie
      // auftritt, und genau darum muss sie benannt sein.
      const rechnung = leer("2026-09-18");
      rechnung.zyklen = 1; rechnung.scans = 1;
      rechnung.claudeGefragt = 364; rechnung.rrAbgelehnt = 200;
      rechnung.go = 144; rechnung.ohneStopZiel = 20;
      rechnung.fehlgeschlagen = 2;
      rechnung.fehlgeschlagenGruende = { "EURUSD: MARKET_CLOSED": 1, "GBPJPY: Stop zu nah": 1 };
      const rText = tb(rechnung);
      torPruefung("die Stufe 'ohne Stop/Ziel' fehlt in der Tagesbilanz",
        /Ohne Stop oder Ziel von GPT[^\n]*: 20/.test(rText),
        "dann gehen Claude gefragt - gescheitert - GO nicht auf");
      torPruefung("die Rechnung der Tagesbilanz geht nicht auf",
        rechnung.claudeGefragt - rechnung.rrAbgelehnt - rechnung.ohneStopZiel === rechnung.go,
        `${rechnung.claudeGefragt} - ${rechnung.rrAbgelehnt} - ${rechnung.ohneStopZiel} != ${rechnung.go}`);
      torPruefung("Broker-Fehler werden wieder ohne Grund gemeldet",
        rText.includes("MARKET_CLOSED") && rText.includes("Stop zu nah"),
        "zwei gescheiterte Orders ohne Grund sind keine Meldung, sondern eine Frage");
      // DEN SUMMIERUNGSPFAD SELBST RECHNEN, nicht nur den Text. Die erste
      // Fassung baute die Tagessumme von Hand — damit blieben zwei Sabotagen
      // gruen, die das Addieren entfernten. Jetzt laeuft der echte Weg:
      // Ereignis -> Zyklus-Bilanz -> Tagessumme.
      const nb = zb.exports?.neueBilanz, bv = zb.exports?.bilanzVerbuchen, ta = zb.exports?.tagessummeAddieren;
      if (typeof nb !== "function" || typeof bv !== "function" || typeof ta !== "function") {
        funde.push("neueBilanz/bilanzVerbuchen/tagessummeAddieren nicht exportiert — "
          + "der Summierungspfad der Bilanz bliebe ungeprueft");
        zusatz++;
      } else {
        const bz = nb(0); bz.ende = 1000; bz.ausgang = "x";
        bv(bz, { type: "ANALYSIS:SCAN_DONE", payload: { scan: {
          maerkte: 30, gpt: { WAIT: 1, BUY: 2, SELL: 3 }, vetos: 0, stilVerworfen: 0,
          unterGrenze: [], go: 5, rrAbgelehnt: 4, ohneStopZiel: 7, claudeGefragt: 16,
          ohneVolleDaten: 3, ohneVolleDatenGrund: { Strategien: 2, "TA-Lib": 1 },
          regelbrueche: {}, dauerMs: {}, kontext: { news: true, mtfSymbole: 30 },
        } } });
        bv(bz, { type: "EXECUTION:TRADE_FAILED", payload: { symbol: "EURUSD", grund: "MARKET_CLOSED" } });
        bv(bz, { type: "EXECUTION:TRADE_FAILED", payload: { symbol: "GBPJPY", grund: "MARKET_CLOSED" } });
        const s1 = ta(null, bz, "2026-09-20");
        const s2 = ta(s1, bz, "2026-09-20");
        torPruefung("die Stufe 'ohne Stop/Ziel' wird nicht in die Tagessumme addiert",
          s1.ohneStopZiel === 7 && s2.ohneStopZiel === 14, `${s1.ohneStopZiel} / ${s2.ohneStopZiel}`);
        torPruefung("die Rechnung der Tagessumme geht nicht auf",
          s1.claudeGefragt - s1.rrAbgelehnt - s1.ohneStopZiel === s1.go,
          `${s1.claudeGefragt} - ${s1.rrAbgelehnt} - ${s1.ohneStopZiel} != ${s1.go}`);
        const gr = s2.fehlgeschlagenGruende ?? {};
        torPruefung("Broker-Fehler-Gruende landen nicht in der Tagessumme",
          Object.values(gr).reduce((a, b2) => a + b2, 0) === 4 && Object.keys(gr).length === 2,
          JSON.stringify(gr));
        // ── DIE STUFE VOR ALLEN ANDEREN (22.09.) ──────────────────────────
        //
        // Sie muss durch denselben Pfad laufen wie der Rest: Ereignis ->
        // Zyklus-Bilanz -> Tagessumme. Ein Feld, das nur im Typ steht, aber
        // nicht addiert wird, meldet nach zwoelf Zyklen immer noch den Wert
        // des ersten.
        torPruefung("'ohne volle Daten' wird nicht in die Tagessumme addiert",
          s1.ohneVolleDaten === 3 && s2.ohneVolleDaten === 6,
          `${s1.ohneVolleDaten} / ${s2.ohneVolleDaten}`);
        const vd = s2.ohneVolleDatenGrund ?? {};
        torPruefung("der GRUND des Datenausfalls landet nicht in der Tagessumme",
          vd.Strategien === 4 && vd["TA-Lib"] === 2,
          JSON.stringify(vd));
      }
      // ── DER ZYKLUS VOM 22.09. 21:17, NACHGERECHNET ───────────────────────
      //
      // Echte Zahlen aus dem Railway-Log: das Strategien-Backend gab 502,
      // `fetchStrategySignals` lieferte eine leere Map, `strategienOk` fiel
      // fuer alle 30 Maerkte. GPT hatte acht Richtungssignale (5 BUY, 3
      // SELL), es folgten exakt acht 🔒-Zeilen, GO war 0.
      //
      // Die Bilanzzeile meldete davon NICHTS: 8 - 0 Veto - 2 <Grenze - 0
      // Freigabe-Nein - 0 ohne Stop/Ziel - 0 GO = SECHS Signale ohne jede
      // Erklaerung. Genau das darf nicht wiederkommen.
      const bzF = zb.exports?.bilanzZeile;
      if (typeof bzF !== "function") {
        funde.push("bilanzZeile nicht exportiert — die Zyklus-Zeile bliebe ungeprueft");
        zusatz++;
      } else {
        const live = {
          start: 0, ende: 100000, ausgang: "Keine freigegebenen Signale",
          scan: {
            maerkte: 30, gpt: { WAIT: 22, BUY: 5, SELL: 3 }, vetos: 0, stilVerworfen: 0,
            unterGrenze: [65, 68], go: 0, rrAbgelehnt: 0, ohneStopZiel: 0,
            ohneVolleDaten: 8, ohneVolleDatenGrund: { Strategien: 8 },
            claudeGefragt: 6, regelbrueche: {}, dauerMs: {},
            kontext: { news: true, mtfSymbole: 30 },
          },
          tore: [], trades: [], fehlgeschlagen: [],
        };
        const lz = bzF(live);
        torPruefung("der Datenausfall fehlt wieder in der Zyklus-Zeile",
          /ohne Daten 8/.test(lz), lz.slice(0, 200));
        torPruefung("die Zyklus-Zeile nennt den ausgefallenen Dienst nicht",
          /ohne Daten 8 \(Strategien 8\)/.test(lz),
          "ohne ihn weiss niemand, ob TA-Lib oder die Strategien weg waren");
        // Jetzt geht die Rechnung auf: 8 = 0 Veto + 8 ohne Daten.
        const s = live.scan;
        const richtung = s.gpt.BUY + s.gpt.SELL;
        torPruefung("die Rechnung des Zyklus geht nicht auf",
          richtung - s.vetos - s.stilVerworfen - s.ohneVolleDaten
            - s.rrAbgelehnt - s.ohneStopZiel - s.go === 0,
          `${richtung} Richtungssignale, ${s.ohneVolleDaten} ohne Daten`);
        // Die Gegenprobe: ohne Ausfall darf die Zeile nicht laenger werden.
        const sauber = JSON.parse(JSON.stringify(live));
        sauber.scan.ohneVolleDaten = 0; sauber.scan.ohneVolleDatenGrund = {};
        torPruefung("die Zeile traegt 'ohne Daten 0' mit, wenn nichts ausgefallen ist",
          !/ohne Daten/.test(bzF(sauber)), bzF(sauber).slice(0, 160));
        // Und der Grund darf die Zeile nicht sprengen, wenn er fehlt.
        const ohneGrund = JSON.parse(JSON.stringify(live));
        delete ohneGrund.scan.ohneVolleDatenGrund;
        const og = bzF(ohneGrund);
        torPruefung("eine Bilanz ohne Grund-Feld laesst die Zyklus-Zeile platzen",
          /ohne Daten 8/.test(og) && !og.includes("undefined") && !og.includes("NaN"),
          og.slice(0, 160));
      }
      // Und dasselbe im Telegram-Text, den du abends liest.
      const ausfall = leer("2026-09-22");
      ausfall.zyklen = 12; ausfall.scans = 12;
      ausfall.gpt = { WAIT: 264, BUY: 60, SELL: 36 };
      ausfall.ohneVolleDaten = 96; ausfall.ohneVolleDatenGrund = { Strategien: 96 };
      const aText = tb(ausfall);
      torPruefung("die Tagesbilanz verschweigt einen Backend-Ausfall",
        /Ohne vollständige Daten[^\n]*: 96/.test(aText),
        "sonst liest sich ein toter Dienst wie 'die KI wollte nicht'");
      torPruefung("die Tagesbilanz nennt den ausgefallenen Dienst nicht",
        /Ohne vollständige Daten[^\n]*96 — Strategien 96/.test(aText),
        aText.split("\n").find((l) => l.includes("vollständige")) ?? "(Zeile fehlt)");

      // Eine Tagessumme von GESTERN kennt die neuen Felder nicht.
      const alt = leer("2026-09-18");
      delete alt.ohneStopZiel; delete alt.fehlgeschlagenGruende;
      delete alt.ohneVolleDaten; delete alt.ohneVolleDatenGrund;
      alt.zyklen = 1; alt.scans = 1;
      let altText = "";
      try { altText = tb(alt); } catch (e) { altText = `ABSTURZ: ${e.message}`; }
      torPruefung("eine alte Tagessumme ohne die neuen Felder laesst die Bilanz platzen",
        !altText.startsWith("ABSTURZ") && !altText.includes("NaN") && !altText.includes("undefined"),
        altText.slice(0, 120));

      // ── ZAHL UND 🔒-ZEILE DUERFEN NICHT AUSEINANDERLAUFEN (22.09.) ──────
      //
      // Die Bilanz-Zahl ist nur so viel wert, wie sie mit dem Log
      // uebereinstimmt. Beide entstehen deshalb im SELBEN `if`. Geprueft wird
      // das per Klammerzaehlung, nicht per Zeichen-Fenster: ein Fenster
      // beweist nur Naehe, nicht Zugehoerigkeit (nachgewiesen am selben Tag
      // in prompt-zahlen.js).
      {
        const engineQuell = read("frontend/lib/market-scanner/ai-analysis-engine.ts")
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        // Der Fehlschlag wird BENANNT statt verschluckt. Erste Fassung hatte
        // hier ein nacktes `catch {}` — und weil `objectBlock` oben nicht
        // importiert war, wurde der ReferenceError zum Befund "der Zaehler
        // steht nicht im selben Zweig". Der Pruefer war rot, der Code aber
        // richtig. Ein Pruefer, der aus dem falschen Grund rot wird, schickt
        // die Suche genauso in die Irre wie einer, der gruen bleibt.
        let block = "", warum = "";
        try {
          block = objectBlock(engineQuell, "if (!hasFullData && isRealAnalysis && gpt.direction !== \"WAIT\")");
        } catch (e) { warum = ` [Pruefer selbst: ${e.message}]`; }
        torPruefung("der Zaehler steht nicht im selben Zweig wie die 🔒-Zeile",
          block !== "" && /ohneVolleDatenZahl\+\+/.test(block) && /🔒/.test(block),
          `sonst meldet das Log acht und die Bilanz etwas anderes${warum}`);
        torPruefung("der GRUND wird nicht im selben Zweig bestimmt",
          block !== "" && /ohneVolleDatenGruende\[grund\]/.test(block),
          `er muss aus demselben \`ta\`/\`strategienOk\` stammen wie die Zeile${warum}`);
        // Und er muss wirklich in die Bilanz wandern — ein Zaehler, den
        // niemand liest, ist keine Messung (CLAUDE.md, 17.09.).
        torPruefung("der Zaehler erreicht die Zyklus-Bilanz nicht",
          /ohneVolleDaten: ohneVolleDatenZahl/.test(engineQuell)
          && /ohneVolleDatenGrund: ohneVolleDatenGruende/.test(engineQuell),
          "ScanDaten muss ihn tragen, sonst bleibt die Tagesbilanz stumm");

        // ── DER GRUND DES AUSFALLS MUSS GEMESSEN WERDEN (22.09.) ──────────
        //
        // Am 22.09. 21:17 stand im Log nur "502 Bad Gateway" — der
        // Antwortkoerper, in dem Railway bzw. FastAPI den Grund nennt, wurde
        // weggeworfen. Damit war die Ursache aus unseren Logs NICHT zu
        // bestimmen. `callClaude` macht es seit jeher richtig.
        //
        // NUR IN DIESER FUNKTION SUCHEN. Die erste Fassung prueft die ganze
        // Datei auf `res.text().catch` — und blieb im Sabotage-Lauf GRUEN,
        // obwohl der Aufruf hier entfernt war: gefunden wurde der von
        // `callClaude`, 1500 Zeilen weiter oben. Exakt die Fehlerklasse aus
        // CLAUDE.md ("ein Wort im Kommentar ist keine Verwendung"), hier in
        // der Spielart "eine ANDERE Aufrufstelle".
        let strategienBlock = "", warumS = "";
        try {
          strategienBlock = objectBlock(engineQuell, "async function fetchStrategySignals");
        } catch (e) { warumS = ` [Pruefer selbst: ${e.message}]`; }
        torPruefung("der Antwortkoerper des Strategien-Backends wird wieder weggeworfen",
          strategienBlock !== "" && /res\.text\(\)\.catch/.test(strategienBlock)
          && /leerer Antwortkoerper/.test(strategienBlock),
          `ohne ihn bleibt jeder kuenftige Ausfall unerklaert${warumS}`);
        // Und die Folge gehoert in die Meldung: eine leere Map heisst, dass
        // JEDES Symbol den Strategie-Konsens verliert.
        torPruefung("die Ausfall-Meldung nennt die Folge nicht",
          strategienBlock !== "" && /dieser Zyklus handelt NICHT/.test(strategienBlock),
          `ein 502 kostet alle 30 Maerkte, nicht nur eines${warumS}`);
      }

      // ── TELEGRAM-ZEITEN, GERECHNET IN EINEM UTC-PROZESS (27.09.) ────────
      //
      // ANLASS: auf `/status` antwortete der Bot mit „27.9.2026, 12:48:11" —
      // Telegram zeigte dieselbe Nachricht um 14:48. Zwei Stunden, genau der
      // Sommerzeit-Versatz. `toLocaleString("de-CH")` ohne `timeZone`
      // formatiert in der Zeitzone des PROZESSES, und auf Railway ist das UTC.
      // Vier Stellen gaben die Zone mit, dreizehn nicht — zwei verschiedene
      // Zeiten fuer denselben Moment, im selben Chat.
      //
      // WARUM EIN KINDPROZESS. Auf einem Rechner, der ohnehin in Zuerich
      // steht, liefern beide Formen dasselbe. Ein Test im laufenden Prozess
      // waere also gruen, egal ob die Zone mitgegeben wird — ein Pruefer, der
      // den echten Fehler gar nicht ausdruecken kann. Deshalb laeuft die
      // Rechnung mit TZ=UTC in einem eigenen Prozess.
      {
        const kind = `
          const { ladeTsModul } = require(${JSON.stringify(path.join(ROOT, "scripts", "checks", "_lib.js"))});
          const m = ladeTsModul("lib/telegram-notifications/telegram-sender.ts");
          const z = m.exports && m.exports.telegramZeit;
          const d = m.exports && m.exports.telegramDatum;
          console.log(JSON.stringify({
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            fehler: m.fehler || null,
            sommer: typeof z === "function" ? z(new Date("2026-09-27T12:48:11Z")) : null,
            winter: typeof z === "function" ? z(new Date("2026-12-01T12:48:11Z")) : null,
            datum:  typeof d === "function" ? d(new Date("2026-09-27T22:30:00Z")) : null,
          }));
        `;
        let r = null, warumT = "";
        try {
          const aus = execFileSync(process.execPath, ["-e", kind], {
            env: { ...process.env, TZ: "UTC" }, encoding: "utf8", cwd: ROOT,
          });
          r = JSON.parse(aus.trim().split("\n").pop());
        } catch (e) { warumT = ` [Pruefstand: ${String(e.message).slice(0, 120)}]`; }

        torPruefung("der Zeit-Pruefstand laeuft nicht in UTC — er koennte den Fehler gar nicht sehen",
          r !== null && r.tz === "UTC", `${r ? r.tz : "kein Ergebnis"}${warumT}`);
        torPruefung("telegramZeit gibt im Sommer die UTC-Zeit statt der Zuericher aus",
          r !== null && r.sommer === "27.9.2026, 14:48:11 MESZ",
          `${r ? r.sommer : "—"} (erwartet 14:48:11 MESZ; 12:48 waere genau der Fehler vom 27.09.)`);
        torPruefung("die Winterzeit wird nicht mitgezogen",
          r !== null && r.winter === "1.12.2026, 13:48:11 MEZ",
          `${r ? r.winter : "—"} (ab 25.10. ist der Versatz 1 h, nicht 2)`);
        // Ein reines Datum ohne Zone kippt am Abend auf den falschen Tag —
        // 22:30 UTC ist in Zuerich schon der naechste.
        torPruefung("ein Tagesdatum kippt am Abend auf den falschen Tag",
          r !== null && r.datum === "28.9.2026",
          `${r ? r.datum : "—"} (22:30 UTC ist in Zuerich der 28.)`);

        // ── EIN ALARMSYSTEM, DESSEN AUSFALL SELBST NICHT ALARMIERT (25.10.) ─
        //
        // `sendTelegram` gibt `Promise<boolean>` zurueck — und der Wert wurde
        // an KEINER der elf Aufrufstellen ausgewertet (nachgezaehlt). Dazu
        // hatte die Funktion DREI stille Ausgaenge: nicht konfiguriert,
        // Telegram lehnt ab, Netzfehler. Keiner schrieb eine Zeile.
        //
        // Daran haengen ZEHN Module — Watchdog, KI-Tor-Alarm, Diagnose-Agent,
        // Risiko- und Orchestrator-Agent, Tagesbilanz. Fehlt
        // TELEGRAM_BOT_TOKEN in Railway, kehrt jeder Alarm wortlos zurueck.
        //
        // RECHNEND: eine Drossel haengt an Zustand und Zeit, nicht am Wortlaut.
        {
          const ts = ladeTsModul("lib/telegram-notifications/telegram-sender.ts");
          const f = ts.exports?.telegramFehlerMelden;
          const ABSTAND = ts.exports?.TELEGRAM_MELDE_ABSTAND_MS;
          if (ts.fehler || typeof f !== "function") {
            funde.push(`telegramFehlerMelden nicht ausfuehrbar: ${ts.fehler ?? "nicht exportiert"}`);
            zusatz++;
          } else {
            const alt = global.__telegram_lage__;
            try {
              torPruefung("der Telegram-Meldeabstand ist keine halbe Stunde",
                ABSTAND === 30 * 60 * 1000, String(ABSTAND));

              delete global.__telegram_lage__;
              const m1 = f("nicht-konfiguriert", "", 1e6);
              torPruefung("ein fehlender Telegram-Token wird verschwiegen",
                typeof m1 === "string" && /TELEGRAM_BOT_TOKEN/.test(m1), String(m1));
              torPruefung("die Meldung sagt nicht, dass KEIN Alarm mehr ankommt",
                typeof m1 === "string" && /Killswitch/.test(m1), String(m1));

              const m2 = f("nicht-konfiguriert", "", 1e6 + 60_000);
              torPruefung("jeder Alarmversuch erzeugt eine eigene Zeile — Rauschen",
                m2 === null, String(m2));
              const m3 = f("nicht-konfiguriert", "", 1e6 + ABSTAND);
              torPruefung("ein dauerhaft toter Kanal verstummt nach der ersten Meldung",
                typeof m3 === "string" && /seit 30 Min/.test(m3), String(m3));

              // Der GRUND von Telegram gehoert in die Zeile.
              delete global.__telegram_lage__;
              const m4 = f("abgelehnt", "400 chat not found", 2e6);
              torPruefung("Telegrams eigener Fehlergrund wird verworfen",
                typeof m4 === "string" && /chat not found/.test(m4), String(m4));
              delete global.__telegram_lage__;
              const m5 = f("netzfehler", "ETIMEDOUT", 2e6);
              torPruefung("ein Netzfehler wird nicht als solcher benannt",
                typeof m5 === "string" && /Netzfehler/.test(m5) && /ETIMEDOUT/.test(m5), String(m5));
              delete global.__telegram_lage__;
              const m6 = f("abgelehnt", "", 2e6);
              torPruefung("eine Ablehnung ohne Grund laesst die Stelle leer",
                typeof m6 === "string" && /ohne Grund/.test(m6), String(m6));

              // Rueckkehr melden, gesunder Dauerzustand schweigen.
              const m7 = f("ok", "", 2e6 + 1000);
              torPruefung("die Rueckkehr des Kanals wird nicht gemeldet",
                typeof m7 === "string" && /geht wieder/.test(m7), String(m7));
              const m8 = f("ok", "", 2e6 + ABSTAND * 3);
              torPruefung("ein gesunder Kanal erzeugt Rauschen", m8 === null, String(m8));
            } finally {
              if (alt === undefined) delete global.__telegram_lage__;
              else global.__telegram_lage__ = alt;
            }
          }

          // Und die Verdrahtung: alle drei Ausgaenge muessen fragen.
          const tsQ = read("frontend/lib/telegram-notifications/telegram-sender.ts")
            .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
          torPruefung("der Ausgang 'nicht konfiguriert' schweigt wieder",
            /isTelegramConfigured\(\)\) \{[\s\S]{0,200}?telegramFehlerMelden\("nicht-konfiguriert"/.test(tsQ),
            "ohne Token kommt KEIN Alarm an — und niemand erfaehrt es");
          torPruefung("eine Ablehnung durch Telegram schweigt wieder",
            /telegramFehlerMelden\("abgelehnt"/.test(tsQ));
          torPruefung("ein Netzfehler schweigt wieder",
            /telegramFehlerMelden\("netzfehler"/.test(tsQ));
          torPruefung("Telegrams description wird nicht mehr gelesen",
            /data\.description/.test(tsQ),
            "dort steht der Grund, z.B. 'chat not found'");
          torPruefung("der Erfolgsfall meldet die Rueckkehr nicht",
            /telegramFehlerMelden\("ok"/.test(tsQ));
          // Die Meldung MUSS in die Konsole — der Telegram-Kanal ist ja der
          // defekte. Ein Alarm ueber den kaputten Kanal waere sinnlos.
          //
          // GEZAEHLT, nicht gefunden (25.10.): die erste Fassung prueffte nur,
          // ob `console.error(m)` IRGENDWO steht. Im Sabotage-Lauf wurde
          // genau EINER der drei Ausgaenge stumm gemacht — die anderen zwei
          // liessen den Ausdruck weiter zutreffen, und der Pruefer blieb
          // gruen. Dasselbe Muster wie "ein Wort im Kommentar ist keine
          // Verwendung": ein Treffer beweist nichts ueber die anderen Stellen.
          const fehlerAusgaben = (tsQ.match(/console\.error\(m\)/g) ?? []).length;
          torPruefung("nicht mehr alle drei Fehler-Ausgaenge melden ins Log",
            fehlerAusgaben === 3,
            `${fehlerAusgaben} von 3 (nicht-konfiguriert, abgelehnt, netzfehler) — `
            + "die Meldung gehoert ins Railway-Log, nicht nach Telegram");
          torPruefung("der Erfolgsfall schreibt keine Zeile ins Log",
            (tsQ.match(/console\.log\(m\)/g) ?? []).length === 1,
            "die Rueckkehr des Kanals gehoert gemeldet");
        }

        // ── DREI NEUE GETEILTE ZUSTAENDE — ZWEI INSTANZEN (25.10.) ────────
        //
        // CLAUDE.md: "Wer einen neuen geteilten Zustand baut, prueft ihn
        // genauso — eine Struktur-Pruefung sieht diesen Fehler nicht."
        //
        // Am 25.10. kamen DREI dazu (Journal-Sync, Keep-Alive, Alarmkanal),
        // und beim Bauen wurde diese Regel dreimal uebergangen: dass sie
        // `global.` benutzen, steht im Quelltext — ob der Zustand zwischen
        // zwei MODULKOPIEN wirklich geteilt wird, sieht man dort NICHT.
        //
        // Warum es hier zaehlt: die Schleifen laufen aus `instrumentation.ts`,
        // die Routen in `app/api` sehen eine ANDERE Kopie. Waere der Zustand
        // modul-scoped, drosselte jede Kopie fuer sich — statt einer Zeile
        // alle 30 Minuten kaemen zwei, und bei einem Dauerausfall waere das
        // Log wieder zugemuellt. Genau diese Luecke hat am 28.07. den
        // Killswitch ausgehebelt und am 26.08. den Preis-Cache.
        {
          const FAELLE = [
            ["lib/capital-com/capital-trade-tracker.ts", "syncAussetzerMelden",
             "__journal_sync_lage__", (f, t) => f("keine-sitzung", "", t)],
            ["lib/capital-com/capital-com-session.ts", "reconnectMelden",
             "__capital_reconnect_lage__", (f, t) => f(false, "HTTP 401", t)],
            ["lib/telegram-notifications/telegram-sender.ts", "telegramFehlerMelden",
             "__telegram_lage__", (f, t) => f("nicht-konfiguriert", "", t)],
          ];
          for (const [modul, fn, schluessel, ruf] of FAELLE) {
            const alt = global[schluessel];
            try {
              delete global[schluessel];
              const A = ladeTsModul(modul);
              const B = ladeTsModul(modul);
              const fA = A.exports?.[fn];
              const fB = B.exports?.[fn];
              if (A.fehler || B.fehler || typeof fA !== "function" || typeof fB !== "function") {
                funde.push(`${fn} nicht zweimal ladbar: ${A.fehler ?? B.fehler ?? "nicht exportiert"}`);
                zusatz++;
                continue;
              }
              torPruefung(`${fn}: die zwei Modulkopien sind identisch — der Test prueft nichts`,
                fA !== fB);
              const T = 5e6;
              const erste = ruf(fA, T);
              torPruefung(`${fn}: Kopie A meldet den ersten Aussetzer nicht`,
                typeof erste === "string", String(erste).slice(0, 60));
              // DER KERN: Kopie B darf eine Minute spaeter NICHT erneut melden.
              const zweite = ruf(fB, T + 60_000);
              torPruefung(`${fn}: der Zustand ist NICHT zwischen Modulkopien geteilt `
                + `(global.${schluessel}) — jede Kopie drosselt fuer sich`,
                zweite === null, String(zweite).slice(0, 70));
              // Gegenprobe: nach der Drosselzeit meldet auch B wieder.
              const dritte = ruf(fB, T + 30 * 60 * 1000);
              torPruefung(`${fn}: nach der Drosselzeit schweigt auch Kopie B`,
                typeof dritte === "string", String(dritte).slice(0, 60));
              torPruefung(`${fn}: der Zustand steht nicht auf globalThis`,
                global[schluessel] !== undefined);
            } finally {
              if (alt === undefined) delete global[schluessel];
              else global[schluessel] = alt;
            }
          }
        }

        // ── DIE ✅-ZEILE DARF KEINEN ZUSTAND BEHAUPTEN (25.10.) ───────────
        //
        // `keepAliveICMarkets` meldete `keep-alive ✅` AUSSERHALB der
        // Bedingung `if (global.__icmarkets_session__)`. Ist die Sitzung null
        // — etwa nach /killswitch, der den Redis-Token loescht —, wird nichts
        // aktualisiert, und trotzdem stand alle zwei Minuten ✅ im Log,
        // waehrend die Anwendung IC als GETRENNT fuehrt. Seit dem 27.09. als
        // offener Punkt notiert.
        //
        // Dieselbe Fehlerklasse wie die zwei falschen Killswitch-Texte: eine
        // Meldung, die etwas behauptet, das der Code nicht tut.
        {
          const icQ = read("frontend/lib/icmarkets/icmarkets-session.ts")
            .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
          const rumpfIC = objectBlock(icQ, "export async function keepAliveICMarkets");
          torPruefung("keepAliveICMarkets ist nicht auffindbar",
            typeof rumpfIC === "string" && rumpfIC.length > 100);
          if (rumpfIC) {
            // Die ✅-Zeile MUSS innerhalb des Sitzungs-Zweigs stehen.
            const iBedingung = rumpfIC.indexOf("if (global.__icmarkets_session__)");
            const iErfolg = rumpfIC.indexOf("keep-alive ✅");
            const iSonst = rumpfIC.indexOf("} else {", iBedingung);
            torPruefung("die keep-alive-✅-Zeile steht ausserhalb des Sitzungs-Zweigs — "
              + "sie behauptet eine Verbindung, die es nicht gibt",
              iBedingung >= 0 && iErfolg > iBedingung && iSonst > iErfolg,
              `bedingung@${iBedingung} erfolg@${iErfolg} else@${iSonst}`);
            torPruefung("der Fall ohne Sitzung wird verschwiegen",
              /KEINE Sitzung/.test(rumpfIC),
              "sonst ist 'erreichbar' von 'verbunden' nicht zu unterscheiden");
            torPruefung("der keep-alive verschluckt seine Fehler wieder still",
              !/\} catch \{\s*\}/.test(rumpfIC) && /keep-alive fehlgeschlagen/.test(rumpfIC),
              "dieselbe Klasse wie Journal-Sync und Capital-Reconnect");
          }
        }

        // ── DER ERWARTUNGSWERT — GERECHNET (26.10.) ───────────────────────
        //
        // Die Zahl, die sagt, ob das System einen Edge hat. Sie entscheidet
        // spaeter ueber Stop und Ziel, also wird sie AUSGEFUEHRT geprueft:
        // ein vertauschtes Vorzeichen oder ein vergessener Ausschluss waere
        // strukturell voellig unauffaellig.
        //
        // Besonders wichtig: die Zeilen mit `KEIN_PNL`/`NIE_BESTAETIGT`
        // muessen DRAUSSEN bleiben. Seit dem 30.09. ist belegt, dass ein
        // Trade zwei Journal-Zeilen erzeugen konnte — eine davon mit P&L 0.
        // Rechnet man die mit, ist jede Trefferquote verduennt.
        {
          // Die ECHTE Etiketten-Liste durchreichen, keine Kopie: sonst
          // pruefte der Test gegen seine eigene Annahme, und eine Aenderung
          // an `ETIKETTEN_OHNE_ERGEBNIS` bliebe hier gruen.
          const trEtik = ladeTsModul("lib/capital-com/capital-trade-tracker.ts");
          const ew = trEtik.fehler ? trEtik : ladeTsModul("lib/expectancy/erwartungswert.ts", {
            "capital-trade-tracker": trEtik.exports,
          });
          const f = ew.exports?.erwartungswert;
          const txt = ew.exports?.erwartungswertText;
          const MIN = ew.exports?.MIN_TRADES;
          if (ew.fehler || typeof f !== "function" || typeof txt !== "function") {
            funde.push(`erwartungswert nicht ausfuehrbar: ${ew.fehler ?? "nicht exportiert"}`);
            zusatz++;
          } else {
            const z = (pnl, extra = {}) => ({ profitLoss: pnl, notes: JSON.stringify(extra) });
            const viele = (n, pnl, extra = {}) => Array.from({ length: n }, () => z(pnl, extra));

            torPruefung("die Mindestzahl fuer eine belastbare Rechnung ist unter 30",
              MIN >= 30, String(MIN));

            // Zu wenig Trades -> KEIN erfundener Wert.
            const wenig = f(viele(10, 5));
            torPruefung("bei zu wenigen Trades wird trotzdem ein Erwartungswert ausgegeben",
              wenig.belastbar === false && wenig.erwartungswert === null,
              JSON.stringify({ b: wenig.belastbar, ew: wenig.erwartungswert }));
            torPruefung("und der Grund dafuer fehlt",
              /unter 30|Ausreisser/.test(String(wenig.grund)), String(wenig.grund));

            // DER KERN: KEIN_PNL darf nicht mitgerechnet werden.
            const mitEtiketten = f([
              ...viele(30, 10),
              ...viele(20, 0, { exitReason: "KEIN_PNL" }),
              ...viele(5, 0, { exitReason: "NIE_BESTAETIGT" }),
            ]);
            torPruefung("Zeilen mit KEIN_PNL/NIE_BESTAETIGT werden mitgerechnet — "
              + "jede Trefferquote waere verduennt",
              mitEtiketten.gewertet === 30 && mitEtiketten.ohneErgebnis === 25,
              `gewertet=${mitEtiketten.gewertet} ohneErgebnis=${mitEtiketten.ohneErgebnis}`);
            torPruefung("eine reine Gewinnserie ergibt keine 100 % Trefferquote",
              mitEtiketten.trefferquote === 100, String(mitEtiketten.trefferquote));

            // Die Rechnung selbst — nachgerechnet von Hand.
            // 21 Gewinne a 40, 9 Verluste a -120:
            //   Treffer 70 %, EW = 0,7*40 - 0,3*120 = 28 - 36 = -8
            const negativ = f([...viele(21, 40), ...viele(9, -120)]);
            torPruefung("der Erwartungswert wird falsch gerechnet (erwartet -8)",
              negativ.erwartungswert === -8,
              `${negativ.erwartungswert} bei ${negativ.trefferquote}% / `
              + `${negativ.avgGewinn} / ${negativ.avgVerlust}`);
            torPruefung("eine hohe Trefferquote mit negativem EW wird als Edge ausgegeben",
              negativ.trefferquote === 70 && negativ.erwartungswert < 0,
              "70 % Treffer und trotzdem kein Edge — genau der Fall, um den es geht");
            torPruefung("das R/R wird falsch gerechnet (erwartet 0.33)",
              negativ.rr === 0.33, String(negativ.rr));
            // Breakeven-Quote: 120/(40+120) = 75 %
            torPruefung("die noetige Trefferquote wird falsch gerechnet (erwartet 75)",
              negativ.breakevenQuote === 75, String(negativ.breakevenQuote));

            // Ein positiver Fall: 12 a 100, 18 a -40
            //   Treffer 40 %, EW = 0,4*100 - 0,6*40 = 40 - 24 = +16
            const positiv = f([...viele(12, 100), ...viele(18, -40)]);
            torPruefung("ein positiver Erwartungswert wird nicht erkannt (erwartet +16)",
              positiv.erwartungswert === 16 && positiv.trefferquote === 40,
              `${positiv.erwartungswert} bei ${positiv.trefferquote}%`);

            // Spread-Verluste sind echte Verluste, kein Breakeven (09.08.).
            const spread = f([...viele(20, 5), ...viele(10, -0.5)]);
            torPruefung("ein Spread-Verlust gilt faelschlich als Breakeven",
              spread.losses === 10 && spread.breakeven === 0,
              `L=${spread.losses} BE=${spread.breakeven}`);

            // ── BREAKEVEN: der Fall, den KEIN Testfall oben hatte (26.10.) ──
            //
            // Alle Faelle darueber haben W+L = n, also NULL Breakeven. Genau
            // dann ist `1 - Trefferquote` zufaellig gleich der echten
            // Verlustquote — und die FALSCHE Formel liefert das richtige
            // Ergebnis. So blieb der Fehler fuer einen rechnenden Pruefer
            // unsichtbar, bis der erste Live-Lauf ihn zeigte.
            //
            // Hier kippt er das VORZEICHEN: 10x +100, 10x -50, 30x 0.
            //   richtig: Summe 500 / 50 Trades      = +10  -> Edge
            //   falsch : 0,2*100 - 0,8*50 = 20 - 40 = -20  -> kein Edge
            const zr = (pnl, result, extra = {}) =>
              ({ profitLoss: pnl, notes: JSON.stringify(extra), result });
            const vieleR = (n, pnl, result, extra = {}) =>
              Array.from({ length: n }, () => zr(pnl, result, extra));

            const mitBe = f([
              ...viele(10, 100), ...viele(10, -50),
              ...vieleR(30, 0, "BREAKEVEN"),
            ]);
            torPruefung("ein Breakeven-Trade bekommt einen vollen Ø Verlust "
              + "aufgebuerdet (erwartet +10, die alte Formel ergab -20)",
              mitBe.erwartungswert === 10,
              `${mitBe.erwartungswert} bei ${mitBe.wins}W/${mitBe.losses}L/`
              + `${mitBe.breakeven}BE`);
            torPruefung("der Erwartungswert deckt sich nicht mit der Summe, "
              + "die dieselbe Antwort ausweist",
              Math.abs(mitBe.erwartungswert * mitBe.gewertet - mitBe.summePnl) <= 0.5,
              `EW*n=${(mitBe.erwartungswert * mitBe.gewertet).toFixed(2)} `
              + `Summe=${mitBe.summePnl}`);
            torPruefung("ein profitables System wird als 'kein Edge' gemeldet",
              mitBe.erwartungswert > 0, String(mitBe.erwartungswert));
            torPruefung("die echte Verlustquote fehlt (sie ist NICHT 1-Treffer)",
              mitBe.verlustquote === 20 && mitBe.trefferquote === 20,
              `v=${mitBe.verlustquote} t=${mitBe.trefferquote}`);
            torPruefung("die Trefferquote der ENTSCHIEDENEN fehlt — ohne sie "
              + "wird gegen die noetige Quote mit falschem Nenner verglichen",
              mitBe.trefferquoteEntschieden === 50 && mitBe.entschieden === 20,
              `${mitBe.trefferquoteEntschieden} % von ${mitBe.entschieden}`);
            torPruefung("der Erwartungswert ohne die Breakeven fehlt",
              mitBe.erwartungswertEntschieden === 25,
              String(mitBe.erwartungswertEntschieden));
            torPruefung("der Breakeven-Anteil wird nicht ausgewiesen",
              mitBe.breakevenAnteil === 60, String(mitBe.breakevenAnteil));

            // Die ECHTE Datenlage vom 26.10., 20:59 — nachgerechnet.
            // 101 Gewinne a 11.47, 196 Verluste a -15.21, 517 Breakeven.
            // Die Live-Antwort meldete -11.9 bei einer Summe von -1822.39.
            // Die 33 rekonstruierten sind ein TEIL der 101 Gewinner, keine
            // zusaetzlichen Zeilen — sonst waere es nicht die echte Lage.
            const live = f([
              ...viele(68, 11.47), ...viele(33, 11.47, { rekonstruiert: true }),
              ...viele(196, -15.21),
              ...vieleR(400, 0, "BREAKEVEN"), ...vieleR(117, 0, "OPEN"),
              ...viele(31, 0, { exitReason: "KEIN_PNL" }),
            ]);
            torPruefung("die nachgebaute Live-Lage trifft die Antwort vom "
              + "26.10. nicht mehr (845 Zeilen, 814 gewertet, 33 rekonstruiert)",
              live.gesamt === 845 && live.gewertet === 814
              && live.ohneErgebnis === 31 && live.rekonstruiert === 33
              && live.wins === 101 && live.losses === 196 && live.breakeven === 517,
              `${live.gesamt}/${live.gewertet}/${live.wins}W${live.losses}L`
              + `${live.breakeven}BE`);
            torPruefung("die Live-Datenlage vom 26.10. ergibt wieder den "
              + "Faktor-5-Fehler (erwartet -2.24, gemeldet wurde -11.9)",
              live.erwartungswert === -2.24,
              `${live.erwartungswert} bei ${live.gewertet} gewerteten`);
            torPruefung("die Summenprobe steht nicht in der Antwort — genau "
              + "sie haette den Widerspruch am 26.10. sofort gezeigt",
              /Summenprobe/.test(txt(live)), txt(live).slice(0, 60));
            torPruefung("die Herkunft der Breakeven-Zeilen fehlt — ein nie "
              + "geschriebener P&L sieht wegen @default(0) aus wie Breakeven",
              live.breakevenHerkunft[0]?.etikett === "BREAKEVEN/—"
              && live.breakevenHerkunft[0]?.anzahl === 400
              && live.breakevenHerkunft[1]?.anzahl === 117,
              JSON.stringify(live.breakevenHerkunft.slice(0, 2)));
            const tLive = txt(live);
            torPruefung("ein hoher Breakeven-Anteil wird nicht laut gemeldet",
              /% der gewerteten Zeilen sind Breakeven/.test(tLive)
              && /Herkunft/.test(tLive), tLive.slice(-200));
            // „davon rekonstruiert" stand unter „ohne Ergebnis" und las sich
            // als Teilmenge — am 26.10. ergab das „33 von 31".
            const iGew = tLive.indexOf("Gewertet:");
            const iRek = tLive.indexOf("davon rekonstruiert");
            torPruefung("'davon rekonstruiert' steht wieder unter 'ohne "
              + "Ergebnis' und liest sich als Teilmenge ('33 von 31')",
              iGew >= 0 && iRek >= 0 && iRek > iGew, `gewertet@${iGew} rek@${iRek}`);

            // ── Die ZEITSPANNE je Etikett (26.10., 2. Runde) ──────────────
            //
            // Die Anzahl allein beantwortet die Frage nicht, wegen der es die
            // Aufschluesselung gibt: *wird das heute noch erzeugt?* Der echte
            // Lauf zeigte 441 BREAKEVEN/— und 69 CLOSED/— — beide Etiketten
            // schrieb `sync-journal` laut Kommentar nur BIS zum 17.08. Ein
            // Kommentar ist aber kein Beleg; das Datum ist einer.
            const zd = (pnl, result, updatedAt, extra = {}) =>
              ({ profitLoss: pnl, notes: JSON.stringify(extra), result, updatedAt });
            // DIE TESTDATEN SIND ABSICHTLICH UNBEQUEM (26.10., nachgebessert).
            //
            // Die erste Fassung war zu brav, und DREI Sabotagen rutschten
            // durch, OHNE dass der Pruefer etwas davon merkte — dieselbe Falle
            // wie `[RSI 82]` am 30.09.: ein Testfall, der den Fehler gar nicht
            // ausdruecken KANN. Was jetzt anders ist:
            //
            //  - die Gewinner haben VERSCHIEDENE Daten (07-01 / 09-01 / 10-20),
            //    sonst sind aelteste und neueste gleich und ein gedrehter
            //    Vergleich faellt nicht auf;
            //  - ein Breakeven ist NEUER (10-25) als der neueste Gewinner,
            //    sonst merkt niemand, wenn der Massstab Breakeven mitnimmt;
            //  - ein Etikett hat UNSORTIERTE Daten UND eine Zeile ohne Datum
            //    mittendrin, sonst traegt "der letzte gewinnt" zufaellig das
            //    richtige Ergebnis und ein null loescht die Spanne unbemerkt.
            const mitDatum = f([
              ...Array.from({ length: 28 }, () => zd(10, "WIN", "2026-09-01T10:00:00Z")),
              zd(10, "WIN", "2026-10-20T10:00:00Z"),   // neuester entschiedener
              zd(10, "WIN", "2026-07-01T10:00:00Z"),   // aeltester entschiedener
              zd(0, "ALT", "2026-08-05T10:00:00Z"),
              zd(0, "ALT", "2026-08-01T10:00:00Z"),
              zd(0, "ALT", "2026-08-03T10:00:00Z"),
              zd(0, "ALT", null),                      // Luecke MITTENDRIN
              zd(0, "ALT", "2026-08-02T10:00:00Z"),
              // NEUER als jeder Gewinner — der Massstab darf ihn NICHT nehmen
              ...Array.from({ length: 3 }, () => zd(0, "NEU", "2026-10-25T10:00:00Z")),
              zd(0, "OHNE", null),
            ]);
            const hol = (name) => mitDatum.breakevenHerkunft.find((h) => h.etikett === name);
            torPruefung("der Massstab fehlt: bis wann liefen Trades MIT Ergebnis "
              + "(2026-10-20; 10-25 waere ein Breakeven, 07-01 der aelteste)",
              mitDatum.zuletztEntschieden === "2026-10-20",
              String(mitDatum.zuletztEntschieden));
            torPruefung("ein Etikett nennt seine Zeitspanne nicht — damit ist "
              + "Altbestand von einem laufenden Fehler nicht zu unterscheiden",
              hol("ALT/—")?.von === "2026-08-01" && hol("ALT/—")?.bis === "2026-08-05",
              JSON.stringify(hol("ALT/—")));
            torPruefung("eine Spanne aus einem einzigen Tag wird falsch gebildet",
              hol("NEU/—")?.von === "2026-10-25" && hol("NEU/—")?.bis === "2026-10-25"
              && hol("NEU/—")?.anzahl === 3,
              JSON.stringify(hol("NEU/—")));
            // DER KERN dieser Runde: ein fehlendes Datum wird NICHT zu "heute".
            // Dieselbe Regel wie beim Kurs-Alter am 22.09. — eine stille
            // Ersatzzahl macht aus "unbekannt" eine Messung, und hier haengt
            // daran die Frage, ob ein Fehler noch aktiv ist.
            torPruefung("eine Zeile OHNE Datum bekommt ein erfundenes",
              hol("OHNE/—")?.von === null && hol("OHNE/—")?.bis === null,
              JSON.stringify(hol("OHNE/—")));
            const tagF = ew.exports?.tag;
            torPruefung("tag() ist nicht pruefbar exportiert", typeof tagF === "function");
            if (typeof tagF === "function") {
              torPruefung("tag() macht aus einem unlesbaren Datum kein gueltiges",
                tagF("nicht-ein-datum") === null && tagF("") === null
                && tagF(null) === null && tagF(undefined) === null,
                `${tagF("nicht-ein-datum")} / ${tagF("")}`);
              torPruefung("tag() verarbeitet kein echtes Date-Objekt — Prisma "
                + "liefert genau das",
                tagF(new Date("2026-09-15T23:30:00Z")) === "2026-09-15",
                String(tagF(new Date("2026-09-15T23:30:00Z"))));
            }
            const tDatum = txt(mitDatum);
            torPruefung("die Zeitspanne steht nicht in der Antwort",
              /2026-08-01 … 2026-08-05/.test(tDatum), tDatum.slice(-260));
            torPruefung("eine Zeile ohne Datum wird in der Antwort nicht als "
              + "'ohne Datum' kenntlich gemacht",
              /ohne Datum/.test(tDatum), tDatum.slice(-260));
            torPruefung("der Vergleichsmassstab fehlt in der Antwort",
              /letzter Trade MIT Ergebnis: <b>2026-10-20<\/b>/.test(tDatum),
              tDatum.slice(-260));

            // ── WORAN DIE TRADES ENDEN (26.10., 3. Runde) ─────────────────
            //
            // Der Einstieg verlangt R/R >= 1.5 (ai-analysis-engine.ts:911),
            // der echte Lauf meldete ein REALISIERTES R/R von 0.75. Die
            // Luecke muss beim Ausstieg entstehen — diese Aufschluesselung
            // sagt, bei welchem. Der Oe je Etikett ist die eigentliche
            // Spalte: ein Ausstieg, der im Schnitt einen Bruchteil des Ziels
            // bringt, erklaert die Luecke; eine blosse Anzahl erklaert nichts.
            // `exitPosition` steht mit in den Notizen: 0 = am Stop, 1 = am
            // Ziel. Die Zahl beantwortet, was das Etikett nicht hergibt —
            // DAZWISCHEN sagt nicht, ob bei 10 % oder bei 90 %.
            const ende = f([
              ...Array.from({ length: 10 }, () =>
                zd(30, "WIN", "2026-10-01T10:00:00Z",
                  { exitReason: "ZIEL", exitPosition: 0.98 })),
              ...Array.from({ length: 20 }, () =>
                zd(6, "WIN", "2026-10-02T10:00:00Z",
                  { exitReason: "PARTIAL_TP", exitPosition: 0.30 })),
              ...Array.from({ length: 15 }, () =>
                zd(-20, "LOSS", "2026-10-03T10:00:00Z",
                  { exitReason: "STOP", exitPosition: 0.02 })),
            ]);
            torPruefung("die Gewinner werden nicht nach Ausstiegsgrund "
              + "aufgeschluesselt — dann bleibt offen, woran sie enden",
              ende.gewinnHerkunft[0]?.etikett === "WIN/PARTIAL_TP"
              && ende.gewinnHerkunft[0]?.anzahl === 20
              && ende.gewinnHerkunft[1]?.etikett === "WIN/ZIEL",
              JSON.stringify(ende.gewinnHerkunft));
            torPruefung("der Oe P&L je Etikett fehlt — die Anzahl allein sagt "
              + "nicht, wie viel ein Ausstieg kostet",
              ende.gewinnHerkunft[0]?.schnitt === 6
              && ende.gewinnHerkunft[1]?.schnitt === 30,
              JSON.stringify(ende.gewinnHerkunft.map((h) => h.schnitt)));
            torPruefung("die Verlierer werden nicht aufgeschluesselt — ohne "
              + "sie fehlt der Vergleich",
              ende.verlustHerkunft[0]?.etikett === "LOSS/STOP"
              && ende.verlustHerkunft[0]?.anzahl === 15
              && ende.verlustHerkunft[0]?.schnitt === -20,
              JSON.stringify(ende.verlustHerkunft));
            torPruefung("Gewinner und Verlierer landen im selben Topf",
              ende.gewinnHerkunft.every((h) => (h.schnitt ?? 0) > 0)
              && ende.verlustHerkunft.every((h) => (h.schnitt ?? 0) < 0)
              && ende.wins === 30 && ende.losses === 15,
              `W=${ende.wins} L=${ende.losses}`);
            const tEnde = txt(ende);
            torPruefung("die Aufschluesselung steht nicht in der Antwort",
              /Woran die Trades enden/.test(tEnde) && /Gewinner \(30\)/.test(tEnde)
              && /Verlierer \(15\)/.test(tEnde), tEnde.slice(-320));
            torPruefung("der Oe steht nicht in der Antwort",
              /Ø 6\b/.test(tEnde) && /Ø 30\b/.test(tEnde), tEnde.slice(-320));

            // ── WIE WEIT kamen die Trades? (27.10.) ───────────────────────
            //
            // Der Live-Lauf vom 27.10. zeigte: 0 von 121 Trades erreichen ihr
            // Ziel, 57 % sterben in der Mitte. Das Etikett DAZWISCHEN sagt
            // aber nicht, ob bei 10 % oder bei 90 % — und genau daran haengt
            // die Entscheidung ueber die Ausstiegsschwellen.
            torPruefung("der Weg zum Ziel wird nicht ausgewiesen (0 % = Stop, "
              + "100 % = Ziel)",
              ende.gewinnHerkunft[0]?.weg === 30 && ende.gewinnHerkunft[1]?.weg === 98
              && ende.verlustHerkunft[0]?.weg === 2,
              JSON.stringify([...ende.gewinnHerkunft, ...ende.verlustHerkunft]
                .map((h) => [h.etikett, h.weg])));
            torPruefung("die Zahl der Zeilen MIT Angabe fehlt",
              ende.gewinnHerkunft[0]?.wegBekannt === 20, String(ende.gewinnHerkunft[0]?.wegBekannt));
            torPruefung("der Weg steht nicht in der Antwort",
              /Weg <b>30 %<\/b>/.test(tEnde) && /0 % = am Stop, 100 % = am Ziel/.test(tEnde),
              tEnde.slice(-360));

            // FEHLT die Angabe, wird sie NICHT zu 0 — eine 0 hiesse „am Stop
            // ausgestiegen" und waere eine Behauptung statt einer Messung.
            const ohneWeg = f([
              ...Array.from({ length: 20 }, () =>
                zd(5, "WIN", "2026-10-01T10:00:00Z", { exitReason: "X" })),
              ...Array.from({ length: 10 }, () =>
                zd(-5, "LOSS", "2026-10-01T10:00:00Z", { exitReason: "Y", exitPosition: 0.5 })),
            ]);
            torPruefung("eine fehlende exitPosition wird als 0 % gerechnet — "
              + "das hiesse 'am Stop ausgestiegen'",
              ohneWeg.gewinnHerkunft[0]?.weg === null
              && ohneWeg.gewinnHerkunft[0]?.wegBekannt === 0,
              JSON.stringify(ohneWeg.gewinnHerkunft[0]));
            torPruefung("ohne Angabe behauptet die Antwort einen Weg",
              /Weg unbekannt/.test(txt(ohneWeg)), txt(ohneWeg).slice(-300));
            // GEGENPROBE: eine unbrauchbare Angabe zaehlt nicht mit.
            const krummWeg = f([
              ...Array.from({ length: 20 }, () =>
                zd(5, "WIN", "2026-10-01T10:00:00Z", { exitReason: "X", exitPosition: 0.4 })),
              ...Array.from({ length: 10 }, () =>
                zd(5, "WIN", "2026-10-01T10:00:00Z", { exitReason: "X", exitPosition: "halb" })),
            ]);
            torPruefung("eine unbrauchbare exitPosition verfaelscht den Schnitt",
              krummWeg.gewinnHerkunft[0]?.weg === 40
              && krummWeg.gewinnHerkunft[0]?.wegBekannt === 20
              && krummWeg.gewinnHerkunft[0]?.anzahl === 30,
              JSON.stringify(krummWeg.gewinnHerkunft[0]));
            torPruefung("die Teilangabe (20/30) steht nicht in der Antwort",
              /\(20\/30\)/.test(txt(krummWeg)), txt(krummWeg).slice(-300));

            // SCHLUPF: beim Schliessen kann der Kurs ueber das Ziel oder
            // unter den Stop hinausgehen — dann liegt der Weg ausserhalb
            // 0..100 %. Das gehoert SICHTBAR; eine Klemme wuerde es
            // verstecken. Ohne einen solchen Wert kann der Testfall den
            // Fehler gar nicht ausdruecken — die Sabotage „auf 0..100
            // klemmen" blieb damit gruen. Vorgefuehrt.
            const schlupf = f([
              ...Array.from({ length: 20 }, () =>
                zd(5, "WIN", "2026-10-01T10:00:00Z",
                  { exitReason: "ZIEL", exitPosition: 1.08 })),
              ...Array.from({ length: 10 }, () =>
                zd(-5, "LOSS", "2026-10-01T10:00:00Z",
                  { exitReason: "STOP", exitPosition: -0.04 })),
            ]);
            torPruefung("ein Weg ausserhalb 0..100 % (Schlupf) wird geklemmt "
              + "und damit versteckt",
              schlupf.gewinnHerkunft[0]?.weg === 108
              && schlupf.verlustHerkunft[0]?.weg === -4,
              `${schlupf.gewinnHerkunft[0]?.weg} / ${schlupf.verlustHerkunft[0]?.weg}`);

            // Die Gruppierung selbst — direkt aufgerufen. EIN Weg fuer
            // Breakeven, Gewinner und Verlierer; drei Kopien waeren drei
            // Stellen, an denen sie auseinanderlaufen koennen.
            const hl = ew.exports?.herkunftListe;
            const maxH = ew.exports?.HERKUNFT_MAX;
            torPruefung("herkunftListe ist nicht pruefbar exportiert",
              typeof hl === "function");
            if (typeof hl === "function") {
              torPruefung("herkunftListe wirft bei leerer Eingabe",
                Array.isArray(hl([])) && hl([]).length === 0);
              // Mit `weg`: ohne ihn kann der Fall nicht zeigen, ob die
              // Buendelung den Weg mitnimmt — die Sabotage „wegSumme beim
              // Buendeln auf 0" blieb damit gruen. Vorgefuehrt.
              const v2 = hl(Array.from({ length: maxH + 4 }, (_, i) =>
                ({ pnl: i + 1, herkunft: `E${i}`, datum: null, weg: 0.5 })));
              torPruefung("beim Buendeln gehen Zeilen verloren",
                v2.reduce((a, h) => a + h.anzahl, 0) === maxH + 4
                && v2.length === maxH + 1,
                `${v2.reduce((a, h) => a + h.anzahl, 0)} Zeilen in ${v2.length} Eintraegen`);
              torPruefung("beim Buendeln geht der Weg verloren",
                v2.at(-1)?.weg === 50 && v2.at(-1)?.wegBekannt === 4,
                JSON.stringify(v2.at(-1)));
              torPruefung("der Oe wird bei gemischten Vorzeichen falsch gemittelt",
                hl([{ pnl: 10, herkunft: "X", datum: null },
                  { pnl: -4, herkunft: "X", datum: null }])[0]?.schnitt === 3,
                String(hl([{ pnl: 10, herkunft: "X", datum: null },
                  { pnl: -4, herkunft: "X", datum: null }])[0]?.schnitt));
            }

            // ── DAS ZEITFENSTER (27.10.) ──────────────────────────────────
            //
            // Der Lauf vom 26.10. zerfiel in ZWEI Systeme: bis Mitte August
            // Zeilen ohne Ausstiegsgrund (Oe Gewinn 21.43, R/R 1.11), danach
            // welche mit Grund (Oe Gewinn 3.13, R/R 0.43). Zusammengerechnet
            // ergibt das R/R 0.75 — eine Zahl, die KEINES der beiden Systeme
            // beschreibt, und die daraus abgeleiteten Hebel zeigen falsch.
            //
            // `jetzt` wird injiziert, damit die Rechnung nicht vom Kalender
            // abhaengt: ein Pruefer, der morgen anders rechnet, beweist nichts.
            const JETZT = new Date("2026-10-27T12:00:00Z");
            const fensterFaelle = [
              ...Array.from({ length: 30 }, () =>
                zd(10, "NEU", "2026-10-20T10:00:00Z", { exitReason: "ZIEL" })),
              ...Array.from({ length: 40 }, () =>
                zd(-5, "ALT", "2026-06-20T10:00:00Z", { exitReason: "STOP" })),
              ...Array.from({ length: 5 }, () => zd(99, "OHNE", null)),
            ];
            const mitFenster = f(fensterFaelle, { tage: 30, jetzt: JETZT });
            const ohneFenster = f(fensterFaelle);

            torPruefung("das Zeitfenster filtert nicht — alte und neue Zeilen "
              + "landen weiter in derselben Zahl",
              mitFenster.gewertet === 30 && mitFenster.wins === 30
              && mitFenster.losses === 0,
              `gewertet=${mitFenster.gewertet} W=${mitFenster.wins} L=${mitFenster.losses}`);
            torPruefung("die Zeilen VOR dem Fenster verschwinden still — sie "
              + "gehoeren gezaehlt, nicht verworfen",
              mitFenster.ausserhalbFenster === 40, String(mitFenster.ausserhalbFenster));
            // Ohne Datum laesst sich eine Zeile nicht einordnen. Sie darf
            // weder mitgerechnet noch stillschweigend verworfen werden.
            torPruefung("Zeilen OHNE Datum werden im Fenster mitgerechnet oder "
              + "still verworfen",
              mitFenster.ohneDatumImFenster === 5
              && !mitFenster.erwartungswert?.toString().includes("99"),
              `ohneDatum=${mitFenster.ohneDatumImFenster} ew=${mitFenster.erwartungswert}`);
            torPruefung("das Fenster wird im Ergebnis nicht ausgewiesen",
              mitFenster.fensterTage === 30 && ohneFenster.fensterTage === null,
              `${mitFenster.fensterTage} / ${ohneFenster.fensterTage}`);
            torPruefung("OHNE Fenster wird trotzdem gefiltert",
              ohneFenster.gewertet === 75 && ohneFenster.ausserhalbFenster === 0
              && ohneFenster.ohneDatumImFenster === 0,
              `gewertet=${ohneFenster.gewertet}`);
            // DER KERN: die beiden Rechnungen muessen sich UNTERSCHEIDEN,
            // sonst beweist das Fenster nichts.
            torPruefung("Fenster und Gesamtlauf liefern dasselbe — dann greift "
              + "das Fenster gar nicht",
              mitFenster.erwartungswert !== ohneFenster.erwartungswert
              && mitFenster.trefferquote !== ohneFenster.trefferquote,
              `${mitFenster.erwartungswert} vs ${ohneFenster.erwartungswert}`);
            const tFenster = txt(mitFenster);
            torPruefung("der Zeitraum steht nicht in der Antwort — man wuesste "
              + "nicht, worauf sich die Zahlen beziehen",
              /Zeitraum: <b>letzte 30 Tage<\/b>/.test(tFenster), tFenster.slice(0, 120));
            torPruefung("die ausgeschlossenen Zeilen stehen nicht in der Antwort",
              /vor dem Fenster: 40/.test(tFenster)
              && /ohne Datum, nicht einordenbar: 5/.test(tFenster),
              tFenster.slice(0, 260));
            torPruefung("ohne Fenster fehlt der Hinweis auf den Zeitraum",
              /Zeitraum: <b>alles<\/b>/.test(txt(ohneFenster)),
              txt(ohneFenster).slice(0, 100));
            // Ein unbrauchbares Fenster faellt auf "alles" zurueck — und SAGT
            // das. Still ein Fenster vortaeuschen waere der Fehler.
            for (const schlecht of [{ tage: 0 }, { tage: -5 }, { tage: NaN }]) {
              const r = f(fensterFaelle, schlecht);
              torPruefung(`ein unbrauchbares Fenster (${schlecht.tage}) taeuscht `
                + "ein Fenster vor, statt ehrlich auf alles zurueckzufallen",
                r.fensterTage === null && r.gewertet === 75,
                `fensterTage=${r.fensterTage} gewertet=${r.gewertet}`);
            }

            // Und die Verdrahtung: nimmt die Route die Tage ueberhaupt an?
            // Eine geprueefte Funktion, die nie ein Fenster bekommt, waere
            // die Fehlerklasse vom 30.09.
            const whFenster = read("frontend/app/api/telegram/webhook/route.ts")
              .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
            torPruefung("/edge nimmt keine Tagesangabe entgegen",
              /textLower\.startsWith\("\/edge "\)/.test(whFenster));
            torPruefung("/edge reicht das Fenster nicht an die Rechnung weiter",
              /erwartungswert\(zeilen,\s*tage === null \? null : \{ tage \}\)/.test(whFenster),
              "sonst waere die Angabe wirkungslos");

            // Fehlt `result`, wird nichts erfunden.
            const ohneResult = f([...viele(20, 10), ...viele(10, 0)]);
            torPruefung("eine fehlende result-Spalte wird geraten statt als "
              + "'—' ausgewiesen",
              ohneResult.breakevenHerkunft[0]?.etikett === "—/—"
              && ohneResult.breakevenHerkunft[0]?.anzahl === 10,
              JSON.stringify(ohneResult.breakevenHerkunft));

            // Mehr Etiketten als HERKUNFT_MAX -> der Rest wird gebuendelt,
            // nicht verschwiegen.
            const MAXH = ew.exports?.HERKUNFT_MAX;
            const vieleEtiketten = f([...viele(30, 10),
              ...Array.from({ length: MAXH + 3 }, (_, i) => zr(0, `R${i}`))]);
            const summeHerkunft = vieleEtiketten.breakevenHerkunft
              .reduce((a, h) => a + h.anzahl, 0);
            torPruefung("bei vielen Breakeven-Etiketten geht ein Teil der "
              + "Zeilen aus der Herkunft verloren",
              summeHerkunft === MAXH + 3
              && /weitere \(3 Etiketten\)/.test(
                vieleEtiketten.breakevenHerkunft.at(-1)?.etikett ?? ""),
              `${summeHerkunft} von ${MAXH + 3}, `
              + `letztes=${vieleEtiketten.breakevenHerkunft.at(-1)?.etikett}`);

            // Unlesbare Notizen werden GEMELDET, nicht still mitgerechnet.
            const kaputt = f([...viele(30, 10), { profitLoss: 5, notes: "kein json" },
              { profitLoss: null, notes: "{}" }]);
            torPruefung("unlesbare Zeilen werden still mitgerechnet",
              kaputt.unlesbar === 2 && kaputt.gewertet === 30,
              `unlesbar=${kaputt.unlesbar} gewertet=${kaputt.gewertet}`);

            // Rekonstruierte Zeilen zaehlen mit, sind aber SICHTBAR.
            const rek = f([...viele(20, 10), ...viele(10, 10, { rekonstruiert: true })]);
            torPruefung("rekonstruierte Zeilen sind in der Ausgabe nicht erkennbar",
              rek.rekonstruiert === 10 && rek.gewertet === 30,
              `rek=${rek.rekonstruiert}`);

            // Leere Eingabe darf nicht werfen.
            for (const [name, ein] of [["null", null], ["undefined", undefined], ["leer", []]]) {
              let r = null;
              try { r = f(ein); } catch (e) { r = { fehler: e.message }; }
              torPruefung(`erwartungswert wirft bei: ${name}`,
                r && r.belastbar === false && !r.fehler, JSON.stringify(r).slice(0, 60));
            }

            // Der Text muss die Datenqualitaet NENNEN und darf keine Zahl
            // erfinden, wenn sie nicht belastbar ist.
            const tWenig = txt(wenig);
            torPruefung("der Text behauptet einen Erwartungswert, obwohl er nicht belastbar ist",
              !/Erwartungswert: [+-]?\d/.test(tWenig) && /nicht belastbar/.test(tWenig),
              tWenig.slice(0, 80));
            const tNeg = txt(negativ);
            torPruefung("der Text nennt den negativen Erwartungswert nicht deutlich",
              /kein Edge/.test(tNeg) && /-8/.test(tNeg), tNeg.slice(0, 80));
            const tEtik = txt(mitEtiketten);
            torPruefung("der Text verschweigt die Zeilen ohne Ergebnis",
              /ohne Ergebnis/.test(tEtik), tEtik.slice(0, 100));
          }

          // Und die Verdrahtung im Webhook.
          const whQ = read("frontend/app/api/telegram/webhook/route.ts")
            .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
          torPruefung("/edge ist im Webhook nicht verdrahtet",
            /textLower === "\/edge"/.test(whQ));
          torPruefung("/edge fehlt in der Befehlsliste — /help zeigt ihn nicht",
            /\/edge — Erwartungswert/.test(whQ));
          torPruefung("/edge liest offene Trades mit — ihr P&L ist ein Zwischenstand",
            /status: \{ not: "OPEN" \}/.test(whQ));
          torPruefung("/edge meldet seinen eigenen Fehlschlag nicht",
            /\/edge fehlgeschlagen/.test(whQ),
            "sonst steht man vor einem stummen Befehl");

          // DIE VERDRAHTUNG, nicht nur die Funktion (Fehlerklasse 30.09.).
          //
          // `erwartungswert()` liest die Spalte `result`, um einen echten
          // Breakeven von einer Zeile zu trennen, deren P&L NIE geschrieben
          // wurde (`Float @default(0)`). Dass die Funktion das kann, belegen
          // die Rechnungen oben ("BREAKEVEN/—" mit 400). Dass sie die Werte
          // auch BEKOMMT, belegt nur diese Prüfung — am 30.09. war genau das
          // der Fehler: eine vollstaendig geprueefte Funktion, die dauerhaft
          // `undefined` bekam und deshalb ehrlich aussehend "Unbekannt" sagte.
          //
          // Der Block wird per Klammerzaehlung ausgeschnitten: ein
          // `result: true` irgendwo sonst in der 1500-Zeilen-Datei beweist
          // fuer /edge nichts ("eine andere Aufrufstelle").
          let edgeBlock = "";
          try { edgeBlock = objectBlock(whQ, 'textLower === "/edge"'); }
          catch { edgeBlock = ""; }
          torPruefung("der /edge-Block ist nicht ausschneidbar — die "
            + "Verdrahtung bliebe ungeprueft", edgeBlock.length > 0);
          torPruefung("/edge schickt die result-Spalte nicht mit — die "
            + "Breakeven-Herkunft waere dauerhaft '—/—' und saehe dabei "
            + "wie ein ehrliches Ergebnis aus",
            /\bresult:\s*true\b/.test(edgeBlock),
            edgeBlock.replace(/\s+/g, " ").slice(0, 140));
          torPruefung("/edge schickt updatedAt nicht mit — dann steht bei "
            + "JEDEM Etikett 'ohne Datum', und die Frage 'wird das heute noch "
            + "erzeugt?' bleibt offen",
            /\bupdatedAt:\s*true\b/.test(edgeBlock),
            edgeBlock.replace(/\s+/g, " ").slice(0, 160));
        }

        // ── UND ZWAR IN JEDEM MODUL, DAS TELEGRAM SCHICKT ─────────────────
        //
        // Die erste Fassung hielt eine feste Liste aus DREI Dateien — und
        // uebersah damit, dass 19 Module Telegram senden und sechs davon
        // Zeiten formatieren. Gefunden wurden so nur 17 von 25 Stellen; acht
        // blieben in claude-watchdog.ts, trade-filters.ts und der
        // security-center-Route stehen.
        //
        // Das ist DIESELBE Lehre wie bei der .gitignore-Deckung am selben
        // Tag: eine feste Pfadliste veraltet in dem Moment, in dem jemand ein
        // neues Modul anlegt. Gesucht wird deshalb dynamisch nach dem, was
        // die Datei TUT — schickt sie Telegram?
        //
        // AUSGENOMMEN sind Dateien mit `"use client"`: die laufen im Browser
        // des Betrachters, und dort ist die Zone des Betrachters genau die
        // richtige. `SettingsDashboard.tsx` waere sonst faelschlich rot.
        const sendet = /sendTelegram|sendTelegramMessage|api\.telegram\.org|notifyTrade|notifyBreakeven|notifyDailySummary/;
        const nackt = [];
        let geprueft = 0;
        for (const f of sourceFiles([".ts", ".tsx"])) {
          if (!f.startsWith("frontend/")) continue;
          const roh = read(f);
          if (!sendet.test(roh)) continue;
          if (/^\s*["']use client["']/m.test(roh.slice(0, 200))) continue;   // Browser
          geprueft++;
          const quell = roh.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
          for (const m of quell.matchAll(/\.toLocale(String|DateString|TimeString)\(([^)]*)\)/g)) {
            if (!/timeZone/.test(m[2])) nackt.push(`${f}: .toLocale${m[1]}(${m[2].slice(0, 40)})`);
          }
        }
        torPruefung("es wird gar kein Telegram-Modul geprueft — der Riegel greift ins Leere",
          geprueft >= 10, `${geprueft} Module mit Telegram-Versand gefunden`);
        torPruefung("eine Telegram-Zeit wird ohne Zonenangabe formatiert",
          nackt.length === 0,
          nackt.length ? `${nackt.length} Stelle(n), z.B. ${nackt[0]}` : `${geprueft} Module geprueft, alle mit Zone`);
      }

      // ── DIE KILLSWITCH-TEXTE AN DAS VERHALTEN BINDEN (27.09.) ───────────
      //
      // ANLASS: der Live-Test vom 27.09. 19:12. Zwei `details`-Texte
      // behaupteten etwas, das der Code nicht tut:
      //
      //  STAGE 3 sagte "Trading-Loops … gestoppt". Es gibt im ganzen
      //  Programm KEIN `clearInterval`. Die Schleifen laufen durch und
      //  fragen `isKillswitchActive()` ab — belegt im Log: "[position-
      //  monitor] 🔴 Killswitch aktiv — Zyklus uebersprungen". Wer
      //  "gestoppt" liest, zweifelt im Ernstfall, ob /reset genuegt.
      //
      //  STAGE 1 sagte "Credentials bleiben gespeichert, damit /reset wieder
      //  verbinden kann" — fuer IC Markets falsch: dort ist der Redis-Token
      //  der Zugang, und er wird geloescht. Genau deshalb meldete /reset
      //  "Token nicht in Redis — bitte manuell verbinden".
      //
      // KOMMENTARE WERDEN VORHER ENTFERNT. Die Begruendungen im Quelltext
      // enthalten die gesuchten Woerter woertlich — ein Pruefer, der seine
      // eigene Erklaerung findet, prueft nichts (CLAUDE.md, sechsmal).
      {
        const ohne = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        const ks = ohne(read("frontend/lib/killswitch/killswitch-engine.ts"));
        const instr = ohne(read("frontend/instrumentation.ts"));
        const icSess = ohne(read("frontend/lib/icmarkets/icmarkets-session.ts"));

        // Das VERHALTEN: keine Schleife wird abgeraeumt, und das Tor sitzt drin.
        const clears = (instr.match(/clearInterval\s*\(/g) || []).length;
        const tore = (instr.match(/isKillswitchActive\(\)/g) || []).length;
        torPruefung("eine Trading-Schleife wird jetzt doch abgeraeumt — der Text 'laufen WEITER' stimmt dann nicht mehr",
          clears === 0, `${clears}x clearInterval in instrumentation.ts`);
        torPruefung("die Schleifen fragen den Killswitch nicht mehr ab",
          tore >= 3, `${tore} Abfragen von isKillswitchActive() (erwartet mindestens 3)`);

        // Und der TEXT muss dazu passen.
        torPruefung("STAGE 3 behauptet wieder, die Loops seien gestoppt",
          !/Trading-Loops[^"]*gestoppt/.test(ks) && /laufen WEITER/.test(ks),
          "sie laufen und werden blockiert — /reset genuegt, kein Redeploy");
        torPruefung("STAGE 3 sagt nicht mehr, dass /reset genuegt",
          /\/reset genuegt/.test(ks) || /\/reset genügt/.test(ks),
          "genau diese Frage stellt sich im Ernstfall");

        // STAGE 1: der Unterschied zwischen den Brokern muss dastehen —
        // und er muss zum Code passen (IC loescht seinen Token wirklich).
        torPruefung("STAGE 1 verspricht wieder pauschal gespeicherte Credentials",
          !/Credentials bleiben gespeichert/.test(ks),
          "fuer IC Markets gibt es keine — der Redis-Token IST der Zugang");
        torPruefung("STAGE 1 nennt den Unterschied zwischen den Brokern nicht",
          /IC Markets NICHT/.test(ks) && /manuelle Verbindung/.test(ks),
          "Capital.com meldet sich neu an, IC Markets kann es nicht");
        torPruefung("der Text behauptet einen geloeschten IC-Token, den der Code gar nicht loescht",
          /clearICMarketsSession[\s\S]{0,200}clearFromRedis\(\)/.test(icSess),
          "sonst stimmt die Begruendung in STAGE 1 nicht mehr");
      }

      // ── DIE META-ANTWORT WIRD GELESEN, NICHT GERATEN (30.09.) ───────────
      //
      // ANLASS: Telegram 30.09. 12:09 — "KI-Sicherheitstor Meta-KI nicht
      // erreichbar", Fehler "Unexpected non-whitespace character after JSON at
      // position 653". Die Stelle war
      //     const json = text.match(/\[[\s\S]*\]/)?.[0];
      // — GIERIG, also vom ersten `[` bis zum LETZTEN `]`. Zwei Fehlerbilder:
      //
      //  1. Prosa mit Klammer NACH dem Array wird mitgenommen -> JSON.parse
      //     wirft -> Rueckfall gibt JEDEN Kandidaten frei (Tor ganz offen).
      //  2. Abgeschnittene Antwort ohne `]` -> der Ausdruck findet NICHTS ->
      //     es wirft auch nichts -> `decisions` bleibt leer -> jeder Kandidat
      //     gilt als "Meta-AI hat abgelehnt". STILLE Totalablehnung.
      //
      // Beides haengt am Lesen des Textes, nicht an der Struktur. Deshalb
      // rechnend: die echte Funktion an echten Modell-Marotten.
      {
        const aa = ladeTsModul("lib/agents/analysis-agent.ts");
        const lies = aa.exports?.metaAntwortLesen;
        const budget = aa.exports?.metaTokenBudget;
        if (aa.fehler || typeof lies !== "function" || typeof budget !== "function") {
          funde.push(`metaAntwortLesen/metaTokenBudget nicht ausfuehrbar: ${aa.fehler ?? "nicht exportiert"}`);
          zusatz++;
        } else {
          const eintrag = (s, c = "ok") =>
            `{"symbol":"${s}","approve":true,"adjustedConfidence":75,"concern":"${c}","priority":"HIGH"}`;
          const array = (n) => "[" + Array.from({ length: n }, (_, i) => eintrag(`SYM${i}`)).join(",") + "]";
          const l = (t) => { try { return lies(t); } catch (e) { return { ok: false, grund: `WIRFT ${e.message}` }; } };

          const rein = l(array(3));
          torPruefung("ein sauberes Urteils-Array wird nicht gelesen",
            rein.ok === true && rein.eintraege.length === 3, JSON.stringify(rein).slice(0, 80));

          // Der Fehler vom 30.09.: Prosa mit Klammer NACH dem Array.
          const danach = l(array(7) + "\n\nHinweis: alle Signale erfuellen die Regeln [siehe oben].");
          torPruefung("Prosa nach dem Array laesst das Lesen wieder scheitern",
            danach.ok === true && danach.eintraege.length === 7,
            danach.ok ? "" : danach.grund);

          // Eine Klammer in der VORREDE darf nicht als Array gelten.
          const davor = l("Hier das Ergebnis [Meta-Analyse]:\n```json\n" + array(4) + "\n```\nFertig.");
          torPruefung("eine Klammer in der Vorrede wird faelschlich als Array genommen",
            davor.ok === true && davor.eintraege.length === 4,
            davor.ok ? "" : davor.grund);

          // Eine `]` INNERHALB einer Zeichenkette darf das Array nicht schliessen.
          //
          // EINZELNE Klammer, mit Absicht: ein Paar wie "[RSI 82]" ist in sich
          // balanciert, da faellt eine fehlende Zeichenketten-Erkennung gar
          // nicht auf. Im Sabotage-Lauf blieb genau dieser erste Testfall
          // gruen — der Testfall war zu schwach, nicht der Pruefer.
          const imText = l("[" + eintrag("EURUSD", "stark ueberdehnt RSI 82]") + "]");
          torPruefung("eine ] im Text schliesst das Array vorzeitig",
            imText.ok === true && imText.eintraege.length === 1
            && imText.eintraege[0].symbol === "EURUSD",
            imText.ok ? String(imText.eintraege[0].concern) : imText.grund);

          // Der gefaehrliche Fall: abgeschnitten MUSS ein benannter Ausfall sein.
          const abg = l(array(9).slice(0, -40));
          torPruefung("eine abgeschnittene Antwort gilt wieder als stilles Nichts",
            abg.ok === false && /abgeschnitten/.test(abg.grund),
            abg.ok ? "faelschlich ok — das ist die stille Totalablehnung" : abg.grund);

          // Ein LEERES Array ist kein Urteil — sonst wieder stille Ablehnung.
          const leer = l("[]");
          torPruefung("ein leeres Array gilt als Urteil",
            leer.ok === false && /leer/.test(leer.grund), JSON.stringify(leer).slice(0, 60));

          // Nichts darf werfen, und jeder Ausfall braucht einen Grund.
          for (const [name, ein] of [
            ["leer", ""], ["undefined", undefined], ["null", null],
            ["reine Prosa", "Ich kann das nicht beurteilen."],
            ["Objekt statt Array", '{"symbol":"X"}'],
            ["kaputtes JSON", '[{"symbol":]'],
            ["Zahlen statt Urteile", "Werte [1,2,3] beachten"],
          ]) {
            const r = l(ein);
            torPruefung(`metaAntwortLesen scheitert unsauber bei: ${name}`,
              r && r.ok === false && typeof r.grund === "string" && r.grund.length > 0
              && !/^WIRFT/.test(r.grund),
              r?.grund ?? JSON.stringify(r));
          }

          // Das Budget — der Grund fuer abgeschnittene Antworten.
          torPruefung("das Meta-Budget faellt unter den alten festen Wert 500",
            [0, 1, 5, 10, 20, 30, 50].every((n) => budget(n) >= 500),
            [0, 5, 30].map((n) => `${n}->${budget(n)}`).join(" "));
          torPruefung("30 Kandidaten bekommen nicht mehr als die gemessenen 735 Token",
            budget(30) >= 735, `${budget(30)} Token`);
          torPruefung("das Budget ist nach oben nicht geklemmt",
            budget(1000) <= 4000, `${budget(1000)}`);
          torPruefung("unsinnige Eingaben ergeben NaN statt der Untergrenze",
            budget(NaN) === 500 && budget(-5) === 500, `${budget(NaN)} / ${budget(-5)}`);

          // Und strukturell: der gierige Ausdruck darf nicht zurueckkehren,
          // und eine unlesbare Antwort MUSS auf den Ausfallpfad.
          const aaQ = read("frontend/lib/agents/analysis-agent.ts")
            .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
          torPruefung("der gierige Regex-Ausdruck ist zurueck",
            !/text\.match\(\/\\\[\[\\s\\S\]\*\\\]\//.test(aaQ)
            && !/match\(\/\\\[\[\\s\\S\]\*\\\]\/\)/.test(aaQ),
            "vom ersten [ bis zum LETZTEN ] — genau der Fehler vom 30.09.");
          torPruefung("eine unlesbare Meta-Antwort geht nicht mehr auf den Ausfallpfad",
            /if \(!lesung\.ok\)[\s\S]{0,120}throw new Error/.test(aaQ),
            "sonst bleibt `decisions` leer und alles gilt als abgelehnt");
          torPruefung("max_tokens ist wieder fest verdrahtet",
            /max_tokens: metaTokenBudget\(candidates\.length\)/.test(aaQ),
            "500 reichen fuer dreissig Kandidaten nicht");
        }
      }

      // ── WANN EIN ZWEITER VERSUCH ETWAS BRINGT — GERECHNET (22.09.) ───────
      //
      // Die echte Funktion, nicht ihr Text. Ein vertauschter Vergleich
      // (`< 500`) oder ein hineingerutschtes 4xx waere strukturell
      // unauffaellig: im ersten Fall wuerde gar nicht mehr wiederholt, im
      // zweiten liefe der Scan bei jedem 401 doppelt ins Leere und
      // verbrennte das Zeitbudget des Zyklus.
      {
        const eng = ladeTsModul("lib/market-scanner/ai-analysis-engine.ts");
        const wh = eng.exports?.strategienWiederholbar;
        if (eng.fehler || typeof wh !== "function") {
          funde.push(`strategienWiederholbar nicht ausfuehrbar: ${eng.fehler ?? "nicht exportiert"}`);
          zusatz++;
        } else {
          const f = (x) => { try { return wh(x); } catch (e) { return `WIRFT ${e.message}`; } };
          torPruefung("ein Gateway-Fehler bekommt keinen zweiten Versuch",
            f(502) === true && f(500) === true && f(503) === true && f(599) === true,
            `502=${f(502)} 500=${f(500)} 503=${f(503)} 599=${f(599)}`);
          torPruefung("ein Netzfehler/Timeout bekommt keinen zweiten Versuch",
            f(null) === true, String(f(null)));
          torPruefung("ein deterministischer Fehler wird sinnlos wiederholt",
            f(400) === false && f(401) === false && f(404) === false && f(422) === false,
            `400=${f(400)} 401=${f(401)} 404=${f(404)} 422=${f(422)}`);
          // 429 heisst "zu viel" — sofort nachzulegen ist genau das Falsche.
          torPruefung("auf 'zu viele Anfragen' wird sofort nachgelegt",
            f(429) === false, String(f(429)));
          torPruefung("ein Erfolg gilt als wiederholbar",
            f(200) === false && f(204) === false, `200=${f(200)} 204=${f(204)}`);
          const budget = eng.exports?.STRATEGIEN_BUDGET_MS;
          const rest = eng.exports?.STRATEGIEN_REST_FUER_WIEDERHOLUNG_MS;
          const pause = eng.exports?.STRATEGIEN_PAUSE_MS;
          torPruefung("das Zeitbudget der Wiederholung ist nicht schluessig",
            typeof budget === "number" && typeof rest === "number" && typeof pause === "number"
            && budget > 0 && rest > 0 && pause > 0 && rest + pause < budget,
            `Budget ${budget}, Restbedarf ${rest}, Pause ${pause}`);
          // Der Zyklus laeuft alle 5 Minuten. Beide Versuche zusammen duerfen
          // ihn nicht ueberholen — deshalb EIN gemeinsames Budget statt zwei.
          torPruefung("zwei Versuche koennen laenger dauern als ein Zyklus",
            budget + pause < 300000, `${budget} + ${pause} >= 300000 ms`);

          // ── UND JETZT WIRKLICH AUSFUEHREN (22.09.) ───────────────────────
          //
          // Alles bisher Gepruefte sagt nur, dass die REGEL stimmt und der
          // Code danach aussieht. Ob der zweite Versuch auch ausgeloest wird,
          // sieht man daran nicht — genau die Luecke, die CLAUDE.md meint
          // ("ein Riegel, der vorhanden, aber subtil falsch umgebaut wurde").
          //
          // Deshalb ein echter HTTP-Server auf 127.0.0.1 (Port 0 = freier
          // Port vom Betriebssystem) und die ECHTE Funktion dagegen. Gezaehlt
          // werden die ANFRAGEN — das ist der Beweis, kein Regex.
          //
          // Kostet rund vier Sekunden (zweimal die Pause von 2s). Das ist der
          // Preis dafuer, den einzigen Pfad abzusichern, dessen Ausfall einen
          // ganzen Handelszyklus kostet.
          const http = require("http");
          const ANTW = { results: { EURUSD: { symbol: "EURUSD", total_strategies: 16, fehlgeschlagen: 0 } } };
          const fallLauf = async (plan) => {
            const treffer = [];
            const srv = http.createServer((_q, res) => {
              const e = plan[Math.min(treffer.length, plan.length - 1)];
              treffer.push(1);
              if (e.status === 200) { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(ANTW)); }
              else { res.writeHead(e.status, { "Content-Type": "text/plain" }); res.end(e.koerper ?? ""); }
            });
            await new Promise((r) => srv.listen(0, "127.0.0.1", r));
            const alteUrl = process.env.PYTHON_BACKEND_NEW_URL;
            process.env.PYTHON_BACKEND_NEW_URL = `http://127.0.0.1:${srv.address().port}`;
            // Eigene Modulkopie MIT Ersatz fuer den Auth-Header: der
            // Stellvertreter von ladeTsModul wirft beim Aufruf, und dann
            // stirbt die Funktion VOR dem fetch (gemessen: 0 Anfragen).
            const eng2 = ladeTsModul("lib/market-scanner/ai-analysis-engine.ts", {
              "auth-header": { pythonBackendAuthHeader: () => ({ "X-Backend-Key": "pruefstand" }) },
            });
            const zeilen = [];
            const [l, w, f2] = [console.log, console.warn, console.error];
            console.log = console.warn = console.error = (...a) => zeilen.push(a.join(" "));
            let karte = new Map();
            try {
              karte = await eng2.exports.fetchStrategySignals(["EURUSD"]);
            } catch (e) { zeilen.push(`WIRFT ${e.message}`); } finally {
              console.log = l; console.warn = w; console.error = f2;
              if (alteUrl === undefined) delete process.env.PYTHON_BACKEND_NEW_URL;
              else process.env.PYTHON_BACKEND_NEW_URL = alteUrl;
              await new Promise((r) => srv.close(r));
            }
            return { anfragen: treffer.length, groesse: karte.size, log: zeilen.join("\n") };
          };

          const r1 = await fallLauf([{ status: 502, koerper: "Application failed to respond" }, { status: 200 }]);
          torPruefung("ein 502 wird NICHT wiederholt — der Zyklus bleibt verloren",
            r1.anfragen === 2 && r1.groesse === 1,
            `${r1.anfragen} Anfragen, ${r1.groesse} Symbole`);
          torPruefung("der Antwortkoerper des Backends landet nicht im Log",
            r1.log.includes("Application failed to respond"),
            "ohne ihn ist die Ursache eines 502 wieder nicht zu bestimmen");
          torPruefung("der geglueckte zweite Versuch wird verschwiegen",
            /beim zweiten Versuch erreicht/.test(r1.log),
            "sonst steht oben '1/1 analysiert' und niemand weiss vom Ausfall");

          const r2 = await fallLauf([{ status: 502, koerper: "Bad Gateway" }]);
          torPruefung("nach dem zweiten Fehlschlag wird weiter nachgefragt",
            r2.anfragen === 2 && r2.groesse === 0,
            `${r2.anfragen} Anfragen (erwartet genau 2)`);

          const r3 = await fallLauf([{ status: 401, koerper: '{"error":"unauthorized"}' }]);
          torPruefung("ein 401 wird sinnlos wiederholt",
            r3.anfragen === 1, `${r3.anfragen} Anfragen (erwartet genau 1)`);
          torPruefung("der Grund eines 401 fehlt im Log", r3.log.includes("unauthorized"));

          const r4 = await fallLauf([{ status: 200 }]);
          torPruefung("auch ein Erfolg loest einen zweiten Versuch aus",
            r4.anfragen === 1 && r4.groesse === 1,
            `${r4.anfragen} Anfragen, ${r4.groesse} Symbole`);
        }
      }

      // Die Gegenprobe: bei wenigen Ausgaengen keine ueberfluessige Zeile.
      const klein = leer("2026-09-17");
      klein.zyklen = 3;
      klein.ausgaenge = { "Keine Kandidaten nach Filter": 2, "# Trade eroeffnet": 1 };
      torPruefung("bei wenigen Ausgaengen steht eine leere '(0 weitere)'-Zeile",
        !/weitere Ausgaenge/.test(tb(klein)));
    }
  }

  // ══ BUS-VERDRAHTUNG: KEIN ABO OHNE SENDER (17.09.) ═══════════════════════
  //
  // GEFUNDEN BEI DER GENERALKONTROLLE, von Hand: der Diagnose-Agent hoerte auf
  // `EXECUTION:TRADE_CLOSED` (sendet niemand — der einzige Sender war bis zum
  // 16.09. eine FALSCH benannte KI-Ablehnung) und auf `DIAGNOSTICS:HEALTH_CHECK`
  // (sendet niemand), und antwortete darauf mit `DIAGNOSTICS:ALERT` (hoert
  // niemand). Ein Empfaenger ohne Sender wartet fuer immer und sieht dabei aus
  // wie eine funktionierende Ueberwachung.
  //
  // Zusaetzlich: die Zyklus-Bilanz liest bestimmte Nutzlast-SCHLUESSEL. Wird
  // `grund` beim Sender in `reason` umbenannt, bleibt alles gruen und die
  // Tagesbilanz meldet stumm "Broker-Fehler: EURUSD: ". Deshalb werden die
  // Schluessel hier gegeneinander gehalten.
  //
  // Die Sendestellen werden mit einem KLAMMERZAEHLER gelesen, nicht mit einem
  // Regex bis zum Zeilenende: bei der Handmessung uebersah ein `\n\}\)`-Muster
  // jede einzeilige Sendestelle und meldete vier Ereignisse faelschlich als
  // "kein Sender". Die Selbstpruefung unten haelt das fest.
  {
    const ohneK = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1 ");
    const klammerBlock = (src, start) => {
      let tiefe = 0;
      for (let i = start; i < src.length && i < start + 4000; i++) {
        const c = src[i];
        if (c === "(" || c === "{" || c === "[") tiefe++;
        else if (c === ")" || c === "}" || c === "]") { tiefe--; if (tiefe === 0) return src.slice(start + 1, i); }
        else if (c === '"' || c === "'" || c === "`") { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; } }
      }
      return null;
    };
    // SCHLUESSEL, NICHT WERTE. Erste Fassung zaehlte jeden Namen vor einem
    // Komma ODER Doppelpunkt — damit galt bei `direction: req.direction` auch
    // der WERT als Schluessel. Die Sabotage "Schluessel umbenannt" blieb
    // deshalb gruen, weil der alte Name im Wert weiterlebte. Jetzt wird auf
    // Ebene 0 an Kommas zerlegt und je Stueck der Kopf vor dem ersten
    // Doppelpunkt genommen (Kurzform `{ scan }` ist der ganze Kopf).
    const schluesselVon = (rumpf) => {
      const teile = []; let tiefe = 0, akt = "";
      for (let i = 0; i < rumpf.length; i++) {
        const c = rumpf[i];
        if (c === '"' || c === "'" || c === "`") {
          const q = c; akt += c; i++;
          while (i < rumpf.length && rumpf[i] !== q) { if (rumpf[i] === "\\") { akt += rumpf[i]; i++; } akt += rumpf[i]; i++; }
          akt += q; continue;
        }
        if (c === "{" || c === "[" || c === "(") tiefe++;
        else if (c === "}" || c === "]" || c === ")") tiefe--;
        else if (c === "," && tiefe === 0) { teile.push(akt); akt = ""; continue; }
        akt += c;
      }
      teile.push(akt);
      const raus = [];
      for (const t of teile) {
        const s = t.trim();
        if (!s) continue;
        let t2 = 0, dp = -1;
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          if (c === '"' || c === "'" || c === "`") { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === "\\") i++; i++; } continue; }
          if (c === "{" || c === "[" || c === "(") t2++;
          else if (c === "}" || c === "]" || c === ")") t2--;
          else if (c === ":" && t2 === 0) { dp = i; break; }
        }
        const kopf = (dp >= 0 ? s.slice(0, dp) : s).trim().replace(/^\.\.\./, "");
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(kopf)) raus.push(kopf);
      }
      return [...new Set(raus)];
    };

    const wurzel = path.join(__dirname, "..", "..", "frontend");
    const dateien = [];
    (function sammeln(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) sammeln(p);
        else if (/\.tsx?$/.test(e.name)) dateien.push(p);
      }
    })(wurzel);

    const sende = new Map(), hoere = new Map();
    for (const abs of dateien) {
      const rel = path.relative(wurzel, abs).replace(/\\/g, "/");
      const src = ohneK(fs.readFileSync(abs, "utf8"));
      for (const m of src.matchAll(/\.publish\s*\(/g)) {
        const rumpf = klammerBlock(src, m.index + m[0].length - 1);
        if (rumpf === null) continue;
        const typ = (rumpf.match(/type:\s*["']([A-Z][A-Z_]*:[A-Z_]+)["']/) || [])[1];
        if (!typ) continue;
        const plIdx = rumpf.indexOf("payload:");
        const gk = plIdx >= 0 ? rumpf.indexOf("{", plIdx) : -1;
        const inner = gk >= 0 ? klammerBlock(rumpf, gk) : null;
        if (!sende.has(typ)) sende.set(typ, []);
        sende.get(typ).push({ datei: rel, schluessel: inner === null ? [] : schluesselVon(inner) });
      }
      for (const m of src.matchAll(/\.subscribe\(\s*["']([A-Z][A-Z_]*:[A-Z_]+)["']/g)) {
        if (!hoere.has(m[1])) hoere.set(m[1], []);
        hoere.get(m[1]).push(rel);
      }
      // Abo ueber eine Schleife: `for (const t of [...])` oder ueber eine Liste im Modul.
      for (const m of src.matchAll(/for\s*\(\s*const\s+(\w+)\s+of\s+([\s\S]{0,400}?)\)\s*\{?([\s\S]{0,300}?)\.subscribe\(\s*(\w+)/g)) {
        if (m[4] !== m[1]) continue;
        let quelle = m[2];
        if (!quelle.includes("[")) {
          const dekl = src.match(new RegExp(`(?:const|let)\\s+${quelle.trim()}\\s*(?::[^=]+)?=\\s*\\[([\\s\\S]*?)\\]`));
          quelle = dekl ? dekl[1] : "";
        }
        for (const t of quelle.matchAll(/["']([A-Z][A-Z_]*:[A-Z_]+)["']/g)) {
          if (!hoere.has(t[1])) hoere.set(t[1], []);
          hoere.get(t[1]).push(rel);
        }
      }
    }

    // SELBSTPRUEFUNG: findet die Messung die bekannten Stellen ueberhaupt?
    // Ohne das koennte ein kaputtes Muster stillschweigend "0 Befunde" melden.
    const belege = [
      ["CYCLE:STARTED", "orchestrator-agent.ts", "s"], ["CYCLE:FINISHED", "orchestrator-agent.ts", "s"],
      ["EXECUTION:TRADE_FAILED", "orchestrator-agent.ts", "s"], ["ANALYSIS:SCAN_DONE", "analysis-agent.ts", "s"],
      ["EXECUTION:TRADE_OPENED", "execution-agent.ts", "s"], ["GATE:DECISION", "agent-bus.ts", "s"],
      ["RISK:HEARTBEAT", "diagnostics-agent.ts", "h"], ["CYCLE:STARTED", "diagnostics-agent.ts", "h"],
      ["GATE:DECISION", "zyklus-bilanz.ts", "h"], ["CYCLE:FINISHED", "zyklus-bilanz.ts", "h"],
    ];
    const blind = belege.filter(([typ, datei, art]) => {
      const liste = art === "s" ? (sende.get(typ) ?? []).map((x) => x.datei) : (hoere.get(typ) ?? []);
      return !liste.some((d) => d.includes(datei));
    });
    torPruefung("die Bus-Messung findet bekannte Stellen nicht mehr — sie ist blind, nicht das Programm sauber",
      blind.length === 0, blind.map(([t, d, a]) => `${a === "s" ? "Sender" : "Abo"} ${t} in ${d}`).join(", "));

    if (blind.length === 0) {
      const ohneSender = [...hoere.keys()].filter((t) => !sende.has(t));
      torPruefung("ein Abo am Bus hat keinen Sender — der Empfaenger wartet fuer immer",
        ohneSender.length === 0,
        ohneSender.map((t) => `${t} (abonniert in ${[...new Set(hoere.get(t))].join(", ")})`).join(" | "));

      // Was die Zyklus-Bilanz aus der Nutzlast liest, muss der Sender auch senden.
      for (const [typ, noetig] of Object.entries({
        "ANALYSIS:SCAN_DONE": ["scan"], "CYCLE:FINISHED": ["ausgang"],
        "EXECUTION:TRADE_OPENED": ["symbol", "direction"], "EXECUTION:TRADE_FAILED": ["symbol", "grund"],
      })) {
        const sender = sende.get(typ) ?? [];
        const schlecht = sender.filter((s) => noetig.some((k) => !s.schluessel.includes(k)));
        torPruefung(`die Zyklus-Bilanz liest aus ${typ} Schluessel, die nicht gesendet werden`,
          sender.length > 0 && schlecht.length === 0,
          sender.length === 0 ? "kein Sender" : schlecht.map((s) => `${s.datei}: sendet ${s.schluessel.join(", ") || "nichts"}, gebraucht ${noetig.join(", ")}`).join(" | "));
      }
    }
  }

  // ══ ORCHESTRATOR- UND AUSFUEHRUNGS-KI: URTEILE GEPRUEFT (16.09.) ═════════
  //
  // Beide Tore uebernahmen die Modellantwort per `as` und fragten
  // `!x.proceed` bzw. `!x.approve` — ein Text "false" ist wahr und gab frei.
  // Die Regel der Orchestrator-KI "CRITICAL → NEIN" hing allein am Modell, und
  // die Alters-Regel der Ausfuehrungs-KI pruefte nichts, weil der Zeitstempel
  // erst bei der Ausfuehrung gesetzt wurde.
  {
    const orchM = ladeTsModul("lib/agents/orchestrator-agent.ts", {
      "broker-config": { MIN_SIGNAL_CONFIDENCE: 70 },
    });
    const pe = orchM.exports?.pruefeOrchestratorEntscheidung;
    if (orchM.fehler || typeof pe !== "function") {
      funde.push(`pruefeOrchestratorEntscheidung nicht ausfuehrbar: ${orchM.fehler ?? "nicht exportiert"}`);
      zusatz++;
    } else {
      const d = (r, st = "HEALTHY") => { try { return pe(r, st); } catch (e) { return { proceed: `WIRFT ${e.message}` }; } };
      torPruefung("die Orchestrator-KI kann trotz CRITICAL Trades freigeben",
        d({ proceed: true, maxTradesThisCycle: 1, reason: "ok" }, "CRITICAL").proceed === false
        && typeof d({ proceed: true }, "CRITICAL").korrektur === "string",
        "ihre eigene Regel lautet CRITICAL → NEIN");
      torPruefung("ein Text \"false\" oder ein fehlendes proceed laesst den Zyklus weiterlaufen",
        d({ proceed: "false" }).proceed === false && d({ proceed: "true" }).proceed === false
        && d({}).proceed === false && d(null).proceed === false,
        "`!x.proceed` ist fuer einen Text wahr");
      torPruefung("eine unlesbare Entscheidung traegt keinen Grund",
        /unlesbar/.test(d({ proceed: 1 }).reason));
      torPruefung("ein echtes JA/NEIN wird nicht uebernommen",
        d({ proceed: true, reason: "Limits ok" }).proceed === true
        && d({ proceed: false, reason: "voll" }).proceed === false
        && d({ proceed: true, reason: "x" }).korrektur === null,
        "DEGRADED ist kein CRITICAL");
      torPruefung("eine 0 oder Unsinn als maxTradesThisCycle haelt den Zyklus an, obwohl JA gesagt wurde",
        d({ proceed: true, maxTradesThisCycle: 0 }).maxTradesThisCycle === 1
        && d({ proceed: true, maxTradesThisCycle: -3 }).maxTradesThisCycle === 1
        && d({ proceed: true, maxTradesThisCycle: 1.5 }).maxTradesThisCycle === 1
        && d({ proceed: true, maxTradesThisCycle: "2" }).maxTradesThisCycle === 1
        && d({ proceed: true, maxTradesThisCycle: 2 }).maxTradesThisCycle === 2);
      torPruefung("DEGRADED wird wie CRITICAL behandelt", d({ proceed: true }, "DEGRADED").proceed === true);
    }

    const exM = ladeTsModul("lib/agents/execution-agent.ts");
    const pa = exM.exports?.pruefeAusfuehrungsUrteil;
    const sa = exM.exports?.signalAlterSekunden;
    const MAXA = exM.exports?.SIGNAL_MAX_ALTER_S;
    if (exM.fehler || typeof pa !== "function" || typeof sa !== "function") {
      funde.push(`Ausfuehrungs-Pruefungen nicht ausfuehrbar: ${exM.fehler ?? "nicht exportiert"}`);
      zusatz++;
    } else {
      const u = (r) => { try { return pa(r); } catch (e) { return { approve: `WIRFT ${e.message}` }; } };
      torPruefung("ein Text \"false\" gibt die Order frei",
        u({ approve: "false" }).approve === false && u({ approve: "true" }).approve === false
        && u({}).approve === false && u({ approve: true }).approve === true);
      torPruefung("unbekannte Broker-Namen kommen durch",
        JSON.stringify(u({ approve: true, brokers: ["CAPITAL", "capital", "BINANCE", "IC_MARKETS"] }).brokers)
        === JSON.stringify(["CAPITAL", "IC_MARKETS"]));
      torPruefung("eine fehlende Broker-Liste wird nicht als fehlend weitergegeben",
        u({ approve: true }).brokers === undefined,
        "der Aufrufer faellt dann auf den Ausfall-Rueckfall zurueck (IC bleibt an die Freigabe gebunden)");
      const jetzt = Date.parse("2026-09-16T18:35:00Z");
      torPruefung("das Signal-Alter wird falsch berechnet",
        sa("2026-09-16T18:28:55Z", jetzt) === 365 && sa("2026-09-16T18:35:00Z", jetzt) === 0
        && sa("2026-09-16T18:36:00Z", jetzt) === 0
        && sa(undefined, jetzt) === null && sa("kein Datum", jetzt) === null && sa(123, jetzt) === null,
        `${sa("2026-09-16T18:28:55Z", jetzt)}`);
      torPruefung("die Altersgrenze ist nicht die der KI-Regel (300 s)", MAXA === 300, String(MAXA));
    }

    const oq2 = read("frontend/lib/agents/orchestrator-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("die Orchestrator-KI-Antwort wird wieder ungeprueft benutzt",
      /const aiDecision = pruefeOrchestratorEntscheidung\(\s*diagnostics\.systemStatus === "CRITICAL"/.test(oq2),
      "geprueft wird an der EINEN Stelle, an der entschieden wird");
    torPruefung("das Signal-Alter startet wieder erst bei der Ausfuehrung",
      /signalGeneratedAt: analysisResult\.scannedAt,/.test(oq2)
      && !/signalGeneratedAt: new Date\(\)/.test(oq2),
      "dann ist das Alter immer ~0 s und die Regel prueft nichts");
    const ex2 = read("frontend/lib/agents/execution-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("die Ausfuehrungs-KI-Antwort wird wieder ungeprueft benutzt",
      /if \(json\) return pruefeAusfuehrungsUrteil\(JSON\.parse\(json\)\);/.test(ex2)
      && !/as AIExecutionDecision;/.test(ex2));
    torPruefung("ein zu altes Signal wird der KI noch vorgelegt",
      /if \(alter !== null && alter > SIGNAL_MAX_ALTER_S\) \{\s*aiDecision = \{\s*approve: false,/.test(ex2));
  }

  // ══ DIE AUSFUEHRUNGS-KI DARF DAS RISIKO NUR SENKEN (16.09.) ══════════════
  //
  // `riskPercent: aiDecision.adjustedRiskPercent ?? req.riskPercent` ersetzte
  // das sorgfaeltig gerechnete Risiko (min(Claude, maxRiskPerTrade), danach
  // Volatilitaets-Kuerzung) durch eine UNGEPRUEFTE Zahl aus einer
  // Modellantwort; capital-com-execution rechnet sie direkt in die Groesse.
  // Kein Pruefer sah das. Gerechnet, weil "nur nach unten" in jeder Fassung
  // plausibel aussieht — ob 0.4 wieder zu 1 wird, zeigt nur der Aufruf.
  {
    const exModul = ladeTsModul("lib/agents/execution-agent.ts");
    if (exModul.fehler) {
      funde.push(`execution-agent.ts nicht ausfuehrbar: ${exModul.fehler}`);
      zusatz++;
    } else if (typeof exModul.exports.wirksamesKiRisiko !== "function") {
      funde.push("wirksamesKiRisiko nicht exportiert — die KI koennte die Positionsgroesse wieder ungeprueft setzen");
      zusatz++;
    } else {
      const wr = (a, k) => { try { return exModul.exports.wirksamesKiRisiko(a, k); } catch (e) { return { risiko: `WIRFT ${e.message}` }; } };
      torPruefung("ein KI-Vorschlag ueber dem gerechneten Risiko wird uebernommen",
        wr(1, 5).risiko === 1 && wr(1, 1.01).risiko === 1,
        `${wr(1, 5).risiko} / ${wr(1, 1.01).risiko} — die 1-%-Grenze des Nutzers waere ausgehebelt`);
      torPruefung("ein durch Volatilitaet gekuerztes Risiko wird von der KI wieder angehoben",
        wr(0.4, 1).risiko === 0.4 && wr(0.4, 1.5).risiko === 0.4,
        `${wr(0.4, 1).risiko} — die Kuerzung waere wirkungslos`);
      torPruefung("eine Senkung durch die KI wird nicht uebernommen",
        wr(1, 0.5).risiko === 0.5 && wr(1, 1).risiko === 1);
      torPruefung("ohne KI-Wert gilt nicht das gerechnete Risiko",
        wr(0.8, undefined).risiko === 0.8 && wr(0.8, null).risiko === 0.8
        && wr(0.8, undefined).hinweis === null);
      const muell = [NaN, Infinity, -Infinity, -1, 0, "0.5", "5", {}, [], true];
      const durch = muell.filter((k) => wr(1, k).risiko !== 1);
      torPruefung("ein unbrauchbarer KI-Wert setzt das Risiko",
        durch.length === 0, durch.map((k) => `${String(k)} -> ${wr(1, k).risiko}`).join(", "));
      // Eigenschaft ueber ein Raster: das Ergebnis liegt NIE ueber dem angefragten Wert.
      let ueber = 0;
      for (const a of [0.1, 0.25, 0.4, 0.5, 1, 1.5, 2]) {
        for (const k of [0, 0.05, 0.1, 0.39, 0.4, 0.41, 1, 1.49, 2, 10, 100]) {
          if (!(wr(a, k).risiko <= a)) ueber++;
        }
      }
      torPruefung("das wirksame Risiko liegt irgendwo UEBER dem gerechneten", ueber === 0, `${ueber} Faelle`);
      // AUCH ein knapper Erhoehungsversuch (1.01 statt 1) wird benannt. Im
      // Sabotage-Lauf blieb "Erhoehung erst ab dem Doppelten melden" gruen:
      // der Handel war trotzdem sicher, aber der Versuch waere still verschwunden.
      torPruefung("eine Aenderung durch die KI wird nicht benannt",
        typeof wr(1, 5).hinweis === "string" && typeof wr(1, 1.01).hinweis === "string"
        && typeof wr(1, 0.5).hinweis === "string" && typeof wr(1, NaN).hinweis === "string"
        && wr(1, 1).hinweis === null,
        "jeder Eingriff der KI in die Positionsgroesse gehoert ins Log — und nur ein Eingriff");
    }
    const exCode = read("frontend/lib/agents/execution-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("die Order bekommt wieder das ungepruefte KI-Risiko",
      /const kiRisiko = wirksamesKiRisiko\(req\.riskPercent, aiDecision\.adjustedRiskPercent\);/.test(exCode)
      && /riskPercent: kiRisiko\.risiko,/.test(exCode)
      && !/adjustedRiskPercent\s*\?\?/.test(exCode),
      "genau dieser Ausdruck war das Loch");
  }

  // ══ DER WATCHDOG SIEHT ALLES — UND STOPPT NICHT BEI JEDER SCANNER-WELLE (15.09.)
  //
  // BEWIESEN, mit den echten Funktionen gegen einen nachgebildeten Redis:
  //   - 20 gleichzeitige Ereignisse von 20 IPs -> 1 gespeichert
  //     (lesen-einfuegen-zurueckschreiben ohne Sperre)
  //   - was WAEHREND der Claude-Analyse eintraf, wurde danach mit `[]`
  //     ueberschrieben — ungeprueft geloescht
  //   - keine Sperre gegen ueberlappende Laeufe (SDK-Timeout 10 min,
  //     Intervall 3 min)
  //
  // Entscheidung des Nutzers: Speicher reparieren UND die Eskalation zugleich
  // anpassen. Der Verlust hatte die Regel "ATTACK + >= 5 IPs -> Killswitch"
  // vermutlich zufaellig entschaerft; mit vollstaendigem Speicher haette jede
  // Scanner-Welle den Handel stoppen koennen. Jetzt: Block umgangen ->
  // sofort; >= 5 IPs -> erst beim zweiten Zyklus in Folge.
  {
    const wdModul = ladeTsModul("lib/security-watchdog/claude-watchdog.ts");
    if (wdModul.fehler) {
      funde.push(`claude-watchdog.ts nicht ausfuehrbar: ${wdModul.fehler}`);
      zusatz++;
    } else {
      const { watchdogDarfStarten: darf, eskalationsEntscheidung: esk,
        WATCHDOG_HAENGER_MS: HAENGER, KOORDINIERT_FENSTER_MS: FENSTER } = wdModul.exports;
      if (typeof darf !== "function" || typeof esk !== "function") {
        funde.push("watchdogDarfStarten / eskalationsEntscheidung nicht exportiert — "
          + "Sperre und Eskalationsregel waeren ungeprueft");
        zusatz++;
      } else {
        const sicher = (fn) => { try { return fn(); } catch (e) { return { wirft: e.message }; } };

        // ── Sperre ──
        torPruefung("ohne laufenden Lauf startet der Watchdog nicht",
          darf(null, 1000).starten === true && darf(undefined, 1000).starten === true);
        torPruefung("ein laufender Lauf wird ueberlappt",
          darf(0, 3 * 60_000).starten === false && darf(0, HAENGER - 1).starten === false,
          "sonst stapeln sich Laeufe bei haengender API");
        torPruefung("ein haengender Lauf blockiert den Watchdog fuer immer",
          darf(0, HAENGER).starten === true && darf(0, HAENGER * 4).starten === true,
          "eine Sperre, die nie aufgeht, schaltet ihn still ab");
        torPruefung("eine unbrauchbare oder rueckwaerts laufende Uhr blockiert den Watchdog",
          darf(NaN, 1000).starten === true && darf(5000, 1000).starten === true);
        torPruefung("die Haengerzeit ist keine sinnvolle Dauer",
          HAENGER >= 11 * 60_000 && HAENGER <= 60 * 60_000,
          `${HAENGER} ms — muss ueber dem SDK-Timeout von 10 min liegen`);

        // ── Eskalation ──
        const jetzt = 10_000_000;
        const f = (bypassedIP, distinctIPs, vorher, t = jetzt) =>
          sicher(() => esk({ bypassedIP, distinctIPs, vorherKoordiniertAm: vorher, jetzt: t }));
        torPruefung("ein umgangener Block loest den Killswitch nicht SOFORT aus",
          f("1.2.3.4", 1, null).killswitch === true && f("1.2.3.4", 9, null).killswitch === true,
          "das ist kein Laerm — die Sperre wurde ueberwunden");
        torPruefung("eine einzelne IP loest den Killswitch aus",
          f(null, 4, jetzt - 60_000).killswitch === false && f(null, 1, null).killswitch === false);
        const erster = f(null, 5, null);
        torPruefung("der ERSTE koordinierte Zyklus stoppt den Handel — eine Scanner-Welle reicht dann",
          erster.killswitch === false && erster.merkeKoordiniert === true, JSON.stringify(erster));
        torPruefung("der ZWEITE koordinierte Zyklus in Folge loest den Killswitch nicht aus",
          f(null, 5, jetzt - 3 * 60_000).killswitch === true
          && f(null, 12, jetzt - FENSTER).killswitch === true,
          "genau auf der Fenstergrenze zaehlt noch als in Folge");
        torPruefung("ein koordinierter Zyklus nach der Fensterzeit gilt faelschlich als in Folge",
          f(null, 5, jetzt - FENSTER - 1).killswitch === false
          && f(null, 5, jetzt - FENSTER - 1).merkeKoordiniert === true);
        torPruefung("eine rueckwaerts laufende Uhr oder ein kaputter Merkwert stoppt den Handel",
          f(null, 5, jetzt + 60_000).killswitch === false && f(null, 5, NaN).killswitch === false);
        torPruefung("eine unbrauchbare IP-Zahl gilt als koordiniert",
          f(null, NaN, jetzt - 60_000).killswitch === false && f(null, NaN, null).merkeKoordiniert === false);
        torPruefung("das Fenster fuer 'in Folge' ist nicht sinnvoll",
          FENSTER >= 3 * 60_000 && FENSTER <= 15 * 60_000,
          `${FENSTER} ms — Intervall ist 3 min`);
      }
    }

    // ── Der echte Speicher: redis-cache.ts im Rueckfall ohne Redis ──
    // `redis` wird durch einen Wurf ersetzt: auch wenn REDIS_URL gesetzt ist,
    // verbindet sich der Pruefer nie mit einem echten Redis.
    const altListen = global.__speicher_listen__;
    delete global.__speicher_listen__;
    try {
      const cache = ladeTsModul("lib/cache/redis-cache.ts", {
        "redis": { createClient: () => { throw new Error("kein Redis im Pruefstand"); } },
      });
      const log = cache.fehler ? cache : ladeTsModul("lib/security-watchdog/security-event-logger.ts",
        { "redis-cache": cache.exports });
      if (log.fehler) {
        funde.push(`Ereignis-Speicher nicht ausfuehrbar: ${log.fehler}`);
        zusatz++;
      } else {
        const { logSecurityEvent, leseSicherheitsereignisse, entferneAnalysierte } = log.exports;
        await logSecurityEvent({ type: "HONEYPOT_ACCESS", ip: "1.1.1.1", path: "/.env", ts: 1 });
        const erst = await leseSicherheitsereignisse();
        await logSecurityEvent({ type: "SQL_INJECTION", ip: "6.6.6.6", path: "/api", ts: 2 });
        await entferneAnalysierte(erst.roh);
        const danach = (await leseSicherheitsereignisse()).ereignisse;
        torPruefung("ein Ereignis WAEHREND der Analyse wird mit geloescht — ungeprueft",
          erst.ereignisse.length === 1 && danach.length === 1 && danach[0].type === "SQL_INJECTION",
          `analysiert ${erst.ereignisse.length}, danach ${danach.length}`);
        await entferneAnalysierte((await leseSicherheitsereignisse()).roh);

        await Promise.all(Array.from({ length: 20 }, (_, i) =>
          logSecurityEvent({ type: "PATH_TRAVERSAL", ip: `9.9.9.${i}`, path: "/x", ts: 100 + i })));
        const zwanzig = (await leseSicherheitsereignisse()).ereignisse;
        torPruefung("gleichzeitige Ereignisse gehen verloren — ein koordinierter Angriff waere unsichtbar",
          zwanzig.length === 20 && new Set(zwanzig.map((e) => e.ip)).size === 20,
          `${zwanzig.length} von 20 gespeichert`);

        await Promise.all(Array.from({ length: 250 }, (_, i) =>
          logSecurityEvent({ type: "BRUTE_FORCE", ip: `8.8.8.${i % 250}`, path: "/y", ts: 1000 + i })));
        // Den SPEICHER messen, nicht das Lesen: `leseSicherheitsereignisse`
        // liest ohnehin hoechstens 200. Im Sabotage-Lauf blieb "Obergrenze
        // entfernt" deshalb gruen — gespeichert waren 270, gelesen 200.
        const gespeichert = global.__speicher_listen__?.get("security:events:liste")?.werte?.length;
        torPruefung("die Obergrenze der Ereignisliste greift nicht — der Speicher waechst unbegrenzt",
          gespeichert === 200, `${gespeichert} im Speicher nach 270 Ereignissen`);
      }
    } finally {
      if (altListen === undefined) delete global.__speicher_listen__;
      else global.__speicher_listen__ = altListen;
    }

    // ── Verdrahtung (kommentarbereinigt) ──
    const wdCode = read("frontend/lib/security-watchdog/claude-watchdog.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    const logCode = read("frontend/lib/security-watchdog/security-event-logger.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    const cacheCode = read("frontend/lib/cache/redis-cache.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("irgendwo wird die Ereignisliste wieder komplett geloescht",
      !/clearSecurityEvents/.test(wdCode) && !/clearSecurityEvents/.test(logCode)
      && !/cacheSet\(/.test(logCode) && !/cacheGet\(/.test(logCode),
      "lesen-einfuegen-zurueckschreiben verliert gleichzeitige Ereignisse");
    torPruefung("der Watchdog entfernt nicht genau die analysierten Ereignisse",
      /await entferneAnalysierte\(roh\);\s*return result;/.test(wdCode),
      "und zwar im try-Zweig — bei einem Ausfall muessen sie stehen bleiben");
    torPruefung("der Watchdog-Lauf hat keine Ueberlappungssperre",
      /watchdogDarfStarten\(global\.__watchdog_laeuft_seit__/.test(wdCode)
      && /if \(global\.__watchdog_laeuft_seit__ === kennung\) global\.__watchdog_laeuft_seit__ = null;/.test(wdCode),
      "ohne Kennung gaebe ein spaet endender Haenger die Sperre des neuen Laufs frei");
    // Die drei folgenden sind im Sabotage-Lauf ENTWISCHT: die Rechnung der
    // reinen Funktionen stimmte, aber der Zyklus beachtete sie nicht.
    torPruefung("die Ueberlappungssperre wird berechnet, aber nicht beachtet",
      /if \(!darf\.starten\) \{[\s\S]{0,160}?return \{ uebersprungen: true/.test(wdCode),
      "sonst laufen Zyklen trotz Sperre uebereinander");
    torPruefung("der erste koordinierte Zyklus wird nicht gemerkt — der zweite waere nie 'in Folge'",
      /else if \(entscheidung\.merkeKoordiniert\) \{[\s\S]{0,200}?cacheSet\(KOORDINIERT_SCHLUESSEL, Date\.now\(\)/.test(wdCode)
      && /cacheGet<number>\(KOORDINIERT_SCHLUESSEL\)/.test(wdCode)
      && /vorherKoordiniertAm: typeof vorher === "number" \? vorher : null/.test(wdCode),
      "ohne Merkwert loest ein koordinierter Angriff nie mehr aus");
    torPruefung("ein ruhiger Zyklus setzt 'koordiniert' nicht zurueck — 'in Folge' waere keine Folge",
      /\} else \{\s*await koordiniertVergessen\(\);\s*\}/.test(wdCode)
      && /events\.length === 0\) \{[\s\S]{0,200}?await koordiniertVergessen\(\)/.test(wdCode),
      "SAFE/SUSPICIOUS und der Zyklus ohne Ereignisse muessen die Zaehlung unterbrechen");
    const handleAttackAufrufe = (wdCode.match(/handleAttack\(/g) || []).length;
    torPruefung("der Killswitch haengt nicht (nur) an der Eskalationsentscheidung",
      handleAttackAufrufe === 2 && /if \(entscheidung\.killswitch\) \{[\s\S]{0,120}handleAttack\(/.test(wdCode),
      `${handleAttackAufrufe} Vorkommen (1 Aufruf + 1 Definition erwartet)`);
    torPruefung("der atomare Listen-Speicher benutzt kein MULTI mehr",
      /multi\(\)\.lPush\(key, roh\)\.lTrim\(key, 0, max - 1\)\.expire\(key, ttlSeconds\)\.exec\(\)/.test(cacheCode)
      && /m\.lRem\(key, -1, r\)/.test(cacheCode));
    torPruefung("der Speicher-Rueckfall der Listen liegt nicht auf global",
      /global\.__speicher_listen__\s*\?\?=/.test(cacheCode),
      "Proxy (Schreiber) und Schleife (Leser) sehen sonst verschiedene Kopien");
  }

  // ══ KEIN DATEIZUGRIFF IM PROGRAMM OHNE FREIGABE (15.09. abends) ══════════
  //
  // DIE VORGESCHICHTE. `lib/agents/validation-agent.ts` war der EINZIGE
  // `fs`-Nutzer im ganzen Programm. Er las Dateien, deren Namen aus dem
  // Anfrage-Rumpf kamen (`.env.local` lag INNERHALB des Projekts und waere
  // durch jede blosse Wurzel-Begrenzung gerutscht), rief `git diff` per exec
  // auf, und seine dynamischen Pfade liessen Turbopack das GANZE Projekt ins
  // `standalone`-Buendel verfolgen, das der Dockerfile vollstaendig ins
  // Railway-Image kopiert (gemessen: 331 Quelldateien, CLAUDE.md).
  //
  // Die Route hatte keinen einzigen Aufrufer. Sie wurde am 15.09. entfernt —
  // und mit ihr der Riegel, der sie abgesichert hatte.
  //
  // DIESE PRUEFUNG sichert nicht mehr die eine Datei, sondern die KLASSE: kein
  // Code in app/, lib/, components/, instrumentation.ts oder proxy.ts darf
  // `fs` importieren, ohne hier namentlich freigegeben zu sein. Heute ist die
  // Liste LEER — nachgemessen. Wer Dateizugriff braucht, traegt die Datei ein
  // und begruendet es; ein stiller neuer Leser faellt sofort auf.
  //
  // Gezaehlt werden statische UND dynamische Importe, `require()` und
  // `node:`-Praefix. Kommentare und Zeichenketten zaehlen nicht — die
  // Begruendung oben nennt `fs` selbst.
  {
    const FS_ERLAUBT = [];   // bewusst leer — siehe oben
    const wurzel = path.join(__dirname, "../../frontend");
    const bereiche = ["app", "lib", "components"];
    const einzeln = ["instrumentation.ts", "proxy.ts"];
    const dateien = [];
    const sammle = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          // Generierter Prisma-Client: fremder Code, liest seine eigene Engine.
          if (e.name === "generated") continue;
          sammle(p);
        } else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) dateien.push(p);
      }
    };
    for (const b of bereiche) sammle(path.join(wurzel, b));
    for (const d of einzeln) { const p = path.join(wurzel, d); if (fs.existsSync(p)) dateien.push(p); }

    const FS_IMPORT = /(?:from\s*["'](?:node:)?fs(?:\/promises)?["']|import\s*\(\s*["'](?:node:)?fs(?:\/promises)?["']\s*\)|require\s*\(\s*["'](?:node:)?fs(?:\/promises)?["']\s*\))/;
    const nutzer = [];
    for (const p of dateien) {
      // NUR Kommentare entfernen, Zeichenketten bleiben: der Modulname IST
      // eine Zeichenkette ("fs"). Kommentare mit `(^|[^:])`-Schutz fuer URLs.
      const code = fs.readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      if (FS_IMPORT.test(code)) nutzer.push(path.relative(wurzel, p).replace(/\\/g, "/"));
    }
    const unerlaubt = nutzer.filter((n) => !FS_ERLAUBT.includes(n));

    torPruefung("der Dateizugriffs-Riegel hat nichts angesehen — Pruefung ins Leere",
      dateien.length >= 300, `${dateien.length} Dateien`);
    torPruefung("Code im Programm importiert `fs` ohne Freigabe — Dateinamen aus Anfragen, "
      + "ganzes Projekt im Image, .env im Prompt: alles schon passiert",
      unerlaubt.length === 0, unerlaubt.join(", "));
    torPruefung("die entfernte Dev-Route ist zurueck",
      !fs.existsSync(path.join(wurzel, "app/api/validation-agent"))
      && !fs.existsSync(path.join(wurzel, "lib/agents/validation-agent.ts")),
      "sie las Dateien nach Namen aus der Anfrage und rief git per exec");
  }

  return {
    titel: `Sicherheitsnetze (${pruefungen.length + 23 + zusatz} Prüfungen)`,
    funde,
  };
};
