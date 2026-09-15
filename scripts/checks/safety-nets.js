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
const { read, ladeTsModul } = require("./_lib");

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
    /if \(blockNewTrades\) \{[\s\S]{0,600}?return;\s*\}\s*const analysisResult = await runAnalysisAgent/
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
        "telegram-sender": { sendTelegram: async (t) => { gesendet.push(t); } },
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
    torPruefung("IC bekommt wieder ohne Freigabe Orders",
      /useIC = aiDecision\.brokers\.includes\("IC_MARKETS"\) && icFreigegeben/.test(exec),
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
  // Am 15.09. wurden deshalb ALLE 150 API-Routen durchgemessen: 65 haben
  // keinen Aufrufer im Quelltext. Das ist fuer sich kein Fehler — aber eine
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

  // ══ KEINE FREMDE DATEI IN EINEN PROMPT (15.09. abends) ═══════════════════
  //
  // DER FUND. `validation-agent.ts` hatte eine Funktion namens
  // `readFilesSafe` — und sie war es nicht. Sie rechnete
  // `path.resolve(base, f)` mit `f` direkt aus dem Anfrage-Rumpf
  // (`filesToTouch`) und schob den Inhalt in einen Prompt. `path.resolve`
  // begrenzt nichts:
  //
  //   "/etc/passwd"  -> /etc/passwd        (absolut schlaegt base)
  //   "../.env"      -> /app/.env
  //   ".env.local"   -> /app/frontend/.env.local   -- LIEGT IN base!
  //
  // Der letzte Fall ist der wichtige: eine reine Wurzel-Begrenzung haette ihn
  // durchgelassen. CLAUDE.md sagt woertlich: `.env` niemals anzeigen.
  //
  // EHRLICH EINGEORDNET: der Proxy verlangt fuer die Route ein gueltiges JWT,
  // und das Cookie ist httpOnly + secure + sameSite lax. Es war kein offenes
  // Tor ins Internet, sondern ein fehlender Riegel dahinter.
  //
  // GERECHNET, nicht gesucht: eine Wurzel-Begrenzung sieht in jeder Fassung
  // richtig aus. Ob sie `.env.local` faengt, sagt nur der Aufruf.
  //
  // BEIDE PLATTFORMEN (nachgeschaerft im Sabotage-Lauf). Die erste Fassung
  // rechnete nur mit dem `path` der Maschine, auf der der Pruefer laeuft —
  // hier Windows. Produktion ist Railway, also LINUX, und dort gelten andere
  // Regeln: `path.posix.isAbsolute("C:\\Windows\\win.ini")` ist false. Eine
  // Pruefung, die nur die Semantik des Entwicklerrechners kennt, sichert die
  // Produktion nicht ab. Gemessen, nicht vermutet (win32 vs. posix).
  const vaLaden = (pfadModul) => ladeTsModul("lib/agents/validation-agent.ts", {
    // Die echten Node-Module: `promisify(exec)` laeuft auf Modulebene und
    // scheitert sonst am Stellvertreter. `import x from "y"` wird zu
    // `y_1.default` — deshalb beide Formen.
    "child_process": require("child_process"),
    "fs/promises": Object.assign({ default: require("fs/promises") }, require("fs/promises")),
    "util": require("util"),
    "path": Object.assign({ default: pfadModul }, pfadModul),
    "@anthropic-ai/sdk": class { },
    "telegram-sender": { sendTelegram: async () => false },
  });
  for (const [plattform, pfadModul, basis] of [
    ["win32", path.win32, "C:\\app\\frontend"],
    ["linux", path.posix, "/app/frontend"],       // so laeuft Railway
  ]) {
    const vaModul = vaLaden(pfadModul);
    if (vaModul.fehler) {
      funde.push(`[${plattform}] validation-agent.ts nicht ausfuehrbar — der `
        + `Datei-Riegel bleibt ungeprueft: ${vaModul.fehler}`);
      zusatz++;
      continue;
    }
    {
      const frei = vaModul.exports.dateiFreigegeben;
      if (typeof frei !== "function") {
        funde.push("dateiFreigegeben wird nicht exportiert — der Riegel gegen "
          + "fremde Dateien im Prompt waere unmessbar");
        zusatz++;
      } else {
        // Ein WURF ist ein Befund, kein Absturz. Im Sabotage-Lauf brach der
        // ganze Pruefer bei `null.replace` ab — rot, aber aus dem falschen
        // Grund, und alle Pruefungen danach liefen gar nicht mehr.
        const urteil = (a) => {
          try { return frei(basis, a); }
          catch (e) { return { erlaubt: "WIRFT", pfad: null, grund: `wirft: ${e.message}` }; }
        };
        const erlaubt = (a) => urteil(a).erlaubt === true;
        const wirft = (a) => urteil(a).erlaubt === "WIRFT";

        // Was WEITER GEHEN MUSS. Ein zu strenger Riegel ist auch ein Fehler —
        // dieselbe Lehre wie beim Kurs-Riegel am 24.08.
        torPruefung(`[${plattform}] eine gewoehnliche Quelldatei wird faelschlich abgelehnt`,
          erlaubt("lib/foo.ts") && erlaubt("frontend/lib/foo.ts")
          && erlaubt("lib/../lib/ok.ts"),
          "der Riegel darf den eigentlichen Zweck nicht zerstoeren");

        // Und was NICHT durchkommen darf.
        const verboten = [
          ["/etc/passwd", "absolut — schlaegt jede Wurzel"],
          ["C:\\Windows\\win.ini", "absolut, Windows-Laufwerk"],
          ["\\\\server\\share\\x", "absolut, UNC"],
          ["../.env", "eine Ebene hoeher"],
          ["../../.env", "zwei Ebenen hoeher"],
          ["lib/../../.env", "Umweg ueber einen gueltigen Ordner"],
          [".env", "INNERHALB des Projekts"],
          [".env.local", "INNERHALB — faengt keine Wurzel-Begrenzung"],
          [".ENV.production", "Gross-/Kleinschreibung"],
          ["config/.env", "tiefer im Baum"],
          [".git/config", "Versionsdaten"],
          ["node_modules/x/y.js", "Fremdcode"],
          ["../frontend-geheim/x.ts", "Praefix-Falle: beginnt mit dem Wurzelnamen"],
          ["", "leer"],
          [null, "nicht gesetzt"],
          [42, "keine Zeichenkette"],
          ["..", "der Elternordner selbst"],
        ];
        // Kein Eingabewert darf den Riegel zum Werfen bringen: im Lesepfad
        // steht der Aufruf ausserhalb des try — ein Wurf risse die ganze
        // Anfrage mit, statt die eine Datei abzulehnen.
        const werfer = verboten.filter(([a]) => wirft(a));
        torPruefung(`[${plattform}] der Datei-Riegel wirft bei ungueltiger Eingabe`,
          werfer.length === 0,
          werfer.map(([a]) => `${JSON.stringify(a)}: ${urteil(a).grund}`).join(", "));

        const durchgerutscht = verboten.filter(([a]) => erlaubt(a));
        torPruefung(`[${plattform}] eine fremde oder geheime Datei kommt in den Prompt`,
          durchgerutscht.length === 0,
          durchgerutscht.map(([a, w]) => `${JSON.stringify(a)} (${w})`).join(", "));

        // Der Grund muss benannt sein — eine stille Ablehnung sieht aus wie
        // eine fehlende Datei, und niemand merkt den Versuch (Fund 06.08.).
        const abgelehnt = urteil("/etc/passwd");
        torPruefung(`[${plattform}] eine Ablehnung nennt keinen Grund`,
          typeof abgelehnt.grund === "string" && abgelehnt.grund.length > 3,
          JSON.stringify(abgelehnt));
        torPruefung(`[${plattform}] eine Ablehnung liefert trotzdem einen Pfad`,
          abgelehnt.pfad === null,
          "sonst koennte ein Aufrufer ihn versehentlich benutzen");
      }
    }
  }
  // Und der Riegel muss WIRKLICH im Lesepfad stehen — einmal, nicht je
  // Plattform. Die Rechnung oben waere wertlos, wenn `readFilesSafe` sie
  // nicht aufruft.
  {
    const va = read("frontend/lib/agents/validation-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("readFilesSafe ruft den Datei-Riegel nicht auf",
      /dateiFreigegeben\(\s*base\s*,\s*f\s*\)/.test(va),
      "sonst rechnet der Riegel, und gelesen wird weiter ungeprueft");
    torPruefung("readFilesSafe loest den Pfad wieder selbst auf",
      !/path\.resolve\(\s*base\s*,/.test(va),
      "genau diese Zeile war das Leck");
    torPruefung("gelesen wird nicht der freigegebene Pfad",
      /fs\.readFile\(\s*urteil\.pfad\s*,/.test(va),
      "sonst pruefte der Riegel das eine und gelesen wuerde das andere");
  }

  return {
    titel: `Sicherheitsnetze (${pruefungen.length + 23 + zusatz} Prüfungen)`,
    funde,
  };
};
