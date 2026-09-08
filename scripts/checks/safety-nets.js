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
    const entscheidungen = (ic.match(/meta\.stilGeraten/g) || []).length;
    torPruefung("IC Markets: `meta.stilGeraten` wird nicht genau einmal abgefragt",
      entscheidungen === 1,
      `${entscheidungen}x — nur der Zeit-Exit darf davon abhaengen`);
    // Das Meldungs-Gedaechtnis darf nicht wachsen (Leck-Klasse vom 26.08.).
    torPruefung("IC Markets: das Meldungs-Gedaechtnis wird nie aufgeraeumt",
      /gerateneGemeldetIC\.delete\(/.test(ic),
      "ein Set, das nur waechst — dasselbe Leck wie in der Brute-Force-Karte");
  }

  return {
    titel: `Sicherheitsnetze (${pruefungen.length + 23 + zusatz} Prüfungen)`,
    funde,
  };
};
