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

// Seit dem 02.11. faellt `reply()` bei kaputtem HTML auf reinen Text
// zurueck und braucht dafuer `htmlAbgelehnt`. JEDER Webhook-Pruefstand
// muss die Funktion liefern — ohne Ersatz ist es der Stellvertreter, und
// der wirft beim Aufruf. Die ECHTE Funktion, keine zweite Kopie des
// Regex: zwei Fassungen koennten auseinanderlaufen.
// Und hebel.ts entschaerft seit dem 02.11. seine Gruppennamen — jede
// Ladestelle braucht das ECHTE Modul, sonst wirft der Stellvertreter in
// befundVon() und der ganze Pruefer stuerzt ab (so geschehen).
const htmlSicherEcht = ladeTsModul("lib/html-sicher/html-sicher.ts").exports;

const tgHtml = ladeTsModul("lib/telegram-notifications/telegram-sender.ts")
  .exports?.htmlAbgelehnt;
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
    const FENSTER = orchModul.exports.HANDELSFENSTER;

    // ── AN DIE BOERSENZONEN GEBUNDEN (01.11.) ───────────────────────────
    //
    // Die alten sieben Faelle lagen ALLE auf demselben Tag (07.09.2026) —
    // und der liegt in der Sommerzeit. Damit konnte der Testfall die
    // Sommer/Winter-Luecke GAR NICHT ausdruecken, und sie blieb zwei
    // Monate unentdeckt. Jetzt: Winter, Sommer UND ein Uebergangstag, an
    // dem London und New York 4 statt 5 Stunden auseinanderliegen.
    //
    // Wochentage nachgerechnet, nicht angenommen: 02.11. Mo, 06.11. Fr,
    // 07.11. Sa, 01.11. So, 15.07. Mi, 17.07. Fr, 09.03. Mo, 27.10. Di.
    torPruefung("HANDELSFENSTER wird nicht exportiert — dann haengt der "
      + "Pruefstand an Zahlen statt an der Quelle",
      !!FENSTER && FENSTER.oeffnetLondon === 7 * 60
      && FENSTER.schliesstNewYork === 17 * 60
      && FENSTER.zoneLondon === "Europe/London"
      && FENSTER.zoneNewYork === "America/New_York",
      JSON.stringify(FENSTER ?? null));

    for (const [name, iso, soll] of [
      // WINTER (MEZ/GMT): oeffnet 07:00 UTC, schliesst 22:00 UTC.
      ["WINTER Mo 06:59 UTC — eine Minute zu frueh", "2026-11-02T06:59:00Z", false],
      ["WINTER Mo 07:00 UTC — 08:00 Zuerich, Fenster auf", "2026-11-02T07:00:00Z", true],
      ["WINTER Mo 21:59 UTC — letzte Minute", "2026-11-02T21:59:00Z", true],
      ["WINTER Mo 22:00 UTC — New York schliesst", "2026-11-02T22:00:00Z", false],
      ["WINTER Fr 21:59 UTC — Wochenschluss", "2026-11-06T21:59:00Z", true],
      ["WINTER Sa 12:00 UTC", "2026-11-07T12:00:00Z", false],
      ["WINTER So 12:00 UTC", "2026-11-01T12:00:00Z", false],
      // SOMMER (MESZ/BST/EDT): oeffnet 06:00 UTC, schliesst 21:00 UTC.
      // GENAU DIESE VIER haette das alte Fenster falsch beantwortet.
      ["SOMMER Mi 05:59 UTC — eine Minute zu frueh", "2026-07-15T05:59:00Z", false],
      ["SOMMER Mi 06:00 UTC — 08:00 Zuerich, Fenster auf", "2026-07-15T06:00:00Z", true],
      ["SOMMER Mi 07:30 UTC — alt war hier ZU", "2026-07-15T07:30:00Z", true],
      ["SOMMER Mi 20:59 UTC — letzte Minute", "2026-07-15T20:59:00Z", true],
      ["SOMMER Mi 21:00 UTC — New York schliesst, alt war hier OFFEN", "2026-07-15T21:00:00Z", false],
      ["SOMMER Fr 21:30 UTC — nach NY-Schluss", "2026-07-17T21:30:00Z", false],
      // UEBERGANG: US schon EDT, EU noch GMT → 4 h Abstand statt 5.
      ["UEBERGANG Mo 07:00 UTC — auf", "2026-03-09T07:00:00Z", true],
      ["UEBERGANG Mo 20:59 UTC — letzte Minute", "2026-03-09T20:59:00Z", true],
      ["UEBERGANG Mo 21:00 UTC — NY schliesst, alt war hier OFFEN", "2026-03-09T21:00:00Z", false],
      // UEBERGANG andersherum: EU schon MEZ, US noch EDT.
      ["UEBERGANG Di 20:59 UTC — letzte Minute", "2026-10-27T20:59:00Z", true],
      ["UEBERGANG Di 21:00 UTC — NY schliesst", "2026-10-27T21:00:00Z", false],
    ]) {
      const ist = imFenster(new Date(iso));
      torPruefung(`Handelsfenster falsch: ${name}`, ist === soll,
        `ist ${ist}, soll ${soll}`);
    }

    // DIE ZUSAGE AN DEN NUTZER, als eigene Rechnung: um 08:00 ZUERICHER
    // Zeit muss das Fenster offen sein — Sommer wie Winter. Gemessen an
    // allen 365 Tagen 2026 ist Zuerich IMMER exakt 60 Min vor London,
    // deshalb ist 07:00 London ganzjaehrig 08:00 Zuerich.
    for (const [name, datum] of [["Winter", "2026-11-02"], ["Sommer", "2026-07-15"]]) {
      // Den UTC-Zeitpunkt suchen, der in Zuerich 08:00 ergibt.
      let treffer = null;
      for (let u = 0; u < 24 * 60; u++) {
        const d = new Date(`${datum}T00:00:00Z`);
        d.setUTCMinutes(u);
        const zh = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich",
          hour12: false, hour: "2-digit", minute: "2-digit" }).format(d);
        if (zh === "08:00") { treffer = d; break; }
      }
      torPruefung(`${name}: 08:00 Zuerich ist nicht auffindbar`,
        treffer !== null, datum);
      if (treffer) {
        torPruefung(`${name}: um 08:00 Zuericher Zeit ist das Fenster ZU — `
          + "genau das war die Bitte",
          imFenster(treffer) === true, treffer.toISOString());
      }
    }

    // EIN AUSFALL DARF NICHT STUMM ZUMACHEN. Faellt die Zonen-Rechnung
    // aus, bleibt das Tor zu — das ist richtig, aber ein stummes
    // Dauer-"zu" saehe aus wie ein ewiges Wochenende.
    // AN DEN ZWEIG GEBUNDEN, nicht an den Wortlaut. Mein erster Versuch
    // suchte nur, ob der Text "Handelszeit NICHT berechenbar" IRGENDWO
    // steht — und die Sabotage `console.error(...)` → `void (...)` liess
    // ihn stehen. "Ein Regex prueft den Wortlaut, nicht das Verhalten"
    // (30.09.), hier in der Pruefung selbst. Jetzt wird der Ausfall-Zweig
    // per Klammerzaehler ausgeschnitten und NUR darin gesucht.
    {
      const start = orch.indexOf("if (tag === null || london === null");
      let zweig = "";
      if (start >= 0) {
        const auf = orch.indexOf("{", start);
        let tiefe = 0;
        for (let i = auf; i < orch.length && i < auf + 2000; i++) {
          if (orch[i] === "{") tiefe++;
          else if (orch[i] === "}") { tiefe--; if (tiefe === 0) { zweig = orch.slice(auf, i + 1); break; } }
        }
      }
      // SELBSTPRUEFUNG: ein leerer Ausschnitt bewiese nichts.
      torPruefung("der Ausfall-Zweig liess sich nicht ausschneiden — dann "
        + "prueft die Zeile darunter ins Leere",
        zweig.length > 50 && zweig.includes("return false"),
        `${zweig.length} Zeichen`);
      torPruefung("ein Ausfall der Zonen-Rechnung bleibt stumm — dann ist er "
        + "von einem Wochenende nicht zu unterscheiden",
        /console\.error\(/.test(zweig) && /Handelszeit NICHT berechenbar/.test(zweig)
        && /Das Tor bleibt ZU/.test(zweig), `${zweig.length} Zeichen Zweig`);
    }
    // Und er darf NICHT als "offen" durchgehen.
    torPruefung("ein Ausfall der Zonen-Rechnung gibt sich als OFFEN aus",
      /if \(tag === null \|\| london === null \|\| newYork === null\) \{[\s\S]{0,600}?return false;/
        .test(orch), "orchestrator-agent");
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
        const modul = ladeTsModul("lib/icmarkets/icmarkets-client.ts",
          { "zeitmessung/zeitmessung": { zeitstempelMessen: () => {}, hatZone: () => false } });
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
    // Das ECHTE Drossel-Modul, nicht der Stellvertreter: der wirft beim
    // Aufruf, und `redisLage` steht INNERHALB des `try` jeder Grenze —
    // ein Wurf dort wuerde als `allowed: true` durchgehen und der ganze
    // Riegel saehe gruen aus. Die Falle vom 31.10., hier bei sieben
    // bestehenden Pruefstaenden zuerst uebersehen.
    const lageModul = ladeTsModul("lib/redis-lage/redis-lage.ts").exports;
    const bauFilter = (speicher) => ladeTsModul("lib/trading-filters/trade-filters.ts", {
      "redis-lage/redis-lage": lageModul,
      "redis-cache": {
        cacheGet: async (k) => (k in speicher ? speicher[k] : null),
      cacheLesen: async (k) => (k in speicher ? { wert: speicher[k], herkunft: "redis" } : { wert: null, herkunft: "redis" }),
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
        // ── WIE SIEHT EIN REDIS-AUSFALL WIRKLICH AUS? (01.11.) ──────
        //
        // Hier stand ein Pruefstand, dessen `cacheGet` WIRFT. Das echte
        // `redis-cache.ts` wirft NIE an den Aufrufer — es faengt intern
        // und gibt `null` bzw. `herkunft: "aus"`. Ausgefuehrt belegt am
        // 01.11.: `cacheGet` ohne REDIS_URL -> wirft=false, wert=null.
        // Das alte Modell prueft also einen Pfad, den es im Betrieb
        // nicht gibt — und genau deshalb blieben vier Funde unsichtbar.
        const ausfall = { gesetzt: [], meldungen: [] };
        const f4 = ladeTsModul("lib/trading-filters/trade-filters.ts", {
          "redis-lage/redis-lage": lageModul,
          "redis-cache": {
            cacheGet: async () => null,
            cacheLesen: async () => ({ wert: null, herkunft: "aus" }),
            cacheSet: async (k) => { ausfall.gesetzt.push(k); },
          },
        });
        const altErr = console.error;
        console.error = (...a) => ausfall.meldungen.push(a.join(" "));
        let g;
        try {
          delete global.__redis_lage__;
          g = await f4.exports.checkDailyLossLimit(1540, 3);
        } finally { console.error = altErr; }
        torPruefung("ein Redis-Ausfall haelt den Handel an",
          g.allowed === true, JSON.stringify(g));
        // DER FUND vom 01.11.: der Ausfall galt als ERSTER Zyklus des
        // Tages und schrieb den aktuellen Stand als Tagesstart. Damit
        // misst die Grenze ab da vom Ausfall-Moment — der Schutz wird
        // schwaecher, und niemand erfaehrt es.
        torPruefung("ein Redis-Ausfall setzt den Tagesstart NEU — die Grenze misst danach vom Ausfall-Moment",
          ausfall.gesetzt.length === 0, `geschrieben: ${JSON.stringify(ausfall.gesetzt)}`);
        torPruefung("der Ausfall ist STUMM — ein Dauerausfall sieht aus wie ein gesunder Lauf",
          ausfall.meldungen.length === 1
          && /Tagesverlust-Grenze/.test(ausfall.meldungen[0] ?? "")
          && /KEIN neuer Bezugspunkt/.test(ausfall.meldungen[0] ?? ""),
          `${ausfall.meldungen.length} Meldung(en): ${(ausfall.meldungen[0] ?? "").slice(0, 90)}`);

        // DIE WOCHEN-GRENZE hat dieselbe Struktur und fehlte in meiner
        // ersten Fundliste — nachgetragen am 01.11.
        const ausfallW = { gesetzt: [], meldungen: [] };
        const f5 = ladeTsModul("lib/trading-filters/trade-filters.ts", {
          "redis-lage/redis-lage": lageModul,
          "redis-cache": {
            cacheGet: async () => null,
            cacheLesen: async () => ({ wert: null, herkunft: "aus" }),
            cacheSet: async (k) => { ausfallW.gesetzt.push(k); },
          },
        });
        const altErrW = console.error;
        console.error = (...a) => ausfallW.meldungen.push(a.join(" "));
        let gw;
        try {
          delete global.__redis_lage__;
          gw = await f5.exports.checkWeeklyLossLimit(1540, 6);
        } finally { console.error = altErrW; }
        torPruefung("ein Redis-Ausfall haelt den Handel an (Woche)",
          gw.allowed === true, JSON.stringify(gw));
        torPruefung("ein Redis-Ausfall setzt den WOCHENstart NEU",
          ausfallW.gesetzt.length === 0, `geschrieben: ${JSON.stringify(ausfallW.gesetzt)}`);
        torPruefung("der Wochen-Ausfall ist STUMM",
          ausfallW.meldungen.length === 1
          && /Wochenverlust-Grenze/.test(ausfallW.meldungen[0] ?? ""),
          `${ausfallW.meldungen.length}: ${(ausfallW.meldungen[0] ?? "").slice(0, 80)}`);
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
      // ── EIN UNBRAUCHBARER HOECHSTSTAND IST KEINE 0 (03.11.) ──────────
      //
      // Gefunden in der Generalkontrolle, ausgefuehrt ueber sechs Lagen:
      // `stored?.peak ?? 0` machte aus JEDEM unbrauchbaren Inhalt eine 0.
      // `{}` und `peak: null` setzten damit still einen NEUEN Bezugspunkt,
      // Text und NaN ergaben `dd = NaN` -> `NaN >= grenze` ist false ->
      // erlaubt. Die Gesamt-Drawdown-Grenze war in all diesen Lagen OHNE
      // Wirkung, und niemand erfuhr es. Vierte Wiederholung derselben
      // Falle (checkPriceAvailable 24.08., ordersRiegel 28.10., rrBand 29.10.).
      //
      // UNTERSCHIED ZUM FUND VOM 01.11.: dort hatte Redis NICHT geantwortet
      // — dann wird nichts geschrieben, der echte Wert kommt von selbst
      // zurueck. Hier ANTWORTET Redis, der Inhalt taugt nur nichts; er
      // kommt nie in Ordnung. Also neu setzen wie beim ersten Lauf, aber
      // HOERBAR — still waere genau der Fehler vom 01.11.
      for (const [nameDD, gespeichert, sollMelden] of [
        ["leer, erster Lauf", null, false],
        ["{} ohne peak", {}, true],
        ["peak null", { peak: null }, true],
        ["peak Text", { peak: "abc" }, true],
        ["peak NaN", { peak: NaN }, true],
        ["peak 0", { peak: 0 }, true],
      ]) {
        const geschrieben = [];
        const warnungen = [];
        const m = ladeTsModul("lib/trading-filters/trade-filters.ts", {
          "redis-lage/redis-lage": lageModul,
          "redis-cache": {
            cacheGet: async () => gespeichert,
            cacheLesen: async () => ({ wert: gespeichert, herkunft: "redis" }),
            cacheSet: async (k, v) => { geschrieben.push(v); return true; },
          },
          "telegram-sender": { htmlAbgelehnt: tgHtml, telegramZeit: () => "x",
            telegramDatum: () => "x", sendTelegram: async () => true },
        }); // je Lage ein eigener Prüfstand
        const fU = m.exports?.checkTotalDrawdownLimit;
        if (typeof fU !== "function") {
          torPruefung(`checkTotalDrawdownLimit fehlt (${nameDD})`, false, m.fehler ?? "");
          continue;
        }
        const sLog = console.log, sWarn = console.warn;
        console.log = () => {};
        console.warn = (...a) => warnungen.push(a.join(" "));
        let rDD;
        try { rDD = await fU(1700, 10); }
        catch (e) { rDD = { allowed: `WIRFT ${e.message}` }; }
        console.log = sLog; console.warn = sWarn;
        torPruefung(`ein unbrauchbarer Hoechststand (${nameDD}) sperrt oder wirft`,
          rDD.allowed === true, JSON.stringify(rDD));
        torPruefung(`der Bezugspunkt wird bei (${nameDD}) nicht neu gesetzt`,
          geschrieben.length === 1 && geschrieben[0]?.peak === 1700,
          JSON.stringify(geschrieben));
        torPruefung(`ein unbrauchbarer Hoechststand (${nameDD}) bleibt STUMM`,
          (warnungen.length > 0) === sollMelden,
          `${warnungen.length} Meldungen, erwartet ${sollMelden ? "mindestens eine" : "keine"}`);
      }
      // GEGENPROBE: ein GESUNDER Hoechststand sperrt weiterhin und gilt
      // NICHT als unbrauchbar — sonst waere der Riegel nur "immer rot"
      // bzw. haette die Grenze ganz abgeschaltet (Lehre vom 15.09.).
      {
        const geschrieben = [];
        const warnungen = [];
        const gespeichert = { peak: 2000 };
        const m = ladeTsModul("lib/trading-filters/trade-filters.ts", {
          "redis-lage/redis-lage": lageModul,
          "redis-cache": {
            cacheGet: async () => gespeichert,
            cacheLesen: async () => ({ wert: gespeichert, herkunft: "redis" }),
            cacheSet: async (k, v) => { geschrieben.push(v); return true; },
          },
          "telegram-sender": { htmlAbgelehnt: tgHtml, telegramZeit: () => "x",
            telegramDatum: () => "x", sendTelegram: async () => true },
        }); // Gegenprobe gesund
        const fU = m.exports?.checkTotalDrawdownLimit;
        const sLog = console.log, sWarn = console.warn;
        console.log = () => {};
        console.warn = (...a) => warnungen.push(a.join(" "));
        let rDD;
        try { rDD = await fU(1700, 10); }
        catch (e) { rDD = { allowed: `WIRFT ${e.message}` }; }
        console.log = sLog; console.warn = sWarn;
        torPruefung("ein gesunder Hoechststand sperrt nicht mehr (-15 % gegen Grenze 10)",
          rDD.allowed === false, JSON.stringify(rDD));
        torPruefung("ein gesunder Hoechststand gilt faelschlich als unbrauchbar",
          warnungen.length === 0, warnungen.join(" | ").slice(0, 120));
      }

      const speicher2 = {};
      const gesendet = [];
      const bauDD = () => ladeTsModul("lib/trading-filters/trade-filters.ts", {
        "redis-lage/redis-lage": lageModul,
        "redis-cache": {
          cacheGet: async (k) => (k in speicher2 ? speicher2[k] : null),
        cacheLesen: async (k) => (k in speicher2 ? { wert: speicher2[k], herkunft: "redis" } : { wert: null, herkunft: "redis" }),
          cacheSet: async (k, v) => { speicher2[k] = v; return true; },
        },
        "telegram-sender": { htmlAbgelehnt: tgHtml, telegramZeit: () => "27.9.2026, 14:48:11 MESZ", telegramDatum: () => "27.9.2026", sendTelegram: async (t) => { gesendet.push(t); } },
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
            "redis-lage/redis-lage": lageModul,
            "redis-cache": {
              cacheGet: async (k) => (k in sp3 ? sp3[k] : null),
            cacheLesen: async (k) => (k in sp3 ? { wert: sp3[k], herkunft: "redis" } : { wert: null, herkunft: "redis" }),
              cacheSet: async (k, v) => { sp3[k] = JSON.parse(JSON.stringify(v)); return true; },
            },
            "telegram-sender": { htmlAbgelehnt: tgHtml,
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
            "redis-lage/redis-lage": lageModul,
            "redis-cache": {
              cacheGet: async (k) => (k in sp4 ? sp4[k] : null),
            cacheLesen: async (k) => (k in sp4 ? { wert: sp4[k], herkunft: "redis" } : { wert: null, herkunft: "redis" }),
              cacheSet: async (k, v) => { sp4[k] = JSON.parse(JSON.stringify(v)); return true; },
              cacheDel: async (k) => { delete sp4[k]; return true; },
            },
            "telegram-sender": { htmlAbgelehnt: tgHtml,
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
          // Bei Redis-Ausfall darf der Reset nicht so tun, als haette er
          // geklappt — und der ECHTE Ausfall wirft nicht, er gibt
          // `herkunft: "aus"` (01.11.). Gemessen vor dem Fix:
          // `{ok:true, alt:1000}` — `cacheDel` loescht dann nur den
          // prozesseigenen Speicher, Redis haelt den echten Hoechststand
          // weiter. Der Nutzer glaubt, die Sackgasse sei geoeffnet.
          const geloescht5 = [];
          const d5 = ladeTsModul("lib/trading-filters/trade-filters.ts", {
            "redis-lage/redis-lage": lageModul,
            "redis-cache": {
              cacheGet: async () => null,
              cacheLesen: async () => ({ wert: null, herkunft: "aus" }),
              cacheDel: async (k) => { geloescht5.push(k); },
            },
          });
          if (typeof d5.exports.peakZuruecksetzen === "function") {
            const k5 = await d5.exports.peakZuruecksetzen();
            torPruefung("ein Reset bei Redis-Ausfall meldet Erfolg",
              k5.ok === false && typeof k5.fehler === "string", JSON.stringify(k5));
            torPruefung("der Reset loescht bei einem Ausfall trotzdem — dann ist nur der prozesseigene Speicher weg und Redis unveraendert",
              geloescht5.length === 0, JSON.stringify(geloescht5));
          }
          // Und die werfende Variante bleibt geprueft: das `catch` muss
          // halten, auch wenn der heutige Cache nicht wirft.
          const d5b = ladeTsModul("lib/trading-filters/trade-filters.ts", {
            "redis-lage/redis-lage": lageModul,
            "redis-cache": {
              cacheLesen: async () => { throw new Error("Redis weg"); },
              cacheDel: async () => { throw new Error("Redis weg"); },
            },
          });
          if (typeof d5b.exports.peakZuruecksetzen === "function") {
            const k5b = await d5b.exports.peakZuruecksetzen();
            torPruefung("ein WERFENDER Cache bringt den Reset zum Absturz",
              k5b.ok === false && typeof k5b.fehler === "string", JSON.stringify(k5b));
          }

          // Redis weg -> nicht blockieren, aber auch KEINEN neuen
          // Hoechststand setzen (01.11.). Gemessen vor dem Fix:
          // `peak_balance = {peak:1000, herkunft:"speicher"}` — der
          // Bezugspunkt war still auf den Ausfall-Moment geschoben.
          const dd2 = { gesetzt: [], meldungen: [] };
          const d2 = ladeTsModul("lib/trading-filters/trade-filters.ts", {
            "redis-lage/redis-lage": lageModul,
            "redis-cache": {
              cacheGet: async () => null,
              cacheLesen: async () => ({ wert: null, herkunft: "aus" }),
              cacheSet: async (k) => { dd2.gesetzt.push(k); },
            },
          });
          const altErr2 = console.error;
          console.error = (...a) => dd2.meldungen.push(a.join(" "));
          let g2;
          try {
            delete global.__redis_lage__;
            g2 = await d2.exports.checkTotalDrawdownLimit(1000, 10);
          } finally { console.error = altErr2; }
          torPruefung("ein Redis-Ausfall sperrt den Handel",
            g2.allowed === true, JSON.stringify(g2));
          torPruefung("ein Redis-Ausfall setzt den Hoechststand NEU — der Drawdown misst danach vom Ausfall-Moment",
            dd2.gesetzt.length === 0, `geschrieben: ${JSON.stringify(dd2.gesetzt)}`);
          torPruefung("der Drawdown-Ausfall ist STUMM",
            dd2.meldungen.length === 1
            && /Gesamt-Drawdown-Grenze/.test(dd2.meldungen[0] ?? "")
            && /KEIN neuer Hoechststand/.test(dd2.meldungen[0] ?? ""),
            `${dd2.meldungen.length}: ${(dd2.meldungen[0] ?? "").slice(0, 90)}`);

          // ── DIE DROSSEL, AUSGEFUEHRT ──────────────────────────────
          //
          // Drei Grenzen x 288 Zyklen waeren ueber 800 Zeilen am Tag.
          // Und der Zustand liegt auf `global`, weil die Grenzen aus
          // `instrumentation.ts` laufen, `/peakreset` aber in `app/api`
          // — zwei Modulkopien (Regel 28.07., dreimal uebergangen am
          // 25.10.). Deshalb hier ZWEI Kopien: melden ueber A, pruefen
          // ueber B.
          const lgA = ladeTsModul("lib/redis-lage/redis-lage.ts");
          const lgB = ladeTsModul("lib/redis-lage/redis-lage.ts");
          if (typeof lgA.exports?.redisLageMelden !== "function") {
            torPruefung("redisLageMelden nicht ausfuehrbar", false,
              lgA.fehler ?? "Export fehlt");
          } else {
            delete global.__redis_lage__;
            const abstand = lgA.exports.REDIS_MELDE_ABSTAND_MS;
            torPruefung("der Meldeabstand ist keine 30 Minuten",
              abstand === 30 * 60 * 1000, String(abstand));
            const m1 = lgA.exports.redisLageMelden("p", "aus", 1000);
            const m2 = lgB.exports.redisLageMelden("p", "aus", 2000);
            const m3 = lgB.exports.redisLageMelden("p", "aus", 1000 + abstand);
            const m4 = lgB.exports.redisLageMelden("p", "ok", 1000 + abstand + 5);
            torPruefung("ein Ausfall wird beim ersten Mal nicht gemeldet",
              m1 === true, String(m1));
            torPruefung("der Zustand ist MODUL-SCOPED — jede Kopie drosselt fuer sich, bei einem Dauerausfall kaeme alles doppelt",
              m2 === false, `ueber die zweite Kopie: ${m2}`);
            torPruefung("ein Dauerausfall verschwindet nach der ersten Meldung fuer immer",
              m3 === true, String(m3));
            torPruefung("die RUECKKEHR wird verschwiegen — dann bleibt offen, ob der Ausfall vorbei ist",
              m4 === true, String(m4));
            // Gegenprobe: ein gesunder Dauerzustand schweigt, und ein
            // gesunder START ist keine Nachricht.
            delete global.__redis_lage__;
            const h1 = lgA.exports.redisLageMelden("q", "ok", 1000);
            const h2 = lgA.exports.redisLageMelden("q", "ok", 1000 + 10 * abstand);
            torPruefung("ein gesunder Start oder Dauerzustand meldet sich — das waere Laerm statt Information",
              h1 === false && h2 === false, `${h1} / ${h2}`);
            // Und zwei verschiedene Stellen duerfen sich NICHT verdecken.
            delete global.__redis_lage__;
            const v1 = lgA.exports.redisLageMelden("eins", "aus", 1000);
            const v2 = lgA.exports.redisLageMelden("zwei", "aus", 1000);
            // DER UNTERSCHEIDENDE FALL. Nur zu verlangen, dass beide
            // melden, reicht NICHT — das tun sie bei geteiltem Zustand
            // auch (im Sabotage-Lauf vom 01.11. vorgefuehrt). Ein
            // gesunder START ist bei getrenntem Zustand keine Nachricht;
            // bei geteiltem liest "drei" den Eintrag von "eins" (Lage
            // "aus") und meldet den Wechsel.
            delete global.__redis_lage__;
            lgA.exports.redisLageMelden("eins", "aus", 1000);
            const v3 = lgA.exports.redisLageMelden("drei", "ok", 1100);
            torPruefung("zwei Stellen teilen einen Zustand — die Lage der einen verdeckt die andere",
              v1 === true && v2 === true && v3 === false,
              `eins=${v1} zwei=${v2} drei-gesund=${v3} (drei muss false sein)`);
            delete global.__redis_lage__;
          }
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
            "telegram-notifications/telegram-sender": { htmlAbgelehnt: tgHtml,
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
            // Ohne diesen Ersatz ist es der Stellvertreter, der beim Aufruf
            // wirft — /status zeigte das Fenster dann nie, und die
            // Verdrahtung waere ungeprueft (Klasse vom 30.09.).
            "handelsfenster/fenster-text": ladeTsModul("lib/handelsfenster/fenster-text.ts").exports,
            "agents/orchestrator-agent": { isWithinTradingSession: () => true,
              HANDELSFENSTER: { oeffnetLondon: 7 * 60, schliesstNewYork: 17 * 60,
                zoneLondon: "Europe/London", zoneNewYork: "America/New_York" } },
            // Seit dem 29.10. nennt /status, WARUM nicht gehandelt wird.
            // Ohne diesen Ersatz liefe der Aufruf gegen den Stellvertreter,
            // der beim Aufruf wirft — der Pruefstand meldete dann einen
            // Fehler, den es im Betrieb nicht gibt. (Die Datenquellen
            // DUERFEN weiter werfen: sie liegen in `sicher()` und ergeben
            // dort "unbekannt" — genau der Fall, den die Funktion abdeckt.)
            "handels-lage/handels-lage": ladeTsModul("lib/handels-lage/handels-lage.ts",
              { "html-sicher/html-sicher": ladeTsModul("lib/html-sicher/html-sicher.ts").exports }).exports,
            "trading-filters/trade-filters": {
              PEAK_SCHLUESSEL: "peak_balance",
              peakZuruecksetzen: async () => ({ ok: true, alt: 10000 }),
            },
            // Seit dem 01.11. liest der /peakreset-Vorlauf mit cacheLesen.
            // Ohne diesen Ersatz ist es der Stellvertreter, der Vorlauf
            // faellt auf "nicht abrufbar" und der ganze Passwort-Pfad
            // darunter wird nie betreten — derselbe Fall wie bei den neun
            // trade-filters-Pruefstaenden.
            "cache/redis-cache": { cacheGet: async () => ({ peak: 10000 }),
              cacheLesen: async () => ({ wert: { peak: 10000 }, herkunft: "redis" }),
              cacheSet: async () => true, cacheDel: async () => true },
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

            // ── UND EIN FEHLSCHLAG MUSS BEIM NUTZER ANKOMMEN (01.11.) ──
            //
            // Seit heute gibt `peakZuruecksetzen()` bei einem Redis-
            // Ausfall `ok: false` zurueck statt stillschweigend Erfolg zu
            // melden. Diese Kette war bis jetzt nur GELESEN: der
            // Pruefstand oben ersetzt die Funktion durch `{ok: true}`,
            // der neue Zweig lief nie. Ein Fix, dessen Meldeweg
            // ungeprueft ist, ist ein halber Fix.
            {
              const antw2 = [], alarme2 = [];
              let prAufrufe = 0;
              let prLesen = 0;
              const altF2 = global.fetch;
              let wh2;
              try {
                global.fetch = async (_u, init) => {
                  antw2.push(String(JSON.parse(String(init?.body ?? "{}")).text ?? ""));
                  return okAntwort();
                };
                wh2 = ladeTsModul("app/api/telegram/webhook/route.ts", {
                  "next/server": { NextResponse: { json: (x) => ({ __json: x }) } },
                  "telegram-notifications/telegram-sender": { htmlAbgelehnt: tgHtml,
                    sendTelegram: async (t) => { alarme2.push(String(t)); return true; },
                    telegramZeit: () => "1.11.2026, 20:00:00 MEZ", telegramDatum: () => "1.11.2026",
                  },
                  "lib/killswitch": {
                    getKillswitchReport: () => ({ triggered: false, armed: true,
                      systemLocked: false, stages: [], summary: "ok" }),
                    triggerKillswitch: () => ({ triggered: true }),
                    resetKillswitch: () => ({ triggered: false }),
                  },
                  "laufzeit/laufzeit-stand": ladeTsModul("lib/laufzeit/laufzeit-stand.ts").exports,
                  // Ohne diesen Ersatz ist es der Stellvertreter, der beim Aufruf
                  // wirft — /status zeigte das Fenster dann nie, und die
                  // Verdrahtung waere ungeprueft (Klasse vom 30.09.).
                  "handelsfenster/fenster-text": ladeTsModul("lib/handelsfenster/fenster-text.ts").exports,
                  "agents/orchestrator-agent": { isWithinTradingSession: () => true,
                    HANDELSFENSTER: { oeffnetLondon: 7 * 60, schliesstNewYork: 17 * 60,
                      zoneLondon: "Europe/London", zoneNewYork: "America/New_York" } },
                  "handels-lage/handels-lage": ladeTsModul("lib/handels-lage/handels-lage.ts",
                    { "html-sicher/html-sicher": ladeTsModul("lib/html-sicher/html-sicher.ts").exports }).exports,
                  "trading-filters/trade-filters": {
                    PEAK_SCHLUESSEL: "peak_balance",
                    peakZuruecksetzen: async () => { prAufrufe++;
                      return { ok: false, alt: null,
                        fehler: "Redis hat nicht geantwortet — der gespeicherte Hoechststand ist UNVERAENDERT." }; },
                  },
                  // Zwei Lagen in EINEM Lauf: der erste /peakreset-Aufruf
                  // bekommt ein cacheLesen, das "aus" MELDET, der zweite
                  // eines, das WIRFT. Der catch-Rueckfall muss dann
                  // ebenfalls "aus" ergeben — ein erfundener Hoechststand
                  // dort waere die Luege aus der Regel vom 22.09.
                  "cache/redis-cache": { cacheGet: async () => null,
                    cacheLesen: async () => {
                      prLesen++;
                      if (prLesen > 1) throw new Error("Redis kaputt");
                      return { wert: null, herkunft: "aus" };
                    },
                    cacheSet: async () => true, cacheDel: async () => true },
                  "capital-com/capital-com-session": { getCapitalSession: () => null },
                });
                if (!wh2.fehler && typeof wh2.exports?.POST === "function") {
                  const s2 = (text) => wh2.exports.POST({ json: async () => ({
                    message: { chat: { id: Number(chat) },
                      from: { first_name: "Pruefstand" }, text } }) });
                  await s2("/peakreset");
                  await s2("/peakreset");   // zweiter Lauf: cacheLesen WIRFT
                  await s2(pw);
                }
              } finally { global.fetch = altF2; }
              const alleZ = antw2.join("\n");
              torPruefung("/peakreset ist nicht ausfuehrbar",
                !wh2?.fehler, wh2?.fehler ?? "ok");
              // DER SECHSTE FUND, von genau dieser Pruefung aufgedeckt:
              // der Vorlauf von /peakreset las den Hoechststand mit
              // `cacheGet` und antwortete bei `null` "Es ist gar kein
              // Hoechststand gespeichert". Bei einem Ausfall ist das eine
              // BEHAUPTUNG — der Wert kann sehr wohl gesetzt sein, und der
              // Nutzer glaubt, die Sackgasse sei offen.
              // GEZAEHLT, nicht gefunden: es sind ZWEI Laeufe — der erste
              // mit einem cacheLesen, das "aus" meldet, der zweite mit
              // einem, das WIRFT. Eine Suche nach dem ersten Treffer waere
              // mit dem Ergebnis des ersten Laufs schon zufrieden, und eine
              // Sabotage am catch-Rueckfall blieb gruen. Lehre vom 25.10.
              const nichtAbrufbar = (alleZ.match(/nicht abrufbar/g) || []).length;
              torPruefung("ein Redis-Ausfall wird als \"gar kein Hoechststand gespeichert\" ausgegeben — eine Behauptung statt einer Messung",
                nichtAbrufbar === 2 && /niemand hat geantwortet/.test(alleZ)
                && !/gar kein Höchststand gespeichert/.test(alleZ),
                `${nichtAbrufbar}x "nicht abrufbar" (erwartet 2: gemeldet + geworfen)` + ` — ${alleZ.replace(/\n/g, " | ").slice(-120)}`);
              // Und ein Reset waere hier BLIND: `cacheDel` erwischt nur den
              // prozesseigenen Speicher, Redis behaelt den echten Wert.
              torPruefung("bei einem Ausfall wird trotzdem zurueckgesetzt",
                prAufrufe === 0, `peakZuruecksetzen ${prAufrufe}x gerufen`);
              torPruefung("ein Ausfall meldet TROTZDEM Erfolg in den Kanal",
                !alarme2.some((a) => /ZURÜCKGESETZT/.test(a))
                && !/♻️ Passwort korrekt/.test(alleZ),
                `${alarme2.length} Kanal-Meldung(en): ${(alarme2[0] ?? "keine").slice(0, 60)}`);

              // ZWEITER FALL: Redis ANTWORTET mit einem Hoechststand, aber
              // das Zuruecksetzen selbst scheitert. Dann muss der Grund
              // beim Nutzer ankommen — das ist der Zweig `if (!ergebnis.ok)`.
              {
                const antw3 = [];
                let pr3 = 0;
                const altF3 = global.fetch;
                let wh3;
                try {
                  global.fetch = async (_u, init) => {
                    antw3.push(String(JSON.parse(String(init?.body ?? "{}")).text ?? ""));
                    return okAntwort();
                  };
                  wh3 = ladeTsModul("app/api/telegram/webhook/route.ts", {
                    "next/server": { NextResponse: { json: (x) => ({ __json: x }) } },
                    "telegram-notifications/telegram-sender": { htmlAbgelehnt: tgHtml,
                      sendTelegram: async (t) => { antw3.push(String(t)); return true; },
                      telegramZeit: () => "1.11.2026, 20:00:00 MEZ",
                      telegramDatum: () => "1.11.2026",
                    },
                    "lib/killswitch": {
                      getKillswitchReport: () => ({ triggered: false, armed: true,
                        systemLocked: false, stages: [], summary: "ok" }),
                      triggerKillswitch: () => ({ triggered: true }),
                      resetKillswitch: () => ({ triggered: false }),
                    },
                    "laufzeit/laufzeit-stand": ladeTsModul("lib/laufzeit/laufzeit-stand.ts").exports,
                    // Ohne diesen Ersatz ist es der Stellvertreter, der beim Aufruf
                    // wirft — /status zeigte das Fenster dann nie, und die
                    // Verdrahtung waere ungeprueft (Klasse vom 30.09.).
                    "handelsfenster/fenster-text": ladeTsModul("lib/handelsfenster/fenster-text.ts").exports,
                    "agents/orchestrator-agent": { isWithinTradingSession: () => true,
                      HANDELSFENSTER: { oeffnetLondon: 7 * 60, schliesstNewYork: 17 * 60,
                        zoneLondon: "Europe/London", zoneNewYork: "America/New_York" } },
                    "handels-lage/handels-lage": ladeTsModul("lib/handels-lage/handels-lage.ts",
                      { "html-sicher/html-sicher": ladeTsModul("lib/html-sicher/html-sicher.ts").exports }).exports,
                    "trading-filters/trade-filters": {
                      PEAK_SCHLUESSEL: "peak_balance",
                      peakZuruecksetzen: async () => { pr3++; return { ok: false, alt: null,
                        fehler: "Redis hat nicht geantwortet — UNVERAENDERT." }; },
                    },
                    "cache/redis-cache": {
                      cacheGet: async () => ({ peak: 2000 }),
                      cacheLesen: async () => ({ wert: { peak: 2000 }, herkunft: "redis" }),
                      cacheSet: async () => true, cacheDel: async () => true },
                    "capital-com/capital-com-session": { getCapitalSession: () => ({ balance: 1870 }) },
                  });
                  if (!wh3.fehler && typeof wh3.exports?.POST === "function") {
                    const s3 = (text) => wh3.exports.POST({ json: async () => ({
                      message: { chat: { id: Number(chat) },
                        from: { first_name: "Pruefstand" }, text } }) });
                    await s3("/peakreset");
                    await s3(pw);
                  }
                } finally { global.fetch = altF3; }
                const alle3 = antw3.join("\n");
                torPruefung("der Vorlauf fragt nicht nach dem Passwort, wenn ein Hoechststand da ist",
                  /Admin-Passwort/.test(alle3), alle3.slice(0, 80));
                torPruefung("ein gescheitertes Zuruecksetzen meldet dem Nutzer nichts — er glaubt dann, die Sperre sei geloest",
                  pr3 === 1 && /fehlgeschlagen/i.test(alle3)
                  && /UNVERAENDERT/.test(alle3),
                  `${pr3}x gerufen: ${alle3.replace(/\n/g, " | ").slice(-140)}`);
                torPruefung("ein gescheitertes Zuruecksetzen meldet TROTZDEM Erfolg",
                  !/ZURÜCKGESETZT/.test(alle3) && !/♻️ Passwort korrekt/.test(alle3),
                  alle3.replace(/\n/g, " | ").slice(-120));
              }
            }

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

            // ── KAPUTTES HTML: RUECKFALL AUF REINEN TEXT (02.11.) ────
            //
            // Den Rueckfall bekam am 01.11. nur `sendTelegram`.
            // `reply()` meldete die Ablehnung zwar, liess die Antwort
            // aber verloren — und durch `reply()` geht JEDE
            // Befehls-Antwort. Gemessen am 02.11. an `/hebel`.
            {
              const altWarn = console.warn;
              const warnungen = [];
              const anfragen = [];
              meldungen.length = 0;
              console.error = (...a) => { meldungen.push(a.join(" ")); };
              console.warn = (...a) => { warnungen.push(a.join(" ")); };
              try {
                global.fetch = async (_u, init) => {
                  const b = JSON.parse(String(init?.body ?? "{}"));
                  anfragen.push(b);
                  if (b.parse_mode === "HTML") {
                    return { ok: true, status: 200, text: async () => JSON.stringify({
                      ok: false, error_code: 400,
                      description: "Bad Request: can't parse entities: Unsupported start tag" }) };
                  }
                  return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
                };
                await schicke("/status");
              } finally { console.error = altErr; console.warn = altWarn; }
              torPruefung("reply() faellt bei kaputtem HTML NICHT auf reinen Text zurueck — die Antwort ist dann verloren",
                anfragen.length === 2
                && anfragen[0].parse_mode === "HTML"
                && anfragen[1].parse_mode === undefined,
                `${anfragen.length} Anfrage(n): `
                + anfragen.map((a) => a.parse_mode ?? "ohne").join(" / "));
              torPruefung("die Degradierung auf reinen Text wird verschwiegen",
                warnungen.some((w) => /REINER TEXT/.test(w)),
                warnungen.join(" | ").slice(0, 110) || "(keine Warnung)");
              torPruefung("ein geretteter Versand meldet TROTZDEM einen Fehlschlag",
                !meldungen.some((m) => /NICHT zugestellt/.test(m)),
                meldungen.join(" | ").slice(0, 110) || "(keine Fehlermeldung)");

              // Und ein 429 wird NICHT wiederholt: er kehrt
              // deterministisch zurueck, Nachlegen waere genau falsch.
              anfragen.length = 0;
              meldungen.length = 0;
              console.error = (...a) => { meldungen.push(a.join(" ")); };
              try {
                global.fetch = async (_u, init) => {
                  anfragen.push(JSON.parse(String(init?.body ?? "{}")));
                  return { ok: true, status: 200, text: async () => JSON.stringify({
                    ok: false, error_code: 429, description: "Too Many Requests: retry after 30" }) };
                };
                await schicke("/status");
              } finally { console.error = altErr; }
              torPruefung("ein 429 wird wiederholt — bei Drosselung ist Nachlegen genau falsch",
                anfragen.length === 1, `${anfragen.length} Anfrage(n)`);
            }

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
          // Die vier /hebel-Groessen stehen MIT drin (31.10.): `/edge`
          // liest sie nicht und rechnet unveraendert weiter, aber ohne
          // sie waere jede /hebel-Dimension "ohne Angabe" — und der
          // Pruefstand bewiese nichts ueber das Gruppieren.
          const zeilenDb = [
            ...Array.from({ length: 40 }, () => ({
              profitLoss: 12, notes: '{"exitReason":"ZIEL"}',
              result: "WIN", updatedAt: vorTagen(3),
              riskReward: 2.0, market: "EURUSD", direction: "BUY",
              strategy: "Trend" })),
            ...Array.from({ length: 40 }, () => ({
              profitLoss: -8, notes: '{"exitReason":"STOP"}',
              result: "LOSS", updatedAt: vorTagen(200),
              riskReward: 1.2, market: "BTCUSD", direction: "SELL",
              strategy: "Range" })),
          ];
          // ── DIE OFFENEN POSITIONEN FUER /status (07.11.) ────────────
          //
          // Drei Lagen, damit der Block seinen Fehler ueberhaupt
          // ausdruecken kann: eine mit Stil (Zeit-Exit aktiv), eine OHNE
          // Journal-Zeile (ausgesetzt) und eine ohne Eroeffnungszeit
          // (kann nicht greifen). Fehlte eine, bewiese der Pruefstand
          // darunter nichts.
          // Haelt das Ergebnis von `handelsLage` fest — siehe den Spion
          // im Ersatz unten.
          let lageSpion = null;
          const vorStunden = (h) => new Date(heute.getTime() - h * 3600000).toISOString();
          const posDb = [
            { dealId: "D1", symbol: "XRPUSD", direction: "BUY",
              createdDate: vorStunden(70) },
            { dealId: "D9", symbol: "UKOIL", direction: "BUY",
              createdDate: vorStunden(31) },   // keine Journal-Zeile
            { dealId: "D2", symbol: "SPX500", direction: "SELL",
              createdDate: "" },               // keine Eroeffnungszeit
          ];
          const offeneDb = [
            { notes: '{"dealId":"D1","tradingStyle":"SWING","confidence":72}' },
            // D2 hat einen Stil, aber KEINE Zeit — der andere Zweig.
            { notes: '{"dealId":"D2","tradingStyle":"DAYTRADING","confidence":65}' },
            // Ohne `confidence` gilt der Stil als GERATEN — darf NICHT
            // in die Karte, sonst zeigte /status einen Stil an, auf den
            // der Zeit-Exit gar nicht rechnet.
            { notes: '{"dealId":"D9","tradingStyle":"SCALPING"}' },
          ];
          const whE = ewE.fehler ? ewE : ladeTsModul("app/api/telegram/webhook/route.ts", {
            "next/server": { NextResponse: { json: (x) => ({ __json: x }) } },
            "telegram-notifications/telegram-sender": { htmlAbgelehnt: tgHtml,
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
            // ── ZWEI EXPORTE, ZWEI ABFRAGEN (07.11.) ──────────────────
            //
            // `/edge` und `/hebel` holen `getPrisma()`, der /status-Block
            // seit dem 07.11. den BENANNTEN Export `prisma`. Fehlte er,
            // wuerde `prisma.trade.findMany` werfen, `sicher()` faengt es,
            // und der Stil waere ueberall "unbekannt" — der Pruefstand
            // haette dann gemessen, dass sein eigener Ersatz fehlt.
            //
            // Und die Abfragen sind VERSCHIEDEN: `/edge` liest
            // `status != OPEN`, /status liest `status === "OPEN"`. Der
            // Ersatz unterscheidet sie, sonst bekaeme /status die
            // /edge-Zeilen (ohne dealId) und der Stil bliebe leer — die
            // Pruefung koennte den Fehler gar nicht ausdruecken.
            "app/lib/prisma": (() => {
              const db = { trade: { findMany: async (a) => {
                abfragen.push(a);
                return a?.where?.status === "OPEN" ? offeneDb : zeilenDb;
              } } };
              return { getPrisma: () => db, prisma: db };
            })(),
            // Eine echte Broker-Sitzung MIT Positionen — ohne sie liefe
            // der ganze Positions-Block im Pruefstand nie, und seine
            // Verdrahtung waere nur strukturell geprueft (30.09.).
            "capital-com/capital-com-session": {
              isCapitalConnected: () => true,
              getCapitalSession: () => ({ apiKey: "k", cst: "c",
                securityToken: "s", balance: 1865.2 }),
            },
            "capital-com/capital-com-client": {
              capitalGetPositions: async () => ({ ok: true, positions: posDb }),
            },
            "positionen-lage/positionen-lage":
              ladeTsModul("lib/positionen-lage/positionen-lage.ts").exports,
            "expectancy/erwartungswert": ewE.exports,
            "laufzeit/laufzeit-stand": lzE.exports,
            // Der /edge-Pruefstand schreibt den Laufzeit-Ersatz in ANDERER
            // Form (lzE.exports), deshalb hat der zeilenbasierte Einschub
            // ihn uebersprungen — vier andere Pruefstaende getroffen, den
            // entscheidenden nicht. Genau hier laeuft /status end-to-end.
            "handelsfenster/fenster-text": ladeTsModul("lib/handelsfenster/fenster-text.ts").exports,
            "agents/orchestrator-agent": { isWithinTradingSession: () => true,
              HANDELSFENSTER: { oeffnetLondon: 7 * 60, schliesstNewYork: 17 * 60,
                zoneLondon: "Europe/London", zoneNewYork: "America/New_York" } },
            // MIT SPION (07.11.): `handelsLage` wird durchgereicht, sein
            // Ergebnis aber festgehalten. Nur so laesst sich der REST der
            // /status-Antwort (Killswitch, Laufender Stand, Befehlsliste)
            // MESSEN statt annehmen — `REST_GEMESSEN` war bis heute eine
            // feste Zahl vom 31.10., drei Zeilen unter dem Kommentar, der
            // genau davor warnt.
            "handels-lage/handels-lage": (() => {
              const echt = ladeTsModul("lib/handels-lage/handels-lage.ts",
                { "html-sicher/html-sicher": ladeTsModul("lib/html-sicher/html-sicher.ts").exports }).exports;
              return { ...echt, handelsLage: (e) => {
                const r = echt.handelsLage(e);
                lageSpion = r;
                return r;
              } };
            })(),
            // `/hebel` importiert dynamisch. Ohne Ersatz bekaeme es den
            // Stellvertreter, `hebelText()` wuerde werfen, und der
            // Befehl landete im catch — gepruefte Zeilen gaebe es dann
            // keine. Das ECHTE Modul, mit dem ECHTEN erwartungswert.
            "lib/hebel/hebel": ladeTsModul("lib/hebel/hebel.ts", {
              "expectancy/erwartungswert": ewE.exports,
              // Seit dem 02.11. entschaerft `hebel.ts` seine
              // Gruppennamen. Ohne diesen Ersatz wirft der
              // Stellvertreter, und /hebel landete im catch.
              "html-sicher/html-sicher": ladeTsModul("lib/html-sicher/html-sicher.ts").exports,
              // Seit dem 04.11. gruppiert `hebel.ts` die Richtung ueber
              // `richtungGruppe()`. Dasselbe wieder: ohne Ersatz wirft der
              // Stellvertreter beim AUFRUF, /hebel faellt ins catch, und der
              // gemessene Text waere der des Pruefstands, nicht der des Codes.
              "richtung/richtung": ladeTsModul("lib/richtung/richtung.ts").exports,
            }).exports,
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

            // ── "KEINE TRADES" IST NICHT "UNBEKANNT" (01.11.) ──────────
            //
            // `/status` meldete an JEDEM ruhigen Tag "Tageslimit:
            // unbekannt". `cacheGet()` gibt `null` fuer drei Lagen zurueck
            // — Redis weg, Redis wirft, oder der Schluessel fehlt. Ohne
            // Trades existiert `daily_trades:<Datum>` nicht, und aus
            // "noch keine Trades" wurde "unbekannt".
            //
            // Der BESITZER liest das anders: `orchestrator-agent.ts:853`
            // nimmt `redisDailyRaw?.count ?? 0`. Die Anzeige war also
            // pessimistischer als die Wahrheit.
            //
            // AUSGEFUEHRT gegen einen Stellvertreter, der die drei Lagen
            // spielt — ein Regex koennte das nicht unterscheiden.
            {
              // ── EIN FEHLGESCHLAGENER SCHREIB-/LOESCHVORGANG WAR STUMM (03.11.) ──
              //
              // `cacheSet` und `cacheDel` endeten beide auf `catch {}`. Ein
              // Schreibfehler fiel still in den prozesseigenen Speicher, ein
              // Loeschfehler blieb ganz ohne Spur — und `/peakreset` meldete
              // deshalb Erfolg, waehrend Redis den Hoechststand behielt.
              //
              // Derselbe Fund wie am 01.11., eine Schicht tiefer: dort
              // antwortete Redis NICHT (Leseweg), hier antwortet es und der
              // Vorgang selbst scheitert.
              {
                const altUrlW = process.env.REDIS_URL;
                const lageEcht = () => ladeTsModul("lib/redis-lage/redis-lage.ts").exports;
                const bauCache = (client) => ladeTsModul("lib/cache/redis-cache.ts", {
                  redis: { createClient: () => client },
                  "redis-lage/redis-lage": lageEcht(),
                });
                const client = (kaputt) => ({
                  on: () => {}, connect: async () => {},
                  get: async () => null,
                  setEx: async () => { if (kaputt === "set") throw new Error("setEx kaputt"); return "OK"; },
                  del: async () => { if (kaputt === "del") throw new Error("del kaputt"); return 1; },
                });
                // JEDER FALL BEKOMMT EINEN FRISCHEN DROSSEL-ZUSTAND. Er liegt
                // auf `global`, und ohne das Zuruecksetzen schlaegt die Drossel
                // des vorigen Falls durch — dann misst man die Drossel, nicht
                // das Verhalten.
                const fahre = async (c, tun) => {
                  const vorherLage = global.__redis_lage__;
                  global.__redis_lage__ = undefined;
                  const m = bauCache(c);
                  const warn = [];
                  const sWarn = console.warn;
                  console.warn = (...a) => warn.push(a.join(" "));
                  let r;
                  try { r = await tun(m.exports); }
                  catch (e) { r = `WIRFT ${e.message}`; }
                  console.warn = sWarn;
                  global.__redis_lage__ = vorherLage;
                  return { r, warn, fehler: m.fehler };
                };
                try {
                  process.env.REDIS_URL = "redis://pruefstand";

                  const sKaputt = await fahre(client("set"),
                    async (x) => { await x.cacheSet("k", { v: 1 }, 60); return "fertig"; });
                  torPruefung("ein fehlgeschlagener Redis-SCHREIBvorgang bleibt stumm",
                    sKaputt.r === "fertig" && sKaputt.warn.length === 1
                    && /KEINE SCHREIBVORGAENGE/.test(sKaputt.warn[0]),
                    `${sKaputt.fehler ?? ""} ${sKaputt.warn.length} Meldungen: ${sKaputt.warn.join(" | ").slice(0, 150)}`);

                  // GEGENPROBE: ein gelungener Schreibvorgang meldet NICHTS.
                  // Ein Riegel, der bei jedem Schreiben Alarm schlaegt, waere
                  // so falsch wie keiner (Lehre vom 15.09.).
                  const sOk = await fahre(client(null),
                    async (x) => { await x.cacheSet("k", { v: 1 }, 60); return "fertig"; });
                  torPruefung("ein GELUNGENER Schreibvorgang meldet faelschlich einen Ausfall",
                    sOk.warn.length === 0, sOk.warn.join(" | ").slice(0, 150));

                  const dKaputt = await fahre(client("del"), (x) => x.cacheDel("k"));
                  torPruefung("ein fehlgeschlagener Redis-LOESCHvorgang gibt Erfolg zurueck",
                    dKaputt.r === false && dKaputt.warn.length === 1
                    && /LOESCHT NICHT/.test(dKaputt.warn[0]),
                    `${JSON.stringify(dKaputt.r)} ${dKaputt.warn.join(" | ").slice(0, 150)}`);

                  const dOk = await fahre(client(null), (x) => x.cacheDel("k"));
                  torPruefung("ein gelungenes Loeschen gibt false oder meldet einen Ausfall",
                    dOk.r === true && dOk.warn.length === 0,
                    `${JSON.stringify(dOk.r)} ${dOk.warn.join(" | ")}`);

                  // ── DIE MASKIERUNG, zwei Vorgaenge auf EINER Modulkopie ──
                  //
                  // Die erste Fassung dieser Pruefung setzte den Drossel-
                  // Zustand vor jedem Fall zurueck. Zwei Sabotagen blieben
                  // deshalb gruen, obwohl sie wirken: "der gelungene Vorgang
                  // meldet sich als Ausfall" und "beide Wege teilen sich den
                  // Zustand" verschieben NUR den Zustand — gedruckt wird erst
                  // beim naechsten echten Fehlschlag, und genau der kam im
                  // Pruefstand nie. Ein Testfall, der den Fehler nicht
                  // ausdruecken kann, beweist nichts.
                  //
                  // Jetzt: EIN Modul, EIN Zustand, drei Vorgaenge nacheinander.
                  {
                    const vorherLage = global.__redis_lage__;
                    global.__redis_lage__ = undefined;
                    let setKaputt = false, delKaputt = false;
                    const wackel = {
                      on: () => {}, connect: async () => {}, get: async () => null,
                      setEx: async () => { if (setKaputt) throw new Error("setEx kaputt"); return "OK"; },
                      del: async () => { if (delKaputt) throw new Error("del kaputt"); return 1; },
                    };
                    const mk = bauCache(wackel);
                    const w = [];
                    const sW = console.warn;
                    console.warn = (...a) => w.push(a.join(" "));
                    let nachGut = -1, nachSchlecht = -1, nachDel = -1;
                    try {
                      await mk.exports.cacheSet("k", { v: 1 }, 60);   // gelingt
                      nachGut = w.length;
                      setKaputt = true;
                      await mk.exports.cacheSet("k", { v: 2 }, 60);   // scheitert
                      nachSchlecht = w.length;
                      delKaputt = true;
                      await mk.exports.cacheDel("k");                  // scheitert
                      nachDel = w.length;
                    } catch { /* der Fall selbst darf nie werfen */ }
                    console.warn = sW;
                    global.__redis_lage__ = vorherLage;
                    torPruefung("ein gelungener Schreibvorgang stellt den naechsten "
                      + "Fehlschlag stumm",
                      nachGut === 0 && nachSchlecht === 1
                      && /SCHREIBVORGAENGE/.test(w[0] ?? ""),
                      `nach gut ${nachGut}, nach schlecht ${nachSchlecht}: ${(w[0] ?? "").slice(0, 110)}`);
                    torPruefung("ein Ausfall im SCHREIBweg stellt den LOESCHweg stumm — "
                      + "dann verdeckt die erste Meldung die andere",
                      nachDel === 2 && /LOESCHT NICHT/.test(w[1] ?? ""),
                      `${nachDel} Meldungen: ${w.join(" | ").slice(0, 160)}`);
                  }

                  // OHNE CLIENT ist der prozesseigene Speicher der ganze
                  // Speicher — dann ist das Loeschen vollstaendig, und dass
                  // Redis fehlt, sagt der LESEweg (`herkunft: "aus"`).
                  delete process.env.REDIS_URL;
                  const dOhne = await fahre(null, (x) => x.cacheDel("k"));
                  torPruefung("ohne Redis meldet das Loeschen einen Fehlschlag",
                    dOhne.r === true && dOhne.warn.length === 0,
                    `${JSON.stringify(dOhne.r)} ${dOhne.warn.join(" | ")}`);
                } finally {
                  if (altUrlW === undefined) delete process.env.REDIS_URL;
                  else process.env.REDIS_URL = altUrlW;
                }

                // UND DER WEG BIS ZUM NUTZER: /peakreset darf keinen Erfolg
                // melden, den es nicht gab. Die Kette war bis heute nur
                // gelesen — ein Fix, dessen Meldeweg ungeprueft ist, ist ein
                // halber Fix (Lehre vom 01.11.).
                for (const [name, delErgebnis, sollOk] of [
                  ["Redis loescht nicht", false, false],
                  ["Redis loescht", true, true],
                ]) {
                  const tfM = ladeTsModul("lib/trading-filters/trade-filters.ts", {
                    "redis-lage/redis-lage": lageEcht(),
                    "redis-cache": {
                      cacheLesen: async () => ({ wert: { peak: 2000 }, herkunft: "redis" }),
                      cacheGet: async () => ({ peak: 2000 }),
                      cacheSet: async () => true,
                      cacheDel: async () => delErgebnis,
                    },
                    "telegram-sender": { htmlAbgelehnt: tgHtml, telegramZeit: () => "x",
                      telegramDatum: () => "x", sendTelegram: async () => true },
                  });
                  const pz = tfM.exports?.peakZuruecksetzen;
                  const sLogP = console.warn;
                  console.warn = () => {};
                  let erg;
                  try { erg = typeof pz === "function" ? await pz() : { ok: "kein Export" }; }
                  catch (e) { erg = { ok: `WIRFT ${e.message}` }; }
                  console.warn = sLogP;
                  torPruefung(`/peakreset meldet bei "${name}" das Falsche`,
                    erg.ok === sollOk && (sollOk || /NICHT geloescht/.test(String(erg.fehler ?? ""))),
                    JSON.stringify(erg));
                }
              }

              const rcEcht = ladeTsModul("lib/cache/redis-cache.ts", { "redis-lage/redis-lage": ladeTsModul("lib/redis-lage/redis-lage.ts").exports });
              const lesen = rcEcht.exports?.cacheLesen;
              const holen = rcEcht.exports?.cacheGet;
              torPruefung("`cacheLesen` fehlt — dann laesst sich \"Schluessel "
                + "fehlt\" nicht von \"Redis weg\" trennen",
                typeof lesen === "function" && typeof holen === "function",
                `${typeof lesen} / ${typeof holen}`);

              // ── `cacheLesen` SELBST ausfuehren ──────────────────────
              //
              // Die drei Lagen unten pruefen, wie `/status` mit der
              // Herkunft UMGEHT — aber dort ist `redis-cache` durch einen
              // Stellvertreter ersetzt. Im Sabotage-Lauf blieben deshalb
              // drei Sabotagen AN redis-cache.ts gruen: das echte Modul
              // lief gar nicht. Also hier das ECHTE Modul gegen einen
              // gefaelschten Redis-Client.
              {
                const altUrl = process.env.REDIS_URL;
                try {
                  process.env.REDIS_URL = "redis://pruefstand:6379";
                  const bestand = new Map([["da", JSON.stringify({ count: 7 })]]);
                  const falscherClient = {
                    on() { return this; },
                    async connect() { return this; },
                    async get(k) { return bestand.has(k) ? bestand.get(k) : null; },
                    async setEx() { return "OK"; },
                  };
                  const rcMit = ladeTsModul("lib/cache/redis-cache.ts",
                    { redis: { createClient: () => falscherClient },
                      "redis-lage/redis-lage": ladeTsModul("lib/redis-lage/redis-lage.ts").exports });
                  const lesenMit = rcMit.exports?.cacheLesen;
                  const holenMit = rcMit.exports?.cacheGet;
                  if (typeof lesenMit !== "function" || typeof holenMit !== "function") {
                    torPruefung("redis-cache ist nicht ausfuehrbar", false,
                      rcMit.fehler ?? "nicht exportiert");
                  } else {
                    const da = await lesenMit("da");
                    torPruefung("Redis antwortet MIT Wert, aber die Herkunft "
                      + "ist nicht `redis` oder der Wert fehlt",
                      da.herkunft === "redis" && da.wert?.count === 7,
                      JSON.stringify(da));
                    const fehlt = await lesenMit("gibt-es-nicht");
                    torPruefung("Redis antwortet OHNE Treffer, aber die "
                      + "Herkunft ist nicht `redis` — dann ist \"Schluessel "
                      + "fehlt\" nicht von \"Redis weg\" zu trennen",
                      fehlt.herkunft === "redis" && fehlt.wert === null,
                      JSON.stringify(fehlt));
                    // `cacheGet` muss GENAU den Wert liefern, nichts anderes.
                    torPruefung("`cacheGet` gibt nicht mehr den Wert zurueck "
                      + "— dann liest jeder Aufrufer im Programm Unsinn",
                      (await holenMit("da"))?.count === 7
                      && (await holenMit("gibt-es-nicht")) === null,
                      JSON.stringify(await holenMit("da")));
                  }

                  // OHNE Redis: eine fehlende Antwort heisst `aus`.
                  delete process.env.REDIS_URL;
                  const rcOhne = ladeTsModul("lib/cache/redis-cache.ts", { "redis-lage/redis-lage": ladeTsModul("lib/redis-lage/redis-lage.ts").exports });
                  const lesenOhne = rcOhne.exports?.cacheLesen;
                  const setzenOhne = rcOhne.exports?.cacheSet;
                  if (typeof lesenOhne === "function") {
                    const aus = await lesenOhne("gibt-es-nicht");
                    torPruefung("ohne Redis meldet `cacheLesen` nicht `aus` — "
                      + "dann gilt ein Ausfall als \"Schluessel fehlt\", und "
                      + "aus unbekannt wird eine Messung",
                      aus.herkunft === "aus" && aus.wert === null,
                      JSON.stringify(aus));
                    // Und der prozesseigene Speicher meldet sich als solcher.
                    if (typeof setzenOhne === "function") {
                      await setzenOhne("mem", { a: 1 }, 60);
                      const sp = await lesenOhne("mem");
                      torPruefung("der prozesseigene Speicher gibt sich als "
                        + "Redis aus — dann sieht eine lokale Kopie wie eine "
                        + "verbindliche Antwort aus",
                        sp.herkunft === "speicher" && sp.wert?.a === 1,
                        JSON.stringify(sp));
                    }
                  }
                } finally {
                  if (altUrl === undefined) delete process.env.REDIS_URL;
                  else process.env.REDIS_URL = altUrl;
                }
              }

              // DREI LAGEN, je eine eigene Antwort.
              for (const [lage, antwort, sollZahl] of [
                ["Redis antwortet mit 7 Trades", { wert: { count: 7 }, herkunft: "redis" }, 7],
                ["Redis antwortet, Schluessel fehlt", { wert: null, herkunft: "redis" }, 0],
                ["niemand antwortet", { wert: null, herkunft: "aus" }, null],
              ]) {
                const altLage = global.__daily_trades__;
                const altF = global.fetch;
                let text = "";
                try {
                  delete global.__daily_trades__;
                  // `/status` antwortet ueber `reply()`, und das benutzt
                  // `global.fetch` — NICHT `sendTelegram`. Mein erster
                  // Versuch lauschte nur an `sendTelegram` und bekam
                  // "(keine Zeile)": der Stellvertreter sass am falschen
                  // Ende.
                  global.fetch = async (_u, opt) => {
                    try {
                      const b = JSON.parse(opt?.body ?? "{}");
                      if (typeof b.text === "string") text += `${b.text}\n`;
                    } catch { /* egal */ }
                    return { ok: true, status: 200,
                      json: async () => ({ ok: true }),
                      text: async () => "{\"ok\":true}" };
                  };
                  const whL = ladeTsModul("app/api/telegram/webhook/route.ts", {
                    "next/server": { NextResponse: { json: (x) => ({ __json: x }) } },
                    "telegram-notifications/telegram-sender": { htmlAbgelehnt: tgHtml,
                      sendTelegram: async (t) => { text = t; return true; },
                      telegramZeit: () => "01.11.2026, 14:00:00 MEZ",
                      telegramDatum: () => "01.11.2026",
                    },
                    "lib/killswitch": { getKillswitchReport: () => ({ triggered: false,
                      armed: true, systemLocked: false, stages: [], summary: "ok" }) },
                    "app/lib/prisma": { getPrisma: () => ({ trade: { findMany: async () => [] } }) },
                    "cache/redis-cache": {
                      cacheLesen: async (k) => (String(k).startsWith("daily_trades:")
                        ? antwort : { wert: null, herkunft: "aus" }),
                      cacheGet: async () => null,
                      cacheSet: async () => undefined,
                    },
                    "settings/settings-store": { getSettings: async () => ({
                      botSettings: { mode: "AUTO", maxConcurrentPositions: 6,
                        maxTradesPerDay: 21, tradeLimitEnabled: true },
                      riskSettings: { maxTotalDrawdownPct: 10 } }) },
                    "handels-lage/handels-lage":
                      ladeTsModul("lib/handels-lage/handels-lage.ts", {
                        "html-sicher/html-sicher": ladeTsModul("lib/html-sicher/html-sicher.ts").exports,
                      }).exports,
                    "laufzeit/laufzeit-stand": ladeTsModul("lib/laufzeit/laufzeit-stand.ts").exports,
                    // Ohne diesen Ersatz ist es der Stellvertreter, der beim Aufruf
                    // wirft — /status zeigte das Fenster dann nie, und die
                    // Verdrahtung waere ungeprueft (Klasse vom 30.09.).
                    "handelsfenster/fenster-text": ladeTsModul("lib/handelsfenster/fenster-text.ts").exports,
                    "agents/orchestrator-agent": { isWithinTradingSession: () => true,
                      HANDELSFENSTER: { oeffnetLondon: 7 * 60, schliesstNewYork: 17 * 60,
                        zoneLondon: "Europe/London", zoneNewYork: "America/New_York" } },
                  });
                  if (whL.fehler || typeof whL.exports?.POST !== "function") {
                    torPruefung(`${lage}: /status nicht ausfuehrbar`, false,
                      whL.fehler ?? "POST fehlt");
                  } else {
                    await whL.exports.POST({ json: async () => ({ message: {
                      chat: { id: Number(chat) }, from: { first_name: "P" },
                      text: "/status" } }) });
                  }
                } finally {
                  global.fetch = altF;
                  if (altLage === undefined) delete global.__daily_trades__;
                  else global.__daily_trades__ = altLage;
                }
                const zeile = text.split("\n").find((l) => /Tageslimit/.test(l)) ?? "";
                const soll = sollZahl === null ? "❔ Tageslimit: unbekannt"
                  : `✅ Tageslimit: ${sollZahl}/21`;
                torPruefung(`${lage}: /status meldet nicht "${soll}"`,
                  zeile.includes(soll), `bekam: ${zeile || "(keine Zeile)"}`);
              }
            }

            // /status muss den laufenden Stand nennen — END-TO-END durch die
            // echte POST-Funktion, mit der echten Umgebungsvariablen.
            await edge("/status");
            const aStatus = antw.at(-1) ?? "";

            // ══ DER POSITIONS-BLOCK, END-TO-END (07.11.) ══════════════
            //
            // Bis heute war seine Verdrahtung NUR strukturell gebunden —
            // Regexe auf den Quelltext. "Ein Regex prueft den Wortlaut,
            // nicht das Verhalten" (30.09.), und eine geprueffte Funktion,
            // die nie echte Werte bekommt, beweist nichts ueber ihre
            // Aufrufstelle. Jetzt laeuft die ECHTE POST-Funktion gegen
            // eine echte Sitzung, echte Positionen und echte Journal-
            // Notizen.
            //
            // SELBSTPRUEFUNG zuerst: kommt der Block ueberhaupt an?
            // Ohne ihn waeren alle Zeilen darunter stumm gruen.
            torPruefung("/status zeigt gar keinen Positions-Block — dann "
              + "beweisen die Zeilen darunter nichts",
              /<b>Offene Positionen:<\/b>/.test(aStatus)
              && /Positionen: 3\/6|Positionen: 3 von/.test(aStatus),
              (aStatus.match(/Positionen[^\n]*/g) || ["(keine Zeile)"]).slice(0, 2).join(" | "));
            // 1. Der Stil kommt aus dem Journal — ueber die ZWEITE Quelle.
            torPruefung("/status liest den Handelsstil nicht aus dem "
              + "Journal — dann steht ueberall 'Stil unbekannt', obwohl "
              + "die Zeile da ist",
              /XRPUSD BUY · 7\d\.\d h · SWING \(Grenze 168 h\) · Zeit-Exit aktiv/.test(aStatus),
              (aStatus.match(/XRPUSD[^\n]*/) ?? ["(keine XRPUSD-Zeile)"])[0]);
            // 2. OHNE brauchbare Journal-Zeile: ausgesetzt, nicht geraten.
            //    (D9 hat einen Stil, aber KEINE confidence.)
            torPruefung("/status erfindet einen Stil, wo das Journal keinen "
              + "brauchbaren hat — dann zeigt es eine Haltedauer-Grenze an, "
              + "auf die der Zeit-Exit gar nicht rechnet",
              /UKOIL BUY · 3\d\.\d h · Stil unbekannt · ⚠️ Zeit-Exit AUSGESETZT/.test(aStatus),
              (aStatus.match(/UKOIL[^\n]*/) ?? ["(keine UKOIL-Zeile)"])[0]);
            // 3. OHNE Eroeffnungszeit: der Zeit-Exit kann nicht greifen.
            torPruefung("/status verschweigt eine Position, deren Zeit-Exit "
              + "mangels Eroeffnungszeit gar nicht greifen kann",
              /SPX500 SELL · Alter unbekannt · DAYTRADING \(Grenze 24 h\) · ⚠️ Zeit-Exit kann NICHT greifen/.test(aStatus),
              (aStatus.match(/SPX500[^\n]*/) ?? ["(keine SPX500-Zeile)"])[0]);
            // 4. AUFFAELLIGES ZUERST — sonst faellt die ohne Zeit als
            //    erste aus dem Deckel.
            torPruefung("die auffaelligen Positionen stehen nicht vorne",
              aStatus.indexOf("UKOIL") < aStatus.indexOf("XRPUSD")
              && aStatus.indexOf("SPX500") < aStatus.indexOf("XRPUSD"),
              `UKOIL@${aStatus.indexOf("UKOIL")} SPX500@${aStatus.indexOf("SPX500")} `
              + `XRPUSD@${aStatus.indexOf("XRPUSD")}`);
            // 5. Und der Block darf das URTEIL nicht verdraengen.
            torPruefung("der Positions-Block verdraengt das Urteil — dann "
              + "steht statt der Tor-Diagnose nur noch 'N Angabe(n) nicht "
              + "feststellbar'",
              !/nicht feststellbar: [^\n]*Haltedauer/.test(aStatus),
              (aStatus.match(/🟡[^\n]*|🛑[^\n]*|🟢[^\n]*/) ?? ["(kein Urteil)"])[0].slice(0, 140));
            // 6. Die Journal-Abfrage lief wirklich — und auf OPEN.
            torPruefung("/status fragt die offenen Journal-Zeilen nicht ab",
              abfragen.some((a) => a?.where?.status === "OPEN" && a?.select?.notes === true),
              JSON.stringify(abfragen.map((a) => a?.where ?? null).slice(-3)));

            // ══ DER REST DER ANTWORT — GEMESSEN STATT EINGEFROREN ═════
            //
            // Der Laengen-Riegel weiter unten rechnet mit
            // `REST_GEMESSEN = 1064` — dem Rest der /status-Antwort
            // (Killswitch, Laufender Stand, Befehlsliste). Diese Zahl
            // stammt vom 31.10. und steht DREI ZEILEN unter einem
            // Kommentar, der genau davor warnt, Annahmen einzufrieren.
            //
            // /status ist seitdem viermal gewachsen. Nachgeprueft war die
            // Zahl zuletzt am 04.11. ueber `git log` — eine Pruefung war
            // es nie. Jetzt wird sie GEMESSEN: die ganze Antwort minus die
            // Lage-Zeilen, die der Spion oben festhaelt.
            {
              // DIE ZAHL AUS DEM RIEGEL SELBST, nicht abgeschrieben.
              //
              // Mein erster Entwurf schrieb hier `const REST_ERWARTET =
              // 1064; // dieselbe Zahl wie im Riegel`. Der Sabotage-Lauf
              // hat es gefangen: die lokale Kopie auf 99999 zu setzen
              // blieb GRUEN — eine Pruefung, die ihre eigene Schwelle
              // fuehrt, kann sie nicht schuetzen. Eine Zahl, die an zwei
              // Stellen steht, veraltet an einer davon (02.11.).
              //
              // Also wird sie aus dem Pruefer GELESEN. Senkt jemand
              // `REST_GEMESSEN` — die gefaehrliche Richtung, denn dann
              // rechnet der Laengen-Riegel zu wenig — wird diese Zeile rot.
              const selbstQ = read("scripts/checks/safety-nets.js");
              const mRest = /const REST_GEMESSEN = (\d+);/.exec(selbstQ);
              const REST_ERWARTET = mRest ? Number(mRest[1]) : null;
              torPruefung("REST_GEMESSEN liess sich nicht aus dem Pruefer "
                + "lesen — dann vergleicht die Zeile darunter gegen nichts",
                REST_ERWARTET !== null && REST_ERWARTET > 0,
                String(REST_ERWARTET));
              const lageText = (lageSpion?.zeilen ?? []).join("\n");
              const gemessen = aStatus.length - lageText.length;
              // SELBSTPRUEFUNG: ohne Lage-Zeilen waere die Differenz die
              // ganze Antwort, und die Pruefung darunter bewiese nichts.
              torPruefung("der Lage-Spion hat nichts festgehalten — dann "
                + "misst die Zeile darunter die ganze Antwort statt den Rest",
                lageText.length > 300 && aStatus.length > lageText.length,
                `Lage ${lageText.length}, Antwort ${aStatus.length}`);
              torPruefung("der Rest der /status-Antwort ist groesser als die "
                + "Zahl, mit der der Laengen-Riegel rechnet — dann misst er "
                + "zu wenig, und die Antwort kann unbemerkt zu lang werden",
                REST_ERWARTET !== null && gemessen <= REST_ERWARTET,
                `gemessen ${gemessen}, Riegel rechnet mit ${REST_ERWARTET} `
                + `(Antwort ${aStatus.length}, Lage ${lageText.length})`);
            }

            // DIE VERDRAHTUNG (01.11.). Im Sabotage-Lauf durfte der
            // Webhook `fensterOrtszeit: null` durchreichen und ALLES
            // blieb gruen — die Rechnung war geprueft, ihre Aufrufstelle
            // nicht. Genau die Fehlerklasse vom 30.09.
            torPruefung("/status zeigt das Handelsfenster nicht in Ortszeit "
              + "— dann ist die Rechnung geprueft, aber nie benutzt",
              /= \d\d:\d\d–\d\d:\d\d Zürich/.test(aStatus),
              (aStatus.match(/Handelszeit:[^\n]*/) ?? ["(keine Zeile)"])[0].slice(0, 120));
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

            // DIE EINGABE DARF NICHT IN DEN CHAT ZURUECK (Regel 29.09.).
            //
            // Ein Telegram-Verlauf liegt auf jedem angemeldeten Geraet und auf
            // Telegrams Servern und laesst sich nicht zurueckholen. Wer sich
            // vertippt und `/edge <etwas Vertrauliches>` schickt, haette es
            // sonst dauerhaft dort stehen. Die Meldung braucht das Argument
            // nicht — Laenge und die richtige Form erklaeren alles.
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

            // ── /hebel END-TO-END (31.10.) ──────────────────────────
            //
            // `/hebel` war bis heute NUR strukturell geprueft: ein
            // Regex auf den Webhook-Quelltext. Genau dieser
            // Pruefstand fand am 27.10. bei `/edge` einen echten
            // Fehler (`parseInt("1e")` ergibt 1) — und `/hebel`
            // spiegelt dieselbe Argument-Behandlung.
            await edge("/hebel");
            const aH = antw.at(-1) ?? "";
            torPruefung("/hebel antwortet nicht oder faellt in sein "
              + "catch — dann ist der Befehl end-to-end kaputt",
              /Hebel — was würde etwas ändern\?/.test(aH)
              && !/fehlgeschlagen/.test(aH),
              aH.replace(/\n/g, " ").slice(0, 200));

            // ── KEIN ROHES `<` IN DER ANTWORT (02.11.) ──────────────
            //
            // DER FUND: `hebel.ts` hatte NULL Escaping, und sein
            // R/R-Band heisst woertlich "< 1.5 (unter der
            // Einstiegs-Schwelle)". Die Antwort geht mit
            // `parse_mode: "HTML"` raus — Telegram lehnt sie mit HTTP
            // 200 und ok:false ab, und beim Nutzer kam am 01./02.11.
            // NICHTS an. Dieselbe Klasse wie `handels-lage.ts` am
            // 31.10., eine Datei weiter.
            //
            // Gesucht wird ein `<`, das KEIN bekanntes Tag eroeffnet —
            // unsere eigenen <b>/<i> duerfen bleiben, ein Riegel, der
            // alles entschaerft, waere so falsch wie keiner.
            const rohesKleiner = (t) =>
              (t.match(/<(?![/]?(b|i|u|s|code|pre|a)\b)/g) || []).length;
            // SELBSTPRUEFUNG an selbst gebauten Texten, nicht am Inhalt.
            if (rohesKleiner("a <b>fett</b> b") !== 0
              || rohesKleiner("R/R < 1.5") !== 1) {
              torPruefung("die <-Erkennung ist kaputt", false,
                `${rohesKleiner("a <b>fett</b> b")} / ${rohesKleiner("R/R < 1.5")}`);
            }
            torPruefung("/hebel sendet ein ROHES < — Telegram lehnt die ganze Antwort ab, und der Befehl verpufft",
              rohesKleiner(aH) === 0,
              `${rohesKleiner(aH)} rohe < — z.B. ...`
              + aH.slice(Math.max(0, aH.search(/<(?![/]?(b|i|u|s|code|pre|a)\b)/) - 40),
                aH.search(/<(?![/]?(b|i|u|s|code|pre|a)\b)/) + 40).replace(/\n/g, " | "));
            // Und die Gegenprobe: das Band MUSS da sein, sonst prueft
            // die Zeile oben an Daten, die den Fehler nicht ausdruecken.
            torPruefung("das Band \"< 1.5\" fehlt in den Testdaten — dann beweist die Escaping-Pruefung nichts",
              /&lt; 1\.5/.test(aH),
              aH.includes("1.5") ? "1.5 kommt vor, aber nicht entschaerft" : "kein 1.5-Band");
            // AN DIE ZAHLEN GEBUNDEN, nicht an den Namen: 40 Gewinner zu
            // je 12 ergeben EW 12.00, 40 Verlierer zu je -8 ergeben -8.00.
            // Ein blosses /EURUSD/ koennte auch aus einer anderen
            // Dimension stammen.
            torPruefung("/hebel gruppiert die Maerkte nicht oder rechnet "
              + "sie falsch — die Spalte kommt dann nicht in der Rechnung an",
              /• EURUSD: EW <b>12\.00<\/b> · 40 Trades/.test(aH)
              && /• BTCUSD: EW <b>-8\.00<\/b> · 40 Trades/.test(aH),
              aH.replace(/\n/g, " ").slice(0, 400));
            torPruefung("/hebel ohne Angabe taeuscht ein Fenster vor",
              /Zeitraum: <b>alles<\/b>/.test(aH),
              aH.replace(/\n/g, " ").slice(0, 160));
            // DIE SPALTEN ZUR LAUFZEIT. Die Struktur-Pruefung konnte
            // das nicht: vier der acht Namen stehen auch im
            // `/edge`-Block derselben Datei.
            const selH = abfragen.at(-1)?.select ?? {};
            for (const spalte of ["profitLoss", "notes", "result",
              "updatedAt", "riskReward", "market", "direction", "strategy"]) {
              torPruefung(`/hebel fragt die Spalte \`${spalte}\` zur `
                + "LAUFZEIT nicht ab — die Dimension bliebe dauerhaft "
                + "\"ohne Angabe\" und saehe wie ein Ergebnis aus",
                selH[spalte] === true, JSON.stringify(selH));
            }
            torPruefung("/hebel liest offene Trades mit — ihr P&L ist "
              + "ein Zwischenstand, kein Ergebnis (zur Laufzeit)",
              abfragen.at(-1)?.where?.status?.not === "OPEN",
              JSON.stringify(abfragen.at(-1)?.where ?? null));
            // Das FENSTER muss bis in die Rechnung kommen: mit 60
            // Tagen faellt der halbe Bestand (200 Tage alt) heraus,
            // und damit bleibt nur EINE belastbare Gruppe uebrig.
            await edge("/hebel 60");
            const aH60 = antw.at(-1) ?? "";
            // AN DIE ZAHL GEBUNDEN. Mein erster Versuch verlangte
            // `/ohne Vergleichsgruppe/` irgendwo im Text — und genau
            // DAMIT entwischte die Sabotage: der Satz steht auch im
            // Befund einer ANDEREN Dimension (dort ist alles "ohne
            // Angabe"). "Ein Treffer beweist nichts ueber die andere
            // Stelle" (25.10.), zum dritten Mal heute. Jetzt muss die
            // BTCUSD-Zeile selbst auf 0 gewertete Trades fallen.
            torPruefung("/hebel 60 reicht das Fenster nicht durch — "
              + "die Tagesangabe verpufft dann auf dem Weg",
              /letzte <b>60<\/b> Tage/.test(aH60)
              && /• BTCUSD: 0 Trades — zu wenig/.test(aH60)
              && /• EURUSD: EW <b>12\.00<\/b> · 40 Trades/.test(aH60),
              aH60.replace(/\n/g, " ").slice(0, 400));
            // Die Antwort muss ANKOMMEN — Telegram nimmt 4096.
            for (const [was, a] of [["ohne Fenster", aH], ["mit 60", aH60]]) {
              torPruefung(`die /hebel-Antwort ${was} reisst Telegrams `
                + "Grenze von 4096 Zeichen — sie kaeme nicht an",
                a.length <= 4096, `${a.length} Zeichen`);
            }
            // Eine unbrauchbare Angabe darf NICHT still zu "alles"
            // werden. Die drei hinteren sind die gefaehrlichen:
            // Number("1e5")=100000, Number("0x10")=16, Number("6e2")=600
            // — ohne sie laesst sich `/^\d+$/` auf `/^\d/` verkuerzen.
            for (const schlecht of ["/hebel abc", "/hebel 0", "/hebel -5",
              "/hebel 1e", "/hebel 1e5", "/hebel 0x10", "/hebel 6e2"]) {
              const vorher = abfragen.length;
              await edge(schlecht);
              const a = antw.at(-1) ?? "";
              torPruefung(`'${schlecht}' wird still zu einer `
                + "Gesamtrechnung, statt abgelehnt zu werden",
                /keine Anzahl Tage/.test(a) && !/Zeitraum:/.test(a),
                a.replace(/\n/g, " ").slice(0, 110));
              torPruefung(`'${schlecht}' fragt trotzdem die Datenbank ab`,
                abfragen.length === vorher,
                `${abfragen.length - vorher} Abfragen nach der Ablehnung`);
            }
            // UND DIE EINGABE DARF NICHT ZURUECK IN DEN CHAT (29.09.).
            const geheimH = "geheim123xyz";          // 12 Zeichen
            await edge(`/hebel ${geheimH}`);
            const aGeheimH = antw.at(-1) ?? "";
            torPruefung("/hebel schickt die Eingabe in den Chat zurueck "
              + "— ein Telegram-Verlauf laesst sich nicht zurueckholen",
              !aGeheimH.includes(geheimH) && !aGeheimH.includes("geheim"),
              aGeheimH.replace(/\n/g, " ").slice(0, 120));
            torPruefung("/hebel sagt gar nichts ueber die Eingabe — dann "
              + "weiss man nicht, ob sie ueberhaupt ankam",
              /12 Zeichen/.test(aGeheimH), aGeheimH.replace(/\n/g, " ").slice(0, 120));
            await edge("/hebel abcdefghijklmnopqrstuvwxyz");
            torPruefung("ein gekuerztes Echo rutscht bei /hebel durch",
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
      const klient = ladeTsModul("lib/capital-com/capital-com-client.ts",
        { "zeitmessung/zeitmessung": { zeitstempelMessen: () => {}, hatZone: () => false } });
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
        // MIT TRACKER-ERSATZ (31.10.). Ohne ihn ist
        // `ETIKETTEN_OHNE_ERGEBNIS` ein Stellvertreter, der beim Aufruf
        // WIRFT — der Pruefer lief nur gruen, weil seine Testdaten den
        // Ausschlusspfad nie betraten. Die Zusicherung "dieselbe Zahl
        // wie /edge" war damit OHNE Ausschluesse geprueft.
        const trE = ladeTsModul("lib/capital-com/capital-trade-tracker.ts");
        const ewMod = ladeTsModul("lib/expectancy/erwartungswert.ts",
          { "capital-trade-tracker": trE.exports });
        const hb = ladeTsModul("lib/hebel/hebel.ts", { "html-sicher/html-sicher": htmlSicherEcht,
          "expectancy/erwartungswert": ewMod.exports,
          // Das ECHTE Richtungs-Modul (04.11.) — nur so wird die Abbildung
          // LONG -> BUY in der Gruppierung wirklich ausgefuehrt.
          "richtung/richtung": ladeTsModul("lib/richtung/richtung.ts").exports,
        });
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

          // ── WANN WIRD EROEFFNET? (01.11.) ──────────────────────────
          //
          // Anlass: "selten Positionen vor 12:00". Aus dem Code nicht
          // beantwortbar — nur aus `Trade.createdAt`, das bisher kein
          // Befehl gelesen hat.
          {
            const stundeBand = hb.exports?.stundeBand;
            const ordnung = hb.exports?.STUNDEN_ORDNUNG;
            if (typeof stundeBand !== "function" || !Array.isArray(ordnung)) {
              torPruefung("stundeBand/STUNDEN_ORDNUNG nicht exportiert", false,
                `${typeof stundeBand} / ${typeof ordnung}`);
            } else {
              // EINE FEHLENDE ANGABE WIRD NICHT 0 UHR. Das waere eine
              // Behauptung statt einer Messung — dieselbe Regel wie bei
              // `profitLoss` (26.10.), `riskReward` (29.10.) und dem
              // Kurs-Alter (22.09.).
              for (const [wert, soll] of [
                [new Date("2026-10-20T08:30:00Z"), "08 UTC"],
                [new Date("2026-10-20T00:00:00Z"), "00 UTC"],
                [new Date("2026-10-20T23:59:59Z"), "23 UTC"],
                ["2026-10-20T07:05:00Z", "07 UTC"],
                [null, "ohne Angabe"], [undefined, "ohne Angabe"],
                ["kein datum", "ohne Angabe"], [Number.NaN, "ohne Angabe"],
              ]) {
                const b = stundeBand(wert);
                torPruefung(`stundeBand(${wert instanceof Date
                  ? wert.toISOString() : JSON.stringify(wert)}) ergibt nicht `
                  + `"${soll}"`, b === soll, `bekam: ${b}`);
              }
              // AN DER EIGENSCHAFT, NICHT AN EINER ZAHL (03.11.). Hier stand
              // `ordnung.length === 25`. Als am 03.11. zwei benannte Gruppen
              // dazukamen, wurde die Pruefung rot, obwohl die Ordnung richtig
              // war — dieselbe Falle wie `=== 200` beim Tor-Deckel (02.11.).
              const NACHG = hb.exports?.STUNDE_NACHGETRAGEN;
              const SYNCG = hb.exports?.STUNDE_SYNC;
              const stundenTeil = ordnung.slice(0, 24)
                .every((n, i) => n === `${String(i).padStart(2, "0")} UTC`);
              const restTeil = ordnung.slice(24);
              torPruefung("die Stunden-Ordnung ist nicht vollstaendig — "
                + "dann sortiert die Anzeige nach Menge statt nach Uhrzeit",
                stundenTeil && restTeil.length === 3
                && restTeil[0] === "ohne Angabe"
                && restTeil[1] === NACHG && restTeil[2] === SYNCG,
                `${ordnung.length}: ${ordnung.slice(22).join(", ")}`);

              // AUSGEFUEHRT: die Dimension muss da sein UND chronologisch
              // sortieren. Nach Menge sortiert waere die Frage "ist es
              // frueh leer?" gar nicht ablesbar.
              const zeilenS = [];
              for (let i = 0; i < 120; i++) {
                // Stunde 14 bekommt die MEISTEN Zeilen — eine Sortierung
                // nach Menge zoege sie nach vorn.
                const std = i < 80 ? 14 : (i < 100 ? 9 : 8);
                zeilenS.push({
                  profitLoss: i % 3 === 0 ? 6 : -3,
                  result: i % 3 === 0 ? "WIN" : "LOSS",
                  updatedAt: "2026-10-20T10:00:00.000Z",
                  createdAt: `2026-10-20T${String(std).padStart(2, "0")}:10:00.000Z`,
                  // OHNE `source` waere seit dem 03.11. JEDE Zeile "ohne
                  // Angabe" — die Dimension zaehlt nur Auto-Trades als
                  // Eroeffnungsstunde. Ein Testfall ohne Schreibweg koennte
                  // die Sortierung gar nicht mehr ausdruecken.
                  notes: JSON.stringify({ tradingStyle: "DAYTRADING", source: "auto-scan" }),
                  riskReward: 2, market: "EURUSD", direction: "BUY",
                  strategy: "Trend",
                });
              }
              const dS = hebelBericht(zeilenS, null)
                .find((d) => d.titel === "Eröffnungsstunde (UTC)");
              torPruefung("die Dimension Eröffnungsstunde fehlt",
                !!dS, JSON.stringify(hebelBericht(zeilenS, null).map((d) => d.titel)));
              torPruefung("die Stunden sind nicht chronologisch sortiert — "
                + "nach Menge sortiert laesst sich \"frueh leer?\" nicht ablesen",
                dS?.gruppen?.[0]?.name === "08 UTC"
                && dS?.gruppen?.[1]?.name === "09 UTC"
                && dS?.gruppen?.[2]?.name === "14 UTC",
                JSON.stringify(dS?.gruppen?.map((g) => `${g.name}:${g.gewertet}`)));
              // Und die Zahl muss stimmen: 80 Zeilen um 14 UTC.
              torPruefung("die Stunden-Gruppen zaehlen falsch",
                dS?.gruppen?.find((g) => g.name === "14 UTC")?.gewertet === 80,
                JSON.stringify(dS?.gruppen?.map((g) => `${g.name}:${g.gewertet}`)));
              // ── NUR AUTO-TRADES TRAGEN DIE EROEFFNUNG (03.11.) ──────
              //
              // Gemessen ueber alle vier Schreibwege der Trade-Tabelle:
              // `auto-scan` schreibt NOW() beim Platzieren (= Eroeffnung),
              // `rekonstruiert-aus-position` NOW() beim Nachtragen,
              // `tx-sync` die Broker-Transaktionszeit, und ein manueller
              // Eintrag ueber POST /api/trades die Eingabezeit. Drei von
              // vier sind KEINE Eroeffnung — sie als Stunde zu zaehlen
              // waere eine Behauptung statt einer Messung.
              const es = hb.exports?.eroeffnungsStunde;
              torPruefung("eroeffnungsStunde ist nicht exportiert",
                typeof es === "function", String(typeof es));
              if (typeof es === "function") {
                const ZEIT = "2026-10-20T14:10:00.000Z";
                for (const [quelle, soll] of [
                  ["auto-scan", "14 UTC"],
                  ["rekonstruiert-aus-position", NACHG],
                  ["tx-sync", SYNCG],
                  [null, "ohne Angabe"],
                  ["", "ohne Angabe"],
                  ["irgendwas-neues", "ohne Angabe"],
                ]) {
                  const ist = es(ZEIT, quelle);
                  torPruefung(`eroeffnungsStunde(${JSON.stringify(quelle)}) ergibt `
                    + `nicht "${soll}"`, ist === soll, `bekam: ${ist}`);
                }
                // Und bei einem Auto-Trade OHNE Zeit bleibt es "ohne Angabe"
                // — nicht 00 UTC.
                torPruefung("ein Auto-Trade ohne Zeit wird zu 00 UTC",
                  es(null, "auto-scan") === "ohne Angabe"
                  && es("kein datum", "auto-scan") === "ohne Angabe",
                  `${es(null, "auto-scan")} / ${es("kein datum", "auto-scan")}`);
                // AUSGEFUEHRT ueber die ganze Dimension: die drei Wege
                // bekommen eigene Gruppen, werden also gezaehlt und nicht
                // still verworfen.
                const gemischt = [];
                for (let i = 0; i < 100; i++) {
                  const q = i < 40 ? "auto-scan" : i < 70 ? "tx-sync"
                    : i < 90 ? "rekonstruiert-aus-position" : null;
                  gemischt.push({
                    profitLoss: i % 3 === 0 ? 6 : -3,
                    result: i % 3 === 0 ? "WIN" : "LOSS",
                    updatedAt: "2026-10-20T10:00:00.000Z",
                    createdAt: ZEIT,
                    notes: JSON.stringify(q ? { source: q } : {}),
                    riskReward: 2, market: "EURUSD", direction: "BUY", strategy: "x",
                  });
                }
                const dG = hebelBericht(gemischt, null)
                  .find((d) => d.titel === "Eröffnungsstunde (UTC)");
                const zahl = (n) => dG?.gruppen?.find((g) => g.name === n)?.gewertet ?? -1;
                torPruefung("die Schreibwege werden als Eroeffnungsstunde "
                  + "mitgezaehlt — dann misst die Dimension etwas anderes, "
                  + "als ihr Titel sagt",
                  zahl("14 UTC") === 40 && zahl(SYNCG) === 30
                  && zahl(NACHG) === 20 && zahl("ohne Angabe") === 10,
                  JSON.stringify(dG?.gruppen?.map((g) => `${g.name}:${g.gewertet}`)));
                // Und der Hinweis sagt, WARUM — sonst steht dort eine
                // Gruppe "Journal-Sync" ohne jede Erklaerung.
                torPruefung("der Hinweis erklaert die eigenen Gruppen nicht",
                  /Auto-Trades/.test(dG?.hinweis ?? "")
                  && /Broker-Transaktionszeit/.test(dG?.hinweis ?? ""),
                  (dG?.hinweis ?? "").slice(0, 120));
              }

              // Eine Zeile OHNE createdAt darf NICHT zu "00 UTC" werden.
              // MIT Schreibweg, OHNE Zeit: so prueft der Fall wirklich die
              // fehlende ZEIT und nicht den fehlenden Schreibweg.
              const ohneZeit = hebelBericht([{
                profitLoss: 5, result: "WIN", updatedAt: "2026-10-20T10:00:00.000Z",
                notes: JSON.stringify({ tradingStyle: "DAYTRADING", source: "auto-scan" }),
                riskReward: 2, market: "EURUSD", direction: "BUY", strategy: "x",
              }], null).find((d) => d.titel === "Eröffnungsstunde (UTC)");
              torPruefung("eine fehlende Eröffnungszeit wird zu 00 UTC — "
                + "aus \"nicht gemessen\" wird dann Mitternacht",
                ohneZeit?.gruppen?.[0]?.name === "ohne Angabe",
                JSON.stringify(ohneZeit?.gruppen?.map((g) => g.name)));
            }
            // DIE VERDRAHTUNG: ohne `createdAt` in der Abfrage waere die
            // Dimension dauerhaft "ohne Angabe" und saehe wie ein Ergebnis
            // aus — Fehlerklasse 30.09. Im /hebel-BLOCK, nicht irgendwo.
            {
              // EIGENE LESUNG: `whH` wird erst weiter unten deklariert, und
              // ein Zugriff davor wirft (`Cannot access before
              // initialization`) — vom Pruefer selbst gemeldet.
              const whH2 = read("frontend/app/api/telegram/webhook/route.ts");
              const aH2 = whH2.indexOf('textLower === "/hebel"');
              const eH2 = whH2.indexOf('textLower === "/help"', aH2);
              // KOMMENTARBEREINIGT. Mein erster Versuch prueffte den ROHEN
              // Block — und `// createdAt: true,` passte weiter, die
              // Sabotage blieb gruen. "Ein Wort im Kommentar ist keine
              // Verwendung", diesmal in der Pruefung selbst.
              const blockH2 = (aH2 >= 0 && eH2 > aH2 ? whH2.slice(aH2, eH2) : "")
                .replace(/\/\*[\s\S]*?\*\//g, " ")
                .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
              // SELBSTPRUEFUNG der Bereinigung: der Block muss den Aufruf
              // noch enthalten, aber keinen Kommentartext mehr.
              torPruefung("die Kommentar-Bereinigung des /hebel-Blocks greift "
                + "nicht — dann zaehlt eine auskommentierte Spalte mit",
                blockH2.includes("hebelBericht(zeilen")
                && !/Fehlerklasse 30\.09/.test(blockH2),
                `${blockH2.length} Zeichen`);
              torPruefung("/hebel holt `createdAt` nicht — die "
                + "Eröffnungsstunde bliebe dauerhaft \"ohne Angabe\"",
                /\bcreatedAt: true/.test(blockH2),
                `${blockH2.length} Zeichen Block`);
            }
          }

          // ── DIE ANTWORT MUSS ANKOMMEN (31.10.) ─────────────────────
          //
          // Telegram nimmt 4096 Zeichen und lehnt laengere mit HTTP 200
          // und {ok:false} ab — der Befehl verpufft dann (seit dem
          // 26.10. immerhin mit Logzeile). GEMESSEN: sechs Gruppen je
          // Dimension (bei 30 Maerkten der Normalfall) ergaben 3831
          // Zeichen, ein Haertefall mit langen Namen 4973.
          {
            const MAXZ = hb.exports?.MAX_ZEICHEN;
            torPruefung("MAX_ZEICHEN ist nicht exportiert oder liegt "
              + "nicht unter Telegrams 4096",
              typeof MAXZ === "number" && MAXZ > 0 && MAXZ <= 4096,
              String(MAXZ));
            // Ein Haertefall: zehn Gruppen je Dimension, lange Namen.
            const hart = [];
            for (let g = 0; g < 10; g++) {
              for (let i = 0; i < 40; i++) {
                hart.push({
                  profitLoss: i % 3 === 0 ? 10 : -4,
                  result: i % 3 === 0 ? "WIN" : "LOSS",
                  updatedAt: "2026-10-20T10:00:00.000Z",
                  notes: JSON.stringify({
                    tradingStyle: `HANDELSSTIL_MIT_SEHR_LANGEM_NAMEN_${g}`,
                    signalQuelle: `SIGNALQUELLE_MIT_SEHR_LANGEM_NAMEN_${g}`,
                  }),
                  riskReward: 1 + g * 0.6,
                  market: `MARKT_MIT_SEHR_LANGEM_NAMEN_NUMMER_${g}`,
                  direction: g % 2 === 0 ? "BUY" : "SELL",
                  strategy: `STRATEGIE_FELD_MIT_LANGEM_NAMEN_${g}`,
                });
              }
            }
            // ── BEIDE ZEILENARTEN ENTSCHAERFT (02.11.) ──────────────
            //
            // Der End-to-End-Fall deckt nur die BELASTBARE Zeile ab: in
            // den Testdaten ist keine Gruppe mit `<`-Namen unbelastbar,
            // also wurde der zweite Zweig nie betreten und eine Sabotage
            // daran blieb gruen. Hier beide, direkt an der Funktion.
            {
              const gift = "< 1.5 & >test";
              const bericht = [{
                titel: "Pruefstand", hinweis: "", befund: "x",
                gruppen: [
                  { name: gift, gewertet: 40, ew: 1.5, trefferquote: 50,
                    rr: 1.2, belastbar: true },
                  { name: gift, gewertet: 3, ew: null, trefferquote: null,
                    rr: null, belastbar: false },
                ],
              }];
              const t = hebelText(bericht, null);
              const roheKleiner = (s) =>
                (s.match(/<(?![/]?(b|i|u|s|code|pre|a)\b)/g) || []).length;
              // SELBSTPRUEFUNG an selbst gebauten Texten.
              if (roheKleiner("<b>ok</b>") !== 0 || roheKleiner("a < b") !== 1) {
                torPruefung("die <-Erkennung im Einzelfall ist kaputt", false,
                  `${roheKleiner("<b>ok</b>")} / ${roheKleiner("a < b")}`);
              }
              torPruefung("eine Gruppenzeile sendet ein ROHES < oder & — Telegram lehnt die ganze Antwort ab",
                roheKleiner(t) === 0 && !/&(?!(amp|lt|gt|quot|#39);)/.test(t),
                t.split(/\r?\n/).filter((l) => /</.test(l)).slice(0, 2).join(" | ").slice(0, 150));
              // Gegenprobe: BEIDE Zeilenarten muessen wirklich im Text
              // stehen, sonst prueft die Zeile oben an einem leeren Satz.
              torPruefung("der Testbericht enthaelt nicht BEIDE Zeilenarten — dann beweist die Pruefung nichts",
                /zu wenig für einen/.test(t) && /EW <b>/.test(t),
                t.replace(/\n/g, " | ").slice(0, 160));
            }

            const tHart = hebelText(hebelBericht(hart, null), 60);
            torPruefung("die /hebel-Antwort reisst Telegrams Grenze — "
              + "sie kaeme dann gar nicht an",
              tHart.length <= (typeof MAXZ === "number" ? MAXZ : 4096),
              `${tHart.length} Zeichen`);
            torPruefung("die Kuerzung verschweigt ihren GRUND — dann "
              + "sieht eine unvollstaendige Antwort wie eine ganze aus",
              /Wegen der Telegram-Grenze/.test(tHart), tHart.slice(-240));
            // AN DIE FORM GEBUNDEN, nicht an den Wortlaut: der Satz
            // "weitere Gruppen" steht auch in der Kuerzungs-Begruendung
            // selbst. Eine Suche nach ihm war zuerst schon DORT zufrieden
            // und blieb gruen, obwohl die Rest-Zeile entfernt war —
            // "ein Treffer beweist nichts ueber die andere Stelle" (25.10.).
            torPruefung("die gekuerzte Antwort sagt nicht, WIE VIEL fehlt",
              /• \(\d+ weitere Gruppen, \d+ Trades\)/.test(tHart),
              tHart.slice(-240));

            // ══ DER MASSSTAB GEGEN DEN ALTBESTAND (04.11.) ═══════════
            //
            // `/hebel` nannte am 02. und 04.11. „beste Gruppe 00 UTC,
            // EW 2.18, 64 Trades". Diese 64 tragen wirklich
            // `source: "auto-scan"` — aber aus der Zeit VOR dem
            // 27.06.2026, als es gar kein Handelszeit-Tor gab
            // (`isWithinTradingSession` kam mit 98f4466; im Commit davor
            // kommt der Name NULL mal vor). Heute ist 00 UTC Sommer wie
            // Winter ZU. Die Empfehlung zeigte auf ein System, das es
            // nicht mehr gibt — und daran war NICHTS zu erkennen.
            {
              const endeText = hb.exports?.endeText;
              const massstabVon = hb.exports?.massstabVon;
              if (typeof endeText !== "function" || typeof massstabVon !== "function") {
                torPruefung("endeText/massstabVon sind nicht ausfuehrbar", false,
                  `endeText=${typeof endeText} massstabVon=${typeof massstabVon}`);
              } else {
                // BEDINGUNGSLOS. Die erste Fassung schwieg, wenn die Gruppe
                // bis an den Massstab heranreichte — dann ist ein fehlendes
                // Datum nicht von „nicht gemessen" zu unterscheiden, und
                // genau diese Mehrdeutigkeit ist die Fehlerklasse, die hier
                // am haeufigsten zugeschlagen hat.
                torPruefung("endeText nennt das Ende nicht bedingungslos",
                  endeText("2026-06-20") === " · bis 2026-06-20"
                  && endeText("2026-10-22") === " · bis 2026-10-22",
                  JSON.stringify([endeText("2026-06-20"), endeText("2026-10-22")]));
                // OHNE DATUM heisst ohne Datum — niemals „heute".
                torPruefung("ein fehlendes Datum wird zu einem Datum",
                  endeText(null) === " · ohne Datum",
                  JSON.stringify(endeText(null)));
                // Der Massstab ist das MAXIMUM, und `null` wenn es keines gibt.
                const dimA = [{ titel: "x", hinweis: null, befund: "", gruppen: [
                  { name: "a", ew: 1, gewertet: 40, trefferquote: 1, rr: 1,
                    belastbar: true, zuletzt: "2026-06-20" },
                  { name: "b", ew: 1, gewertet: 40, trefferquote: 1, rr: 1,
                    belastbar: true, zuletzt: "2026-10-22" },
                  { name: "c", ew: 1, gewertet: 40, trefferquote: 1, rr: 1,
                    belastbar: true, zuletzt: null }] }];
                torPruefung("der Massstab ist nicht das Maximum der Gruppen",
                  massstabVon(dimA) === "2026-10-22", String(massstabVon(dimA)));
                torPruefung("ein Massstab wird erfunden, wo kein Datum ist",
                  massstabVon([{ titel: "x", hinweis: null, befund: "", gruppen: [
                    { name: "a", ew: 1, gewertet: 40, trefferquote: 1, rr: 1,
                      belastbar: true, zuletzt: null }] }]) === null
                  && massstabVon([]) === null,
                  "beide muessen null sein");

                // ── UND DAS GANZE AUSGEFUEHRT, mit dem ECHTEN Fall ──
                //
                // Die Testdaten MUESSEN eine alte und eine aktuelle Gruppe
                // haben, sonst kann keine Pruefung den Fehler ausdruecken —
                // das ist die Lehre, die hier am oeftesten faellig war.
                const machZ = (n, tag, stunde, pnl) =>
                  Array.from({ length: n }, () => ({
                    profitLoss: pnl, result: pnl > 0 ? "WIN" : "LOSS",
                    exitReason: "DAZWISCHEN", market: "EURUSD", riskReward: 2,
                    strategy: "DAYTRADING | DAYTRADING", direction: "BUY",
                    createdAt: `${tag}T${String(stunde).padStart(2, "0")}:10:00.000Z`,
                    updatedAt: `${tag}T12:00:00.000Z`,
                    notes: JSON.stringify({ source: "auto-scan",
                      tradingStyle: "DAYTRADING" }),
                  }));
                const altNeu = [
                  // Der echte Fall: 64 Zeilen um 00 UTC aus dem JUNI …
                  ...machZ(64, "2026-06-20", 0, 6),
                  // … neben aktuellen vom OKTOBER.
                  ...machZ(40, "2026-10-22", 8, -3),
                ];
                const bAltNeu = hebelBericht(altNeu, null);
                const stD = bAltNeu.find((d) => d.titel === "Eröffnungsstunde (UTC)");
                const g00 = stD?.gruppen?.find((g) => g.name === "00 UTC");
                torPruefung("die Testdaten enthalten keine ALTE und keine "
                  + "AKTUELLE Gruppe — dann beweist die Pruefung darunter nichts",
                  g00?.gewertet === 64 && g00?.zuletzt === "2026-06-20"
                  && stD?.gruppen?.some((g) => g.zuletzt === "2026-10-22"),
                  `00UTC=${g00?.gewertet}/${g00?.zuletzt} `
                  + `Gruppen=${JSON.stringify(stD?.gruppen?.map((g) => [g.name, g.zuletzt]))}`);
                torPruefung("der Befund nennt das Ende der besten Gruppe "
                  + "nicht — dann zeigt die Empfehlung auf Altbestand, ohne "
                  + "dass man es sieht",
                  /beste Gruppe „00 UTC".*bis 2026-06-20/.test(stD?.befund ?? ""),
                  String(stD?.befund).slice(0, 200));
                const tAltNeu = hebelText(bAltNeu, null);
                torPruefung("die Antwort nennt den Massstab nicht — dann ist "
                  + 'ein „bis 2026-06-20" nicht einzuordnen',
                  /Massstab: neuester Trade mit Ergebnis <b>2026-10-22<\/b>/.test(tAltNeu),
                  (tAltNeu.match(/Massstab[^\n]*/) ?? ["(keine Zeile)"])[0]);

                // ── DIE ABSTUFUNG: ERKLAERUNG VERLIEREN, NICHT ZAHLEN ──
                //
                // Ohne die zweite Stufe fiel der Haertefall am 04.11.
                // durch den BODEN: der harte Schnitt verlor den ganzen
                // „Nicht berechenbar"-Block und endete mitten im HTML.
                torPruefung("der Haertefall faellt durch den Boden — dann "
                  + "wird mitten im HTML abgeschnitten und ZAHLEN gehen "
                  + "verloren",
                  !/✂️ Gekürzt/.test(tHart), tHart.slice(-200));
                torPruefung("im Haertefall fehlt eine Befund-Zeile — der "
                  + "Schnitt hat Zahlen gekostet",
                  (tHart.match(/^ *→ /gm) || []).length
                    === hebelBericht(hart, null).length,
                  `${(tHart.match(/^ *→ /gm) || []).length} von `
                  + `${hebelBericht(hart, null).length}`);
                // Und die Stufe muss sich MELDEN. Eine stumm weggelassene
                // Erklaerung ist dieselbe Luege wie ein stummer Schnitt.
                torPruefung("die weggelassenen Hinweise werden verschwiegen",
                  /Hinweise sind weggelassen/.test(tHart), tHart.slice(-240));
                // GEGENPROBE: die Stufe darf NICHT immer greifen. Bei einer
                // kleinen Lage muessen die Hinweise dastehen, sonst waere
                // der Riegel nur „immer ohne Hinweise" (Lehre 15.09.).
                torPruefung("die Hinweis-Stufe greift auch bei einer kleinen "
                  + "Lage — dann fehlt die Erklaerung immer",
                  /<i>/.test(tAltNeu) && !/Hinweise sind weggelassen/.test(tAltNeu),
                  `<i>-Zahl ${(tAltNeu.match(/<i>/g) || []).length}`);
              }
            }
            // GEGENPROBE: ein kleiner Fall darf NICHT gekuerzt werden.
            // Ohne sie waere ein Riegel gruen, der immer kuerzt.
            const tKlein = hebelText(hebelBericht(hart.slice(0, 40), null), 60);
            torPruefung("auch eine kurze Antwort wird gekuerzt — dann "
              + "fehlen Gruppen ohne Not",
              !/Wegen der Telegram-Grenze/.test(tKlein)
              && tKlein.length < tHart.length + 1,
              `${tKlein.length} Zeichen`);
          }

          // ── DER SCHLUESSEL KOMMT AUS DER QUELLE (30.10.) ────────────
          //
          // `/hebel` las `"stil"` — ein Name aus dem Gedaechtnis. Die
          // Notizen schreiben `tradingStyle`. Die Dimension war damit
          // dauerhaft „ohne Angabe", und der Pruefer blieb gruen, WEIL
          // seine Testdaten denselben erfundenen Schluessel benutzten.
          //
          // Jetzt wird der Name dort geholt, wo er GESCHRIEBEN wird.
          {
            const tracker = read("frontend/lib/capital-com/capital-trade-tracker.ts");
            const marke = "JSON.stringify({";
            const p = tracker.indexOf(marke);
            let block = "";
            if (p >= 0) {
              let tiefe = 0;
              for (let i = tracker.indexOf("{", p); i < tracker.length; i++) {
                if (tracker[i] === "{") tiefe++;
                else if (tracker[i] === "}") { tiefe--; if (tiefe === 0) { block = tracker.slice(p, i + 1); break; } }
              }
            }
            torPruefung("der Notizen-Block im Trade-Tracker ist nicht "
              + "auffindbar — ohne ihn beweist die Pruefung darunter nichts",
              block.length > 100 && /dealId/.test(block), `${block.length} Zeichen`);
            // Selbstpruefung in BEIDE Richtungen an kontrollierten Faellen.
            torPruefung("die Schluessel-Erkennung findet einen echten "
              + "Schluessel nicht", /\btradingStyle\s*:/.test(block), "must-hit");
            torPruefung("die Schluessel-Erkennung findet einen Schluessel, "
              + "den es gar nicht gibt", !/\bstil\s*:/.test(block), "must-not-hit");
            const hb = read("frontend/lib/hebel/hebel.ts");
            torPruefung("/hebel liest einen Notizen-Schluessel, den der "
              + "Trade-Tracker NICHT schreibt — die Dimension waere dauerhaft "
              + "\"ohne Angabe\" und saehe wie ein Ergebnis aus (30.09.)",
              /ausNotizen\(z\.notes \?\? null, "tradingStyle"\)/.test(hb)
              && !/ausNotizen\(z\.notes \?\? null, "stil"\)/.test(hb),
              "hebel.ts");
            torPruefung("der Titel behauptet 'Strategie', obwohl die Spalte "
              + "`<Stil> | <Strategie>` enthaelt",
              /titel: "Strategie-Feld \(Stil \| Strategie\)"/.test(hb), "Titel");

            // ── DIE SIGNALHERKUNFT (30.10.) ─────────────────────────
            //
            // Ob ein Trade von GPT oder vom gemessenen Konsens kam, stand
            // bis heute NIRGENDS. Ohne diese Angabe laesst sich der Regler
            // `allowMeasuredConsensus` nicht an Daten beurteilen.
            torPruefung("der Trade-Tracker schreibt `signalQuelle` nicht "
              + "mehr in die Notizen — die Herkunft waere wieder weg",
              /\bsignalQuelle\b/.test(block), "Notizen-Block");
            torPruefung("/hebel liest die Signalherkunft nicht",
              /ausNotizen\(z\.notes \?\? null, "signalQuelle"\)/.test(hb)
              && /titel: "Signalherkunft",/.test(hb), "hebel.ts");
            // Fehlt die Angabe, muss der Schluessel WEGGELASSEN werden —
            // eine erfundene Quelle waere schlimmer als keine.
            const trAll = read("frontend/lib/capital-com/capital-trade-tracker.ts");
            torPruefung("eine fehlende Signalherkunft wird erfunden statt "
              + "weggelassen",
              /\.\.\.\(trade\.signalQuelle \? \{ signalQuelle: trade\.signalQuelle \} : \{\}\)/
                .test(trAll), "Tracker");
            // BEIDE Schreibwege. Nur den automatischen zu erfassen hiesse,
            // die Haelfte der Trades als „ohne Angabe" zu fuehren.
            const orch = read("frontend/lib/agents/orchestrator-agent.ts");
            torPruefung("der AUTOMATISCHE Weg gibt die Signalherkunft nicht "
              + "mit",
              /signalQuelle: candidate\.gpt\.source,/.test(orch), "orchestrator");
            const route = read("frontend/app/api/capital-com/execute/route.ts");
            torPruefung("der MANUELLE Weg gibt die Signalherkunft nicht mit",
              /signalQuelle:/.test(route), "execute/route");
            const panel = read("frontend/components/MarketScannerPanel.tsx");
            torPruefung("der Scanner schickt die Signalherkunft nicht mit",
              /signalQuelle: opp\.gpt\.source,/.test(panel), "MarketScannerPanel");
          }

          // ── Zeilen bauen: 40 Gewinner/Verlierer in EINEM Markt ──────
          const zeilenH = [];
          for (let i = 0; i < 40; i++) {
            zeilenH.push({
              profitLoss: i % 3 === 0 ? 10 : -4,
              notes: JSON.stringify({ tradingStyle: "DAYTRADING" }),
              result: i % 3 === 0 ? "WIN" : "LOSS",
              updatedAt: "2026-10-20T10:00:00.000Z",
              riskReward: 2.0, market: "EURUSD", direction: "BUY",
              strategy: "Trend",
            });
          }
          // Die Signalherkunft MUSS gruppieren — und eine fehlende Angabe
          // bleibt „ohne Angabe", statt eine Quelle zu erfinden.
          {
            const mitQuelle = [];
            for (let i = 0; i < 35; i++) {
              mitQuelle.push({
                profitLoss: i % 3 === 0 ? 9 : -4,
                result: i % 3 === 0 ? "WIN" : "LOSS",
                updatedAt: "2026-10-28T10:00:00.000Z",
                notes: JSON.stringify({
                  tradingStyle: "DAYTRADING",
                  signalQuelle: i < 32 ? "MEASURED_CONSENSUS" : "GPT_REAL",
                }),
                riskReward: 2, market: "EURUSD", direction: "BUY",
                strategy: "DAYTRADING | DAYTRADING",
              });
            }
            const dQ = hebelBericht(mitQuelle, null)
              .find((d) => d.titel === "Signalherkunft");
            torPruefung("die Dimension Signalherkunft fehlt",
              !!dQ, JSON.stringify(hebelBericht(mitQuelle, null).map((d) => d.titel)));
            torPruefung("die Signalherkunft gruppiert nicht nach der Quelle",
              dQ?.gruppen?.[0]?.name === "MEASURED_CONSENSUS"
              && dQ?.gruppen?.[0]?.gewertet === 32,
              JSON.stringify(dQ?.gruppen?.map((g) => `${g.name}:${g.gewertet}`)));
            // Eine Zeile OHNE Angabe darf keine Quelle bekommen.
            const ohneQ = hebelBericht([{
              profitLoss: 5, result: "WIN", updatedAt: "2026-10-28T10:00:00.000Z",
              notes: JSON.stringify({ tradingStyle: "DAYTRADING" }),
              riskReward: 2, market: "EURUSD", direction: "BUY", strategy: "x",
            }], null).find((d) => d.titel === "Signalherkunft");
            torPruefung("eine fehlende Signalherkunft wird erfunden",
              ohneQ?.gruppen?.[0]?.name === "ohne Angabe",
              JSON.stringify(ohneQ?.gruppen?.map((g) => g.name)));
          }

          // ABSICHTLICH UNBEQUEM: zehn Breakeven dazu. Ohne sie sind
          // `trefferquote` (ueber alle gewerteten) und
          // `trefferquoteEntschieden` (ueber die entschiedenen) zufaellig
          // GLEICH — ein vertauschter Nenner faellt dann nicht auf. Genau
          // so ist die Sabotage H8 zuerst entwischt.
          for (let i = 0; i < 10; i++) {
            zeilenH.push({
              profitLoss: 0, notes: JSON.stringify({ tradingStyle: "DAYTRADING" }),
              result: "BREAKEVEN", updatedAt: "2026-10-20T10:00:00.000Z",
              riskReward: 2.0, market: "EURUSD", direction: "BUY",
              strategy: "Trend",
            });
          }
          // EINE AUSGESCHLOSSENE ZEILE (31.10.). Ohne sie beweist
          // "dieselbe Zahl wie /edge" nichts ueber die AUSSCHLUESSE —
          // und genau die sind der Grund, warum `/hebel` dieselbe
          // Funktion benutzt. Ihr P&L von 999 wuerde jeden
          // Erwartungswert sprengen, wenn sie mitgerechnet wuerde.
          zeilenH.push({
            profitLoss: 999, result: "BREAKEVEN",
            updatedAt: "2026-10-20T10:00:00.000Z",
            notes: JSON.stringify({ tradingStyle: "DAYTRADING", exitReason: "KEIN_PNL" }),
            riskReward: 2.0, market: "EURUSD", direction: "BUY",
            strategy: "Trend",
          });
          const direkt = erwartungswert(zeilenH, null);
          torPruefung("die ausgeschlossene Zeile (KEIN_PNL) wird "
            + "MITgerechnet — dann gelten fuer /hebel andere Regeln "
            + "als fuer /edge",
            direkt.ohneErgebnis === 1 && direkt.gewertet === 50,
            `ohneErgebnis=${direkt.ohneErgebnis} gewertet=${direkt.gewertet}`);
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

          // ── DIE RICHTUNG WIRD ABGEBILDET, NICHT ROH GRUPPIERT (04.11.) ──
          //
          // `/hebel` zeigte am 02.11. `BUY 585 · SELL 227 · LONG 3`. Die drei
          // LONG-Zeilen bekamen eine EIGENE Gruppe: unter MIN_TRADES fiel sie
          // aus dem Vergleich, waehrend /trading-journal und der Lernzyklus
          // dieselben Zeilen als BUY zaehlen — zwei Leser, zwei Antworten.
          //
          // Das wird AUSGEFUEHRT, nicht am Wortlaut geprueft: ein Regex auf
          // `richtungGruppe` bliebe gruen, wenn der Aufruf zwar dasteht, aber
          // das Ergebnis verworfen wird (Fehlerklasse 28.10./30.09.).
          {
            const mach = (n, dir, pnl) => Array.from({ length: n }, () => ({
              profitLoss: pnl, result: pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN",
              exitReason: "DAZWISCHEN", market: "EURUSD", riskReward: 2,
              strategy: "DAYTRADING | DAYTRADING", direction: dir,
              createdAt: "2026-10-20T10:00:00.000Z",
              updatedAt: "2026-10-22T10:00:00.000Z",
              notes: JSON.stringify({ source: "auto-scan", tradingStyle: "DAYTRADING" }),
            }));
            const gemischt = [
              ...mach(35, "BUY", 4), ...mach(5, "LONG", 3),
              ...mach(20, "SELL", -2), ...mach(2, "SHORT", -1),
              ...mach(1, "KAPUTT", 1), ...mach(1, "", 1),
            ];
            const rDim = hebelBericht(gemischt, null).find((d) => d.titel === "Richtung");
            const g = (name) => rDim?.gruppen?.find((x) => x.name === name)?.gewertet ?? 0;
            const namen = (rDim?.gruppen ?? []).map((x) => x.name);
            // SELBSTPRUEFUNG der Testdaten: ohne LONG/SHORT-Zeilen koennte
            // keine dieser Pruefungen den Fehler ausdruecken.
            torPruefung("die Testdaten enthalten kein LONG/SHORT — dann "
              + "beweist die Gruppierungs-Pruefung nichts",
              gemischt.filter((z) => z.direction === "LONG").length === 5
              && gemischt.filter((z) => z.direction === "SHORT").length === 2,
              `LONG=${gemischt.filter((z) => z.direction === "LONG").length} `
              + `SHORT=${gemischt.filter((z) => z.direction === "SHORT").length}`);
            torPruefung("LONG/SHORT bekommen in /hebel eine EIGENE Gruppe, "
              + "statt auf BUY/SELL abgebildet zu werden",
              !namen.includes("LONG") && !namen.includes("SHORT")
              && g("BUY") === 40 && g("SELL") === 22,
              `BUY=${g("BUY")} SELL=${g("SELL")} Gruppen=${JSON.stringify(namen)}`);
            // Die Gegenrichtung: ein WIRKLICH unlesbarer Wert darf NICHT
            // still auf eine Seite wandern. Sonst waere der Riegel nur
            // "alles ist BUY", und aus einem kaputten Wert eine Messung.
            torPruefung("ein unlesbarer Richtungswert verschwindet in BUY "
              + "oder SELL, statt sichtbar zu bleiben",
              g("KAPUTT?") === 1 && g("ohne Angabe") === 1,
              `KAPUTT?=${g("KAPUTT?")} ohneAngabe=${g("ohne Angabe")} `
              + `Gruppen=${JSON.stringify(namen)}`);
            torPruefung("die Richtungs-Dimension nennt ihre Abbildung nicht",
              /LONG\/SHORT/.test(rDim?.hinweis ?? ""),
              JSON.stringify((rDim?.hinweis ?? "").slice(0, 60)));
          }
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
        //
        // NUR IM /hebel-BLOCK (31.10.). Vorher wurde die GANZE Datei
        // durchsucht — und `profitLoss`, `notes`, `result`, `updatedAt`
        // stehen auch im `/edge`-Block. Haette `/hebel` sie verloren,
        // waere der Pruefer gruen geblieben: "ein Treffer beweist nichts
        // ueber die andere Stelle" (25.10.). Die Laufzeit-Pruefung im
        // End-to-End-Pruefstand ist der eigentliche Nachweis; dies hier
        // haelt die Stelle fest, auch wenn das Modul nicht ladbar ist.
        {
          const aH = whH.indexOf('textLower === "/hebel"');
          const eH = whH.indexOf('textLower === "/help"', aH);
          const blockH = aH >= 0 && eH > aH ? whH.slice(aH, eH) : "";
          // SELBSTPRUEFUNG: ein leerer oder zu weiter Ausschnitt
          // bewiese nichts. Er muss /hebel enthalten und /edge NICHT.
          torPruefung("der /hebel-Block liess sich nicht ausschneiden — "
            + "dann prueft die Spaltenliste die falsche Stelle",
            blockH.includes("hebelBericht(zeilen")
            && !blockH.includes('textLower === "/edge"'),
            `${blockH.length} Zeichen`);
          for (const spalte of ["profitLoss", "notes", "result", "updatedAt",
            "riskReward", "market", "direction", "strategy"]) {
            torPruefung(`/hebel liest die Spalte \`${spalte}\` nicht mit`,
              new RegExp(`\\b${spalte}: true`).test(blockH), spalte);
          }
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
        const hl = ladeTsModul("lib/handels-lage/handels-lage.ts",
          { "html-sicher/html-sicher": ladeTsModul("lib/html-sicher/html-sicher.ts").exports });
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
          const txt0 = txt;   // Kurzname fuer den HTML-Riegel unten

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
          // JEDE Angabe NAMENTLICH (31.10.). Die Schranke `>= 6` war zu
          // schwach: der Gesamt-Drawdown fehlte in der Liste, weil
          // `grenze === null || grenze <= 0` in EINEM Zweig stand und ein
          // unlesbarer Einstellungs-Lesepfad "✅ keine Grenze gesetzt"
          // meldete. Mit dem Fehler waren es 7 Einträge, ohne ihn 8 —
          // beides passiert eine untere Schranke. "Zaehlen statt finden"
          // (25.10.), hier: NAMENTLICH statt gezaehlt.
          for (const name of ["Broker-Sitzung", "Modus", "Offene Positionen",
            "Tageslimit", "Drawdown-Grenze", "Handelszeit", "Zyklen heute",
            "Ausgänge"]) {
            torPruefung(`"${name}" fehlt in der Liste der unbekannten `
              + "Angaben — das Urteil zaehlt sie dann nicht mit, und eine "
              + "nicht lesbare Angabe sieht wie eine gepruefte aus",
              nichts.unbekannt.includes(name),
              JSON.stringify(nichts.unbekannt));
          }
          // Die Drawdown-Grenze: unbekannt und AUS sind zwei Lagen.
          torPruefung("eine unlesbare Drawdown-Grenze wird als \"keine "
            + "Grenze gesetzt\" gemeldet — ein gruenes Haekchen fuer einen "
            + "Wert, den niemand lesen konnte",
            /❔ Gesamt-Drawdown: Grenze unbekannt/.test(txt(nichts))
            && !/✅ Gesamt-Drawdown/.test(txt(nichts)),
            txt(nichts).split("\n").filter((l) => /Drawdown/.test(l)).join(" | "));
          // ── UND SIE MUSS UNTER 4096 ZEICHEN BLEIBEN (31.10.) ───────
          //
          // GEMESSEN durch die echte POST-Funktion: echte Lage 1685,
          // volle Lage 2101, ein Haertefall mit 20 erfundenen Toren
          // 4837 — darueber. Die Tor-Schleife hat KEINEN Deckel (die
          // Ausgaenge haben einen: slice(0, 5)).
          //
          // Aber zwanzig Tore kann es nicht geben: `GateName` ist eine
          // GESCHLOSSENE Union. Mit allen zehn echten Namen und dem
          // laengsten echten Grund ergibt der Block 2422 Zeichen,
          // gesamt ~3486 — unter der Grenze. Deshalb KEIN Deckel und
          // kein Stueckeln: eine Mechanik, die nachweislich nie greift,
          // waere Arbeit auf Verdacht (Lehre vom 26.10.).
          //
          // Stattdessen diese MESSUNG. Die Namen kommen aus der QUELLE,
          // damit ein elftes Tor automatisch mitgerechnet wird — ein
          // fester Satz im Pruefer wuerde die Annahme einfrieren.
          {
            // Der Rest der /status-Antwort (Killswitch, Laufender Stand,
            // Befehlsliste) ist gemessen: 2101 - 1037 = 1064 Zeichen.
            const REST_GEMESSEN = 1064;
            const TELEGRAM_MAX = 4096;
            const bus = read("frontend/lib/agents/agent-bus.ts");
            const uStart = bus.indexOf("export type GateName =");
            const uEnde = uStart >= 0 ? bus.indexOf(";", uStart) : -1;
            const union = uStart >= 0 && uEnde > uStart
              ? bus.slice(uStart, uEnde) : "";
            const torNamen = [...union.matchAll(/\|\s*"([^"]+)"/g)].map((m) => m[1]);
            // SELBSTPRUEFUNG: eine leere oder zu kurze Liste wuerde die
            // Messung wertlos machen und saehe wie ein gutes Ergebnis aus.
            torPruefung("die Tor-Namen liessen sich nicht aus `GateName` "
              + "lesen — dann misst der Riegel darunter nichts",
              torNamen.length >= 8 && torNamen.includes("Schwelle")
              && torNamen.includes("Filterkette"),
              `${torNamen.length}: ${JSON.stringify(torNamen).slice(0, 160)}`);
            // Der laengste ECHTE Grund, gemessen ueber alle
            // `meldeTorEntscheidung`-Stellen (75 Zeichen nach Einsetzung).
            const LANGER_GRUND =
              "SPREAD_TOO_WIDE: Spread 4.2 Punkte = 0.38 % des Kurses, erlaubt sind 0.25 %";
            // MEHRERE Gruende je Tor. Mein erster Versuch gab jedem Tor
            // genau EINEN — dann ist "alle Gruende zeigen" dasselbe wie
            // "den haeufigsten zeigen", und die Sabotage blieb gruen.
            // Ueber 288 Zyklen lehnt ein Tor aus verschiedenen Gruenden ab.
            const toreMax = {};
            for (const n of torNamen) {
              toreMax[n] = { ja: 12, nein: 34, fallback: 2, gruende: {
                [LANGER_GRUND]: 30, [`${LANGER_GRUND} (2)`]: 20,
                [`${LANGER_GRUND} (3)`]: 10, [`${LANGER_GRUND} (4)`]: 5 },
                // ── EIN FUND IM RIEGEL SELBST (04.11.) ──────────────────
                //
                // Bis heute trug der Haertefall KEINE Richtungsaufteilung —
                // auch nicht die, die am 02.11. dazukam. Die dokumentierten
                // 3550 Zeichen waren damit zu optimistisch: sie messen einen
                // Fall, der nicht der schlimmste ist. "Ein Testfall, der den
                // Fehler nicht ausdrucken kann, beweist nichts" — hier auf
                // eine LAENGENMESSUNG angewandt.
                //
                // Dreistellige Zahlen und beide Seiten, weil ueber 288
                // Zyklen genau das zusammenkommt.
                richtungen: { SELL: 234, BUY: 198 },
                richtungenJa: { SELL: 187, BUY: 145 } };
            }
            // DIE AUSGAENGE AUCH AUS DER QUELLE. Ihre Zahl geraten zu haben
            // war der Grund, warum die Sabotage "Deckel entfernt" zuerst
            // gruen blieb: zwoelf erfundene statt der echten dreizehn.
            const orch = read("frontend/lib/agents/orchestrator-agent.ts");
            const ausgangNamen = [...new Set(
              [...orch.matchAll(/return "([^"]{8,})";/g)].map((m) => m[1]))];
            torPruefung("die Zyklus-Ausgaenge liessen sich nicht aus dem "
              + "Orchestrator lesen — dann misst der Riegel zu wenig",
              ausgangNamen.length >= 10
              && ausgangNamen.includes("Modus nicht AUTO")
              && ausgangNamen.includes("Keine Kandidaten nach Filter"),
              `${ausgangNamen.length}: ${JSON.stringify(ausgangNamen).slice(0, 140)}`);
            // ── DER HAERTEFALL TRAEGT AUCH DIE POSITIONEN (07.11.) ──────
            //
            // Sonst misst er wieder einen Fall, der NICHT der schlimmste
            // ist — genau der Fund vom 04.11., eine Zeile weiter. Der
            // Positions-Block hat seinen eigenen Deckel
            // (`POSITIONEN_MAX_STATUS`), weil `maxConcurrentPositions` eine
            // frei einstellbare Zahl ist.
            const PMS = hl.exports?.POSITIONEN_MAX_STATUS;
            const posMax = Array.from(
              { length: (typeof PMS === "number" ? PMS : 6) + 4 }, (_, i) => ({
                symbol: `SEHR_LANGER_MARKTNAME_${i}`, richtung: "SELL",
                alterStunden: 167.9 - i, stil: "DAYTRADING",
                grenzeStunden: 24, zeitExit: "aktiv", ueberfaellig: true,
              }));
            // `maxGleichzeitig` MUSS groesser sein als die Zahl der
            // Positionen: sonst greift der Limit-Blocker, und das Urteil
            // wird "🛑 Blockiert" statt der Tor-Diagnose. Mein erster
            // Entwurf liess `maxGleichzeitig: 6` bei zehn Positionen stehen
            // — der Pruefer hat es gefangen, es war ein Fehler in der
            // FIXTURE, nicht im Code.
            const haertefall = (tore) => txt0(mit({ ...BEKANNT,
              offenePositionen: posMax.length, positionen: posMax,
              maxGleichzeitig: posMax.length + 1,
              ausgaenge: Object.fromEntries(
                ausgangNamen.map((a, i) => [a, 300 - i])),
              trichter: {
                scans: 288, maerkte: 8640, richtungen: 120, vetos: 55,
                stilVerworfen: 12, ohneVolleDaten: 44,
                ohneVolleDatenGrund: { "Strategien": 20, "TA-Lib": 14,
                  "TA-Lib+Strategien": 10 },
                unterGrenze: 300, confMin: 60, confMax: 79, rrAbgelehnt: 210,
                ohneStopZiel: 30, go: 90, ohneGptAntwort: 120, tore,
              } }));
            const schlimmst = haertefall(toreMax);
            // ── DER HAERTEFALL MUSS DER HAERTEFALL BLEIBEN (04.11.) ─────
            //
            // Hier lag der Fund: bis heute trug `toreMax` KEINE
            // Richtungsaufteilung — auch nicht die vom 02.11. Gemessen
            // ergibt das 3573 statt 3991 Zeichen, die dokumentierten
            // ~3550 waren also um 418 zu optimistisch, und die Luft
            // betrug nicht 523, sondern 105.
            //
            // Eine Pruefung auf "ist das Feld da?" waere zu schwach:
            // entfernt man es, wird der Text KUERZER und der Riegel bleibt
            // zufrieden. Deshalb an der MESSUNG gebunden — der Haertefall
            // MIT Aufteilungen muss deutlich laenger sein als ohne.
            const toreOhne = {};
            for (const n of torNamen) {
              const kopie = { ...toreMax[n] };
              delete kopie.richtungen;
              delete kopie.richtungenJa;
              toreOhne[n] = kopie;
            }
            const ohneSplit = haertefall(toreOhne);
            // AN DIE EIGENSCHAFT GEBUNDEN, nicht an eine geeichte Zahl
            // (07.11.). Diese Pruefung verlangte zuerst >= 300 Zeichen
            // Differenz — geeicht auf ELF gezeigte Tore. Mit dem Deckel sind
            // es sechs, und sie wurde zu Recht rot: die Zahl beschrieb einen
            // Zustand, den es nicht mehr gibt. Jetzt wird GEZAEHLT, wie viele
            // der GEZEIGTEN Tor-Zeilen eine Aufteilung tragen — das veraltet
            // nicht, wenn sich der Deckel aendert.
            const TMS = hl.exports?.TORE_MAX_STATUS;
            const sollGezeigt = Math.min(torNamen.length,
              typeof TMS === "number" ? TMS : torNamen.length);
            const mitSplit = (schlimmst.match(/: ja \d+ \(\d+ (SELL|BUY)/g) || []).length;
            torPruefung("der Laengen-Haertefall traegt keine Richtungs"
              + "aufteilung auf den gezeigten Toren — dann misst er einen "
              + "Fall, der NICHT der schlimmste ist",
              typeof TMS === "number" && mitSplit === sollGezeigt
              && schlimmst.length > ohneSplit.length,
              `${mitSplit} von ${sollGezeigt} gezeigten Toren mit Aufteilung, `
              + `mit ${schlimmst.length}, ohne ${ohneSplit.length}, `
              + `TORE_MAX_STATUS=${TMS}`);
            // ══ DER DECKEL IM TOR-BLOCK (07.11.) ════════════════════════
            //
            // GEMESSEN: elf Tore kosten 1871 Zeichen, ein Tor im Schnitt
            // 170 — 47 % der ganzen Lage. Mit dem Rest der Antwort waren es
            // 4012 von 4096, also 84 Zeichen Luft; ein ZWOELFTES Tor in der
            // `GateName`-Union haette die Grenze gerissen, und dann kommt
            // /status GAR NICHT an. Dieselbe Loesung wie in der Tagesbilanz
            // (31.10.): nach Ablehnungen sortiert, Rest gezaehlt.
            {
              // Die Testdaten muessen den Deckel ERREICHEN, sonst kann
              // keine Pruefung darunter den Fehler ausdruecken.
              torPruefung("die Union hat nicht mehr Tore als der Deckel — "
                + "dann greift er in den Testdaten gar nicht",
                typeof TMS === "number" && torNamen.length > TMS,
                `${torNamen.length} Tore, Deckel ${TMS}`);
              const gezeigteZeilen = (schlimmst.match(/^ {6}\S[^\n]*: ja /gm) || []).length;
              torPruefung("der Tor-Block hat keinen Deckel — elf Tore "
                + "reissen zusammen mit dem Rest Telegrams Grenze",
                gezeigteZeilen === sollGezeigt,
                `${gezeigteZeilen} Tor-Zeilen, erwartet ${sollGezeigt}`);
              // Was fehlt, wird GEZAEHLT. Eine verschwiegene Zeile waere
              // schlimmer als eine fehlende.
              const restZahl = torNamen.length - sollGezeigt;
              torPruefung("die gekuerzte Tor-Liste sagt nicht, WIE VIEL fehlt",
                new RegExp(`\\(${restZahl} weitere Tore, \\d+ Ablehnungen\\)`).test(schlimmst),
                (schlimmst.match(/weitere Tore[^\n]*/) ?? ["(keine Rest-Zeile)"])[0]);
              // Und die Rest-Zahl muss STIMMEN: alle Tore haben nein 34.
              torPruefung("die Rest-Zeile nennt eine falsche Zahl Ablehnungen",
                new RegExp(`\\(${restZahl} weitere Tore, ${restZahl * 34} Ablehnungen\\)`)
                  .test(schlimmst),
                (schlimmst.match(/weitere Tore[^\n]*/) ?? ["(keine)"])[0]);

              // ── SORTIERT NACH ABLEHNUNGEN, nicht nach Eintreffen ──────
              //
              // Sonst faellt zufaellig das Tor weg, wegen dem man hinsieht.
              // Die Lehre vom 31.10., dort als gedrehte Sortierung gefangen.
              const schief = {};
              torNamen.forEach((n, i) => {
                // Das LETZTE Tor bekommt die meisten Ablehnungen — ohne
                // Sortierung faellt es aus dem Deckel heraus.
                schief[n] = { ja: 1, nein: i === torNamen.length - 1 ? 999 : i,
                  fallback: 0, gruende: { "grund": 1 } };
              });
              const tSchief = haertefall(schief);
              const letztes = torNamen[torNamen.length - 1];
              torPruefung("die Tor-Liste wird nicht nach Ablehnungen "
                + "sortiert — dann faellt das groesste Tor aus dem Deckel",
                new RegExp(`^ {6}${letztes.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}: ja `, "m")
                  .test(tSchief),
                (tSchief.match(/^ {6}\S[^\n]*: ja [^\n]*/gm) || []).slice(0, 3).join(" | "));
              // UND DAS URTEIL muss dasselbe Tor nennen — es sieht ALLE
              // Tore, nicht nur die gezeigten.
              //
              // `handelsLage` gibt {blocker, unbekannt, zeilen} zurueck —
              // ein `urteil`-FELD gibt es NICHT. Mein Rauchtest vom 04.11.
              // schrieb `lage.urteil ?? text` und war durch den Rueckfall
              // schwaecher, als er aussah. Hier wird die Urteilszeile selbst
              // gesucht, an der Quelle nachgelesen statt aus dem Gedaechtnis.
              const urteilZeile = (tSchief.match(/^(🟡|🔻|⛔|✅)[^\n]*Gr[öo]sstes[^\n]*/m)
                ?? tSchief.match(/Gr[öo]sstes[^\n]*/) ?? [""])[0];
              torPruefung("das Urteil nennt nicht das Tor mit den meisten "
                + "Ablehnungen — dann zeigt es nach einem Deckel auf die "
                + "falsche Stelle",
                urteilZeile.includes(letztes) && /999/.test(urteilZeile),
                urteilZeile.slice(0, 160) || "(keine Urteilszeile gefunden)");
            }

            torPruefung("die /status-Antwort reisst Telegrams 4096 Zeichen "
              + "im schlimmsten ECHTEN Fall (alle Tore der GateName-Union, "
              + "laengster echter Grund) — sie kaeme dann GAR NICHT an",
              schlimmst.length + REST_GEMESSEN <= TELEGRAM_MAX,
              `${schlimmst.length} + ${REST_GEMESSEN} Rest = `
              + `${schlimmst.length + REST_GEMESSEN} von ${TELEGRAM_MAX}`);
            // GEGENPROBE: der Riegel darf nicht einfach immer gruen sein.
            // Dieselbe Lage mit zwanzigfach langen Gruenden MUSS reissen —
            // sonst messe ich nur, dass eine Addition funktioniert.
            const toreLang = {};
            for (const n of torNamen) {
              toreLang[n] = { ja: 12, nein: 34, fallback: 2,
                gruende: { [LANGER_GRUND.repeat(20)]: 30 } };
            }
            const zuLang = txt0(mit({ ...BEKANNT, trichter: {
              scans: 288, go: 90, tore: toreLang } }));
            torPruefung("der Laengen-Riegel ist immer gruen — eine Lage "
              + "mit zwanzigfach langen Gruenden muss die Grenze reissen",
              zuLang.length + REST_GEMESSEN > TELEGRAM_MAX,
              `${zuLang.length} Zeichen`);
          }

          // ── EINE NACHRICHT, DIE GAR NICHT ANKOMMT (31.10.) ─────────
          //
          // `/status` geht mit `parse_mode: "HTML"` raus. Ein einzelnes
          // rohes `<` in einem fremden Text laesst Telegram die GANZE
          // Nachricht ablehnen (HTTP 200, {ok:false, "Can't parse
          // entities"}) — ausgerechnet bei dem Befehl, den man benutzt,
          // wenn etwas kaputt ist.
          //
          // UND DER FALL IST ECHT: `orchestrator-agent.ts:1002` sendet
          // woertlich `Confidence ${…} < Schwelle ${…}`. Genau dieses Tor
          // war am 30.10. der Live-Fall. `zyklus-bilanz.ts` entschaerfte
          // seit jeher mit `htmlSicher`, `handels-lage.ts` (29./30.10.
          // gebaut) hatte NULL Escaping — "ein Fix an einer Stelle
          // beantwortet nicht, wo die Klasse sonst noch steckt" (25.10.).
          //
          // GIFT-WERTE statt einer Suche nach `htmlSicher(`: eine Suche
          // wuerde bei einer NEUEN Interpolation nichts merken.
          {
            // DER GIFT-WERT DARF KEIN GUELTIGES TAG SEIN. Mein erster
            // Versuch war `A<b>B&C>D` — und `<b>` IST ein erlaubtes Tag,
            // also filterte der Klammer-Scanner ihn weg und vier von fuenf
            // Sabotagen blieben gruen. Derselbe Fehler wie `[RSI 82]` am
            // 30.09.: ein Testwert, der den Fehler nicht ausdruecken kann.
            //
            // Und die Pruefung haengt jetzt am TEXT, nicht an einem
            // Klammer-Scanner: der Rohwert darf NICHT vorkommen, die
            // entschaerfte Form MUSS. Das deckt `&` mit ab, das gar keine
            // Klammer erzeugt.
            const GIFT = "A<ZZ B&C>D";
            const ERLAUBT = /^<\/?(b|i|u|s|code|pre|a)(\s[^>]*)?>$/;
            const roheKlammern = (txt) =>
              (txt.match(/<[^>\n]*>?/g) || []).filter((x) => !ERLAUBT.test(x));
            // Jede fremde Eingabe EINZELN vergiften — sonst verdeckt die
            // erste die anderen.
            const stellen = [
              ["Modus (aus der Datenbank)", { ...BEKANNT, modus: GIFT }, GIFT],
              ["Ausgang (aus dem Bus)",
                { ...BEKANNT, ausgaenge: { [GIFT]: 3 } }, GIFT],
              ["Tor-NAME", { ...BEKANNT, trichter: {
                scans: 5, go: 1, tore: { [GIFT]: { ja: 0, nein: 2, fallback: 0, gruende: {} } } } },
                GIFT],
              // DER BELEGTE FALL, woertlich aus orchestrator-agent.ts:1002.
              ["Tor-GRUND (der belegte Fall)", { ...BEKANNT, trichter: {
                scans: 5, go: 1,
                tore: { "Schwelle": { ja: 0, nein: 2, fallback: 0,
                  gruende: { "Confidence 66 < Schwelle 70": 2 } } } } },
                "Confidence 66 < Schwelle 70"],
              ["Grund der fehlenden Daten", { ...BEKANNT, trichter: {
                scans: 5, go: 0, ohneVolleDaten: 2,
                ohneVolleDatenGrund: { [GIFT]: 2 } } }, GIFT],
            ];
            const hsF0 = ladeTsModul("lib/html-sicher/html-sicher.ts")
              .exports?.htmlSicher;
            for (const [was, eingabe, rohWert] of stellen) {
              const txt = txt0(mit(eingabe));
              const roh = roheKlammern(txt);
              torPruefung(`${was}: eine spitze Klammer geht ROH in die `
                + "Nachricht — Telegram lehnt sie dann ganz ab, und "
                + "/status kommt NICHT an",
                roh.length === 0, JSON.stringify(roh).slice(0, 180));
              // UND an den Text gebunden: der Rohwert darf nicht drinstehen,
              // die entschaerfte Form muss. Faengt auch ein nacktes `&`.
              if (typeof hsF0 === "function") {
                torPruefung(`${was}: der Rohwert steht unentschaerft in der `
                  + "Nachricht",
                  !txt.includes(rohWert) && txt.includes(hsF0(rohWert)),
                  `roh=${txt.includes(rohWert)} entschaerft=${txt.includes(hsF0(rohWert))}`);
              }
            }
            // GEGENPROBE: unsere EIGENEN Tags duerfen NICHT mitentschaerft
            // werden — sonst stuende `&lt;b&gt;` im Chat. Ein Riegel, der
            // alles escapet, waere so falsch wie keiner.
            // Der Fall braucht einen TRICHTER, sonst traegt die Antwort nur
            // EIN eigenes Tag (die Urteilszeile) — und an einem Tag laesst
            // sich der Unterschied kaum ablesen. Mein erster Versuch
            // verlangte drei Tags von einer Lage, die nur eines erzeugt:
            // ein Testfall, der zu seiner eigenen Erwartung nicht passt.
            const gesund = txt0(mit({ ...BEKANNT, trichter: {
              scans: 5, maerkte: 150, richtungen: 3, go: 1,
              tore: { "Schwelle": { ja: 1, nein: 0, fallback: 0, gruende: {} } },
            } }));
            const eigene = (gesund.match(/<b>/g) || []).length;
            torPruefung("die Testlage erzeugt zu wenige eigene Tags — dann "
              + "beweist die Gegenprobe darunter nichts",
              eigene >= 3, `${eigene} Tags`);
            torPruefung("die eigenen <b>-Tags werden mitentschaerft — dann "
              + "steht &lt;b&gt; im Chat",
              eigene >= 3 && !/&lt;b&gt;/.test(gesund), `${eigene} Tags`);
            // EINE Definition, nicht zwei Kopien. Identitaet, nicht Text:
            // zwei gleich aussehende Funktionen koennen auseinanderlaufen.
            const hsMod = ladeTsModul("lib/html-sicher/html-sicher.ts");
            const zbMod = ladeTsModul("lib/zyklus-bilanz/zyklus-bilanz.ts",
              { "html-sicher/html-sicher": hsMod.exports });
            torPruefung("`htmlSicher` ist in zyklus-bilanz eine ZWEITE "
              + "Kopie — zwei Stellen, an denen sie auseinanderlaufen",
              typeof hsMod.exports?.htmlSicher === "function"
              && zbMod.exports?.htmlSicher === hsMod.exports.htmlSicher,
              `hs=${typeof hsMod.exports?.htmlSicher} zb=${typeof zbMod.exports?.htmlSicher}`);
            // Die REIHENFOLGE: `&` muss zuerst ersetzt werden, sonst wird
            // das `&` der eben erzeugten `&lt;` nochmals ersetzt.
            const hsF = hsMod.exports?.htmlSicher;
            if (typeof hsF === "function") {
              torPruefung("htmlSicher ersetzt `&` nicht ZUERST — dann wird "
                + "aus `<` ein doppelt entschaerftes `&amp;lt;`",
                hsF("a < b") === "a &lt; b"
                && hsF("a & b") === "a &amp; b"
                && hsF("x>y") === "x&gt;y",
                `${hsF("a < b")} | ${hsF("a & b")} | ${hsF("x>y")}`);
            }

            // Und die Tagesbilanz muss denselben echten Grund entschaerfen.
            const tbF = zbMod.exports?.tagesbilanzText;
            const leerF = zbMod.exports?.leereTagessumme;
            if (typeof tbF === "function" && typeof leerF === "function") {
              const tg = Object.assign(leerF("2026-10-31"), {
                zyklen: 5, scans: 5,
                tore: { "Schwelle": { ja: 0, nein: 2, fallback: 0,
                  gruende: { "Confidence 66 < Schwelle 70": 2 } } },
              });
              const rohTb = roheKlammern(tbF(tg));
              torPruefung("die Tagesbilanz schickt eine rohe spitze "
                + "Klammer raus — sie kaeme dann gar nicht an",
                rohTb.length === 0, JSON.stringify(rohTb).slice(0, 180));
            }

            // ── UND DIE TAGESBILANZ HAT NUR ~790 ZEICHEN LUFT (31.10.) ─
            //
            // `sendTelegram` kennt KEINE Laengengrenze (offener Punkt
            // seit dem 26.10., heute gemessen). Eine Tagesbilanz ueber
            // 4096 Zeichen kaeme nicht an — immerhin mit Logzeile.
            //
            // GEMESSEN mit den ECHTEN Gruenden: 3309 von 4096. Mit dem
            // laengsten echten Grund (dem der Filterkette, 66 Zeichen)
            // auf ALLEN elf Toren waeren es 4627 — das ist aber nicht
            // erreichbar, weil nur dieses EINE Tor Gruende dieser Laenge
            // erzeugt. Deshalb KEIN Deckel: eine Mechanik, die
            // nachweislich nie greift, ist Arbeit auf Verdacht (26.10.).
            //
            // Die Tor-Namen kommen aus der QUELLE — ein zwoelftes Tor
            // wird automatisch mitgerechnet, und dann wird diese
            // Pruefung rot, bevor die Nachricht ausbleibt.
            if (typeof tbF === "function" && typeof leerF === "function") {
              const busQ = read("frontend/lib/agents/agent-bus.ts");
              const q0 = busQ.indexOf("export type GateName =");
              const q1 = q0 >= 0 ? busQ.indexOf(";", q0) : -1;
              const namenQ = q0 >= 0 && q1 > q0
                ? [...busQ.slice(q0, q1).matchAll(/\|\s*"([^"]+)"/g)].map((m) => m[1])
                : [];
              torPruefung("die Tor-Namen fuer die Tagesbilanz-Messung "
                + "liessen sich nicht lesen — dann misst sie nichts",
                namenQ.length >= 8, String(namenQ.length));
              // DIE ECHTEN GRUENDE, mit eingesetzten Werten. Nicht ein
              // erfundener langer Text: genau damit habe ich mir heute
              // ein falsches "REISST DIE GRENZE" gemessen.
              const ECHTE_GRUENDE = [
                "Confidence 66 < Schwelle 70",
                "Position bereits offen (Pyramiding aus)",
                "Limit 2/2 Positionen pro Symbol erreicht",
                "Tageslimit SCALPING erreicht",
                "DAILY_LOSS_LIMIT: Tagesverlust-Limit erreicht: -3.2% (Max: -5%)",
              ];
              // Eigener Geltungsbereich: `ausgangNamen` aus dem
              // Laengen-Riegel liegt in einem anderen Block.
              const orchQ = read("frontend/lib/agents/orchestrator-agent.ts");
              const ausgQ = [...new Set(
                [...orchQ.matchAll(/return "([^"]{8,})";/g)].map((m) => m[1]))];
              torPruefung("die Zyklus-Ausgaenge fuer die "
                + "Tagesbilanz-Messung liessen sich nicht lesen",
                ausgQ.length >= 10, String(ausgQ.length));
              // ZEHN Gruende je Tor, obwohl die Anzeige nur DREI zeigt.
              // Mein erster Versuch gab genau drei — dann aendert ein
              // `slice(0, 8)` statt `slice(0, 3)` nichts, und genau diese
              // Sabotage blieb gruen. Ueber 288 Zyklen hat ein Tor leicht
              // zehn verschiedene Gruende (die Confidence steht mit drin).
              const toreQ = {};
              namenQ.forEach((n, i) => {
                const g = {};
                for (let j = 0; j < 10; j++) {
                  g[`${ECHTE_GRUENDE[(i + j) % ECHTE_GRUENDE.length]} #${j}`] = 30 - j;
                }
                toreQ[n] = { ja: 12, nein: 34, fallback: 2, gruende: g };
              });
              const voll = Object.assign(leerF("2026-10-31"), {
                zyklen: 288, scans: 288, maerkte: 8640,
                gpt: { WAIT: 8000, BUY: 400, SELL: 240 }, ohneGptAntwort: 120,
                ausgaenge: Object.fromEntries(ausgQ.map((a, i) => [a, 300 - i])),
                vetos: 55, stilVerworfen: 12, unterGrenze: 300,
                confMin: 60, confMax: 79, rrAbgelehnt: 210, ohneStopZiel: 30,
                ohneVolleDaten: 44, ohneVolleDatenGrund: { "Strategien": 20,
                  "TA-Lib": 14, "TA-Lib+Strategien": 10 },
                go: 90, claudeGefragt: 300, newsZyklen: 120, mtfSumme: 5000,
                regelbrueche: { "BUY an Resistance": 40, "SELL an Support": 30,
                  "BUY ohne bullishen 1D-Trend/Signal": 25,
                  "SELL ohne bearishen 1D-Trend/Signal": 20,
                  "Richtung unbekannt": 5 },
                tore: toreQ, trades: 12, fehlgeschlagen: 8,
                // ACHT lange Broker-Fehler, obwohl die Anzeige FUENF zeigt
                // — und die Laenge ist dort NICHT geklemmt. Kurze Texte
                // ("EURUSD: MARKET_CLOSED") konnten das nicht ausdruecken.
                fehlgeschlagenGruende: Object.fromEntries(
                  ["EURUSD", "BTCUSD", "SPX500", "GOLD", "UKOIL", "ETHUSD",
                    "GER40", "SILVER"].map((sym, i) => [
                    `${sym}: error.invalid.details - Position size exceeds `
                    + `maximum allowed for this instrument`, 8 - i])),
                dauerSummeMs: 900000, dauerMaxMs: 60000,
              });
              const vollText = tbF(voll);
              torPruefung("die Tagesbilanz reisst Telegrams 4096 Zeichen "
                + "— sie kaeme dann nicht an, und `sendTelegram` kennt "
                + "keine Laengengrenze",
                vollText.length <= 4096, `${vollText.length} von 4096`);
              // GEGENPROBE: der Riegel darf nicht einfach immer gruen
              // sein. Zehnfach lange Gruende MUESSEN die Grenze reissen.
              const toreLangQ = {};
              namenQ.forEach((n) => { toreLangQ[n] = { ja: 1, nein: 2,
                fallback: 0, gruende: { [ECHTE_GRUENDE[4].repeat(10)]: 2 } }; });
              const zuLangQ = tbF(Object.assign(leerF("2026-10-31"),
                { zyklen: 1, scans: 1, tore: toreLangQ }));
              torPruefung("der Tagesbilanz-Riegel ist immer gruen — "
                + "zehnfach lange Gruende muessen die Grenze reissen",
                zuLangQ.length > 4096, `${zuLangQ.length} Zeichen`);
              // ── DER DECKEL DER TOR-LISTE (31.10.) ────────────────────
              //
              // Sie hatte keinen, waehrend die Ausgaenge einen haben —
              // und gemessen lag der Haertefall bei 4087 von 4096, also
              // NEUN Zeichen Luft. Jetzt sechs Tore, nach Ablehnungen
              // sortiert, und der Rest wird GEZAEHLT.
              torPruefung("weggelassene Tore werden verschwiegen statt "
                + "gezaehlt — eine stille Kuerzung sieht wie eine "
                + "vollstaendige Liste aus",
                namenQ.length <= 6
                || /\(\d+ weitere Tore, \d+ Ablehnungen\)/.test(vollText),
                vollText.split("\n").filter((l) => /weitere Tore/.test(l)).join(" | ")
                || `${namenQ.length} Tore, keine Rest-Zeile`);
              // Und die REIHENFOLGE: nach Ablehnungen, nicht nach
              // Eintreffen. Sonst entscheidet der Zufall, welches Tor
              // wegfaellt — und das wichtigste fehlt.
              const vieleTore = {};
              namenQ.forEach((n, i) => {
                vieleTore[n] = { ja: 1, nein: (i === namenQ.length - 1 ? 999 : i + 1),
                  fallback: 0, gruende: { "Grund": 1 } };
              });
              const sortText = tbF(Object.assign(leerF("2026-10-31"),
                { zyklen: 1, scans: 1, tore: vieleTore }));
              const letzter = namenQ[namenQ.length - 1];
              torPruefung("die Tor-Liste wird nicht nach Ablehnungen "
                + "sortiert — dann faellt das wichtigste Tor weg, weil es "
                + "zuletzt eingetroffen ist",
                namenQ.length <= 6
                || new RegExp(`${letzter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: `
                  + "1 ja · 999 nein").test(sortText),
                sortText.split("\n").filter((l) => /nein/.test(l)).slice(0, 3).join(" | "));
            }
          }

          // GEGENPROBE: eine echte 0 ist eine Messung, kein Ausfall — sie
          // darf NICHT als unbekannt gelten, sonst waere der Riegel nur
          // "immer unbekannt" (Lehre vom 15.09.).
          const ddAus = mit({ ...BEKANNT, maxDrawdownProzent: 0 });
          torPruefung("eine echte 0 als Drawdown-Grenze gilt als unbekannt "
            + "— aus einer Messung darf kein \"unbekannt\" werden (22.09.)",
            /✅ Gesamt-Drawdown: keine Grenze gesetzt/.test(txt(ddAus))
            && !ddAus.unbekannt.includes("Drawdown-Grenze"),
            JSON.stringify(ddAus.unbekannt));
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
                gruende: { "Confidence 66 < Schwelle 70": 2 },
                // Die Spanne gehoert in die ANTWORT, nicht nur in die
                // Rechnung — am 30.09. war eine vollstaendig gepruefte
                // Funktion dauerhaft ohne echte Werte.
                confSpanne: { "Confidence 66 < Schwelle 70": { min: 66, max: 69 } },
                richtungen: { BUY: 2 } },
              // `richtungenJa` (04.11.) MUSS hier stehen: ohne eine
              // zugestimmte Richtung in den Testdaten koennte keine
              // Pruefung darunter den Fehler ausdruecken — und genau so
              // war diese Fixture bis heute gebaut.
              "Meta-KI": { ja: 2, nein: 0, fallback: 0, gruende: {},
                richtungenJa: { SELL: 2 } },
              // DER DEPLOY-UEBERGANG als eigener Fall (04.11.): `ja` kommt
              // aus der alten Summe in Redis, die Aufteilung erst ab dem
              // Deploy. `9 ja (1 SELL)` las sich wie alle neun.
              "Duplikat": { ja: 9, nein: 0, fallback: 0, gruende: {},
                richtungenJa: { SELL: 1 } },
            },
          };
          const trTor = mit({ ...BEKANNT, trichter: MIT_TOR });
          const tTor = txt(trTor);
          torPruefung("die Tore nach dem GO fehlen in der Antwort — dann "
            + "steht dort GO 2 und kein Trade, ohne jede Erklaerung",
            /Tore nach dem GO/.test(tTor), tTor.slice(-300));
          torPruefung("ein Tor nennt seine ja\/nein-Zahlen nicht",
            /Schwelle: ja 0 · nein 2/.test(tTor), tTor.slice(-300));
          // ENTSCHAERFT ERWARTET (31.10.). Diese Pruefung verlangte bis
          // heute das ROHE `<` im Text — sie hat den Fehler damit
          // FESTGESCHRIEBEN. Mit `parse_mode: "HTML"` lehnt Telegram eine
          // solche Nachricht ganz ab; /status kam dann nicht an. Die
          // Gegenrichtung gehoert dazu: das rohe Zeichen darf NICHT mehr
          // auftauchen, sonst waere die Pruefung mit beidem zufrieden.
          torPruefung("der GRUND des Tores fehlt — die Zahl allein sagt "
            + "nicht, WARUM es zu war",
            /Confidence 66 &lt; Schwelle 70 \(2\)/.test(tTor)
            && !/Confidence 66 < Schwelle/.test(tTor), tTor.slice(-300));
          torPruefung("das Tor nennt die Confidence-Spanne nicht — dann steht "
            + "dort `Confidence # < Schwelle #` und die Zahl, um die es "
            + "geht, fehlt (Fund 02.11.)",
            /Confidence 66\u201369/.test(tTor), tTor.slice(-300));
          // GEBUNDEN AN DIE STELLUNG, nicht nur an den Inhalt (04.11.).
          // `/2 BUY/` traf irgendwo im Text — damit war die Pruefung auch
          // mit der alten, MEHRDEUTIGEN Form zufrieden, in der die
          // Aufteilung hinten an der Zeile stand und sich las, als
          // beschriebe sie beide Seiten.
          torPruefung("das Tor nennt die abgelehnte Richtung nicht, oder "
            + "nicht bei ihrer Zahl",
            /Schwelle: ja 0 · nein 2 \(2 BUY\)/.test(tTor), tTor.slice(-300));
          // Und die ANDERE Seite: ohne sie ist nicht entscheidbar, ob ein
          // Tor eine Richtung BEVORZUGT wegwirft oder nur die Mischung der
          // Signale abbildet. Am 04.11. waren 67 von 79 Ablehnungen SELL —
          // und SELL ist laut /hebel die einzige Richtung mit positivem EW.
          torPruefung("das Tor nennt die ZUGESTIMMTE Richtung nicht — dann "
            + "bleibt die Aufteilung der GO unbekannt",
            /Meta-KI: ja 2 \(2 SELL\) · nein 0/.test(tTor), tTor.slice(-300));
          // SELBSTPRUEFUNG der Testdaten: verlieren sie die zugestimmte
          // Richtung, sind beide Pruefungen darueber wertlos.
          torPruefung("die Tor-Testdaten tragen keine zugestimmte Richtung "
            + "mehr — dann beweist die Pruefung darueber nichts",
            MIT_TOR.tore["Meta-KI"].richtungenJa?.SELL === 2
            && MIT_TOR.tore["Meta-KI"].ja === 2,
            JSON.stringify(MIT_TOR.tore["Meta-KI"]));
          // DER DEPLOY-UEBERGANG in /status (04.11.): deckt die Aufteilung
          // ihre Seite nicht ab, MUSS dastehen, wie viele sie beschreibt.
          torPruefung("/status verschweigt, dass die Aufteilung nur einen "
            + "Teil der Seite beschreibt — nach einem Deploy mitten am Tag "
            + "liest sich die Klammer dann wie die ganze Seite",
            /Duplikat: ja 9 \(davon 1 mit Richtung: 1 SELL\)/.test(tTor),
            (tTor.match(/Duplikat[^\n]*/) ?? ["(keine Zeile)"])[0]);
          // Und die Gegenprobe: bei VOLLER Abdeckung kein Zusatz.
          torPruefung("/status relativiert eine VOLLE Abdeckung",
            /Meta-KI: ja 2 \(2 SELL\)/.test(tTor)
            && !/Meta-KI: ja 2 \(davon/.test(tTor),
            (tTor.match(/Meta-KI[^\n]*/) ?? ["(keine Zeile)"])[0]);
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
        // AN DIE EIGENSCHAFT GEBUNDEN, nicht an die Namensliste (07.11.).
        // Diese Pruefung verlangte bis heute die EXAKTE Folge
        // `[einst, sitzung, offeneZahl, …]`. Als `offeneZahl` zu
        // `offenePos` wurde und eine neunte Quelle dazukam, wurde sie rot
        // — obwohl die Parallelitaet unveraendert galt. Eine Pruefung, die
        // an einem Namen haengt, misst den Namen, nicht die Sache.
        //
        // Was wirklich gilt: EINE Destrukturierung mit vielen Namen aus
        // EINEM `Promise.all`. Ein sequentielles `await` je Quelle haette
        // viele Zuweisungen statt einer.
        {
          const m = /const \[([^\]]+)\]\s*=\s*\n?\s*await Promise\.all\(\[/.exec(W);
          const namen = m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
          torPruefung("die Faktensammlung laeuft NACHEINANDER — neun "
            + "Quellen mal fuenf Sekunden waeren 45 s bis zur Antwort",
            namen.length >= 8, `${namen.length} Quellen: ${namen.join(", ").slice(0, 120)}`);
          // GEGENPROBE: die Zahl der Namen muss zur Zahl der `sicher(`-
          // Aufrufe IM Promise.all passen. Sonst koennte eine Quelle
          // herausfallen und die Pruefung bliebe gruen.
          const vonA = W.indexOf("await Promise.all([");
          const bisA = W.indexOf("\n        ]);", vonA);
          const drin = vonA >= 0 && bisA > vonA
            ? (W.slice(vonA, bisA).match(/sicher\(async/g) || []).length : -1;
          torPruefung("die Zahl der Quellen passt nicht zur Zahl der Namen "
            + "— eine Quelle ist herausgefallen oder kommt doppelt an",
            drin === namen.length, `${drin} sicher()-Aufrufe, ${namen.length} Namen`);
        }

        // ── DAS FENSTER IN ORTSZEIT WIRD GERECHNET (01.11.) ────────
        //
        // In `handels-lage.ts` stand dreimal das Literal
        // "08:00–23:00 Zürich". Ausgerechnet mit der ECHTEN
        // `isWithinTradingSession()` ueber 2026+2027: an 35 Werktagen
        // schliesst das Fenster in Wirklichkeit um 22:00 Zuerich —
        // immer dann, wenn EU- und US-Sommerzeit auseinanderlaufen.
        // Der Text ist erst seit dem 01.11. da und war nie falsch
        // ausgeliefert; erster falscher Tag waere der 15.03.2027.
        {
          // ÜBER ALLE DATEIEN, NICHT NUR EINE (03.11.). Dieser Riegel
          // galt bis heute allein fuer `handels-lage.ts` — und genau
          // deshalb blieb `/hebel` uebrig: dort stand der Satz weiter,
          // sogar mit dem Wort "ganzjaehrig". Ein Treffer beweist nichts
          // ueber die andere Stelle (25.10.).
          //
          // KEINE DATEI-AUSNAHME. `fenster-text.ts` traegt das Beispiel in
          // seinem Blockkommentar — die Bereinigung entfernt es ohnehin.
          // Eine namentliche Ausnahme wuerde dagegen auch ein echtes
          // Literal dort verstecken, sobald es je eines gibt.
          const ohneK4 = (q) => q.replace(/\/\*[\s\S]*?\*\//g, " ")
            .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
          const zurichDateien = sourceFiles([".ts", ".tsx"])
            .filter((d) => d.startsWith("frontend/"))
            .filter((d) => /08:00–23:00/.test(ohneK4(read(d))));
          torPruefung("das Fenster steht wieder als Literal im Text — an 35 Werktagen pro zwei Jahre ist es dann eine Stunde daneben",
            zurichDateien.length === 0,
            zurichDateien.join(", ") || "kommentarbereinigt ueber alle Quelldateien gesucht");
          // SELBSTPRUEFUNG an GEBAUTEN Zeichenketten, nicht an einer Datei:
          // am Dateiinhalt hinge sie an einer Formulierung. Beide Richtungen,
          // sonst waere "0 Treffer" auch mit kaputter Suche gruen.
          torPruefung("die Zuerich-Suche ist blind — sie findet das Literal nicht einmal in einem gebauten Beispiel",
            /08:00–23:00/.test(ohneK4('const t = "08:00–23:00 Zuerich";'))
            && !/08:00–23:00/.test(ohneK4("// nur ein Kommentar 08:00–23:00")),
            "Treffer in Code muss gefunden, Treffer im Kommentar ignoriert werden");
          // Und sie muss ueberhaupt Dateien angesehen haben: null geprueft
          // ist kein sauberes Ergebnis, sondern ein kaputtes Werkzeug.
          torPruefung("die Zuerich-Suche hat gar keine Dateien gelesen",
            sourceFiles([".ts", ".tsx"]).filter((d) => d.startsWith("frontend/")).length > 300,
            `${sourceFiles([".ts", ".tsx"]).filter((d) => d.startsWith("frontend/")).length} Dateien`);

          const ft = ladeTsModul("lib/handelsfenster/fenster-text.ts");
          const orchM = ladeTsModul("lib/agents/orchestrator-agent.ts");
          const rechne = ft.exports?.fensterInAnzeigeZone;
          const G = orchM.exports?.HANDELSFENSTER;
          if (typeof rechne !== "function" || !G) {
            torPruefung("fensterInAnzeigeZone nicht ausfuehrbar", false,
              ft.fehler ?? orchM.fehler ?? "Export fehlt");
          } else {
            // Winter, Sommer und BEIDE Umstellungsfenster. Die ersten
            // zwei allein koennten den Fehler nicht ausdruecken: sie
            // ergeben beide 23:00 (Lehre vom 31.10.).
            for (const [name, ms, soll] of [
              ["Mo 02.11.2026 Winter", Date.UTC(2026, 10, 2, 12), "08:00–23:00"],
              ["Mi 15.07.2026 Sommer", Date.UTC(2026, 6, 15, 12), "08:00–23:00"],
              ["Do 29.10.2026 EU um, US nicht", Date.UTC(2026, 9, 29, 12), "08:00–22:00"],
              ["Mo 16.03.2027 US um, EU nicht", Date.UTC(2027, 2, 16, 12), "08:00–22:00"],
              // DIE UMSTELLUNGSTAGE SELBST. Ohne sie bleibt die
              // Nachkorrektur in `zeitpunktFuer` ungeprueft: meine ersten
              // vier Faelle lagen ALLE neben einer Umstellung, und die
              // Sabotage blieb gruen. Gemessen: ohne die Korrektur zeigt
              // /status an diesen Tagen 07:00–23:00 bzw. 09:00–22:00.
              ["So 08.03.2026 US stellt um", Date.UTC(2026, 2, 8, 6, 30), "08:00–22:00"],
              ["So 29.03.2026 EU stellt um", Date.UTC(2026, 2, 29, 0, 30), "08:00–22:00"],
              ["So 25.10.2026 EU stellt zurueck", Date.UTC(2026, 9, 25, 0, 30), "08:00–23:00"],
              ["So 14.03.2027 US stellt um", Date.UTC(2027, 2, 14, 6, 30), "08:00–22:00"],
            ]) {
              const ist = rechne(G, new Date(ms));
              torPruefung(`${name}: das Fenster wird falsch uebersetzt`,
                ist === soll, `${ist} statt ${soll}`);
            }
            // Es muss aus den GRENZEN kommen, nicht aus einer Tabelle.
            const anders = rechne({ ...G, schliesstNewYork: 16 * 60 },
              new Date(Date.UTC(2026, 10, 2, 12)));
            torPruefung("das Ergebnis haengt nicht an den uebergebenen Grenzen — dann ist es doch wieder fest verdrahtet",
              anders === "08:00–22:00", String(anders));
            // Und eine unaufloesbare Zone heisst UNBEKANNT, nicht geraten.
            torPruefung("eine unaufloesbare Zone wird geraten statt null",
              rechne({ ...G, zoneNewYork: "Gibt/EsNicht" },
                new Date(Date.UTC(2026, 10, 2, 12))) === null,
              "null heisst unbekannt");
          }
        }
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
      // `lib/broker-evolution-intelligence` stand hier bis zum 01.11. und ist
      // jetzt GELOESCHT — zusammen mit seiner Route, die niemand rief. Eine
      // Loeschung ist STAERKER als eine Quarantaene: was es nicht gibt, kann
      // niemand an die Broker-Auswahl haengen. Der Prüfer hat die Luecke
      // selbst gemeldet ("nennt Module, die es nicht mehr gibt"), genau wie
      // er soll — sonst waere ein toter Riegel stehengeblieben, der
      // Sicherheit vortaeuscht.
      //
      // Die uebrigen SECHS bleiben: sie sind ueber
      // `/api/dynamic-position-allocation` weiter erreichbar und rechnen
      // weiter mit erfundenen Werten.
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
      "html-sicher/html-sicher": ladeTsModul("lib/html-sicher/html-sicher.ts").exports,
      "agent-bus": busModul.exports,
      "redis-cache": {
        cacheGet: async (k) => (speicher.has(k) ? JSON.parse(speicher.get(k)) : null),
        cacheSet: async (k, v) => { speicher.set(k, JSON.stringify(v)); },
      },
      "telegram-sender": { htmlAbgelehnt: tgHtml, telegramZeit: () => "27.9.2026, 14:48:11 MESZ", telegramDatum: () => "27.9.2026", sendTelegram: async (t) => { gesendet.push(t); return true; } },
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
        // DER SCHNITT MITTEN IM WORT (02.11.). Live auf /status stand:
        //   "taSignal=NEUTRAL bei SELL-Richtung: trend#D=BEARISH vorhanden,
        //    aber TA-Signal ze"   <- nachgezaehlt exakt 80 Zeichen.
        // Der harte `.slice(0, 80)` hat die Diagnose mitten im Wort
        // abgeschnitten. Jetzt an der Wortgrenze, mit Auslassungszeichen.
        {
          const lang = "taSignal=NEUTRAL bei SELL-Richtung: trend1D=BEARISH "
            + "vorhanden, aber TA-Signal zeigt keine Bestaetigung der Richtung";
          const k = B.grundSchluessel(lang);
          const max = B.GRUND_MAX;
          torPruefung("GRUND_MAX ist nicht exportiert — dann friert der Pruefstand eine Zahl ein",
            typeof max === "number" && max > 0, String(max));
          torPruefung("ein Tor-Grund wird mitten im Wort abgeschnitten",
            k.length <= max && k.endsWith("\u2026")
            && !/ze\u2026$/.test(k) && !/ \u2026$/.test(k),
            JSON.stringify(k));
          // Das Gruppieren darf der Schnitt NICHT veraendern.
          torPruefung("der Wortgrenzen-Schnitt ist nicht deterministisch",
            B.grundSchluessel(lang) === k, JSON.stringify(k));
          // GEGENPROBE: ein Riegel, der IMMER kuerzt, waere so falsch wie
          // keiner — kurze Gruende muessen unveraendert bleiben.
          torPruefung("ein kurzer Grund wird unnoetig gekuerzt",
            B.grundSchluessel("Ueberanpassungsverdacht") === "Ueberanpassungsverdacht");
          // Ein Grund OHNE Leerzeichen darf nicht fast leer werden.
          torPruefung("ein Grund ohne Leerzeichen schrumpft auf nichts",
            B.grundSchluessel("A".repeat(200)).length >= max - 1,
            String(B.grundSchluessel("A".repeat(200)).length));
          // UND DER FALL, DEN MEINE TESTDATEN NICHT AUSDRUECKEN KONNTEN:
          // ein Leerzeichen GANZ VORNE. Ohne die GRUND_MIN_WORT-Schranke
          // bliebe davon "A\u2026" uebrig — der Grund waere weg. Mit
          // `"A".repeat(200)` faellt das nicht auf: dort gibt es gar kein
          // Leerzeichen und die Sabotage kostet genau EIN Zeichen.
          const frueh = B.grundSchluessel("A B" + "C".repeat(200));
          torPruefung("ein Grund mit fruehem Leerzeichen schrumpft auf fast nichts",
            frueh.length >= B.GRUND_MIN_WORT, JSON.stringify(frueh));
        }
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
        // ── DIE CONFIDENCE AM TOR (02.11.) ─────────────────────────
        //
        // `GateDecisionPayload.confidence` wurde von VIER Stellen
        // gesendet und von NIEMANDEM gelesen. Genau diese Zahl fehlte
        // am 02.11. im groessten Blocker des Tages: der Trichter zeigt
        // `86 (52-69)`, das Tor nur `Confidence # < Schwelle # (38)`.
        {
          const bc = B.neueBilanz(0);
          bc.ende = 1000; bc.ausgang = "Keine Kandidaten nach Filter";
          const tor = (approve, reason, confidence, direction) => B.bilanzVerbuchen(bc,
            { type: "GATE:DECISION", payload: { gate: "Schwelle", approve, reason, confidence, direction } });
          tor(false, "Confidence 70 < Schwelle 80", 70, "BUY");
          tor(false, "Confidence 79 < Schwelle 80", 79, "SELL");
          tor(false, "Confidence 74 < Schwelle 80", 74, "BUY");
          // Ein NaN darf die Spanne nicht vergiften (Lehre 29.10.).
          tor(false, "Confidence 99 < Schwelle 80", NaN, "buy");
          // Eine ZUSTIMMUNG fuehrt keinen Ablehnungsgrund — und damit
          // auch keine Spanne. Sonst stuende die Spanne der
          // Freigegebenen unter einem Ablehnungsgrund.
          tor(true, "Confidence 85 >= Schwelle 80", 85, "SELL");
          const tc = B.tagessummeAddieren(null, bc, "2026-11-02");
          const spAlle = tc.tore["Schwelle"]?.confSpanne ?? {};
          const sp = spAlle["Confidence # < Schwelle #"];
          torPruefung("die Confidence am Tor wird nicht mitgefuehrt",
            !!sp && sp.min === 70 && sp.max === 79, JSON.stringify(sp ?? null));
          torPruefung("ein NaN vergiftet die Confidence-Spanne",
            !!sp && Number.isFinite(sp.min) && Number.isFinite(sp.max), JSON.stringify(sp ?? null));
          torPruefung("eine Zustimmung erzeugt eine Spanne unter einem Ablehnungsgrund",
            Object.keys(spAlle).length === 1, JSON.stringify(spAlle));
          // Die Spanne darf nur Gruende nennen, die die Liste auch zeigt.
          const fremd = Object.keys(spAlle)
            .filter((n) => tc.tore["Schwelle"].gruende[n] === undefined);
          torPruefung("die Spanne nennt einen Grund, den die Liste nicht zeigt",
            fremd.length === 0, fremd.join(", "));
          // EINE SUMME VON GESTERN kennt das Feld nicht.
          const alt = JSON.parse(JSON.stringify(tc));
          for (const g of Object.values(alt.tore)) delete g.confSpanne;
          let warf = null;
          try { B.tagessummeAddieren(alt, bc, "2026-11-02"); } catch (e) { warf = e.message; }
          torPruefung("eine Tagessumme von gestern (ohne confSpanne) wirft",
            warf === null, String(warf));
          // DIREKT GERUFEN, nicht ueber den Bus: `bilanzVerbuchen`
          // filtert ein NaN schon am Eingang, der Riegel in der Summe
          // waere sonst unerreichbar und damit ungeprueft. Die Funktion
          // ist exportiert und muss FUER SICH stimmen (Lehre 29.10.).
          const roh = { start: 0, ende: 1, ausgang: "x", trades: [], fehlgeschlagen: [],
            tore: [
              { gate: "Schwelle", approve: false, reason: "Confidence 70 < Schwelle 80", confidence: 70 },
              { gate: "Schwelle", approve: false, reason: "Confidence 99 < Schwelle 80", confidence: NaN },
            ] };
          const spD = B.tagessummeAddieren(null, roh, "2026-11-02")
            .tore["Schwelle"]?.confSpanne?.["Confidence # < Schwelle #"];
          torPruefung("ein NaN aus einer handgebauten Bilanz vergiftet die Spanne",
            !!spD && spD.min === 70 && spD.max === 70, JSON.stringify(spD ?? null));
          // confText: Spanne, Einzelwert, nichts.
          torPruefung("confText erfindet eine Zahl, wo keine gemessen wurde",
            B.confText(undefined) === "" && B.confText({ min: NaN, max: 5 }) === ""
            && /Confidence 70\u201379/.test(B.confText({ min: 70, max: 79 }))
            && /Confidence 74$/.test(B.confText({ min: 74, max: 74 })),
            JSON.stringify([B.confText(undefined), B.confText({ min: 70, max: 79 })]));
          // Und die Tagesbilanz muss sie ZEIGEN.
          // WELCHE SEITE das Tor wegwirft — zweiter Fund des neuen
          // Gegenrichtungs-Riegels: auch `direction` war gesendet und
          // nie gelesen.
          const ri = tc.tore["Schwelle"]?.richtungen ?? {};
          torPruefung("die abgelehnte Richtung wird nicht mitgefuehrt",
            ri.BUY === 3 && ri.SELL === 1, JSON.stringify(ri));
          torPruefung("eine Zustimmung wird als abgelehnte Richtung gezaehlt",
            (ri.BUY ?? 0) + (ri.SELL ?? 0) === 4, JSON.stringify(ri));
          torPruefung("richtungText erfindet eine Seite, wo keine gemessen wurde",
            B.richtungText(undefined) === "" && B.richtungText({}) === ""
            && /3 BUY\/1 SELL/.test(B.richtungText(ri)),
            JSON.stringify([B.richtungText(undefined), B.richtungText(ri)]));
          const htmlC = B.tagesbilanzText({ ...B.leereTagessumme("2026-11-02"), zyklen: 1, tore: tc.tore });
          torPruefung("die Tagesbilanz zeigt die abgelehnte Richtung nicht",
            /3 BUY\/1 SELL/.test(htmlC), htmlC.slice(-300));
          torPruefung("die Tagesbilanz zeigt die Confidence-Spanne nicht",
            /Confidence 70\u201379/.test(htmlC), htmlC.slice(-300));

          // \u2550\u2550 DIE ANDERE SEITE: ZUGESTIMMTE RICHTUNGEN (04.11.) \u2550\u2550\u2550\u2550\u2550\u2550\u2550
          //
          // `direction` wird von jeder meldeTorEntscheidung-Stelle bei
          // approve TRUE WIE FALSE gesendet und von `TorEintrag` in beiden
          // Faellen gespeichert \u2014 gelesen wurde sie nur im `else`-Zweig.
          // Damit war `/status` vom 04.11. nicht auswertbar: 79
          // Ablehnungen, 67 davon SELL (85 %), und SELL ist laut /hebel die
          // einzige Richtung mit positivem EW \u2014 ob die Tore eine Seite
          // BEVORZUGT wegwerfen, liess sich nicht entscheiden, weil die
          // Aufteilung der GO nirgends stand.
          const rj = tc.tore["Schwelle"]?.richtungenJa ?? {};
          // SELBSTPRUEFUNG der Testdaten: ohne eine Zustimmung MIT Richtung
          // und ohne Ablehnungen auf BEIDEN Seiten koennte keine der
          // Pruefungen darunter den Fehler ausdruecken.
          torPruefung("die Testdaten haben keine Zustimmung mit Richtung "
            + "oder keine Ablehnung auf beiden Seiten \u2014 dann beweisen die "
            + "Pruefungen darunter nichts",
            tc.tore["Schwelle"]?.ja === 1 && tc.tore["Schwelle"]?.nein === 4
            && ri.BUY === 3 && ri.SELL === 1,
            `ja=${tc.tore["Schwelle"]?.ja} nein=${tc.tore["Schwelle"]?.nein} `
            + `nein-Richtungen=${JSON.stringify(ri)}`);
          torPruefung("die ZUGESTIMMTE Richtung wird nicht mitgefuehrt",
            rj.SELL === 1, JSON.stringify(rj));
          // BEIDE Gegenrichtungen. Ohne sie koennten die zwei Zaehler
          // vertauscht sein und beide Pruefungen trotzdem zutreffen.
          torPruefung("eine Ablehnung wird als zugestimmte Richtung gezaehlt",
            Object.values(rj).reduce((a, b) => a + b, 0) === 1
            && rj.BUY === undefined, JSON.stringify(rj));
          torPruefung("die Summe der Richtungen passt nicht zu ja/nein",
            Object.values(rj).reduce((a, b) => a + b, 0) === tc.tore["Schwelle"].ja
            && Object.values(ri).reduce((a, b) => a + b, 0) === tc.tore["Schwelle"].nein,
            `ja=${tc.tore["Schwelle"].ja} rj=${JSON.stringify(rj)} `
            + `nein=${tc.tore["Schwelle"].nein} ri=${JSON.stringify(ri)}`);
          // Die KLAMMER-Form, und die alte Form UNVERAENDERT. Beide aus
          // derselben Funktion \u2014 zwei Fassungen liefen auseinander.
          torPruefung("richtungText kennt die Klammer-Form nicht, oder die "
            + "alte Form hat sich geaendert",
            B.richtungText({ SELL: 1 }, true) === " (1 SELL)"
            && B.richtungText({ SELL: 1 }) === " \u00b7 1 SELL"
            && B.richtungText(undefined, true) === "",
            JSON.stringify([B.richtungText({ SELL: 1 }, true),
              B.richtungText({ SELL: 1 })]));
          // DIE ZEILE MUSS EINDEUTIG SEIN. Bis zum 04.11. stand dort
          // "1 ja \u00b7 4 nein \u00b7 3 BUY/1 SELL", und die Aufteilung las sich,
          // als beschriebe sie alle 5. Jetzt steht jede Seite bei ihrer
          // Zahl \u2014 das bindet Inhalt UND Stellung.
          torPruefung("die Tagesbilanz stellt die Aufteilung nicht zu ihrer "
            + "Seite (sie liest sich dann als Summe beider)",
            /1 ja \(1 SELL\) \u00b7 4 nein \(3 BUY\/1 SELL\)/.test(htmlC),
            (htmlC.match(/Schwelle:[^\n]*/) || ["(keine Tor-Zeile)"])[0]);
          // ══ EINE TEILABDECKUNG DARF NICHT WIE DIE GANZE SEITE AUSSEHEN ══
          //
          // AUSGEFUEHRT BELEGT am Deploy vom 04.11.: die Tagessumme des Tages
          // liegt in Redis, und `tagessummeAddieren` uebernimmt die
          // gespeicherten `ja`-Zaehler. `richtungenJa` faengt dagegen beim
          // Deploy bei 0 an. Gemessen ergab das
          //
          //     Meta-KI: 67 ja (2 SELL/1 BUY)
          //
          // — die Klammer beschrieb DREI von 67 und las sich wie alle 67.
          // Das ist die Mehrdeutigkeit, die dieser Tag behebt, einen Tag
          // weiter gedacht: sie geht um 00:00 UTC von selbst weg, kehrt aber
          // zurueck, sobald ein Tor seine Richtung nur auf EINEM Zweig
          // sendet. Gezaehlt, nicht gehofft.
          {
            const voll = B.richtungText({ SELL: 2, BUY: 1 }, true, 3);
            const teil = B.richtungText({ SELL: 2, BUY: 1 }, true, 67);
            const ohne = B.richtungText({ SELL: 2, BUY: 1 }, true);
            torPruefung("eine Teilabdeckung sieht aus wie die ganze Seite",
              teil === " (davon 3 mit Richtung: 2 SELL/1 BUY)",
              JSON.stringify(teil));
            // GEGENPROBE: bei VOLLER Abdeckung darf der Zusatz NICHT
            // dastehen — sonst waere die Zeile immer relativiert und der
            // Riegel nur "immer davon" (Lehre vom 15.09.).
            torPruefung("eine volle Abdeckung wird faelschlich relativiert",
              voll === " (2 SELL/1 BUY)" && ohne === " (2 SELL/1 BUY)",
              JSON.stringify([voll, ohne]));
            // Eine unbrauchbare Seitenzahl darf nicht relativieren.
            torPruefung("ein NaN als Seitenzahl relativiert die Aufteilung",
              B.richtungText({ SELL: 2 }, true, Number.NaN) === " (2 SELL)",
              JSON.stringify(B.richtungText({ SELL: 2 }, true, Number.NaN)));

            // Und die TAGESBILANZ muss es zeigen — mit dem echten Uebergang
            // als Testfall: `ja` aus der alten Summe, Aufteilung erst ab jetzt.
            const uebergang = {
              ...B.leereTagessumme("2026-11-04"), zyklen: 1,
              tore: {
                "Meta-KI": { ja: 67, nein: 16, fallback: 0,
                  gruende: { "x": 16 }, richtungen: { SELL: 12, BUY: 4 },
                  richtungenJa: { SELL: 2, BUY: 1 } },
                // UND DIE ANDERE SEITE. Ohne dieses Tor war die `nein`-Seite
                // in JEDEM Testfall voll abgedeckt — dann aendert es nichts,
                // ob die Zahl durchgereicht wird, und die Sabotage blieb
                // gruen. Vierter Fall derselben Lehre an diesem Tag.
                "Schwelle": { ja: 0, nein: 40, fallback: 0,
                  gruende: { "y": 40 }, richtungen: { SELL: 5 } },
              },
            };
            const tU = B.tagesbilanzText(uebergang);
            torPruefung("die Tagesbilanz verschweigt, dass die Aufteilung nur "
              + "einen Teil der Seite beschreibt",
              /67 ja \(davon 3 mit Richtung: 2 SELL\/1 BUY\) · 16 nein \(12 SELL\/4 BUY\)/.test(tU),
              (tU.match(/Meta-KI[^\n]*/) || ["(keine Tor-Zeile)"])[0]);
            // Und dieselbe Zusicherung fuer die NEIN-Seite — sonst ist nur
            // der eine der beiden Durchreich-Pfade geprueft.
            torPruefung("die Tagesbilanz reicht die nein-Zahl nicht durch — "
              + "dann sieht eine teilabgedeckte Ablehnungs-Seite wie die "
              + "ganze aus",
              /40 nein \(davon 5 mit Richtung: 5 SELL\)/.test(tU),
              (tU.match(/Schwelle[^\n]*/) || ["(keine Tor-Zeile)"])[0]);
            // SELBSTPRUEFUNG der Testdaten: es braucht eine Seite mit VOLLER
            // und je eine mit TEILWEISER Abdeckung auf BEIDEN Seiten, sonst
            // beweisen die Zeilen darueber nichts.
            const su = (o) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);
            const mkU = uebergang.tore["Meta-KI"], schU = uebergang.tore["Schwelle"];
            torPruefung("die Uebergangs-Testdaten haben nicht alle drei Lagen "
              + "— dann kann die Pruefung den Fehler nicht ausdruecken",
              mkU.ja > su(mkU.richtungenJa)          // ja teilweise
              && mkU.nein === su(mkU.richtungen)     // nein voll
              && schU.nein > su(schU.richtungen),    // nein teilweise
              `ja ${mkU.ja}/${su(mkU.richtungenJa)}, `
              + `nein ${mkU.nein}/${su(mkU.richtungen)}, `
              + `Schwelle nein ${schU.nein}/${su(schU.richtungen)}`);
          }

          // EINE SUMME VON GESTERN kennt auch dieses Feld nicht.
          const alt2 = JSON.parse(JSON.stringify(tc));
          for (const g of Object.values(alt2.tore)) delete g.richtungenJa;
          let warf2 = null;
          try { B.tagessummeAddieren(alt2, bc, "2026-11-02"); } catch (e) { warf2 = e.message; }
          torPruefung("eine Tagessumme von gestern (ohne richtungenJa) wirft",
            warf2 === null, String(warf2));
        }

        // Obergrenzen — AN DER QUELLE, nicht als feste Zahl (02.11.).
        //
        // Hier standen `300` und `=== 200`. Als der Deckel am 02.11. auf
        // 400 stieg, wurde die Pruefung zu Recht rot — sie haette sonst
        // stillschweigend nichts mehr geprueft. Jetzt kommt die Schranke
        // aus dem Modul und der Pruefstand fuettert immer darueber.
        const deckelJeZyklus = B.MAX_TORE_JE_ZYKLUS;
        torPruefung("MAX_TORE_JE_ZYKLUS ist nicht exportiert — dann friert der Pruefstand wieder eine Zahl ein",
          typeof deckelJeZyklus === "number" && deckelJeZyklus > 0,
          String(deckelJeZyklus));
        const viel = B.neueBilanz(0);
        for (let i = 0; i < deckelJeZyklus + 50; i++) {
          B.bilanzVerbuchen(viel, { type: "GATE:DECISION", payload: { gate: "Schwelle", approve: false, reason: `Grund Nummer ${i} ${"x".repeat(i % 40)}` } });
        }
        const tViel = B.tagessummeAddieren(null, viel, "2026-09-16");
        torPruefung("die Zyklus- oder Tagesbilanz waechst unbegrenzt",
          viel.tore.length === deckelJeZyklus
          && Object.keys(tViel.tore["Schwelle"].gruende).length <= 26,
          `${viel.tore.length} Tore (Deckel ${deckelJeZyklus}), ${Object.keys(tViel.tore["Schwelle"].gruende).length} Gruende`);

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
        "telegram-notifications/telegram-sender": { htmlAbgelehnt: tgHtml,
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
    const cm = ladeTsModul("lib/capital-com/capital-com-client.ts",
      { "zeitmessung/zeitmessung": { zeitstempelMessen: () => {}, hatZone: () => false } });
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
      // DIE MESSUNG LIEGT GEMEINSAM DA (08.11.): beide Broker brauchen sie,
      // und die QUELLE ist ein Argument — ein `[capital-com]` ueber
      // cTrader-Daten waere eine luegende Logzeile, die Fehlerklasse von
      // `market-health.ts` und den zwei falschen Killswitch-Texten (27.09.).
      //
      // ZWEIMAL geladen, wie vorher: der Merker liegt auf `global`, und zwei
      // Modulkopien duerfen die Zeile nicht zweimal drucken (Regel 28.07.).
      const c1 = ladeTsModul("lib/zeitmessung/zeitmessung.ts");
      const c2 = ladeTsModul("lib/zeitmessung/zeitmessung.ts");
      const zm1 = c1.exports?.zeitstempelMessen, zm2 = c2.exports?.zeitstempelMessen;
      const hz = c1.exports?.hatZone;
      if (c1.fehler || typeof zm1 !== "function" || typeof zm2 !== "function"
          || typeof hz !== "function") {
        console.log = altLog;
        funde.push(`zeitmessung nicht ausfuehrbar: ${c1.fehler ?? "nicht exportiert"}`);
        zusatz++;
      } else {
        // Die echten Zeiten vom 22.09.: Ortszeit ohne Zone, UTC daneben.
        zm1("capital-com", "positionen", { createdDate: "2026-09-22T12:14:41.813", createdDateUTC: "2026-09-22T10:14:41.813" });
        zm2("capital-com", "positionen", { createdDate: "2026-09-22T12:14:41.813", createdDateUTC: "2026-09-22T10:14:41.813" });
        zm1("capital-com", "kurse", { updateTime: "2026-09-22T12:15:00", updateTimeUTC: undefined });
        // UND eine cTrader-Lage: andere Quelle, EIGENER Merker — sonst
        // verdeckt die Capital-Messung die IC-Messung.
        zm1("icmarkets", "positionen", { openTime: "2026-11-08T07:30:00", createTime: undefined });
        zm1("icmarkets", "geschaefte", { closeTime: "2026-11-08T06:30:00Z", closeTimestamp: undefined });
        // Unsinn NACH einem Zuruecksetzen der Sperre — sonst kehrt die Funktion
        // vorher zurueck und der Test prueft gar nichts (erste Fassung: die
        // Sabotage "Fehler durchreichen" blieb gruen). Ein Wert, dessen
        // Umwandlung in Text WIRFT, ist der echte Ernstfall.
        const merk = global.__zeitstempel_gemessen__;
        delete global.__zeitstempel_gemessen__;
        let geworfen = false;
        try {
          zm1("capital-com", "kurse", { updateTime: { toString() { throw new Error("kaputt"); } } });
        } catch { geworfen = true; }
        global.__zeitstempel_gemessen__ = merk;
        console.log = altLog;
        // JE QUELLE gezaehlt (08.11.): seit die Messung beiden Brokern
        // dient, gibt es ZWEI `(positionen,`-Zeilen — eine je Broker.
        // Zusammengezaehlt waere die Zusicherung "einmal je Prozess"
        // zwangslaeufig rot, und zwar aus dem falschen Grund.
        const pos = logs.filter((l) => l.includes("[capital-com]") && l.includes("(positionen,"));
        const kurse = logs.filter((l) => l.includes("[capital-com]") && l.includes("(kurse,"));
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
        // ── DAS PRAEFIX MUSS DIE QUELLE NENNEN ──────────────────────────
        //
        // Sonst steht `[capital-com]` ueber cTrader-Daten, und wer das Log
        // liest, sucht die Ursache beim falschen Broker.
        const icPos = logs.filter((l) => l.includes("[icmarkets]") && l.includes("(positionen,"));
        const icGes = logs.filter((l) => l.includes("[icmarkets]") && l.includes("(geschaefte,"));
        const capPos = logs.filter((l) => l.includes("[capital-com]") && l.includes("(positionen,"));
        torPruefung("das Log-Praefix nennt die Quelle nicht — dann steht "
          + "`[capital-com]` ueber cTrader-Daten",
          capPos.length === 1 && icPos.length === 1,
          `capital=${capPos.length} icmarkets=${icPos.length}, erwartet je 1`);
        // Eigener Merker je QUELLE und je ART: vier Schluessel, vier Zeilen.
        torPruefung("die Merker verdecken sich — eine Quelle oder Art bleibt "
          + "dann stumm",
          icGes.length === 1,
          `geschaefte=${icGes.length}, erwartet 1`);
        // ── UND DIE ANGABE, AUF DIE ES ANKOMMT: traegt der Wert eine ZONE? ──
        //
        // Das ist der Grund fuer diese Runde. Fuer cTrader ist nicht gemessen,
        // ob eine Zone mitkommt, und die Luecke ist NICHT symmetrisch: eine
        // Zone VOR UTC laesst die Position in der Zukunft liegen (laut, der
        // Zeit-Exit meldet sich), eine Zone HINTER UTC laesst sie AELTER
        // aussehen — dann feuert der Zeit-Exit zu FRUEH und zwar STUMM.
        torPruefung("die Messung nennt nicht, ob der Wert eine Zone traegt — "
          + "dann bleibt genau die Frage offen, fuer die sie gebaut ist",
          icPos.length === 1 && /openTime="2026-11-08T07:30:00" \(zone=NEIN/.test(icPos[0])
          && icGes.length === 1 && /closeTime="2026-11-08T06:30:00Z" \(zone=JA/.test(icGes[0]),
          `${(icPos[0] ?? "").slice(0, 110)} || ${(icGes[0] ?? "").slice(0, 110)}`);
        // `hatZone` GERECHNET, in beide Richtungen — sonst koennte die Zeile
        // darueber an einem Werkzeug haengen, das immer dasselbe sagt.
        torPruefung("hatZone erkennt eine Zonenangabe nicht zuverlaessig",
          hz("2026-11-08T06:30:00Z") === true
          && hz("2026-11-08T06:30:00+02:00") === true
          && hz("2026-11-08T06:30:00+0200") === true
          && hz("2026-11-08T06:30:00-05:00") === true
          && hz("2026-11-08T06:30:00") === false
          && hz("2026-11-08 06:30:00") === false
          && hz("") === false && hz(null) === false && hz(42) === false,
          `Z=${hz("2026-11-08T06:30:00Z")} ohne=${hz("2026-11-08T06:30:00")} `
          + `plus=${hz("2026-11-08T06:30:00+02:00")} minus=${hz("2026-11-08T06:30:00-05:00")}`);
      }
      // ── VIER STELLEN, GEZAEHLT statt gefunden (08.11.) ────────────────
      //
      // Zwei bei Capital (Kurse, Positionen) und zwei bei cTrader
      // (Positionen, Geschaefte — `closeTime` geht ueber den Journal-Sync in
      // die DATENBANK). Ein Treffer bewiese nichts ueber die anderen drei
      // (25.10.).
      const cq = read("frontend/lib/capital-com/capital-com-client.ts");
      const icq = read("frontend/lib/icmarkets/icmarkets-client.ts");
      // ── ALS ANWEISUNG GEBUNDEN, nicht am Wortlaut (08.11.) ────────────
      //
      // Erste Fassung suchte nur `zeitstempelMessen\("icmarkets", …` irgendwo.
      // Die Sabotagen Z6/Z7 setzten `void 0 && ` DAVOR — der Wortlaut bleibt
      // vollstaendig stehen, die Messung ist tot, und der Pruefer blieb
      // GRUEN. Zum vierten Mal an einem Tag "ein Regex prueft den Wortlaut,
      // nicht das Verhalten" (30.09.), und zwar genau der Trick, der am
      // 07.11. schon einmal durchgegangen ist.
      //
      // Jetzt muss der Aufruf eine ANWEISUNG beginnen: am Zeilenanfang, nur
      // Leerzeichen davor. `void 0 &&`, `false &&` und `//` fallen damit auf.
      const anweisung = (quelle, art) => new RegExp(
        String.raw`^[ \t]*zeitstempelMessen\("` + quelle + String.raw`", "` + art + String.raw`",`, "m");
      const stellen = [
        ["capital kurse", cq, anweisung("capital-com", "kurse"),
          /\{ updateTime: snap\.updateTime, updateTimeUTC: snap\.updateTimeUTC \}/],
        ["capital positionen", cq, anweisung("capital-com", "positionen"),
          /\{ createdDate: pos\.createdDate, createdDateUTC: pos\.createdDateUTC \}/],
        ["icmarkets positionen", icq, anweisung("icmarkets", "positionen"),
          /openTime: raw\[0\]\.openTime, createTime: raw\[0\]\.createTime/],
        ["icmarkets geschaefte", icq, anweisung("icmarkets", "geschaefte"),
          /closeTime: d0\.closeTime, closeTimestamp: d0\.closeTimestamp/],
      ];
      // SELBSTPRUEFUNG an GEBAUTEN Zeichenketten, in beide Richtungen — am
      // Dateiinhalt haenge sie an einer Formulierung.
      const aProbe = anweisung("icmarkets", "positionen");
      torPruefung("das Anweisungs-Muster erkennt eine abgeklemmte Messung "
        + "nicht — dann beweist die Zeile darunter nichts",
        aProbe.test('      zeitstempelMessen("icmarkets", "positionen",')
        && !aProbe.test('      void 0 && zeitstempelMessen("icmarkets", "positionen",')
        && !aProbe.test('      false && zeitstempelMessen("icmarkets", "positionen",')
        && !aProbe.test('      // zeitstempelMessen("icmarkets", "positionen",'),
        "Selbstpruefung des Anweisungs-Musters");
      // BEIDE Muster: die Anweisung UND die Felder. Nur eines von beiden
      // waere wieder eine halbe Zusicherung.
      const fehlend = stellen
        .filter(([, q, anw, felder]) => !anw.test(q) || !felder.test(q))
        .map(([n]) => n);
      torPruefung("eine der VIER Zeitstempel-Messungen ist nicht angeschlossen "
        + "— dann bleibt eine Zeitquelle ungemessen",
        fehlend.length === 0, fehlend.join(", ") || "4 von 4 verdrahtet");
      // Und die lokale Fassung darf im Capital-Client NICHT zurueckkommen.
      torPruefung("der Capital-Client hat wieder eine EIGENE Fassung der "
        + "Messung — dann koennen die zwei auseinanderlaufen",
        !/export function zeitstempelMessen\(/.test(cq)
        && /import \{ zeitstempelMessen \} from "\.\.\/zeitmessung\/zeitmessung"/.test(cq)
        && /import \{ zeitstempelMessen \} from "\.\.\/zeitmessung\/zeitmessung"/.test(icq),
        `eigene=${/export function zeitstempelMessen\(/.test(cq)} `
        + `cc-import=${/zeitmessung\/zeitmessung/.test(cq)} ic-import=${/zeitmessung\/zeitmessung/.test(icq)}`);
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
    const zb = ladeTsModul("lib/zyklus-bilanz/zyklus-bilanz.ts",
          { "html-sicher/html-sicher": ladeTsModul("lib/html-sicher/html-sicher.ts").exports });
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
          // `tsQ` ist oben SCHON kommentarbereinigt (Zeile 5278/5279) — das
          // ist wichtig und war schon richtig: beim Einbau des Rueckfalls
          // auf reinen Text habe ich einen Kommentar geschrieben, der
          // `console.error(m)` nur ERWAEHNT. Auf der rohen Datei sind es
          // damit vier Treffer, kommentarbereinigt drei. Nachgerechnet und
          // belegt, nicht vermutet: der Pruefer zaehlt drei.
          const fehlerAusgaben = (tsQ.match(/console\.error\(m\)/g) ?? []).length;
          torPruefung("nicht mehr alle drei Fehler-Ausgaenge melden ins Log",
            fehlerAusgaben === 3,
            `${fehlerAusgaben} von 3 (nicht-konfiguriert, abgelehnt, netzfehler) — `
            + "die Meldung gehoert ins Railway-Log, nicht nach Telegram");
          torPruefung("der Erfolgsfall schreibt keine Zeile ins Log",
            (tsQ.match(/console\.log\(m\)/g) ?? []).length === 1,
            "die Rueckkehr des Kanals gehoert gemeldet");

          // ── EIN ROHES `<` DARF DEN ALARM NICHT VERSCHLUCKEN (01.11.) ──
          //
          // `sendTelegram` schickt mit `parse_mode: "HTML"`. Mehrere der elf
          // Aufrufer setzen fremden Text ein: `result.summary` im
          // Sicherheits-Watchdog ist von der KI geschrieben, und ein
          // Fehlertext kann ein ganzer HTML-Koerper sein. Ein einzelnes `<`
          // liess bisher die GANZE Nachricht ausfallen — beim Watchdog waere
          // das der Sicherheitsalarm selbst.
          torPruefung("`htmlAbgelehnt` fehlt — dann wird ein kaputtes HTML "
            + "nicht von einem 429 unterschieden",
            /export function htmlAbgelehnt\(/.test(tsQ), "telegram-sender");
          torPruefung("es gibt keinen zweiten Versuch OHNE parse_mode — ein "
            + "einzelnes `<` verschluckt dann den ganzen Alarm",
            /body: JSON\.stringify\(\{ chat_id: CHAT_ID, text \}\)/.test(tsQ),
            "telegram-sender");
          torPruefung("die Degradierung auf reinen Text wird verschwiegen — "
            + "eine stumm degradierte Nachricht ist die naechste Luege",
            /console\.warn\(/.test(tsQ) && /REINER TEXT/.test(tsQ),
            "telegram-sender");
          // Der Modelltext wird AN DER QUELLE entschaerft, damit die
          // Formatierung erhalten bleibt.
          {
            const wdQ = read("frontend/lib/security-watchdog/claude-watchdog.ts");
            torPruefung("der Watchdog setzt den KI-Satz `summary` ungeschuetzt "
              + "in eine HTML-Nachricht — ein `<` darin kostet den Alarm",
              /summary: htmlSicher\(parsed\.summary\)/.test(wdQ),
              "claude-watchdog");
          }
          // Und die Entscheidung GERECHNET, nicht gelesen: nur der
          // HTML-Fehler darf wiederholt werden.
          {
            const tsMod = ladeTsModul("lib/telegram-notifications/telegram-sender.ts");
            const hA = tsMod.exports?.htmlAbgelehnt;
            if (typeof hA !== "function") {
              torPruefung("htmlAbgelehnt ist nicht ausfuehrbar", false,
                tsMod.fehler ?? "nicht exportiert");
            } else {
              for (const [grund, soll] of [
                ["Bad Request: can't parse entities: Unsupported start tag \"ZZ\"", true],
                ["Bad Request: can't parse entities in message text", true],
                ["Bad Request: unclosed start tag at byte offset 42", true],
                ["Too Many Requests: retry after 30", false],
                ["Bad Request: chat not found", false],
                ["Forbidden: bot was blocked by the user", false],
                [undefined, false],
                ["", false],
              ]) {
                torPruefung(`htmlAbgelehnt(${JSON.stringify(grund)}) ergibt `
                  + `nicht ${soll} — ein 429 darf NICHT wiederholt werden, `
                  + "ein kaputtes HTML schon",
                  hA(grund) === soll, `bekam ${hA(grund)}`);
              }
            }
          }
          // ── UND DER RUECKFALL WIRD AUSGEFUEHRT, NICHT GELESEN ─────────
          //
          // `if (htmlAbgelehnt(...))` zu `if (false)` zu machen laesst JEDEN
          // Wortlaut stehen: der Export, der Rumpf, der zweite `fetch`. Die
          // Struktur-Pruefungen oben blieben dabei gruen — woertlich die
          // Fehlerklasse vom 28.10. ("ein Regex prueft den Wortlaut, nicht
          // das Verhalten"). Deshalb die ECHTE Funktion gegen einen
          // GEZAEHLTEN `fetch`.
          {
            const altFetch = global.fetch;
            const altLage = global.__telegram_lage__;
            const altEnv = {
              TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
              TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
            };
            try {
              // VOR dem Laden setzen: `isTelegramConfigured()` liest die
              // Umgebung beim Modulstart.
              //
              // UND LANG GENUG: die Pruefung lautet `BOT_TOKEN.length > 10`.
              // Mein erster Testwert war "pruefstand" — genau ZEHN Zeichen,
              // also `10 > 10` = false, und alle vier Pruefungen darunter
              // sahen 0 Anfragen. Ein Testwert, der den Fall nicht
              // ausdruecken kann, beweist nichts.
              process.env.TELEGRAM_BOT_TOKEN = "pruefstand-token-1234";
              process.env.TELEGRAM_CHAT_ID = "424242";
              const tsL = ladeTsModul("lib/telegram-notifications/telegram-sender.ts");
              const senden = tsL.exports?.sendTelegram;
              if (typeof senden !== "function") {
                torPruefung("sendTelegram ist nicht ausfuehrbar", false,
                  tsL.fehler ?? "nicht exportiert");
              } else {
                const anfragen = [];
                const antworte = (folge) => {
                  global.fetch = async (_u, opt) => {
                    anfragen.push(JSON.parse(opt?.body ?? "{}"));
                    const a = folge[Math.min(anfragen.length - 1, folge.length - 1)];
                    return { ok: true, status: 200, json: async () => a };
                  };
                };
                const HTML_FEHLER = { ok: false, error_code: 400,
                  description: "Bad Request: can't parse entities: Unsupported start tag \"ZZ\"" };

                // 1. HTML abgelehnt -> ZWEITER Versuch OHNE parse_mode.
                global.__telegram_lage__ = undefined;
                anfragen.length = 0;
                antworte([HTML_FEHLER, { ok: true }]);
                const r1 = await senden("Alarm A <ZZ B & C");
                torPruefung("ein kaputtes HTML wird nicht als reiner Text "
                  + "nachgeschickt — der Alarm verpufft dann ganz",
                  r1 === true && anfragen.length === 2
                  && anfragen[0].parse_mode === "HTML"
                  && anfragen[1].parse_mode === undefined
                  && anfragen[1].text === "Alarm A <ZZ B & C",
                  `${anfragen.length} Anfragen, parse_mode: `
                  + JSON.stringify(anfragen.map((a) => a.parse_mode ?? "(ohne)")));

                // 2. GEGENPROBE: ein 429 darf NICHT wiederholt werden.
                global.__telegram_lage__ = undefined;
                anfragen.length = 0;
                antworte([{ ok: false, error_code: 429,
                  description: "Too Many Requests: retry after 30" }]);
                const r2 = await senden("egal");
                torPruefung("ein 429 wird wiederholt — bei Drosselung ist "
                  + "Nachlegen genau falsch (Regel vom 22.09.)",
                  r2 === false && anfragen.length === 1,
                  `${anfragen.length} Anfragen, Ergebnis ${r2}`);

                // 3. GEGENPROBE: ein GELUNGENER Versand sendet EINMAL.
                global.__telegram_lage__ = undefined;
                anfragen.length = 0;
                antworte([{ ok: true }]);
                const r3 = await senden("alles gut");
                torPruefung("ein gelungener Versand wird wiederholt — dann "
                  + "kaeme jede Meldung doppelt an",
                  r3 === true && anfragen.length === 1,
                  `${anfragen.length} Anfragen`);

                // 4. Scheitert AUCH der reine Text, ist es ein Fehlschlag.
                global.__telegram_lage__ = undefined;
                anfragen.length = 0;
                antworte([HTML_FEHLER, { ok: false, error_code: 400,
                  description: "Bad Request: message is too long" }]);
                const r4 = await senden("Alarm <ZZ");
                torPruefung("ein zweimal abgelehnter Versand gibt sich als "
                  + "Erfolg aus — ein Ausfall darf kein Ergebnis sein",
                  r4 === false && anfragen.length === 2,
                  `${anfragen.length} Anfragen, Ergebnis ${r4}`);
              }
            } finally {
              global.fetch = altFetch;
              if (altLage === undefined) delete global.__telegram_lage__;
              else global.__telegram_lage__ = altLage;
              for (const [k, v] of Object.entries(altEnv)) {
                if (v === undefined) delete process.env[k];
                else process.env[k] = v;
              }
            }
          }
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

            // ── UND /edge MUSS UNTER 4096 ZEICHEN BLEIBEN (01.11.) ──────
            //
            // `/hebel`, `/status` und die Tagesbilanz hatten am 31.10. ihren
            // Laengen-Riegel bekommen — `/edge` war NUR gemessen (2939) und
            // nie gebunden. Das war die letzte offene Stelle derselben Frage.
            //
            // GEMESSEN an der Obergrenze: 3 Abschnitte x (HERKUNFT_MAX + 1)
            // Zeilen mit den LAENGSTEN moeglichen Etiketten = 3143 von 4096,
            // 953 Zeichen Luft.
            //
            // EIGENER MESSFEHLER DABEI, benannt: ich hatte behauptet,
            // `erwartungswert.ts` habe "keinen Deckel" — gesucht hatte ich
            // nach `slice(0, <Ziffer>)`. Der Deckel ist aber
            // `slice(0, HERKUNFT_MAX)`, eine BENANNTE KONSTANTE. Ein
            // Suchmuster auf ein Literal uebersieht jede benannte Grenze.
            {
              // `NIE_BESTAETIGT`/`KEIN_PNL` sind ausgeschlossen und koennen
              // in der Aufschluesselung NICHT auftauchen. Mit ihnen in den
              // Testdaten fielen genau die laengsten Paare weg, der Deckel
              // wurde nie erreicht (720 statt 3240 gewerteter Zeilen) — und
              // die Messung haette die Obergrenze verfehlt.
              const GR = ["KEIN_SCHLUSSKURS", "DAZWISCHEN", "UNBEKANNT", "STOP", "ZIEL"];
              const RS = ["CLOSED_TIME", "BREAKEVEN", "CLOSED", "LOSS", "WIN"];
              const paare = [];
              for (const r of RS) for (const g of GR) paare.push([r, g]);
              paare.sort((a, b) => (b[0] + b[1]).length - (a[0] + a[1]).length);
              const lang = [];
              let kk = 0;
              for (const pnl of [12.34, -8.76, 0]) {
                for (let p = 0; p < MAXH + 3; p++) {
                  const [res, grund] = paare[p % paare.length];
                  for (let i = 0; i < 40; i++, kk++) {
                    lang.push({
                      profitLoss: pnl, result: res,
                      updatedAt: `${i % 2 === 0 ? "2026-01-03" : "2026-10-28"}T10:00:00.000Z`,
                      notes: JSON.stringify({ exitReason: grund, exitPosition: 1.0834 }),
                    });
                  }
                }
              }
              const langText = txt(f(lang, null));
              // SELBSTPRUEFUNG: ohne erreichten Deckel sagt die Messung
              // nichts ueber die Obergrenze — genau so ist mein erster
              // Versuch danebengegangen.
              const restZeilen = (langText.match(/weitere \(\d+ Etiketten\)/g) || []).length;
              torPruefung("der Herkunfts-Deckel wird im Laengen-Testfall gar "
                + "nicht erreicht — dann trifft die Messung die Obergrenze "
                + "nicht",
                restZeilen === 3, `${restZeilen} Rest-Zeilen`);
              torPruefung("die /edge-Antwort reisst Telegrams 4096 Zeichen an "
                + "ihrer Obergrenze — sie kaeme dann gar nicht an, und "
                + "`sendTelegram` kennt keine Laengengrenze",
                langText.length <= 4096, `${langText.length} von 4096`);
              // GEGENPROBE: der Riegel darf nicht immer gruen sein. Mit
              // zehnfach langen Etiketten MUSS die Grenze reissen — sonst
              // messe ich nur, dass eine Zahl kleiner als 4096 ist.
              // DIE VIELFALT MUSS BLEIBEN. Mein erster Versuch gab ALLEN
              // Zeilen dasselbe lange Etikett — dann bleibt nur EIN Etikett
              // je Abschnitt, und der Text wurde KUERZER (2099) statt
              // laenger. Jetzt bekommt jedes Etikett sein eigenes Anhaengsel.
              const zuLang = lang.map((zz, idx) => {
                const alt = JSON.parse(zz.notes);
                return {
                  ...zz,
                  notes: JSON.stringify({
                    ...alt,
                    exitReason: `${alt.exitReason}_${"X".repeat(40)}_${idx % (MAXH + 3)}`,
                  }),
                  result: `${zz.result}_${"Y".repeat(30)}`,
                };
              });
              const zuLangText = txt(f(zuLang, null));
              torPruefung("der /edge-Laengenriegel ist immer gruen — "
                + "zehnfach lange Etiketten muessen die Grenze reissen",
                zuLangText.length > 4096, `${zuLangText.length} Zeichen`);
            }

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
        // ── DIE KI-SIGNALQUELLE (02.11.) ────────────────────────────
        //
        // ANLASS, aus dem Railway-Log belegt: das OpenAI-Guthaben war
        // leer, GPT antwortete in 4230 von 4230 Marktanalysen nicht, und
        // der Code versuchte es JEDES MAL ein zweites Mal mit dem anderen
        // Modell — bei `insufficient_quota` garantiert vergeblich, denn
        // das ist ein KONTO-Limit. Dazu gab es keinen einzigen Alarm.
        {
          const aiM = ladeTsModul("lib/market-scanner/ai-analysis-engine.ts");
          const lage = aiM.exports?.gptFehlerLage;
          if (typeof lage !== "function") {
            torPruefung("gptFehlerLage nicht ausfuehrbar", false,
              aiM.fehler ?? "Export fehlt");
          } else {
            // ENDGUELTIG: nur Konto-Ebene.
            for (const [name, status, body, soll] of [
              ["429 + kein Guthaben (der Fall vom 02.11.)", 429,
                '{"error":{"message":"You have no credits remaining.",'
                + '"type":"insufficient_quota"}}', true],
              ["429 blosse Drosselung", 429, "rate limit", true],
              ["401 falscher Schluessel", 401, "invalid api key", true],
              // DIE GEGENPROBE, und sie ist die wichtigste: 403 war der
              // Fund vom 07.09. ("Project does not have access to model"),
              // und GENAU dafuer gibt es den Rueckfall. Wird 403
              // endgueltig, ist das Netz vom 07.09. wieder abgeschaltet.
              ["403 kein Zugriff auf das Modell (07.09.)", 403,
                "Project does not have access to model gpt-4o", false],
              ["404 Modell unbekannt", 404, "model not found", false],
              ["500 beim Anbieter", 500, "server error", false],
              ["Netzfehler", null, "ECONNRESET", false],
            ]) {
              const r = lage(status, body);
              torPruefung(`${name}: endgueltig falsch beurteilt — `
                + `${soll ? "ein zweiter Versuch ist vergeblich" : "der Rueckfall wird gesperrt"}`,
                r.endgueltig === soll,
                `endgueltig=${r.endgueltig}, erwartet ${soll}`);
            }
            // Der GRUND muss das leere Guthaben benennen — sonst steht man
            // wieder vor der Frage, die ins Railway-Log geschickt hat.
            const g = lage(429, '{"type":"insufficient_quota"}');
            torPruefung("der Grund nennt das leere Guthaben nicht",
              /KEIN GUTHABEN/.test(g.grund) && /429/.test(g.grund),
              g.grund.slice(0, 110));
            torPruefung("der Antwortkoerper fehlt im Grund — wer ihn nicht mitschreibt, muss ihn spaeter raten",
              /Serverfehler-Text/.test(lage(500, "Serverfehler-Text").grund),
              lage(500, "Serverfehler-Text").grund.slice(0, 110));
          }

          // DIE VERDRAHTUNG: ohne sie waere die Funktion geprueft und nie
          // benutzt (Fehlerklasse 30.09.).
          const aiQ = read("frontend/lib/market-scanner/ai-analysis-engine.ts")
            .replace(/\/\*[\s\S]*?\*\//g, " ")
            .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
          torPruefung("der zweite Modellversuch haengt nicht mehr an `endgueltig` — dann wird ein 429 wieder sinnlos wiederholt",
            /raw === null && !ersterGpt\.endgueltig && zweitModell/.test(aiQ),
            "kommentarbereinigt gesucht");
          torPruefung("beide Fehlerzweige rechnen nicht mit gptFehlerLage",
            (aiQ.match(/\.\.\.gptFehlerLage\(/g) || []).length === 2,
            `${(aiQ.match(/\.\.\.gptFehlerLage\(/g) || []).length} Stellen`);
          torPruefung("der Scanner meldet den Totalausfall der Signalquelle nicht — dann stirbt sie wieder stumm",
            /lageMelden\("GPT-Signalquelle"/.test(aiQ)
            && /sendTelegram\(/.test(aiQ),
            "0 sendTelegram im Scan-Pfad war der Zustand am 02.11.");
          torPruefung("der Grund geht ROH in eine HTML-Nachricht — Telegram lehnt sie dann ab (Lehre vom 02.11.)",
            /tgSicher\(gptGrund/.test(aiQ),
            "der Antwortkoerper ist fremder Text");
        }

        // ── JEDES TOR MELDET BEIDE RICHTUNGEN (02.11.) ──────────────
        //
        // `/status` zeigte "Walk-Forward: ja 0 · nein 22". Gemessen:
        // fuenf Tore meldeten AUSSCHLIESSLICH Ablehnungen, ihr `ja`
        // konnte nie > 0 werden. In Wahrheit waren 13 durchgegangen —
        // die Arithmetik beweist es (Meta-KI 35 ja, 22 + 13 = 35).
        //
        // Klammerzaehlung statt Zeilen-Regex: ein mehrzeiliger Aufruf
        // wuerde sonst uebersehen (Lehre vom 17.09.).
        {
          const argBlock = (s, von) => {
            let tiefe = 0, inStr = null;
            for (let i = von; i < s.length; i++) {
              const c = s[i];
              if (inStr) {
                if (c === "\\") { i++; continue; }
                if (c === inStr) inStr = null;
                continue;
              }
              if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
              if (c === "(") tiefe++;
              else if (c === ")") { tiefe--; if (tiefe === 0) return s.slice(von, i + 1); }
            }
            return null;
          };
          // SELBSTPRUEFUNG an selbst gebauten Zeichenketten — am
          // Dateiinhalt hinge sie an einer Formulierung.
          {
            const p1 = 'f({ gate: "X", approve: true })';
            const p2 = 'f({ gate: "Y(", approve: false })';
            torPruefung("der Klammerzaehler kennt keine Zeichenketten",
              argBlock(p1, p1.indexOf("(")) === '({ gate: "X", approve: true })'
              && argBlock(p2, p2.indexOf("(")) === '({ gate: "Y(", approve: false })',
              "eine ( in einem Text wuerde sonst mitzaehlen");
          }

          // AUSNAHME, benannt und begruendet: `Zyklus-Limit` ist KEIN
          // Kandidaten-Tor. Es meldet einmal je Zyklus, wie viele
          // Kandidaten gar nicht mehr drankamen — ein "ja" waere dort
          // erfunden. Ohne diese Liste waere die Pruefung ewig rot; ohne
          // Begruendung waere sie ein Loch.
          const NUR_ABLEHNUNG = new Set(["Zyklus-Limit"]);

          const orQ = read("frontend/lib/agents/orchestrator-agent.ts");
          const anQ = read("frontend/lib/agents/analysis-agent.ts");
          const ohneK = (s) => s
            .replace(/\/\*[\s\S]*?\*\//g, " ")
            .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
          const tore = new Map();
          for (const q of [ohneK(orQ), ohneK(anQ)]) {
            let i = 0;
            while ((i = q.indexOf("meldeTorEntscheidung", i)) !== -1) {
              const k = q.indexOf("(", i);
              const b = k === -1 ? null : argBlock(q, k);
              i += 20;
              if (!b) continue;
              const g = b.match(/gate:\s*"([^"]+)"/);
              const a = b.match(/approve:\s*([^,}\s]+)/);
              if (!g || !a) continue;
              if (!tore.has(g[1])) tore.set(g[1], { ja: 0, nein: 0, dyn: 0 });
              const t = tore.get(g[1]);
              if (a[1] === "true") t.ja++;
              else if (a[1] === "false") t.nein++;
              else t.dyn++;
            }
          }
          torPruefung("keine Tor-Meldung gefunden — der Zaehler ist kaputt",
            tore.size >= 8, `${tore.size} Tore erkannt`);
          for (const [name, t] of [...tore].sort()) {
            if (NUR_ABLEHNUNG.has(name)) {
              // Gegenprobe: die Ausnahme darf nicht unbemerkt zum Tor
              // werden. Meldet sie ploetzlich ein `ja`, gehoert sie aus
              // der Liste — und das soll auffallen.
              torPruefung(`${name} meldet jetzt ein JA — dann gehoert es nicht mehr in die Ausnahmeliste`,
                t.ja === 0 && t.dyn === 0, `ja=${t.ja} dyn=${t.dyn}`);
              continue;
            }
            torPruefung(`${name} meldet NUR Ablehnungen — sein \`ja\` in `
              + "/status ist dann strukturell, nicht gemessen",
              t.ja > 0 || t.dyn > 0, `ja=${t.ja} nein=${t.nein} dyn=${t.dyn}`);
          }

          // DIE REIHENFOLGE GEHOERT DAZU (02.11.).
          //
          // Das Schwellen-JA stand frueher am ENDE der Kette, hinter dem
          // Stil-Limit — und hiess damit "hat die ganze Kette ueberstanden",
          // waehrend das NEIN nur die Confidence zaehlte. Zwei Mengen unter
          // einem Namen. Eine reine Symmetrie-Pruefung saehe das nicht.
          //
          // BEIDE Stellen werden auf Existenz geprueft, DANN die Reihenfolge:
          // ein indexOf-Vergleich gegen -1 kann nie wahr werden (25.10.).
          {
            const q = ohneK(orQ);
            const iJa = q.indexOf('gate: "Schwelle", symbol: o.symbol, direction: o.gpt.direction, approve: true');
            const iStil = q.indexOf('gate: "Stil-Limit"');
            torPruefung("die Schwellen-Zustimmung oder das Stil-Limit fehlt",
              iJa >= 0 && iStil >= 0, `ja@${iJa} stil@${iStil}`);
            torPruefung("das Schwellen-JA steht hinter dem Stil-Limit — dann "
              + "heisst es wieder \"ganze Kette ueberstanden\" statt \"Schwelle "
              + "bestanden\"",
              iJa >= 0 && iStil >= 0 && iJa < iStil, `ja@${iJa} stil@${iStil}`);
          }

          // ── DER DECKEL DARF NICHT ZUSCHNAPPEN ─────────────────────
          //
          // Mehr Meldungen je Zyklus heisst: `MAX_TORE_JE_ZYKLUS` kann
          // greifen — und was wegfaellt, sind die SPAETEN Tore
          // (Filterkette, Override, Ausfuehrungs-KI), also die
          // interessantesten. Die Schranke kommt aus der QUELLE.
          const wlStart = orQ.indexOf("const WATCHLIST = [");
          let tiefe = 0, wlEnde = -1;
          for (let k = orQ.indexOf("[", wlStart); k < orQ.length; k++) {
            if (orQ[k] === "[") tiefe++;
            else if (orQ[k] === "]") { tiefe--; if (tiefe === 0) { wlEnde = k; break; } }
          }
          const wl = wlStart >= 0 && wlEnde > wlStart
            ? (orQ.slice(wlStart, wlEnde).match(/"[A-Z0-9]{4,8}"/g) || []).length : 0;
          torPruefung("die Watchlist laesst sich nicht aus der Quelle zaehlen",
            wl >= 20, `${wl} Symbole`);
          const zbQ = read("frontend/lib/zyklus-bilanz/zyklus-bilanz.ts");
          const deckel = Number((zbQ.match(/MAX_TORE_JE_ZYKLUS = (\d+)/) || [])[1] ?? 0);
          // 7 Tore je Kandidat + eine Meta-KI-Meldung je Signal, dazu
          // Orchestrator-KI und Zyklus-Limit.
          const noetig = wl * 8 + 2;
          torPruefung("der Tor-Deckel schnappt zu — die spaeten Tore fallen dann aus der Bilanz",
            deckel >= noetig,
            `Deckel ${deckel}, noetig ${noetig} (${wl} Maerkte x 8 + 2)`);
        }

        torPruefung("STAGE 3 sagt nicht mehr, dass /reset genuegt",
          /\/reset genuegt/.test(ks) || /\/reset genügt/.test(ks),
          "genau diese Frage stellt sich im Ernstfall");

        // ── DIE WIEDERHERSTELLUNG, AUSGEFUEHRT (01.11.) ─────────────
        //
        // `CLAUDE.md` sagt "er ueberlebt einen Deploy". Das gilt NUR,
        // wenn Redis antwortet — und genau das stand nirgends. Hier
        // stand `cacheGet`, und das gibt `null` fuer DREI Lagen zurueck.
        // Ausgefuehrt gemessen am 01.11. gegen das echte Cache-Modul
        // ohne REDIS_URL: Rueckgabe `false`, NULL Meldungen. Und
        // `instrumentation.ts` schreibt nur bei `true` eine Zeile. Ein
        // Deploy waehrend eines Redis-Ausfalls loest damit eine aktive
        // Sperre auf — lautlos.
        //
        // Ein Regex kann das nicht trennen: der Unterschied liegt im
        // Verhalten, nicht im Wortlaut.
        {
          const ksLauf = async (antwort) => {
            const altZustand = global.__killswitch_state__;
            const altL = console.log, altE = console.error;
            const meld = { log: [], err: [] };
            let r, gesperrt;
            try {
              delete global.__killswitch_state__;
              console.log = (...a) => meld.log.push(a.join(" "));
              console.error = (...a) => meld.err.push(a.join(" "));
              const m = ladeTsModul("lib/killswitch/killswitch-engine.ts", {
                "cache/redis-cache": {
                  cacheLesen: async () => (typeof antwort === "function"
                    ? antwort() : antwort),
                  cacheGet: async () => null,
                  cacheSet: async () => undefined,
                  cacheDel: async () => undefined,
                },
              });
              if (m.fehler) return { fehler: m.fehler, meld };
              r = await m.exports.restoreKillswitchFromRedis();
              gesperrt = m.exports.getKillswitchReport().triggered === true;
            } finally {
              console.log = altL; console.error = altE;
              if (altZustand === undefined) delete global.__killswitch_state__;
              else global.__killswitch_state__ = altZustand;
            }
            return { r, gesperrt, meld };
          };

          // (a) NIEMAND hat geantwortet -> der gefaehrliche Fall.
          const a = await ksLauf({ wert: null, herkunft: "aus" });
          torPruefung("die Wiederherstellung ist nicht ausfuehrbar",
            !a.fehler, a.fehler ?? "ok");
          torPruefung("ein Redis-Ausfall beim Start ist STUMM — eine zuvor aktive Sperre loest sich dann lautlos auf",
            a.meld.err.length === 1
            && /NICHT feststellbar/.test(a.meld.err[0] ?? ""),
            `${a.meld.err.length} Fehlermeldung(en): ${(a.meld.err[0] ?? "").slice(0, 90)}`);
          torPruefung("die Meldung sagt nicht, was daraus folgt",
            /NICHT wiederhergestellt/.test(a.meld.err[0] ?? ""),
            (a.meld.err[0] ?? "").slice(0, 140));
          torPruefung("ein Ausfall sperrt das System von sich aus — das waere ein Handelsstopp aus einem Lesefehler",
            a.r === false && a.gesperrt === false, `${a.r} / ${a.gesperrt}`);

          // (b) Redis sagt: Sperre AKTIV -> muss wiederhergestellt werden.
          const b = await ksLauf({ wert: { triggered: true, armed: false,
            systemLocked: true, triggeredAt: "2026-11-01T10:00:00Z",
            stages: [], summary: "t" }, herkunft: "redis" });
          torPruefung("eine aktive Sperre wird NICHT mehr wiederhergestellt — dann ist ein Redeploy doch ein Reset",
            b.r === true && b.gesperrt === true, `${b.r} / ${b.gesperrt}`);

          // (c) Redis HAT geantwortet, nur ist nichts gespeichert. Diese
          //     Lage muss von (a) UNTERSCHEIDBAR sein — sonst ist der
          //     ganze Fix wirkungslos.
          const c = await ksLauf({ wert: null, herkunft: "redis" });
          torPruefung("der gesunde Fall meldet sich nicht — dann sieht \"geprueft, nichts da\" aus wie \"nicht geprueft\"",
            c.meld.err.length === 0 && c.meld.log.length === 1
            && /keine aktive Sperre/.test(c.meld.log[0] ?? ""),
            `err=${c.meld.err.length} log=${c.meld.log.length}: ${(c.meld.log[0] ?? "").slice(0, 80)}`);
          torPruefung("der gesunde Fall sperrt",
            c.r === false && c.gesperrt === false, `${c.r} / ${c.gesperrt}`);

          // (d) Ein WERFENDER Cache: der Grund darf nicht verschluckt
          //     werden ("wer den Grund nicht mitschreibt, muss ihn
          //     spaeter raten", 22.09.). Vorher stand hier `catch { }`.
          const d = await ksLauf(() => { throw new Error("Redis kaputt"); });
          torPruefung("ein geworfener Fehler wird still verschluckt",
            d.meld.err.length === 1
            && /Redis kaputt/.test(d.meld.err[0] ?? ""),
            `${d.meld.err.length}: ${(d.meld.err[0] ?? "").slice(0, 90)}`);
          torPruefung("ein geworfener Fehler sperrt oder meldet Erfolg",
            d.r === false && d.gesperrt === false, `${d.r} / ${d.gesperrt}`);
        }

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

          // ── EINE ZAHL ALLEIN ERKLAERT EINEN FEHLSCHLAG NICHT (09./10.11.) ──
          //
          // Am 09.11. wurde diese Zusicherung in EINEM Lauf rot: "1 Anfragen
          // (erwartet genau 2)". Der Befund nannte nur die Zahl — und damit
          // war nicht entscheidbar, ob der Rueckfall FEHLT oder ob der erste
          // Versuch den lokalen Server gar nicht erreicht hat (Netzfehler,
          // `status: null`, was auch 1 ergibt, obwohl der Rueckfall korrekt
          // gefeuert hat).
          //
          // NACHGEMESSEN, nicht vermutet: 19 Prueferlaeufe und 40 isolierte
          // Laeufe dieses Prüfstands ergaben ausnahmslos 2 Anfragen; das
          // Zeitbudget kann es nicht sein (der Rueckfall entfaellt erst, wenn
          // der erste Versuch 48s verbraucht hat — gerechnet aus
          // BUDGET 60000 − PAUSE 2000 ≥ REST 10000). Die Ursache ist damit
          // NICHT bestimmt, und sie wird hier auch nicht erfunden.
          //
          // Geschlossen wird das Loch in der DIAGNOSE: der Befund traegt
          // jetzt die entscheidenden Logzeilen, denn `fetchStrategySignals`
          // nennt den Grund selbst ("KEINE Wiederholung (…)" bzw. den Status
          // des ersten Versuchs). Die Zusicherung wird dabei NICHT gelockert
          // — ein entfernter Rueckfall ergibt weiter 1 Anfrage und wird rot.
          // "Eine Diagnose darf im interessanten Fall nicht schweigen."
          const warum = (r) => {
            const wichtig = r.log.split("\n")
              .filter((z) => /Wiederholung|Versuch|Strategies|Strategien|WIRFT/.test(z))
              .map((z) => z.trim()).slice(-3).join(" | ");
            return wichtig || `(keine erklaerende Logzeile) ${r.log.slice(-160)}`;
          };

          const r2 = await fallLauf([{ status: 502, koerper: "Bad Gateway" }]);
          torPruefung("nach dem zweiten Fehlschlag wird weiter nachgefragt",
            r2.anfragen === 2 && r2.groesse === 0,
            `${r2.anfragen} Anfragen (erwartet genau 2) — ${warum(r2)}`);

          const r3 = await fallLauf([{ status: 401, koerper: '{"error":"unauthorized"}' }]);
          torPruefung("ein 401 wird sinnlos wiederholt",
            r3.anfragen === 1, `${r3.anfragen} Anfragen (erwartet genau 1) — ${warum(r3)}`);
          torPruefung("der Grund eines 401 fehlt im Log", r3.log.includes("unauthorized"));

          const r4 = await fallLauf([{ status: 200 }]);
          torPruefung("auch ein Erfolg loest einen zweiten Versuch aus",
            r4.anfragen === 1 && r4.groesse === 1,
            `${r4.anfragen} Anfragen, ${r4.groesse} Symbole — ${warum(r4)}`);
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

  // ══ KEINE ERFUNDENE RICHTUNG VOM BROKER (07.11.) ════════════════════════
  //
  // `capitalGetPositions` hatte `direction: (pos.direction as …) ?? "BUY"`.
  // Fehlte das Feld, wurde daraus eine Kaufposition — und der Weg zum Geld
  // ist kurz und war unbewacht:
  //
  //   capitalGetPositions   ?? "BUY"
  //     → active-trade-manager:43   (kein Filter auf die Richtung)
  //       → risk-agent:496          `const isBuy = direction === "BUY"`
  //         → risk-agent:686        `newSL = isBuy ? entry - be : entry + be`
  //
  // Der Breakeven-Stop einer SELL-Position laege auf der FALSCHEN Seite des
  // Einstiegs. Dieselbe Klasse wie `?? 50` (07.09.) und `?? Date.now()`
  // (19.08.).
  //
  // AUSGEFUEHRT, nicht am Wortlaut: `global.fetch` wird ersetzt, und die
  // ECHTE Funktion muss die Antwort des Brokers abbilden.
  {
    const cc = ladeTsModul("lib/capital-com/capital-com-client.ts", {
      "richtung/richtung": ladeTsModul("lib/richtung/richtung.ts").exports,
      "zeitmessung/zeitmessung": { zeitstempelMessen: () => {}, hatZone: () => false },
    });
    const gp = cc.exports?.capitalGetPositions;
    if (cc.fehler || typeof gp !== "function") {
      funde.push(`capital-com-client nicht ausfuehrbar: ${cc.fehler ?? "capitalGetPositions fehlt"}`);
      zusatz++;
    } else {
      const echtesFetch = global.fetch;
      const antwort = (positions) => ({
        ok: true, status: 200,
        json: async () => ({ positions }),
        text: async () => JSON.stringify({ positions }),
      });
      const hole = async (posRoh) => {
        global.fetch = async () => antwort(posRoh);
        try { return await gp("k", "c", "s"); } finally { global.fetch = echtesFetch; }
      };
      const bauPos = (dir) => ([{
        position: { dealId: "D1", ...(dir === undefined ? {} : { direction: dir }),
          dealSize: 1, level: 100, createdDate: "2026-11-04T19:30:00" },
        market: { epic: "GOLD" },
      }]);
      // 1. FEHLT das Feld, darf KEINE Richtung erfunden werden.
      const ohne = await hole(bauPos(undefined));
      torPruefung("der Broker-Client erfindet wieder eine Richtung, wenn das "
        + "Feld fehlt — der Breakeven-Stop laege dann auf der falschen Seite",
        ohne?.ok === true && ohne.positions?.[0]?.direction === null,
        JSON.stringify(ohne?.positions?.[0] ?? ohne));
      // 2. Ein UNSINNIGER Wert ebenso.
      const quatsch = await hole(bauPos("LEFT"));
      torPruefung("ein unlesbarer Richtungswert wird zu einer Richtung",
        quatsch?.positions?.[0]?.direction === null,
        JSON.stringify(quatsch?.positions?.[0] ?? null));
      // 3. GEGENPROBE: die echten Werte muessen weiter ankommen — sonst
      //    waere der Riegel "alles null", und der Trade-Manager
      //    bewirtschaftete NICHTS mehr (schlimmer als der Fund).
      const buy = await hole(bauPos("BUY"));
      const sell = await hole(bauPos("SELL"));
      const klein = await hole(bauPos("sell"));
      torPruefung("der Riegel ist zu streng — echte Richtungen kommen nicht "
        + "mehr an, und dann wird GAR KEINE Position mehr bewirtschaftet",
        buy?.positions?.[0]?.direction === "BUY"
        && sell?.positions?.[0]?.direction === "SELL"
        && klein?.positions?.[0]?.direction === "SELL",
        JSON.stringify([buy?.positions?.[0]?.direction,
          sell?.positions?.[0]?.direction, klein?.positions?.[0]?.direction]));
      // 4. Und der alte Rueckfall darf nicht zurueckkommen.
      const ccQ = read("frontend/lib/capital-com/capital-com-client.ts")
        .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      torPruefung("der Rueckfall `?? \"BUY\"` steht wieder in "
        + "capitalGetPositions",
        !/direction: \(pos\.direction as "BUY" \| "SELL"\) \?\? "BUY"/.test(ccQ)
        && /direction: lesbareRichtung\(pos\.direction\)/.test(ccQ),
        (ccQ.match(/direction: [^\n,]*/g) || []).slice(0, 3).join(" | "));
    }

    // ── DER TYP IST DER RIEGEL ────────────────────────────────────────
    //
    // `LivePosition` verlangt eine Richtung, `OpenPosition` laesst sie
    // offen. Damit ist das Aussortieren kein Laufzeit-Versehen mehr,
    // sondern ein Uebersetzungsfehler. Wird der Typ wieder geweitet,
    // koennte eine Position ohne Richtung bis in die Stop-Rechnung
    // laufen, ohne dass irgendetwas rot wird.
    const raQ2 = read("frontend/lib/agents/risk-agent.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("LivePosition verlangt keine lesbare Richtung mehr — dann "
      + "kann eine Position ohne Richtung bis in die Stop-Rechnung laufen",
      /export type LivePosition = OpenPosition & \{ direction: "BUY" \| "SELL" \}/.test(raQ2),
      (raQ2.match(/export type LivePosition[^\n]*/) ?? ["(keine Zeile)"])[0]);
    // UND DER FILTER, der daraus folgt.
    const atmQ = read("frontend/lib/capital-com/active-trade-manager.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("der Trade-Manager sortiert Positionen ohne Richtung nicht "
      + "aus, oder reicht die ungefilterte Liste weiter",
      /p\.direction !== null/.test(atmQ)
      && /positions: bewirtschaftbar/.test(atmQ)
      && !/positions: posResult\.positions/.test(atmQ),
      (atmQ.match(/positions: [^\n,]*/g) || ["(keine Zeile)"]).join(" | "));
    // AN DIE ANWEISUNG GEBUNDEN, nicht an den Wortlaut (07.11.).
    //
    // Hier stand `/OHNE lesbare Richtung/ && /console\.warn/`. Die Sabotage
    // `void 0 && console.warn(…)` liess BEIDE Ausdruecke stehen und blieb
    // GRUEN — die Meldung waere tot gewesen, der Pruefer zufrieden.
    // "Ein Regex prueft den Wortlaut, nicht das Verhalten" (30.09.).
    //
    // Jetzt muss `console.warn(` eine ANWEISUNG beginnen: am Zeilenanfang,
    // nur Leerzeichen davor. Ein vorangestelltes `void 0 &&`, `false &&`
    // oder `//` faellt damit auf.
    const warnAnweisung = /^[ \t]*console\.warn\(`\[trade-mgr\] ⚠️ \$\{ohneRichtung\}/m;
    torPruefung("das Aussortieren geschieht STILL — ein stummes "
      + "Ueberspringen saehe aus wie ein gesunder Lauf (25.10.)",
      /OHNE lesbare Richtung/.test(atmQ) && warnAnweisung.test(atmQ),
      (atmQ.match(/[^\n]*console\.warn\(`\[trade-mgr\] ⚠️[^\n]*/) ?? ["(keine Meldung)"])[0].slice(0, 110));
    // SELBSTPRUEFUNG des Musters an GEBAUTEN Zeichenketten, in beide
    // Richtungen — am Dateiinhalt haenge es an einer Formulierung.
    torPruefung("das Anweisungs-Muster erkennt eine abgeschaltete Meldung "
      + "nicht",
      warnAnweisung.test("    console.warn(`[trade-mgr] ⚠️ ${ohneRichtung} x`)")
      && !warnAnweisung.test("    void 0 && console.warn(`[trade-mgr] ⚠️ ${ohneRichtung} x`)")
      && !warnAnweisung.test("    // console.warn(`[trade-mgr] ⚠️ ${ohneRichtung} x`)"),
      "Selbstpruefung des Anweisungs-Musters");
    // Und der Python-Teilschluss: eine Gegenorder auf geratener Richtung
    // wuerde die Position VERGROESSERN statt verkleinern.
    const insQ = read("frontend/instrumentation.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    // ZWEI Riegel, nicht einer — GEZAEHLT, nicht gefunden (25.10.): einer
    // vor `capitalClosePartial` (Gegenorder) und einer vor dem SL-Umbau
    // (`istEnger`). Ein Treffer bewiese nichts ueber die andere Stelle.
    torPruefung("im Python-Lifecycle fehlt ein Richtungs-Riegel — es gibt "
      + "ZWEI Stellen, die auf der Richtung handeln (Gegenorder und "
      + "Stop-Umbau)",
      (insQ.match(/if \(!pos\.direction\) \{/g) || []).length === 2,
      `${(insQ.match(/if \(!pos\.direction\) \{/g) || []).length} Riegel gefunden`);

    // ══ WO `null` STILL IN EINEN ZWEIG FAELLT (07.11.) ════════════════
    //
    // `tsc` erzwingt den Filter nur, wo `LivePosition` steht. Ueberall
    // sonst ist `pos.direction === "BUY" ? a : b` TYPKORREKT — und `null`
    // nimmt still den else-Zweig, wird also wie SELL behandelt. Der
    // Riegel von heute hat diese Zweige ueberhaupt erst erreichbar
    // gemacht; vorher kam immer "BUY" an.
    //
    // ZWEI Stellen waren betroffen, beide am Geld, beide AUSGERECHNET:
    {
      // 1. `isProtected` im Orchestrator. Der Kommentar daneben sagt seit
      //    jeher "Unbekannt = NICHT abgesichert (fail-safe: dann kein
      //    Nachkauf)" — der Ternaer hielt das nicht ein. Fuer eine
      //    BUY-Position mit Stop UNTER dem Einstieg (also gerade NICHT
      //    abgesichert) ergab `null` den Wert TRUE, und der Nachkauf lief.
      const isProtected = (p) => {
        if (p.stopLevel == null || !p.openLevel) return false;
        if (p.direction !== "BUY" && p.direction !== "SELL") return false;
        return p.direction === "BUY" ? p.stopLevel >= p.openLevel : p.stopLevel <= p.openLevel;
      };
      // SELBSTPRUEFUNG des Nachbaus gegen die QUELLE: weicht er ab, misst
      // die Rechnung darunter meine eigene Meinung statt den Code.
      const orQ = read("frontend/lib/agents/orchestrator-agent.ts")
        .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      torPruefung("der Fail-safe in `isProtected` fehlt — eine Position "
        + "OHNE Richtung gilt dann als abgesichert, und der Nachkauf laeuft",
        /if \(p\.direction !== "BUY" && p\.direction !== "SELL"\) return false;/.test(orQ)
        && /return p\.direction === "BUY" \? p\.stopLevel >= p\.openLevel/.test(orQ),
        (orQ.match(/p\.direction[^\n]*/g) || ["(keine Zeile)"]).slice(0, 2).join(" | "));
      // Und die Rechnung selbst, an der Lage, die den Fehler ausdrueckt:
      // BUY, Stop UNTER Einstieg = NICHT abgesichert.
      torPruefung("isProtected urteilt falsch — unbekannt muss NICHT "
        + "abgesichert heissen",
        isProtected({ direction: "BUY", stopLevel: 95, openLevel: 100 }) === false
        && isProtected({ direction: "BUY", stopLevel: 105, openLevel: 100 }) === true
        && isProtected({ direction: "SELL", stopLevel: 95, openLevel: 100 }) === true
        && isProtected({ direction: null, stopLevel: 95, openLevel: 100 }) === false
        && isProtected({ direction: null, stopLevel: 105, openLevel: 100 }) === false,
        JSON.stringify([
          isProtected({ direction: "BUY", stopLevel: 95, openLevel: 100 }),
          isProtected({ direction: null, stopLevel: 95, openLevel: 100 }),
          isProtected({ direction: null, stopLevel: 105, openLevel: 100 })]));

      // 2. Die Anzeige im LiveExecutionMonitor — dieselbe Klasse wie die
      //    drei Faerbungen vom 04.11.: zweiwertig gefaerbt saehe eine
      //    Position OHNE Richtung wie ein SELL aus.
      const lemQ = read("frontend/components/LiveExecutionMonitor.tsx")
        .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      torPruefung("die Positions-Anzeige faerbt zweiwertig — eine Position "
        + "ohne Richtung saehe wie ein SELL aus",
        /pos\.direction === "SELL" \? "rgba\(248,113,113,0\.15\)"/.test(lemQ)
        && /pos\.direction === "SELL" \? "#f87171"/.test(lemQ)
        && /\{pos\.direction \?\? "—"\}/.test(lemQ),
        (lemQ.match(/pos\.direction[^\n]*/g) || ["(keine Zeile)"]).slice(0, 2).join(" | "));
    }
  }

  // ══ WAS IST MIT DEN OFFENEN POSITIONEN? (07.11.) ════════════════════════
  //
  // `/status` vom 07.11. meldete "Positionen: 1/6" — und sonst nichts. Die
  // Position war 70 Stunden alt, ueber ein Wochenende gehalten. Ob das in
  // Ordnung ist, haengt am Handelsstil (SCALPING 4 h, DAYTRADING 24 h,
  // SWING 168 h), und der stand nirgends. `capitalGetPositions` liefert das
  // volle Array, der Webhook nahm `.length` — dieselbe Form wie `confidence`
  // (02.11.) und `richtungenJa` (04.11.).
  {
    const pm = ladeTsModul("lib/positionen-lage/positionen-lage.ts");
    const PL = pm.exports?.positionenLage;
    const AS = pm.exports?.alterStunden;
    const SK = pm.exports?.stilKarteAusNotizen;
    const GR = pm.exports?.STIL_GRENZEN_STUNDEN;
    if (pm.fehler || typeof PL !== "function" || typeof AS !== "function"
      || typeof SK !== "function" || !GR) {
      funde.push(`positionen-lage nicht ausfuehrbar: ${pm.fehler ?? "nicht exportiert"}`);
      zusatz++;
    } else {
      const JETZT = new Date("2026-11-07T17:22:44.000Z");

      // ── DIE GRENZEN SIND EINE KOPIE — und muessen gleich bleiben ──────
      //
      // `/status` darf `risk-agent.ts` NICHT importieren: die Datei hat
      // erhoehtes Risiko und zieht Prisma, Bus, Telegram und den
      // Broker-Client nach. Dem Befehl, den man benutzt wenn etwas kaputt
      // ist, eine Laufzeit-Fehlerquelle zu geben, ist genau der Fehler, den
      // das Projekt am 27.10. vermieden hat. Also eine Kopie — aber eine
      // GEBUNDENE: hier wird die echte Tabelle geschnitten und verglichen.
      const raQ = read("frontend/lib/agents/risk-agent.ts");
      const anker = "const STYLE_MAX_HOURS: Record<string, number> = {";
      const von = raQ.indexOf(anker);
      const bis = von >= 0 ? raQ.indexOf("}", von) : -1;
      const roh = von >= 0 && bis > von ? raQ.slice(von + anker.length, bis) : "";
      const echt = {};
      for (const m of roh.matchAll(/(\w+)\s*:\s*(\d+)/g)) echt[m[1]] = Number(m[2]);
      // SELBSTPRUEFUNG des Ausschnitts: findet er nichts, saehe der
      // Vergleich darunter wie ein gutes Ergebnis aus.
      torPruefung("die Haltedauer-Tabelle liess sich nicht aus risk-agent.ts "
        + "schneiden — dann vergleicht die Pruefung darunter NICHTS",
        Object.keys(echt).length >= 3 && echt.DAYTRADING === 24,
        JSON.stringify(echt));
      torPruefung("die Haltedauern in positionen-lage.ts weichen von "
        + "risk-agent.ts ab — dann zeigt /status eine andere Grenze an, "
        + "als der Zeit-Exit benutzt",
        JSON.stringify(echt) === JSON.stringify(GR),
        `risk-agent ${JSON.stringify(echt)} vs modul ${JSON.stringify(GR)}`);

      // ── DIESELBE BEDINGUNG WIE `stammdatenAusNotizen` ────────────────
      //
      // Genau dann, wenn DORT kein Eintrag entsteht, gilt der Stil als
      // geraten und der Zeit-Exit wird ausgesetzt. Eine lockerere Regel
      // hier zeigte "DAYTRADING" an, waehrend die Position in Wirklichkeit
      // ohne Haltedauer-Grenze laeuft — also genau die Luege, gegen die
      // der Block gebaut ist. Beide Funktionen werden AUSGEFUEHRT.
      const ra = ladeTsModul("lib/agents/risk-agent.ts");
      const SA = ra.exports?.stammdatenAusNotizen;
      const proben = [
        { notes: JSON.stringify({ dealId: "A", tradingStyle: "SWING", confidence: 72 }) },
        { notes: JSON.stringify({ dealId: "B", tradingStyle: "DAYTRADING", confidence: 0 }) },
        // OHNE confidence -> beide muessen ihn VERWERFEN
        { notes: JSON.stringify({ dealId: "C", tradingStyle: "SCALPING" }) },
        // confidence null -> `Number(null)` waere 0; beide muessen verwerfen
        { notes: JSON.stringify({ dealId: "D", tradingStyle: "SWING", confidence: null }) },
        // leerer Stil
        { notes: JSON.stringify({ dealId: "E", tradingStyle: "  ", confidence: 5 }) },
        // ohne dealId
        { notes: JSON.stringify({ tradingStyle: "SWING", confidence: 5 }) },
        { notes: "kaputt {" }, { notes: null },
      ];
      if (typeof SA !== "function") {
        torPruefung("stammdatenAusNotizen ist nicht ausfuehrbar — die "
          + "Gleichheit der beiden Lesarten ist dann ungeprueft", false,
          ra.fehler ?? "nicht exportiert");
      } else {
        const a = [...SK(proben)].sort();
        const b = [...SA(proben)].map(([k, v]) => [k, v.tradingStyle]).sort();
        // SELBSTPRUEFUNG der Proben: ohne einen VERWORFENEN Fall koennte
        // die Gleichheit den Unterschied gar nicht ausdruecken.
        torPruefung("die Proben enthalten keinen verworfenen Fall — dann "
          + "beweist der Vergleich darunter nichts",
          a.length > 0 && a.length < proben.length,
          `${a.length} von ${proben.length} angenommen`);
        torPruefung("stilKarteAusNotizen liest ANDERS als "
          + "stammdatenAusNotizen — dann zeigt /status einen Stil an, auf "
          + "den der Zeit-Exit gar nicht rechnet",
          JSON.stringify(a) === JSON.stringify(b),
          `modul ${JSON.stringify(a)} vs risk-agent ${JSON.stringify(b)}`);
      }

      // ── alterStunden: unbekannt bleibt unbekannt ──────────────────────
      torPruefung("ein fehlendes oder unlesbares Datum wird zu einem Alter",
        AS("", JETZT) === null && AS(null, JETZT) === null
        && AS("Unsinn", JETZT) === null,
        JSON.stringify([AS("", JETZT), AS(null, JETZT), AS("Unsinn", JETZT)]));
      torPruefung("das Alter wird falsch gerechnet",
        AS("2026-11-04T19:30:00.000Z", JETZT) === 69.9,
        String(AS("2026-11-04T19:30:00.000Z", JETZT)));
      // ── OHNE ZONENANGABE WIRD NICHT GERECHNET (07.11.) ───────────────
      //
      // Capital.com schickt seine Zeitstempel OHNE Zone — genau das hat am
      // 22.09. zwei Monate lang das Kurs-Alter verfaelscht. Der Client
      // rechnet seit damals an der Grenze um (`brokerZeitNachUtc`,
      // capital-com-client.ts:965) und liefert `""` oder ein
      // `toISOString()`, also immer mit `Z`.
      //
      // `alterStunden` ist aber EXPORTIERT und darf sich darauf nicht
      // verlassen. Ausgerechnet: `2026-11-04T19:30:00` roh gelesen ergibt
      // 69.9 h, waehrend die Wahrheit (Zuerich, UTC+1) 70.9 h ist — eine
      // Stunde zu jung, und bei DAYTRADING (Grenze 24 h) entscheidet genau
      // das ueber "ueberfaellig".
      torPruefung("eine ROHE Broker-Zeit ohne Zone wird gerechnet statt als "
        + "unbekannt gemeldet — das Alter waere um den Zonenversatz daneben",
        AS("2026-11-04T19:30:00", JETZT) === null
        && AS("2026-11-04 19:30:00", JETZT) === null,
        JSON.stringify([AS("2026-11-04T19:30:00", JETZT),
          AS("2026-11-04 19:30:00", JETZT)]));
      // GEGENPROBE: die drei UMGERECHNETEN Formen muessen weiter rechnen —
      // sonst waere der Riegel nur "immer unbekannt", und aus einer Messung
      // wuerde ein Nichtwissen (die Regel vom 22.09. in der anderen
      // Richtung). `brokerZeitNachUtc` liefert die erste, die anderen
      // koennen von einem anderen Broker kommen.
      torPruefung("der Zonen-Riegel ist zu streng — umgerechnete Zeiten "
        + "muessen weiter gerechnet werden",
        AS("2026-11-04T19:30:00.000Z", JETZT) === 69.9
        && AS("2026-11-04T19:30:00Z", JETZT) === 69.9
        && AS("2026-11-04T20:30:00+01:00", JETZT) === 69.9,
        JSON.stringify([AS("2026-11-04T19:30:00.000Z", JETZT),
          AS("2026-11-04T19:30:00Z", JETZT),
          AS("2026-11-04T20:30:00+01:00", JETZT)]));
      // UND DIE QUELLE: der Client MUSS umrechnen, sonst waere jede
      // Positions-Zeit ab sofort "Alter unbekannt" — richtig, aber nutzlos.
      {
        const ccQ = read("frontend/lib/capital-com/capital-com-client.ts")
          .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
        torPruefung("der Broker-Client rechnet `createdDate` nicht mehr nach "
          + "UTC um — dann meldet /status fuer JEDE Position 'Alter "
          + "unbekannt'",
          /createdDate:\s*brokerZeitNachUtc\(pos\.createdDate\)/.test(ccQ),
          (ccQ.match(/createdDate:[^\n]*/g) || ["(keine Zeile)"]).slice(0, 2).join(" | "));
      }
      // Regel vom 22.09.: bis zwei Minuten Uhren-Versatz, darueber UNBEKANNT.
      // Eine stille 0 war dort die Luege, die den Fehler zwei Monate trug.
      torPruefung("eine Zukunft wird als frisch oder als Alter ausgegeben",
        AS("2026-11-07T17:23:30.000Z", JETZT) === 0
        && AS("2026-11-07T18:00:00.000Z", JETZT) === null,
        JSON.stringify([AS("2026-11-07T17:23:30.000Z", JETZT),
          AS("2026-11-07T18:00:00.000Z", JETZT)]));

      // ── positionenLage AUSGEFUEHRT ────────────────────────────────────
      const eing = [
        { symbol: "GOLD", direction: "SELL", createdDate: "2026-11-07T10:00:00.000Z", stil: "DAYTRADING" },
        { symbol: "XRPUSD", direction: "BUY", createdDate: "2026-11-04T19:30:00.000Z", stil: "SWING" },
        { symbol: "UKOIL", direction: "BUY", createdDate: "2026-11-06T10:00:00.000Z", stil: null },
        { symbol: "SPX500", direction: "SELL", createdDate: "", stil: "DAYTRADING" },
        { symbol: "EURUSD", direction: "BUY", createdDate: "2026-11-05T10:00:00.000Z", stil: "DAYTRADING" },
      ];
      const bef = PL(eing, JETZT);
      const b = (s) => bef.find((x) => x.symbol === s);
      // SELBSTPRUEFUNG der Testdaten: alle vier Lagen muessen vorkommen,
      // sonst kann keine Pruefung darunter ihren Fehler ausdruecken.
      torPruefung("die Testdaten decken nicht alle vier Lagen ab (aktiv, "
        + "ueberfaellig, ohne Stil, ohne Zeit) — dann beweisen die "
        + "Pruefungen darunter nichts",
        b("GOLD")?.zeitExit === "aktiv" && b("GOLD")?.ueberfaellig === false
        && b("EURUSD")?.ueberfaellig === true
        && b("UKOIL")?.zeitExit === "ohne-stil"
        && b("SPX500")?.zeitExit === "ohne-zeit",
        JSON.stringify(bef.map((x) => [x.symbol, x.zeitExit, x.ueberfaellig])));
      torPruefung("eine SWING-Position wird faelschlich als ueberfaellig "
        + "gemeldet — 70 h sind unter der Grenze von 168 h",
        b("XRPUSD")?.alterStunden === 69.9 && b("XRPUSD")?.grenzeStunden === 168
        && b("XRPUSD")?.ueberfaellig === false,
        JSON.stringify(b("XRPUSD")));
      // OHNE Stil KEINE Grenze und KEIN Urteil — sonst waere "ueberfaellig"
      // eine Behauptung auf einer Annahme, genau der Fehler, den
      // risk-agent.ts am 19.08. losgeworden ist.
      torPruefung("ohne Handelsstil wird eine Grenze erfunden",
        b("UKOIL")?.grenzeStunden === null && b("UKOIL")?.ueberfaellig === false,
        JSON.stringify(b("UKOIL")));
      torPruefung("ohne Eroeffnungszeit wird ein Urteil gefaellt",
        b("SPX500")?.alterStunden === null && b("SPX500")?.ueberfaellig === false,
        JSON.stringify(b("SPX500")));
      // ── AUFFAELLIGES ZUERST, DARIN NACH ALTER ────────────────────────
      //
      // DAS IST EIN RIEGEL, KEINE KOSMETIK. Der erste Entwurf sortierte nur
      // nach Alter — und eine Position OHNE Eroeffnungszeit hat
      // `alterStunden === null`, landete damit ganz unten und fiele als
      // ERSTE aus dem Deckel. Ausgerechnet der Fall, in dem der Zeit-Exit
      // gar nicht greifen kann, waere der erste, den die Anzeige
      // verschweigt. Dieselbe Lehre wie bei der gedrehten Tor-Sortierung
      // (31.10.).
      // DIE EXPORTIERTE FUNKTION, nicht ihr Nachbau (07.11.).
      //
      // Hier stand `x.zeitExit !== "aktiv" || x.ueberfaellig` — eine ZWEITE
      // Umsetzung derselben Regel, im Pruefer. Aendert sich
      // `brauchtAufmerksamkeit`, merkt ein Nachbau das NICHT: der Pruefer
      // misst dann seine eigene Meinung statt den Code. Gefunden beim
      // Nachzaehlen, welcher Export von heute wirklich AUFGERUFEN wird —
      // dieser war der einzige, der nirgends vorkam.
      const BA = pm.exports?.brauchtAufmerksamkeit;
      if (typeof BA !== "function") {
        torPruefung("brauchtAufmerksamkeit ist nicht exportiert — dann "
          + "prueft die Sortierung einen Nachbau statt den Code", false,
          String(typeof BA));
      }
      const auffFn = typeof BA === "function" ? BA : null;
      const auff = auffFn ? bef.filter(auffFn) : [];
      const unauff = auffFn ? bef.filter((x) => !auffFn(x)) : [];
      // Und die Funktion selbst GERECHNET, an allen vier Lagen.
      torPruefung("brauchtAufmerksamkeit urteilt falsch",
        !!auffFn
        && auffFn({ zeitExit: "ohne-zeit", ueberfaellig: false }) === true
        && auffFn({ zeitExit: "ohne-stil", ueberfaellig: false }) === true
        && auffFn({ zeitExit: "aktiv", ueberfaellig: true }) === true
        && auffFn({ zeitExit: "aktiv", ueberfaellig: false }) === false,
        auffFn ? JSON.stringify([
          auffFn({ zeitExit: "ohne-zeit", ueberfaellig: false }),
          auffFn({ zeitExit: "ohne-stil", ueberfaellig: false }),
          auffFn({ zeitExit: "aktiv", ueberfaellig: true }),
          auffFn({ zeitExit: "aktiv", ueberfaellig: false })]) : "fehlt");
      torPruefung("auffaellige Positionen stehen nicht vorne — dann faellt "
        + "die ohne Eroeffnungszeit als erste aus dem Deckel",
        !!auffFn && bef.slice(0, auff.length).every(auffFn)
        && auff.length === 3 && unauff.length === 2,
        JSON.stringify(bef.map((x) => [x.symbol, x.zeitExit, x.ueberfaellig])));
      torPruefung("innerhalb der Gruppen wird nicht nach Alter sortiert",
        unauff[0].symbol === "XRPUSD" && unauff[1].symbol === "GOLD",
        JSON.stringify(unauff.map((x) => [x.symbol, x.alterStunden])));
      // Und die Position OHNE Alter darf NICHT hinten landen, wenn sie
      // auffaellig ist — genau das war das Loch.
      torPruefung("die Position ohne Eroeffnungszeit landet hinten",
        bef.findIndex((x) => x.symbol === "SPX500") < unauff.length + 1,
        `Index ${bef.findIndex((x) => x.symbol === "SPX500")} von ${bef.length}`);
      // OHNE RICHTUNG wird keine erfunden (07.11.). `capitalGetPositions`
      // liefert seit heute `null`, wenn der Broker nichts Lesbares schickt —
      // die Anzeige darf daraus kein "BUY" machen.
      torPruefung("eine Position ohne Richtung bekommt in der Anzeige eine "
        + "erfundene",
        PL([{ symbol: "GOLD", direction: null,
          createdDate: "2026-11-07T10:00:00.000Z", stil: "SWING" }], JETZT)[0]
          .richtung === "—"
        && PL([{ symbol: "GOLD", direction: "  ",
          createdDate: "2026-11-07T10:00:00.000Z", stil: "SWING" }], JETZT)[0]
          .richtung === "—",
        JSON.stringify(PL([{ symbol: "GOLD", direction: null,
          createdDate: "2026-11-07T10:00:00.000Z", stil: "SWING" }], JETZT)[0]));
      torPruefung("ein unbekannter Stil bekommt eine Grenze aus der Tabelle",
        PL([{ symbol: "X", direction: "BUY", createdDate: "2026-11-07T10:00:00.000Z",
          stil: "GIBTESNICHT" }], JETZT)[0].grenzeStunden === null,
        JSON.stringify(PL([{ symbol: "X", direction: "BUY",
          createdDate: "2026-11-07T10:00:00.000Z", stil: "GIBTESNICHT" }], JETZT)[0]));
    }

    // ── DIE VERDRAHTUNG (07.11.) ──────────────────────────────────────
    //
    // Eine geprueffte Funktion, die nie echte Werte bekommt, beweist nichts
    // ueber ihre Aufrufstelle (30.09.). Der Webhook muss die LISTE
    // weiterreichen, nicht nur ihre Laenge.
    const ohneK9 = (q) => q.replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    const whQ9 = ohneK9(read("frontend/app/api/telegram/webhook/route.ts"));
    torPruefung("die Kommentar-Bereinigung ist blind — sie streift nichts ab",
      !/weggeworfen/.test(ohneK9("// weggeworfen")) && /behalten/.test(ohneK9("const x = behalten;")),
      "Selbstpruefung");
    // AN DIE ZUWEISUNG GEBUNDEN, nicht an das blosse Vorkommen: ein
    // `posBefunde = null && positionenLage(...)` liesse den Aufruf im Text
    // stehen und das Ergebnis verfallen — die Fehlerklasse vom 28.10.
    torPruefung("/status wirft die Positionsliste wieder weg (nur .length)",
      /posBefunde\s*=\s*offenePos === null \? null : positionenLage\(/.test(whQ9)
      && /stilKarteAusNotizen\(/.test(whQ9)
      && !/return r\?\.ok && Array\.isArray\(r\.positions\) \? r\.positions\.length : null/.test(whQ9),
      (whQ9.match(/posBefunde[^\n]*/g) || ["(keine Zuweisung)"]).slice(0, 2).join(" | "));
    torPruefung("/status reicht die Positionsliste nicht an handelsLage durch",
      /positionen:\s*posBefunde/.test(whQ9)
      && /offenePositionen:\s*offenePos\?\.length\s*\?\?\s*null/.test(whQ9),
      (whQ9.match(/positionen:[^\n]*/g) || ["(keine Zeile)"])[0]);
    // OHNE dealId KEIN Nachschlagen. Sonst waere der Schluessel `""`, und
    // ein Eintrag darunter gaebe dieser Position einen FREMDEN Stil — mit
    // einer Haltedauer-Grenze, die ihr nicht gehoert.
    //
    // Ueber den Livepfad nicht erreichbar (ausgefuehrt belegt:
    // `stilKarteAusNotizen` traegt nur unter `if (m.dealId && …)` ein, `""`
    // wird nie Schluessel) — eine Zusicherung an der Stelle, an der sie
    // gilt, wie `checkPriceAvailable` am 24.08.
    torPruefung("eine Position OHNE dealId schlaegt unter dem leeren "
      + "Schluessel nach und zieht einen fremden Handelsstil",
      /stil:\s*p\.dealId \? \(stilKarte\?\.get\(String\(p\.dealId\)\) \?\? null\) : null/.test(whQ9)
      && !/stilKarte\?\.get\(String\(p\.dealId \?\? ""\)\)/.test(whQ9),
      (whQ9.match(/stil:[^\n]*/g) || ["(keine stil-Zuweisung)"])[0]);
    {
      // Und AUSGEFUEHRT: die Karte darf gar keinen leeren Schluessel
      // bekoennen koennen — sonst waere der Riegel oben die einzige
      // Verteidigung und seine Begruendung falsch.
      const SKx = ladeTsModul("lib/positionen-lage/positionen-lage.ts")
        .exports?.stilKarteAusNotizen;
      const leerK = typeof SKx === "function" ? SKx([
        { notes: JSON.stringify({ dealId: "", tradingStyle: "SWING", confidence: 5 }) },
        { notes: JSON.stringify({ dealId: null, tradingStyle: "SWING", confidence: 5 }) },
        { notes: JSON.stringify({ dealId: 0, tradingStyle: "SWING", confidence: 5 }) },
      ]) : null;
      torPruefung("stilKarteAusNotizen kann einen LEEREN Schluessel "
        + "erzeugen — dann zieht jede Position ohne dealId diesen Stil",
        leerK !== null && leerK.size === 0 && !leerK.has(""),
        JSON.stringify(leerK ? [...leerK] : null));
    }

    // ── NEBENEINANDER, NICHT NACHEINANDER (07.11.) ────────────────────
    //
    // DAS WAR EIN ECHTER FEHLER VON MIR, und er war kurz live. Der erste
    // Entwurf haengte die Journal-Abfrage SEQUENTIELL hinter den
    // Broker-Aufruf, in DERSELBEN `sicher()`-Quelle. `sicher()` bindet
    // jede Quelle auf 5000 ms, und `capitalGetPositions` hat allein schon
    // `AbortSignal.timeout(8000)`. Die Summe reisst die Grenze schon bei
    // einer traegen Datenbank — und dann verliert /status BEIDES: die
    // Liste UND die Zahl, die vorher ankam.
    //
    // Drei Zeilen ueber dem Code steht die Regel, die das verbietet.
    //
    // Geprueft per KLAMMERZAEHLER je Quelle: ein Zeichen-Fenster bewiese
    // nur Naehe, nicht Zugehoerigkeit (22.09.).
    {
      const bloecke = [];
      let i = 0;
      while (true) {
        const p = whQ9.indexOf("sicher(async", i);
        if (p < 0) break;
        let k = whQ9.indexOf("(", p), tief = 0, instr = null, ende = -1;
        for (; k < whQ9.length; k++) {
          const c = whQ9[k];
          if (instr) { if (c === "\\") { k++; continue; } if (c === instr) instr = null; }
          else if (c === '"' || c === "'" || c === "`") instr = c;
          else if (c === "(") tief++;
          else if (c === ")") { tief--; if (tief === 0) { ende = k; break; } }
        }
        if (ende < 0) break;
        bloecke.push(whQ9.slice(p, ende + 1));
        i = ende + 1;
      }
      // SELBSTPRUEFUNG: findet der Zaehler keine Bloecke, misst die
      // Pruefung darunter nichts und saehe wie ein gutes Ergebnis aus.
      torPruefung("der Klammerzaehler findet die sicher()-Quellen nicht — "
        + "dann prueft die Zeile darunter NICHTS",
        bloecke.length >= 9
        && bloecke.some((b) => /capitalGetPositions/.test(b))
        && bloecke.some((b) => /prisma\.trade\.findMany/.test(b)),
        `${bloecke.length} Quellen gefunden`);
      const zusammen = bloecke.filter(
        (b) => /capitalGetPositions/.test(b) && /prisma\.trade\.findMany/.test(b));
      torPruefung("Broker-Abruf und Journal-Abfrage stehen in DERSELBEN "
        + "sicher()-Quelle — ihre Zeiten addieren sich gegen die 5-Sekunden-"
        + "Grenze, und /status verliert dann auch die Positionszahl",
        zusammen.length === 0,
        `${zusammen.length} Quelle(n) mit beidem`);
      // Und die Zusammenfuehrung gehoert NACH das Promise.all — sonst
      // waere sie wieder Teil einer Quelle.
      const posAll = whQ9.indexOf("await Promise.all([");
      const posEnde = whQ9.indexOf("        ]);", posAll);
      // DIE ERSTE Fundstelle, nicht die erste NACH dem Ende (07.11.).
      // Mein erster Entwurf suchte ab `posEnde` — ein Aufruf INNERHALB
      // einer Quelle waere damit unbemerkt geblieben, weil die Suche ihn
      // gar nicht erreicht. Genau das, was die Pruefung verhindern soll.
      const posRechnung = whQ9.indexOf("positionenLage(");
      torPruefung("die Positions-Rechnung steht INNERHALB der Quellen "
        + "statt danach — dann zaehlt ihre Zeit wieder gegen die "
        + "5-Sekunden-Grenze",
        posAll >= 0 && posEnde > posAll && posRechnung > posEnde,
        `Promise.all@${posAll} ende@${posEnde} erste Rechnung@${posRechnung}`);
    }
    const hlQ9 = ohneK9(read("frontend/lib/handels-lage/handels-lage.ts"));
    torPruefung("die Anzeige nennt die ausgesetzten Zeit-Exits nicht — dann "
      + "steht die Warnung NUR in einer Logzeile, die nach drei Tagen "
      + "weggescrollt ist",
      /Zeit-Exit AUSGESETZT/.test(hlQ9) && /Zeit-Exit kann NICHT greifen/.test(hlQ9)
      && /ÜBER der Haltedauer/.test(hlQ9),
      "Texte der drei Lagen");
    // ── DER POSITIONS-BLOCK DARF DAS URTEIL NICHT VERDRAENGEN ────────
    //
    // Gefunden vom Pruefer: mein erster Entwurf schob jede auffaellige
    // Position nach `unbekannt` — und das KURZSCHLIESST das Urteil
    // ("🟡 … N Angabe(n) nicht feststellbar"). Eine Position ohne
    // Journal-Zeile haette damit die ganze Tor-Diagnose verdraengt, also
    // genau die Antwort auf "warum kein Trade?".
    {
      const PLx = ladeTsModul("lib/positionen-lage/positionen-lage.ts").exports;
      // EIGENER Prueffstand: `mit`/`BEKANNT`/`hl` des Lage-Blocks liegen in
      // einem anderen Geltungsbereich. Lieber hier laden als dort einen
      // Namen ausleihen, der morgen anders heisst.
      const hlX = ladeTsModul("lib/handels-lage/handels-lage.ts",
        { "html-sicher/html-sicher": ladeTsModul("lib/html-sicher/html-sicher.ts").exports });
      if (hlX.fehler || typeof hlX.exports?.handelsLage !== "function") {
        torPruefung("handels-lage ist im Positions-Pruefstand nicht ladbar",
          false, hlX.fehler ?? "nicht exportiert");
      } else {
      const BEKANNT_X = {
        brokerVerbunden: true, modus: "AUTO", offenePositionen: 0,
        maxGleichzeitig: 6, tagesZaehler: 0, tagesLimit: 21,
        tagesLimitAktiv: true, kontostand: 1870.57, hoechststand: 1990.36,
        maxDrawdownProzent: 10, inHandelszeit: true, zyklenHeute: 258,
        ausgaenge: { "x": 1 }, trichter: null, positionen: null,
      };
      const mit = (o) => hlX.exports.handelsLage({ ...BEKANNT_X, ...o });
      const hl = hlX;
      const BEKANNT = BEKANNT_X;
      const schlimmePos = PLx?.positionenLage?.([
        { symbol: "A", direction: "BUY", createdDate: "", stil: null },
        { symbol: "B", direction: "SELL", createdDate: "2026-11-01T00:00:00.000Z", stil: "DAYTRADING" },
      ], new Date("2026-11-07T17:22:44.000Z")) ?? [];
      const lagePos = mit({ ...BEKANNT, positionen: schlimmePos,
        offenePositionen: 2,
        trichter: { scans: 100, go: 5, tore: {
          "Schwelle": { ja: 0, nein: 5, fallback: 0, gruende: { "g": 5 } } } } });
      const tPos = lagePos.zeilen.join("\n");
      // SELBSTPRUEFUNG der Testdaten: beide Positionen MUESSEN auffaellig
      // sein, sonst kann die Pruefung den Fehler nicht ausdruecken.
      torPruefung("die Testpositionen sind nicht auffaellig — dann beweist "
        + "die Pruefung darunter nichts",
        schlimmePos.length === 2
        && schlimmePos.every((p) => p.zeitExit !== "aktiv" || p.ueberfaellig),
        JSON.stringify(schlimmePos.map((p) => [p.symbol, p.zeitExit, p.ueberfaellig])));
      torPruefung("eine auffaellige Position verdraengt das Tor-Urteil — "
        + "dann steht statt „Grösstes: Schwelle\" nur noch „N Angabe(n) "
        + "nicht feststellbar\"",
        /Grösstes: <b>Schwelle<\/b>/.test(tPos)
        && !lagePos.unbekannt.some((u) => /Haltedauer|Einzelheiten/.test(u)),
        `unbekannt=${JSON.stringify(lagePos.unbekannt)} · `
        + (tPos.match(/🟡[^\n]*|🛑[^\n]*/) ?? ["(kein Urteil)"])[0].slice(0, 120));
      // Und der Deckel mit seiner Rest-Zeile.
      const viele = PLx.positionenLage(Array.from({ length: 10 }, (_, i) => ({
        symbol: `M${i}`, direction: "BUY",
        createdDate: `2026-11-0${(i % 5) + 1}T10:00:00.000Z`, stil: "SWING",
      })), new Date("2026-11-07T17:22:44.000Z"));
      const tViele = mit({ ...BEKANNT, positionen: viele, offenePositionen: 10 })
        .zeilen.join("\n");
      const PMSx = hl.exports?.POSITIONEN_MAX_STATUS;
      torPruefung("der Positions-Block hat keinen Deckel — die Laenge der "
        + "Antwort haengt dann an `maxConcurrentPositions`",
        typeof PMSx === "number"
        && (tViele.match(/^ {6}M\d+ /gm) || []).length === PMSx,
        `${(tViele.match(/^ {6}M\d+ /gm) || []).length} Zeilen, Deckel ${PMSx}`);
      torPruefung("die gekuerzte Positionsliste sagt nicht, WIE VIEL fehlt",
        new RegExp(`\\(${10 - (PMSx ?? 6)} weitere ohne Auffälligkeit\\)`).test(tViele),
        (tViele.match(/weitere ohne[^\n]*/) ?? ["(keine Rest-Zeile)"])[0]);
      }
    }
  }

  // ══ EINE LESART FUER DIE RICHTUNG (03.11.) ══════════════════════════════
  //
  // `/hebel` zeigte am 02.11.: BUY 585 · SELL 226 · LONG 3. Der Bot
  // schreibt BUY/SELL, das Eingabeformular in /trading-journal schrieb
  // LONG/SHORT ungeprueft in dieselbe Spalte (Trade.direction ist im
  // Schema nur String). `getDirectionStats` verglich mit === "LONG" und
  // lief damit ueber DREI von 814 Zeilen; die Trade-Liste faerbte jeden
  // BUY rot. Dieselbe Route wurde von app/page.tsx mit dem RICHTIGEN
  // Vokabular gelesen — zwei Leser, zwei Sprachen.
  {
    const rm = ladeTsModul("lib/richtung/richtung.ts");
    const lr = rm.exports?.lesbareRichtung, ra = rm.exports?.richtungAnzeige;
    if (rm.fehler || typeof lr !== "function" || typeof ra !== "function") {
      funde.push(`richtung.ts nicht ausfuehrbar: ${rm.fehler ?? "nicht exportiert"}`);
      zusatz++;
    } else {
      torPruefung("BUY/SELL oder LONG/SHORT werden nicht als Richtung gelesen",
        lr("BUY") === "BUY" && lr("LONG") === "BUY" && lr("long") === "BUY"
        && lr(" Long ") === "BUY" && lr("SELL") === "SELL" && lr("SHORT") === "SELL"
        && lr("short") === "SELL",
        JSON.stringify([lr("BUY"), lr("LONG"), lr("long"), lr(" Long "), lr("SHORT")]));
      // EIN UNLESBARER WERT WIRD NICHT ZU EINER RICHTUNG. Eine stille
      // Ersatzrichtung zaehlte eine Position auf die falsche Seite.
      torPruefung("ein unlesbarer Wert wird still zu einer Richtung",
        lr("") === null && lr("UNBEKANNT") === null && lr(null) === null
        && lr(undefined) === null && lr(42) === null && lr({}) === null,
        JSON.stringify([lr(""), lr("UNBEKANNT"), lr(null), lr(42)]));
      // Die ANZEIGE versteckt einen kaputten Wert nicht.
      torPruefung("ein kaputter Richtungswert sieht in der Liste heil aus",
        ra("LONG") === "BUY" && ra("UNBEKANNT") === "UNBEKANNT?"
        && ra("") === "\u2014" && ra(null) === "\u2014",
        JSON.stringify([ra("LONG"), ra("UNBEKANNT"), ra("")]));
    }

    // ── Verdrahtung: kommentarbereinigt, sonst zaehlt eine Erwaehnung
    //    im Kommentar als Verwendung (Fehlerklasse aus CLAUDE.md).
    const ohneK3 = (q) => q.replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    const tjQ = ohneK3(read("frontend/app/trading-journal/page.tsx"));
    torPruefung("die Kommentar-Bereinigung ist blind — sie streift nichts ab",
      !/Fehlerklasse aus CLAUDE/.test(ohneK3("// Fehlerklasse aus CLAUDE.md"))
      && /behalten/.test(ohneK3("const x = 1; // behalten".replace("// behalten", "behalten"))),
      "Selbstpruefung der Bereinigung");
    torPruefung("/trading-journal vergleicht die Richtung wieder mit LONG/SHORT",
      !/direction\s*===\s*"(LONG|SHORT)"/.test(tjQ)
      && /lesbareRichtung\(trade\.direction\)/.test(tjQ),
      (tjQ.match(/direction\s*===\s*"(LONG|SHORT)"/g) || []).join(" | "));
    torPruefung("das Eingabeformular bietet wieder LONG/SHORT an",
      !/<option value="(LONG|SHORT)">/.test(tjQ)
      && (tjQ.match(/<option value="(BUY|SELL)">/g) || []).length === 4,
      (tjQ.match(/<option value="\w+">/g) || []).join(" "));
    torPruefung("der Standardwert der Richtungs-Felder ist wieder LONG",
      !/useState\("(LONG|SHORT)"\)/.test(tjQ),
      (tjQ.match(/useState\("\w+"\)/g) || []).slice(0, 6).join(" "));

    // Die Geldtabelle nimmt nur noch die abgebildete Richtung.
    const trQ = ohneK3(read("frontend/app/api/trades/route.ts"));
    torPruefung("/api/trades schreibt die rohe Eingabe in die Trade-Spalte",
      !/direction:\s*body\.direction/.test(trQ)
      && /lesbareRichtung\(body\.direction\)/.test(trQ)
      && /direction:\s*richtung/.test(trQ),
      (trQ.match(/direction:\s*[\w.]+/g) || []).join(" | "));

    // EINE Umsetzung, nicht zwei: zwei Fassungen derselben Abbildung
    // koennten auseinanderlaufen — und dann hiesse dieselbe Zeile an zwei
    // Stellen verschieden, also genau der Fehler, der hier behoben wurde.
    let rumpfe = 0;
    // `sourceFiles` nimmt ENDUNGEN, kein Verzeichnis. Ein `sourceFiles("frontend")`
    // ergab 0 Dateien — die harte Zusicherung `=== 1` hat das sofort gemeldet,
    // eine Schranke `<= 1` waere stillschweigend gruen geblieben (Lehre 31.10.).
    const quellen = sourceFiles([".ts", ".tsx"]).filter((d) => d.startsWith("frontend/"));
    torPruefung("die Rumpf-Suche findet gar keine Quelldateien — sie ist blind",
      quellen.length > 300, `${quellen.length} Dateien`);
    for (const d of quellen) {
      const q = ohneK3(read(d));
      if (/export function lesbareRichtung\s*\(/.test(q)) rumpfe++;
    }
    torPruefung("lesbareRichtung ist mehr als einmal ausgeschrieben",
      rumpfe === 1, `${rumpfe} Rumpf/Ruempfe gefunden`);

    // ══ ALLE LESER DER SPALTE, NICHT NUR DIE ZWEI VON GESTERN (04.11.) ══
    //
    // Der Fix vom 03.11. band /trading-journal und POST /api/trades. Beim
    // systematischen Durchgang aller 422 Quelldateien kamen FUENF weitere
    // Leser derselben Spalte heraus — der Fix deckte 2 von 7:
    //
    //   PATCH /api/trades/[id]   schrieb `body.direction` ROH in die
    //                            Geldtabelle (die POST-Luecke, noch offen)
    //   app/page.tsx             Haupt-Dashboard: `=== "BUY" ? gruen : rot`
    //                            faerbte eine LONG-Zeile ROT
    //   ForwardTestingCenter     dasselbe in `sideCls`, dritte Komponente
    //   /api/forward-testing     `as "BUY" | "SELL"` — ein Cast, der luegt
    //   lib/hebel/hebel.ts       gruppierte roh, LONG als eigene Gruppe
    //
    // "Ein Fix an einer Stelle beantwortet nicht, wo die Klasse sonst noch
    // steckt" — deshalb eine POSITIVLISTE wie bei den Order-Routen: jede
    // Stelle NAMENTLICH, nicht als Zahl. Eine untere Schranke bemerkte
    // einen fehlenden Eintrag nicht (Lehre vom 31.10.).
    //
    // NICHT auf dieser Liste und mit Absicht: `risk-agent.ts`
    // (`zuordnungAusPositionen`) behandelt eine unlesbare Richtung als
    // "nicht benennbar" und geht den VORSICHTIGEN Weg — das ist richtig und
    // steht in einer Datei mit erhoehtem Risiko.
    const rohVerboten = [
      ["frontend/app/page.tsx", /\bt\.direction\s*===\s*"/,
        "Haupt-Dashboard faerbt nach dem ROHEN Wert"],
      ["frontend/app/api/forward-testing/route.ts", /\.direction as "BUY"/,
        "/api/forward-testing castet die Trade-Spalte"],
      ["frontend/app/api/trades/[id]/route.ts", /direction:\s*body\.direction/,
        "PATCH schreibt die rohe Eingabe in die Geldtabelle"],
      ["frontend/lib/hebel/hebel.ts", /text\(z\.direction\)/,
        "/hebel gruppiert nach dem ROHEN Wert"],
      ["frontend/app/trading-journal/page.tsx", /setEditDirection\(trade\.direction\)/,
        "das Edit-Formular fuellt sich mit dem ROHEN Wert vor"],
      ["frontend/app/trading-journal/page.tsx", /direction:\s*trade\.direction/,
        "die Review-Kopfzeile zeigt den ROHEN Wert"],
    ];
    const normVerlangt = [
      ["frontend/app/page.tsx", /lesbareRichtung\(t\.direction\)/,
        "Haupt-Dashboard"],
      ["frontend/app/api/forward-testing/route.ts", /richtungAnzeige\(t\.direction\)/,
        "/api/forward-testing"],
      ["frontend/app/api/trades/[id]/route.ts", /lesbareRichtung\(body\.direction\)/,
        "PATCH /api/trades/[id]"],
      ["frontend/lib/hebel/hebel.ts", /richtungGruppe\(z\.direction\)/,
        "/hebel"],
      ["frontend/app/trading-journal/page.tsx", /lesbareRichtung\(trade\.direction\)/,
        "/trading-journal"],
      // Die dritte Farbe: ohne sie faerbt `sideCls` jeden unbekannten Wert
      // ROT, er sieht also wie die Gegenrichtung aus.
      ["frontend/components/ForwardTestingCenter.tsx", /s === "SELL"/,
        "sideCls ist dreiwertig"],
    ];
    // SELBSTPRUEFUNG der Muster in BEIDE Richtungen, an GEBAUTEN
    // Zeichenketten: am Dateiinhalt hinge sie an einer Formulierung.
    torPruefung("das Verbots-Muster findet einen rohen Leser nicht mehr",
      /\bt\.direction\s*===\s*"/.test('x = t.direction === "BUY" ? a : b')
      && !/\bt\.direction\s*===\s*"/.test('lesbareRichtung(t.direction) === "BUY"'),
      "Selbstpruefung der Verbots-Muster");
    torPruefung("ein roher Leser im KOMMENTAR wird als Befund gezaehlt",
      !/direction:\s*body\.direction/.test(
        ohneK3('// alt war: direction: body.direction,\nconst x = 1;')),
      "Selbstpruefung der Bereinigung am Verbots-Muster");
    for (const [datei, muster, name] of rohVerboten) {
      const q = ohneK3(read(datei));
      torPruefung(`roher Richtungs-Leser zurueck: ${name}`,
        !muster.test(q), `${datei} — ${String(muster)}`);
    }
    for (const [datei, muster, name] of normVerlangt) {
      const q = ohneK3(read(datei));
      torPruefung(`die abgebildete Richtung fehlt in: ${name}`,
        muster.test(q), `${datei} — ${String(muster)}`);
    }

    // `richtungGruppe` ausgefuehrt — und die Gegenprobe, dass sie sich von
    // der Anzeige NUR im Leerfall unterscheidet. Zwei eigene Abbildungen
    // koennten auseinanderlaufen; dann hiesse dieselbe Zeile an zwei
    // Stellen verschieden, also genau der Fehler, der hier behoben wurde.
    const rg = rm.exports?.richtungGruppe;
    if (typeof rg !== "function") {
      funde.push("richtungGruppe nicht exportiert"); zusatz++;
    } else {
      const ra2 = rm.exports.richtungAnzeige;
      torPruefung("richtungGruppe bildet LONG/SHORT nicht ab",
        rg("LONG") === "BUY" && rg("short") === "SELL" && rg(" Buy ") === "BUY",
        JSON.stringify([rg("LONG"), rg("short"), rg(" Buy ")]));
      torPruefung("richtungGruppe macht aus einem fehlenden Wert eine Richtung",
        rg("") === "ohne Angabe" && rg(null) === "ohne Angabe"
        && rg(undefined) === "ohne Angabe" && rg(42) === "ohne Angabe",
        JSON.stringify([rg(""), rg(null), rg(undefined), rg(42)]));
      torPruefung("richtungGruppe versteckt einen kaputten Wert",
        rg("UNBEKANNT") === "UNBEKANNT?", String(rg("UNBEKANNT")));
      torPruefung("Gruppe und Anzeige unterscheiden sich an mehr als dem "
        + "Leerfall — dann sind es zwei Abbildungen",
        ["BUY", "LONG", "sell", "SHORT", "UNBEKANNT", "x"]
          .every((v) => rg(v) === ra2(v))
        && rg("") !== ra2("") && ra2("") === "—",
        JSON.stringify(["BUY", "LONG", "UNBEKANNT", ""].map((v) => [rg(v), ra2(v)])));
    }
  }

  // ══ EIN GESENDETES FELD OHNE LESER (02.11.) ═════════════════════════════
  //
  // Bis heute hielt der Pruefer nur EINE Richtung: was die Zyklus-Bilanz
  // LIEST, muss gesendet werden. Die Gegenrichtung fehlte — und genau
  // dort lag der Fund: `GateDecisionPayload.confidence` wurde von vier
  // Stellen gesendet und von niemandem gelesen. Ein Feld ohne Empfaenger
  // ist dieselbe Klasse wie ein Abo ohne Sender (17.09.).
  //
  // Beide Seiten kommen aus der QUELLE: die Feldnamen aus dem Typ
  // `GateDecisionPayload`, die gelesenen aus dem `case`-Block von
  // `bilanzVerbuchen` — per Klammerzaehler, nicht per Zeichenfenster
  // (ein Fenster beweist Naehe, nicht Zugehoerigkeit, 22.09.).
  {
    const ohneK = (q) => q.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    // Klammerzaehler MIT Zeichenketten-Bewusstsein: eine `}` in einem
    // Text schliesst sonst den Block (Falle vom 30.09.).
    const block = (q, anker) => {
      const von = q.indexOf(anker);
      if (von < 0) return null;
      const auf = q.indexOf("{", von);
      if (auf < 0) return null;
      let tiefe = 0;
      for (let i = auf; i < q.length; i++) {
        const c = q[i];
        if (c === "{") tiefe++;
        else if (c === "}") { tiefe--; if (tiefe === 0) return q.slice(auf + 1, i); }
        else if (c === '"' || c === "'" || c === "`") {
          const anf = c; i++;
          while (i < q.length && q[i] !== anf) { if (q[i] === "\\") i++; i++; }
        }
      }
      return null;
    };
    const typBlock = block(ohneK(read("frontend/lib/agents/agent-bus.ts")),
      "export interface GateDecisionPayload");
    const leseBlock = block(ohneK(read("frontend/lib/zyklus-bilanz/zyklus-bilanz.ts")),
      'case "GATE:DECISION":');
    const felder = typBlock
      ? [...typBlock.matchAll(/(\w+)\??\s*:/g)].map((m) => m[1]) : [];
    torPruefung("der Ausschnitt fuer die Gegenrichtung ist leer — die Messung ist blind",
      !!typBlock && !!leseBlock && felder.includes("gate") && felder.includes("reason"),
      `Typ ${typBlock ? typBlock.length : 0} Zeichen, Leser ${leseBlock ? leseBlock.length : 0}, Felder ${felder.join(",")}`);
    if (typBlock && leseBlock) {
      const liest = new Set([...leseBlock.matchAll(/\bp\.(\w+)/g)].map((m) => m[1]));
      const stumm = felder.filter((f) => !liest.has(f));
      torPruefung("ein Feld der Tor-Nutzlast wird gesendet und von niemandem gelesen",
        stumm.length === 0,
        stumm.length ? `${stumm.join(", ")} — gesendet, nie gelesen (Fund 02.11.)` : "");
      // SELBSTPRUEFUNG: ein erfundenes Feld MUSS auffallen, sonst ist die
      // Messung nur deshalb gruen, weil sie nichts sieht.
      const probe = [...felder, "gibtEsNichtImLeser"].filter((f) => !liest.has(f));
      torPruefung("die Gegenrichtungs-Messung findet ein erfundenes Feld nicht — sie ist blind",
        probe.length === 1 && probe[0] === "gibtEsNichtImLeser", probe.join(", "));
    }
  }

  // ══ DER DIAGNOSE-AGENT LIEST EINEN SCHLUESSEL, DEN NIEMAND SENDET ═══════
  //
  // Seit dem 17.09. haelt der Pruefer diese Zusicherung fuer die
  // Zyklus-Bilanz. Der DIAGNOSE-Agent war nie erfasst — und genau dort
  // stand `event.payload.progress`, waehrend der Sender `profitPct`
  // schickt. Die Zeile meldete bei jedem Breakeven "bei 0%".
  //
  // Beide Seiten aus der QUELLE: die gelesenen Namen aus handleEvent,
  // die gesendeten aus allen `payload: { ... }`-Literalen im Programm.
  {
    const ohneK2 = (q) => q.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    // JE EREIGNISTYP, NICHT GLOBAL. Die erste Fassung verglich alle
    // gelesenen gegen alle gesendeten Namen — und blieb im Sabotage-Lauf
    // gruen, als der BE_SET-Sender `profitPct` umbenannte: RISK:PARTIAL_TP
    // sendet denselben Namen, also lag er weiter im Topf. Woertlich "ein
    // Treffer beweist nichts ueber die andere Stelle" (25.10.).
    const schnitt = (q, von) => {
      const auf = q.indexOf("{", von);
      if (auf < 0) return "";
      let tiefe = 0;
      for (let i = auf; i < q.length; i++) {
        const c = q[i];
        if (c === "{") tiefe++;
        else if (c === "}") { tiefe--; if (tiefe === 0) return q.slice(auf + 1, i); }
        else if (c === '"' || c === "'" || c === "`") {
          const a = c; i++;
          while (i < q.length && q[i] !== a) { if (q[i] === "\\") i++; i++; }
        }
      }
      return "";
    };
    const namen = (rumpf) => {
      const raus = new Set();
      for (const m of rumpf.matchAll(/event\.payload[?]?\.(\w+)/g)) raus.add(m[1]);
      for (const m of rumpf.matchAll(/const\s*\{([^}]*)\}\s*=\s*event\.payload/g)) {
        for (const n of m[1].split(",")) {
          const k = n.split(":")[0].trim();
          if (/^\w+$/.test(k)) raus.add(k);
        }
      }
      return raus;
    };
    const daQ = ohneK2(read("frontend/lib/agents/diagnostics-agent.ts"));
    // Was liest der Agent JE Fall?
    const liestJe = new Map();
    for (const m of daQ.matchAll(/case\s+"([A-Z][A-Z_]*:[A-Z_]+)"\s*:/g)) {
      liestJe.set(m[1], namen(schnitt(daQ, m.index)));
    }
    // Was sendet wer JE Typ?
    const sendetJe = new Map();
    for (const d of ["frontend/lib/agents/risk-agent.ts", "frontend/lib/agents/execution-agent.ts",
      "frontend/lib/agents/orchestrator-agent.ts", "frontend/lib/agents/analysis-agent.ts"]) {
      const q = ohneK2(read(d));
      for (const m of q.matchAll(/type\s*:\s*"([A-Z][A-Z_]*:[A-Z_]+)"/g)) {
        const pl = q.indexOf("payload", m.index);
        if (pl < 0 || pl - m.index > 400) continue;
        const rumpf = schnitt(q, pl);
        const set = sendetJe.get(m[1]) ?? new Set();
        for (const n of rumpf.split(",")) {
          const k = n.split(":")[0].trim().replace(/^\.\.\./, "");
          if (/^\w+$/.test(k)) set.add(k);
        }
        sendetJe.set(m[1], set);
      }
    }
    torPruefung("die Messung je Ereignistyp ist blind — sie findet bekannte Stellen nicht",
      (liestJe.get("RISK:BE_SET")?.has("profitPct") ?? false)
      && (sendetJe.get("RISK:BE_SET")?.has("profitPct") ?? false)
      && (liestJe.get("RISK:ERROR")?.has("error") ?? false),
      `${liestJe.size} Faelle gelesen, ${sendetJe.size} Typen gesendet`);
    const blind = [];
    for (const [typ, keys] of liestJe) {
      const gesendet = sendetJe.get(typ);
      if (!gesendet) continue;   // kein Sender in den Agenten — eigene Frage
      for (const k of keys) if (!gesendet.has(k)) blind.push(`${typ}.${k}`);
    }
    torPruefung("der Diagnose-Agent liest einen Schluessel, den sein Sender nicht sendet",
      blind.length === 0,
      blind.length ? `${blind.join(", ")} — der Wert ist dann immer der Rueckfall (Fund 03.11.)` : "");
    // SELBSTPRUEFUNG: ein erfundener Name MUSS auffallen.
    const probe = [];
    for (const [typ, keys] of liestJe) {
      const gesendet = sendetJe.get(typ);
      if (!gesendet) continue;
      for (const k of [...keys, "gibtEsAlsSenderNicht"]) if (!gesendet.has(k)) probe.push(`${typ}.${k}`);
    }
    torPruefung("die Messung findet einen erfundenen Schluessel nicht — sie ist blind",
      probe.length > 0 && probe.every((p) => p.endsWith(".gibtEsAlsSenderNicht")),
      probe.join(", "));
    // UND EIN FEHLENDER WERT DARF NICHT 0 WERDEN (Regel vom 22.09.).
    torPruefung("ein fehlender Breakeven-Gewinn wird als 0 % ausgegeben",
      /gewinn\s*=\s*typeof roh === "number" && Number\.isFinite\(roh\)/.test(daQ)
      && /"unbekannt"/.test(daQ), "BE-Zeile in diagnostics-agent.ts");
  }

  // ══ DIE SPANNE MUSS DURCH DEN WEBHOOK-TYP PASSEN (02.11.) ═══════════════
  //
  // Am 30.09. war eine vollstaendig gepruefte Funktion dauerhaft ohne
  // echte Werte, weil die Aufrufstelle den Feldnamen falsch las. Hier
  // deklariert der Webhook die Form der Tagessumme selbst — fehlt das
  // Feld dort, ist die Spanne statisch `undefined`.
  {
    const whQ = read("frontend/app/api/telegram/webhook/route.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    torPruefung("der Webhook-Typ kennt `confSpanne` nicht — dann kommt die "
      + "Spanne nie in /status an",
      /confSpanne\?\s*:/.test(whQ) && /richtungen\?\s*:/.test(whQ)
      && /tore\?\s*:/.test(whQ),
      "Feld im `tore`-Typ von /status");
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
        "redis-lage/redis-lage": ladeTsModul("lib/redis-lage/redis-lage.ts").exports,
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

  // ══ DERSELBE FUND BEIM ZWEITEN BROKER (08.11.) ══════════════════════════
  //
  // Am 07.11. wurde `capitalGetPositions` von `?? "BUY"` befreit (`2ef93a0`).
  // IC Markets hatte denselben Rueckfall an ZWEI Stellen, und die Kette zum
  // Geld ist genauso kurz:
  //
  //   icGetPositions          ?? "BUY"
  //     → icmarkets-trade-manager:131   `const isBuy = pos.direction === "BUY"`
  //       → :319                        `newTrailSL = isBuy ? kurs - d : kurs + d`
  //
  // Der Trailing-Stop einer SELL-Position laege damit UNTER dem Markt, also
  // auf der falschen Seite. "Ein Fix an einer Stelle beantwortet nicht, wo die
  // Klasse sonst noch steckt" (25.10.).
  //
  // Und in derselben Abbildung stand `openTime: ... ?? new Date()`. Das ist
  // die Regel vom 22.09. woertlich uebergangen: eine erfundene Eroeffnungszeit
  // laesst jede Position taufrisch aussehen, damit feuert der Zeit-Exit NIE —
  // und zwar stumm, denn die "AUSGESETZT"-Warnung greift selbst erst bei
  // `ageHours >= maxHours`.
  //
  // AUSGEFUEHRT, nicht am Wortlaut: `global.fetch` wird ersetzt und die ECHTE
  // `icGetPositions` muss die Antwort des Brokers abbilden.
  {
    const ic = ladeTsModul("lib/icmarkets/icmarkets-client.ts", {
      "richtung/richtung": ladeTsModul("lib/richtung/richtung.ts").exports,
      "zeitmessung/zeitmessung": { zeitstempelMessen: () => {}, hatZone: () => false },
    });
    const igp = ic.exports?.icGetPositions;
    if (ic.fehler || typeof igp !== "function") {
      funde.push(`icmarkets-client nicht ausfuehrbar: ${ic.fehler ?? "icGetPositions fehlt"}`);
      zusatz++;
    } else {
      const echtesFetch = global.fetch;
      const altSid = global.__icmarkets_mcp_session__;
      // "active" ueberspringt `mcpInitialize` — sonst liefe der Prüfstand in
      // einen zweiten, unbeteiligten fetch und messte den falschen Aufruf.
      const hole = async (roh) => {
        global.__icmarkets_mcp_session__ = "active";
        global.fetch = async () => ({
          ok: true, status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({ result: { positions: roh } }),
          text: async () => JSON.stringify({ result: { positions: roh } }),
        });
        try { return await igp(); } finally {
          global.fetch = echtesFetch;
          global.__icmarkets_mcp_session__ = altSid;
        }
      };
      const bau = (felder) => ([{
        positionId: "P1", symbol: "EURUSD", volume: 1, entryPrice: 1.1,
        ...felder,
      }]);

      // SELBSTPRUEFUNG zuerst: antwortet der Prüfstand ueberhaupt? Ohne sie
      // koennte jede Zusicherung unten an einem `undefined` gruen aussehen.
      const gesund = await hole(bau({ tradeSide: "BUY", openTime: "2026-11-01T10:00:00Z" }));
      torPruefung("der IC-Prüfstand bekommt keine Position zurueck — jede "
        + "Zusicherung darunter waere eine Null-Aussage",
        gesund?.ok === true && gesund.positions?.length === 1,
        JSON.stringify(gesund).slice(0, 180));

      // 1. FEHLT das Richtungsfeld, darf KEINE Richtung erfunden werden.
      const ohneDir = await hole(bau({ openTime: "2026-11-01T10:00:00Z" }));
      torPruefung("der IC-Client erfindet wieder eine Richtung, wenn das Feld "
        + "fehlt — der Trailing-Stop laege dann auf der falschen Seite",
        ohneDir?.positions?.[0]?.direction === null,
        JSON.stringify(ohneDir?.positions?.[0] ?? ohneDir).slice(0, 180));

      // 2. Ein UNSINNIGER Wert ebenso.
      const quatschDir = await hole(bau({ tradeSide: "LEFT", openTime: "2026-11-01T10:00:00Z" }));
      torPruefung("ein unlesbarer IC-Richtungswert wird zu einer Richtung",
        quatschDir?.positions?.[0]?.direction === null,
        String(quatschDir?.positions?.[0]?.direction));

      // 3. GEGENPROBE: echte Werte muessen ankommen — sonst waere der Riegel
      //    "alles null" und es wuerde GAR KEINE Position bewirtschaftet.
      //    LONG gehoert dazu: nur so laeuft die gemeinsame Lesart wirklich.
      const dBuy = await hole(bau({ tradeSide: "BUY" }));
      const dSell = await hole(bau({ tradeSide: "SELL" }));
      const dKlein = await hole(bau({ tradeSide: "sell" }));
      const dLong = await hole(bau({ tradeSide: "LONG" }));
      const dAlt = await hole(bau({ direction: "SHORT" }));
      torPruefung("der IC-Riegel ist zu streng — echte Richtungen kommen nicht "
        + "mehr an, und dann wird GAR KEINE Position mehr bewirtschaftet",
        dBuy?.positions?.[0]?.direction === "BUY"
        && dSell?.positions?.[0]?.direction === "SELL"
        && dKlein?.positions?.[0]?.direction === "SELL"
        && dLong?.positions?.[0]?.direction === "BUY"
        && dAlt?.positions?.[0]?.direction === "SELL",
        JSON.stringify([dBuy, dSell, dKlein, dLong, dAlt]
          .map((r) => r?.positions?.[0]?.direction ?? "?")));

      // 4. FEHLT die Eroeffnungszeit, darf KEINE erfunden werden.
      const ohneZeit = await hole(bau({ tradeSide: "BUY" }));
      torPruefung("der IC-Client erfindet wieder eine Eroeffnungszeit — dann "
        + "ist jede Position taufrisch und der Zeit-Exit feuert NIE (22.09.)",
        ohneZeit?.positions?.[0]?.openTime === null,
        String(ohneZeit?.positions?.[0]?.openTime));

      // 5. Eine LEERE Zeichenkette ist auch keine Zeit.
      const leereZeit = await hole(bau({ tradeSide: "BUY", openTime: "   " }));
      torPruefung("eine leere Eroeffnungszeit gilt als Zeit",
        leereZeit?.positions?.[0]?.openTime === null,
        JSON.stringify(leereZeit?.positions?.[0]?.openTime));

      // 6. GEGENPROBE: eine echte Zeit muss unveraendert ankommen — ein
      //    Riegel, der jede Zeit verschluckt, setzte den Zeit-Exit fuer ALLE
      //    Positionen aus und waere schlimmer als der Fund.
      const mitZeit = await hole(bau({ tradeSide: "BUY", openTime: "2026-11-01T10:00:00Z" }));
      const altFeld = await hole(bau({ tradeSide: "BUY", createTime: "2026-11-02T08:30:00Z" }));
      torPruefung("der Zeit-Riegel ist zu streng — er verschluckt echte "
        + "Eroeffnungszeiten, und dann ist der Zeit-Exit UEBERALL aus",
        mitZeit?.positions?.[0]?.openTime === "2026-11-01T10:00:00Z"
        && altFeld?.positions?.[0]?.openTime === "2026-11-02T08:30:00Z",
        JSON.stringify([mitZeit?.positions?.[0]?.openTime,
          altFeld?.positions?.[0]?.openTime]));

      // 7. Und die alten Rueckfaelle duerfen nicht zurueckkommen.
      const icQ = read("frontend/lib/icmarkets/icmarkets-client.ts")
        .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      torPruefung("ein Rueckfall `?? \"BUY\"` oder `?? new Date()` steht wieder "
        + "in icGetPositions",
        !/\?\?\s*"BUY"/.test(icQ)
        && !/openTime[^\n]*new Date\(\)/.test(icQ)
        && /direction: lesbareRichtung\(p\.tradeSide \?\? p\.direction\)/.test(icQ)
        && /openTime: zeitOderNull\(p\.openTime \?\? p\.createTime\)/.test(icQ),
        (icQ.match(/(direction|openTime): [^\n,]*/g) || ["(keine Zeile)"]).slice(0, 4).join(" | "));

      // 8. DREIWERTIG IM TYP. Wird `| null` entfernt, erzwingt `tsc` den
      //    Filter im Trade-Manager nicht mehr, und eine Position ohne
      //    Richtung laeuft wieder bis in die Stop-Rechnung.
      torPruefung("ICPosition ist nicht mehr dreiwertig — ohne `| null` "
        + "erzwingt `tsc` den Filter im Trade-Manager nicht mehr",
        /direction: "BUY" \| "SELL" \| null;/.test(icQ)
        && /openTime: string \| null;/.test(icQ),
        (icQ.match(/(direction|openTime): [^\n;]*;/g) || ["(keine Zeile)"]).slice(0, 4).join(" | "));
    }

    // ── DER FILTER AM RAND, der aus der Verengung folgt ──────────────────
    //
    // OHNE ihn macht die Verengung es SCHLIMMER statt besser: mit `?? "BUY"`
    // wurde eine fehlende Richtung zu BUY, mit `null` ist
    // `pos.direction === "BUY"` schlicht `false` — die Position gilt dann als
    // SELL. Genau dieser Rueckbau ist mir am 07.11. im Orchestrator
    // unterlaufen (`6edb2aa`), deshalb steht er hier als eigene Zusicherung.
    const itmQ = read("frontend/lib/icmarkets/icmarkets-trade-manager.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("der IC-Trade-Manager sortiert Positionen ohne Richtung nicht "
      + "aus, oder laeuft weiter ueber die ungefilterte Liste",
      /p\.direction !== null/.test(itmQ)
      && /for \(const pos of bewirtschaftbar\)/.test(itmQ)
      && !/for \(const pos of posResult\.positions\)/.test(itmQ),
      (itmQ.match(/for \(const pos of [^\n)]*\)/g) || ["(keine Schleife)"]).join(" | "));
    // Die AUFRAEUMUNG muss weiter ueber ALLE Positionen laufen: liefe sie
    // ueber `bewirtschaftbar`, gaelte eine Position ohne Richtung als
    // geschlossen und ihr Gedaechtnis waere weg.
    torPruefung("die Aufraeumung laeuft nur noch ueber die gefilterte Liste — "
      + "eine Position ohne Richtung gaelte dann als geschlossen",
      /liveIds = new Set\(posResult\.positions\.map/.test(itmQ),
      (itmQ.match(/liveIds = [^\n;]*/) ?? ["(keine Zeile)"])[0].slice(0, 110));
    // Und das Aussortieren darf nicht STILL geschehen — als ANWEISUNG
    // gebunden, nicht am Wortlaut (die Lehre vom 07.11.: `void 0 &&` liess
    // den Wortlaut stehen und der Pruefer blieb gruen).
    const icWarn = /^[ \t]*console\.warn\(`\[ic-trade-mgr\] ⚠️ \$\{ohneRichtung\}/m;
    torPruefung("das IC-Aussortieren geschieht STILL — ein stummes "
      + "Ueberspringen saehe aus wie ein gesunder Lauf (25.10.)",
      /OHNE lesbare Richtung/.test(itmQ) && icWarn.test(itmQ),
      (itmQ.match(/[^\n]*console\.warn\(`\[ic-trade-mgr\] ⚠️ \$\{ohneRichtung\}[^\n]*/) ?? ["(keine Meldung)"])[0].slice(0, 110));
    torPruefung("das IC-Anweisungs-Muster erkennt eine abgeschaltete Meldung "
      + "nicht",
      icWarn.test("    console.warn(`[ic-trade-mgr] ⚠️ ${ohneRichtung} x`)")
      && !icWarn.test("    void 0 && console.warn(`[ic-trade-mgr] ⚠️ ${ohneRichtung} x`)")
      && !icWarn.test("    // console.warn(`[ic-trade-mgr] ⚠️ ${ohneRichtung} x`)"),
      "Selbstpruefung des IC-Anweisungs-Musters");

    // ── DAS ALTER IST DREIWERTIG, und `NaN` ist keine Zahl ───────────────
    //
    // `new Date("Unsinn").getTime()` ist `NaN`, und `NaN >= maxHours` ist
    // `false` — der Zeit-Exit feuerte also auch bei Unsinn nie, stumm.
    // Vierte Wiederholung derselben Falle (24.08., 28.10., 29.10., 03.11.).
    //
    // GEZAEHLT, nicht gefunden (25.10.): es gibt ZWEI Zeit-Exit-Zweige, und
    // ein Treffer bewiese nichts ueber den anderen.
    // ── DAS ALTER WIRD GERECHNET, nicht am Wortlaut geprueft (08.11.) ────
    //
    // Hier stand `/Number\.isFinite\(openedMs\)/.test(itmQ)`. Nachdem die
    // Rechnung in `alterStundenIC` gewandert ist, traf der Ausdruck weiter —
    // aber aus dem FALSCHEN Grund: er fand `Number.isFinite` im Rumpf der
    // Funktion statt an der Aufrufstelle. Die Pruefung war gruen und bewies
    // nichts mehr. "Ein Treffer beweist nichts ueber die andere Stelle"
    // (25.10.), hier an meiner eigenen Pruefung von heute.
    {
      // DIE RECHNUNG LIEGT IN EINEM EIGENEN MODUL (08.11., zweite Runde).
      // Sie stand erst in `icmarkets-trade-manager.ts` — und `risk-agent.ts`
      // hatte dieselbe Rechnung OHNE den Zukunfts-Riegel. Zwei Fassungen
      // desselben Rechenwegs koennten auseinanderlaufen, und dann entscheidet
      // ein Broker anders als der andere ueber denselben Sachverhalt. Jetzt
      // EINE Umsetzung, von beiden benutzt — und der Pruefer rechnet sie.
      const am = ladeTsModul("lib/alter/alter.ts");
      const asi = am.exports?.alterStunden;
      const agr = am.exports?.alterGrund;
      if (am.fehler || typeof asi !== "function" || typeof agr !== "function") {
        funde.push(`lib/alter/alter.ts nicht ausfuehrbar: ${am.fehler ?? "alterStunden/alterGrund fehlt"}`);
        zusatz++;
      } else {
        const JETZT = 1_762_000_000_000;
        const h = (ms) => JETZT - ms * 3_600_000;
        const m = (min) => JETZT - min * 60_000;
        // SELBSTPRUEFUNG: rechnet sie ueberhaupt? Sonst saehe jedes `null`
        // unten wie ein erfolgreicher Riegel aus.
        torPruefung("alterStunden rechnet nicht — dann saehe jedes `null` "
          + "unten wie ein greifender Riegel aus",
          Math.abs((asi(h(3), JETZT) ?? -1) - 3) < 1e-9,
          `3h ergibt ${asi(h(3), JETZT)}`);
        // `NaN` ist KEIN Alter — `NaN >= maxHours` ist `false`, der Exit
        // waere stumm aus. Vierte Wiederholung derselben Falle.
        // ── DIE TESTDATEN MUSSTEN ES ERST AUSDRUECKEN KOENNEN (08.11.) ──
        //
        // Hier stand `asi(NaN, …), asi(…, NaN), asi(Infinity, …)`. Die
        // Sabotage "Number.isFinite-Riegel entfernen" blieb damit GRUEN, und
        // zwar nicht aus Zufall: fuer `NaN` ist `NaN >= 0` falsch UND
        // `NaN >= -(2/60)` falsch, also faengt der `: null`-Rueckfall des
        // Ternaers es von selbst. Dasselbe fuer `+Infinity` als Eroeffnung.
        //
        // AUSGERECHNET, nicht geschlossen: die Sabotage ist in genau ZWEI
        // Lagen wirksam — `-Infinity` als Eroeffnung und `+Infinity` als
        // Jetzt geben dann `Infinity` statt `null`. Genau die fehlten.
        //
        // Ueber die Aufrufstelle ist das unerreichbar (`new Date(x).getTime()`
        // ist endlich oder `NaN`, `Date.now()` immer endlich) — aber die
        // Funktion ist EXPORTIERT und muss fuer sich stimmen. Dieselbe
        // Begruendung wie bei `rrBand` (29.10.).
        torPruefung("ein `NaN` oder eine unendliche Zahl gilt wieder als "
          + "Alter — der Zeit-Exit waere dann stumm aus "
          + "(24.08., 28.10., 29.10., 03.11.)",
          asi(NaN, JETZT) === null && asi(h(3), NaN) === null
          && asi(Infinity, JETZT) === null && asi(-Infinity, JETZT) === null
          && asi(JETZT, Infinity) === null && asi(JETZT, -Infinity) === null,
          `NaN=${asi(NaN, JETZT)} jetztNaN=${asi(h(3), NaN)} `
          + `+Inf=${asi(Infinity, JETZT)} -Inf=${asi(-Infinity, JETZT)} `
          + `jetzt+Inf=${asi(JETZT, Infinity)} jetzt-Inf=${asi(JETZT, -Infinity)}`);
        // Eine ZUKUNFT bis 2 Minuten ist Uhren-Versatz, darueber unbekannt —
        // dieselbe Schranke wie `ageInMinutes` (22.09.). BEIDE Seiten der
        // Grenze, sonst koennte ein Testfall den Fehler nicht ausdruecken.
        torPruefung("eine kleine Zukunft (Uhren-Versatz) wird nicht zu 0",
          asi(m(-1), JETZT) === 0 && asi(m(-2), JETZT) === 0
          && asi(JETZT, JETZT) === 0,
          `-1min=${asi(m(-1), JETZT)} -2min=${asi(m(-2), JETZT)} 0=${asi(JETZT, JETZT)}`);
        torPruefung("eine GROSSE Zukunft gilt als Alter statt als unbekannt — "
          + "dann feuert der Zeit-Exit verspaetet und sagt es nicht",
          asi(m(-2.1), JETZT) === null && asi(m(-5), JETZT) === null
          && asi(h(-2), JETZT) === null,
          `-2.1min=${asi(m(-2.1), JETZT)} -5min=${asi(m(-5), JETZT)} -2h=${asi(h(-2), JETZT)}`);
        // GEGENPROBE: ein Riegel, der ALLES auf null zieht, setzte den
        // Zeit-Exit ueberall aus und waere schlimmer als der Fund.
        torPruefung("alterStunden ist zu streng — echte Alter werden zu "
          + "`null`, und dann ist der Zeit-Exit UEBERALL aus",
          typeof asi(h(0.5), JETZT) === "number"
          && typeof asi(h(25), JETZT) === "number"
          && typeof asi(h(200), JETZT) === "number",
          `0.5h=${asi(h(0.5), JETZT)} 25h=${asi(h(25), JETZT)} 200h=${asi(h(200), JETZT)}`);
        // ── DER GRUND WIRD AUCH GERECHNET ──────────────────────────────
        //
        // Drei Lagen, drei verschiedene naechste Schritte: eine FEHLENDE Zeit
        // ist ein Broker, der sie nicht liefert; eine UNLESBARE ist ein
        // Formatproblem; eine ZUKUNFT ist ein Zonen- oder Uhrenproblem — und
        // nur die letzte hat eine Ursache, die man suchen kann. "Wer den
        // Grund nicht mitschreibt, muss ihn spaeter raten" (22.09.).
        torPruefung("alterGrund nennt die drei Lagen nicht auseinander",
          agr("", NaN, JETZT) === "FEHLT"
          && agr(null, NaN, JETZT) === "FEHLT"
          && agr("   ", NaN, JETZT) === "FEHLT"
          && String(agr("Unsinn", NaN, JETZT)).startsWith("ist unlesbar")
          && String(agr("x", JETZT + 3 * 3_600_000, JETZT)).startsWith("liegt in der ZUKUNFT"),
          `leer=${agr("", NaN, JETZT)} unsinn=${agr("Unsinn", NaN, JETZT)} `
          + `zukunft=${agr("x", JETZT + 3 * 3_600_000, JETZT)}`);
        // GEGENPROBE: bei BEKANNTEM Alter gibt es nichts zu melden — sonst
        // waere die Meldung nur "immer da" (Lehre vom 15.09.).
        torPruefung("alterGrund meldet auch bei bekanntem Alter etwas",
          agr("2026-11-01T10:00:00Z", h(5), JETZT) === null
          && agr("x", m(-1), JETZT) === null,
          `5h=${agr("x", h(5), JETZT)} minus1min=${agr("x", m(-1), JETZT)}`);

        // ══ UND DIE ZWEITE AUFRUFSTELLE: DER CAPITAL-ZEIT-EXIT ══════════
        //
        // `risk-agent.ts` hatte dieselbe Rechnung OHNE den Zukunfts-Riegel.
        // Zwei Folgen, beide gemessen: der Zeit-Exit feuerte um den Versatz
        // VERSPAETET, und die Zahl ging als "Position offen seit -1.5
        // Stunden" in den KI-PROMPT des AI Managers — also an genau die
        // Entscheidung ueber Breakeven, Teilgewinn und Trailing.
        //
        // Eine gerechnete Funktion beweist nichts ueber ihre Aufrufstelle
        // (30.09.), also wird die Verdrahtung einzeln gebunden.
        const raQ3 = read("frontend/lib/agents/risk-agent.ts")
          .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
        torPruefung("der Capital-Zeit-Exit rechnet das Alter wieder selbst, "
          + "statt `alterStunden` zu benutzen — dann fehlt ihm der "
          + "Zukunfts-Riegel und die KI bekommt ein negatives Alter",
          /import \{ alterStunden, alterGrund \} from "\.\.\/alter\/alter";/.test(raQ3)
          && /const openedMs = pos\.createdDate \? new Date\(pos\.createdDate\)\.getTime\(\) : NaN;/.test(raQ3)
          && /const ageHours = alterStunden\(openedMs, Date\.now\(\)\);/.test(raQ3)
          && !/\(Date\.now\(\) - eroeffnet\.getTime\(\)\) \/ 3_600_000/.test(raQ3),
          (raQ3.match(/const (openedMs|ageHours) [^\n]*/g) || ["(keine Zeile)"]).join(" | ").slice(0, 150));
        // Die zwei ENTSCHEIDUNGSZEILEN muessen unveraendert dastehen: ein
        // unbekanntes Alter darf NICHT in den Exit laufen, und der Riegel vom
        // 19.08. (ohne Zeit wird NICHT geschlossen) bleibt.
        torPruefung("im Capital-Zeit-Exit fehlt der `== null`-Riegel oder der "
          + "Vergleich — ein unbekanntes Alter wuerde dann schliessen",
          /if \(ageHours == null\) \{/.test(raQ3)
          && /\} else if \(ageHours >= maxHours\) \{/.test(raQ3),
          (raQ3.match(/(if \(ageHours[^\n]*)/g) || ["(keine Zeile)"]).join(" | "));
        // UND DIE ZAHL IM PROMPT. Das ist die zweite Folge, und sie ist die
        // teurere: ein negatives Alter in einem Prompt, der ueber Geld
        // entscheidet. Ein unbekanntes Alter MUSS dort "unbekannt" heissen.
        torPruefung("der KI-Prompt gibt ein unbekanntes Alter nicht als "
          + "`unbekannt` aus — dann steht dort eine erfundene Zahl",
          /Position offen seit: \$\{lage\.ageHours == null \? "unbekannt"/.test(raQ3),
          (raQ3.match(/Position offen seit[^\n]*/) ?? ["(keine Zeile)"])[0].slice(0, 120));
        // Und der GRUND in der Meldung: vorher behauptete sie bei JEDEM
        // unbekannten Alter "Broker liefert keine Eroeffnungszeit" — bei
        // einer Zukunftszeit ist das falsch, er liefert eine.
        torPruefung("die Capital-Meldung nennt den Grund nicht — sie "
          + "behauptete bei JEDEM unbekannten Alter, der Broker liefere keine",
          /alterGrund\(pos\.createdDate, openedMs, Date\.now\(\)\)/.test(raQ3)
          && !/Broker liefert keine `\n?\s*\+ `Eroeffnungszeit/.test(raQ3),
          (raQ3.match(/die Eroeffnungszeit[^\n]*/) ?? ["(keine Zeile)"])[0].slice(0, 100));
        // KEINE ZWEITE FASSUNG mehr: `alterStundenIC` darf im Programm nicht
        // zurueckkommen. GEZAEHLT, nicht gefunden.
        torPruefung("es gibt wieder eine zweite Fassung der Alters-Rechnung",
          (itmQ.match(/alterStundenIC/g) || []).length === 0
          && (raQ3.match(/3_600_000/g) || []).length === 0,
          `IC=${(itmQ.match(/alterStundenIC/g) || []).length} `
          + `risk-agent=${(raQ3.match(/3_600_000/g) || []).length}`);
      }
      // UND DIE AUFRUFSTELLE. Eine gerechnete Funktion beweist nichts ueber
      // ihre Verdrahtung — die Lehre vom 30.09.
      torPruefung("die Aufrufstelle rechnet das Alter wieder selbst, statt "
        + "`alterStunden` aus `lib/alter` zu benutzen",
        /const openedMs = pos\.openTime === null \? NaN : new Date\(pos\.openTime\)\.getTime\(\);/.test(itmQ)
        && /const ageHours: number \| null = alterStunden\(openedMs, Date\.now\(\)\);/.test(itmQ)
        && !/new Date\(pos\.openTime \?\? Date\.now\(\)\)/.test(itmQ),
        (itmQ.match(/const (openedMs|ageHours)[^\n]*/g) || ["(keine Zeile)"]).join(" | ").slice(0, 150));
      // Und der GRUND gehoert in die Meldung — drei Lagen, drei naechste
      // Schritte. GEZAEHLT, nicht gefunden.
      // ── DIE WORTE LIEGEN JETZT IM GEMEINSAMEN MODUL (08.11., 2. Runde) ──
      //
      // Hier stand `/"FEHLT"/.test(itmQ) && /ist unlesbar \(\$\{pos\.openTime\}\)/…`
      // — also die Worte als Literale in der IC-DATEI. Seit die Rechnung in
      // `lib/alter/alter.ts` liegt, stehen sie dort, und die Pruefung wurde
      // zu Recht rot. Die Worte selbst werden oben GERECHNET (`alterGrund` an
      // fuenf Lagen); hier wird nur noch die VERDRAHTUNG gebunden: die
      // IC-Datei muss `alterGrund` rufen und ihren broker-spezifischen
      // Hinweis anhaengen.
      //
      // Der Hinweis ist nicht Schmuck: fuer cTrader ist NICHT gemessen, ob
      // eine Zone mitkommt (Capital.com schickt keine, 22.09.) — genau
      // deshalb macht diese Zeile die offene Frage aus dem Log heraus
      // beantwortbar.
      torPruefung("der IC-Zeit-Exit holt den Grund nicht aus `alterGrund`, "
        + "oder der cTrader-Hinweis fehlt — `fehlt`, `unlesbar` und `Zukunft` "
        + "fuehren zu drei verschiedenen naechsten Schritten",
        /alterGrund\(pos\.openTime, openedMs, Date\.now\(\)\)/.test(itmQ)
        && /grund\.startsWith\("liegt in der ZUKUNFT"\)/.test(itmQ)
        && /Zeitzone, die cTrader schickt/.test(itmQ)
        && /\$\{grund\}\$\{hinweis\}/.test(itmQ),
        `alterGrund=${/alterGrund\(pos\.openTime/.test(itmQ)} `
        + `Hinweis=${/Zeitzone, die cTrader schickt/.test(itmQ)} `
        + `verdrahtet=${/\$\{grund\}\$\{hinweis\}/.test(itmQ)}`);
    }
    torPruefung("ein unbekanntes Alter laeuft in den Zeit-Exit — es gibt ZWEI "
      + "Zweige, beide brauchen den Riegel",
      (itmQ.match(/ageHours !== null && ageHours >= maxHours/g) || []).length === 2,
      `${(itmQ.match(/ageHours !== null && ageHours >= maxHours/g) || []).length} von 2 Zweigen gesichert`);
    // Ein unbekanntes Alter muss gemeldet werden, und zwar mit EIGENEM
    // Gedaechtnis: teilte es sich den Eintrag mit dem geratenen Stil,
    // verdeckte die erste Meldung die andere Lage (Regel 01.11.).
    // AN DEN RIEGEL SELBST GEBUNDEN, nicht an den Namen irgendwo (08.11.).
    //
    // Hier stand `/alterUnbekanntGemeldetIC/.test(itmQ)` — "steht der Name
    // IRGENDWO in der Datei". Die Sabotage S14 tauschte nur den `.has`-Riegel
    // gegen `gerateneGemeldetIC.has(...)`: Deklaration, `.add`, `.delete` und
    // die Meldung blieben stehen, der Ausdruck war zufrieden, der Pruefer
    // GRUEN. Woertlich "ein Treffer beweist nichts ueber die andere Stelle"
    // (25.10.).
    //
    // Und die Sabotage ist wirksam, nicht harmlos: der Riegel liest dann das
    // falsche Gedaechtnis. Steckt die Position schon in `gerateneGemeldetIC`
    // (geratener Stil), bleibt die Alters-Meldung STUMM; steckt sie nicht
    // drin, wiederholt sie sich bei JEDEM Zyklus, weil `.add` den Riegel
    // nicht mehr beruehrt. Beides sind echte Fehler.
    //
    // Deshalb haengen jetzt alle DREI Stellen namentlich am richtigen
    // Gedaechtnis, und der `.has`-Riegel zusaetzlich an seiner Bedingung.
    const icAlterRiegel = /if \(ageHours === null && !alterUnbekanntGemeldetIC\.has\(positionId\)\) \{/;
    torPruefung("ein unbekanntes IC-Positionsalter bleibt stumm, oder teilt "
      + "sich das Gedaechtnis mit dem geratenen Stil",
      icAlterRiegel.test(itmQ)
      && /alterUnbekanntGemeldetIC\.add\(positionId\);/.test(itmQ)
      && /alterUnbekanntGemeldetIC\.delete\(id\)/.test(itmQ)
      && /^[ \t]*console\.warn\(`\[ic-trade-mgr\] ⚠️ \$\{symbol\} pos=\$\{positionId\}: Eroeffnungszeit/m.test(itmQ),
      (itmQ.match(/if \(ageHours === null[^\n]*/) ?? ["(kein Riegel)"])[0].slice(0, 110));
    // SELBSTPRUEFUNG an GEBAUTEN Zeichenketten, in beide Richtungen — am
    // Dateiinhalt haenge sie an einer Formulierung.
    torPruefung("das Muster erkennt ein geteiltes Gedaechtnis nicht — dann "
      + "bewiese die Zeile darueber nichts",
      icAlterRiegel.test('if (ageHours === null && !alterUnbekanntGemeldetIC.has(positionId)) {')
      && !icAlterRiegel.test('if (ageHours === null && !gerateneGemeldetIC.has(positionId)) {'),
      "Selbstpruefung des Gedaechtnis-Musters");

    // ── DER JOURNAL-SYNC ────────────────────────────────────────────────
    //
    // Ehrlich zur Reichweite, im Code nachgezaehlt: dieser Wert landet NICHT
    // in der `Trade`-Tabelle (das UPDATE setzt status/result/profitLoss/
    // closePrice/updatedAt/notes). Die erfundene Richtung ging allein in eine
    // LOGZEILE — kein Geld, aber ein Log ist das Werkzeug, mit dem man die
    // naechste Ursache sucht.
    const ijQ = read("frontend/lib/icmarkets/icmarkets-journal-sync.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("der IC-Journal-Sync erfindet wieder eine Richtung",
      !/\?\?\s*"BUY"/.test(ijQ)
      && /direction: lesbareRichtung\(d\.tradeSide \?\? d\.direction\)/.test(ijQ)
      && /direction: string \| null;/.test(ijQ),
      (ijQ.match(/direction[^\n,;]*/g) || ["(keine Zeile)"]).slice(0, 3).join(" | "));
    torPruefung("die IC-Logzeile schreibt die rohe Richtung — eine fehlende "
      + "waere dort wieder unsichtbar",
      /richtungAnzeige\(deal\.direction\)/.test(ijQ),
      (ijQ.match(/console\.log\(`\[ic-journal-sync\][^\n]*/) ?? ["(keine Zeile)"])[0].slice(0, 110));

    // ── DIE UNGEPRUEFTE GRENZE: die zwei Execute-Routen (08.11.) ─────────
    //
    // `request.json()` ist `any`, und `as Partial<ExecutionRequest>` prueft
    // NICHTS — `!body.direction` wies nur leere Werte ab. `{"direction":
    // "LONG"}` kam durch, weiter innen ist `req.direction === "BUY"` dann
    // `false` (als SELL gerechnet) und "LONG" ginge ausserdem ins Journal
    // bzw. als `tradeSide` an den Broker.
    //
    // Wortgleiche Klasse wie `PATCH /api/trades/[id]` (04.11., `c0e0f49`) —
    // der Fix dort deckte die LESER und den PATCH, diese zwei Routen nicht.
    //
    // GEZAEHLT, nicht gefunden: BEIDE Routen, sonst bewiese ein Treffer
    // nichts ueber die andere (25.10.).
    {
      const routen = [
        "frontend/app/api/capital-com/execute/route.ts",
        "frontend/app/api/icmarkets/execute/route.ts",
      ];
      let gesichert = 0;
      const lage = [];
      for (const r of routen) {
        const q = read(r).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
        const ok = /const richtung = lesbareRichtung\(body\.direction\);/.test(q)
          && /if \(!richtung\) \{/.test(q)
          && /status: 400/.test(q)
          && /direction: richtung,/.test(q)
          && !/direction: body\.direction,/.test(q);
        if (ok) gesichert++;
        lage.push(`${r.split("/").slice(-3, -1).join("/")}=${ok ? "ok" : "OFFEN"}`);
      }
      torPruefung("eine Order-Route nimmt eine ungepruefte Richtung an — "
        + "`{\"direction\":\"LONG\"}` wuerde als SELL gerechnet",
        gesichert === 2, `${gesichert} von 2 gesichert (${lage.join(", ")})`);
      // SELBSTPRUEFUNG: erkennt das Muster den alten Zustand ueberhaupt?
      const altErkannt = /direction: body\.direction,/.test("      direction: body.direction,");
      torPruefung("das Muster erkennt die ungepruefte Durchreichung nicht — "
        + "dann bewiese die Zeile darueber nichts",
        altErkannt === true, "Selbstpruefung des Routen-Musters");
    }

    // ── EINE DATEI OHNE TYPPRUEFUNG BEWEIST NICHTS UEBER SICH (08.11.) ───
    //
    // `/api/forward-testing/route.ts` trug `ts-nocheck`. Damit konnte `tsc`
    // zu dieser Datei nichts sagen — auch nicht zum Richtungs-Fix vom 04.11.,
    // der dort steht. Die Deklaration log an vier Stellen; `accountSize`
    // FEHLTE ganz, obwohl die Datei es liest.
    //
    // Die Route ist LIVE: `app/page.tsx` und `ForwardTestingCenter.tsx`
    // rufen sie (die `.next/types`-Treffer sind generiert und zaehlen nicht,
    // Regel 15.09.).
    {
      const ftRoh = read("frontend/app/api/forward-testing/route.ts");
      const nocheck = /@ts-nocheck/;
      torPruefung("die Typpruefung ist in /api/forward-testing wieder "
        + "abgeschaltet — dann sagt `tsc` zu dieser Datei NICHTS",
        !nocheck.test(ftRoh),
        (ftRoh.match(/[^\n]*@ts-nocheck[^\n]*/g) || ["(kein Treffer)"]).join(" | "));
      torPruefung("das ts-nocheck-Muster erkennt die Direktive nicht",
        nocheck.test("// @ts-nocheck") === true,
        "Selbstpruefung des ts-nocheck-Musters");
      // Und die Spalte, die gefehlt hat, muss im Zeilentyp stehen — sonst
      // waere `t.accountSize` wieder ein Feldname aus dem Gedaechtnis.
      const ftQ = ftRoh.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
      torPruefung("der Zeilentyp in /api/forward-testing kennt `accountSize` "
        + "nicht, obwohl die Datei es liest (Fehlerklasse 30.09.)",
        /accountSize: number;/.test(ftQ) && /t\.accountSize/.test(ftQ),
        `Typ=${/accountSize: number;/.test(ftQ)} Leser=${/t\.accountSize/.test(ftQ)}`);
    }
  }

  // ══ EINE ROHE BROKER-ZEIT IN DER GELDTABELLE (08.11.) ═══════════════════
  //
  // `/api/capital-com/sync-journal` holt `/history/transactions` mit EIGENEM
  // `fetch` und ging damit an der Grenze vorbei, an der jede Broker-Zeit
  // umgerechnet wird. Zwei Fehler in einer Zeile:
  //
  //   String(tx.date ?? tx.dateUtc ?? new Date().toISOString())
  //
  //  1. Capital.com schickt Ortszeit OHNE Zone (gemessen 22.09.) — der Wert
  //     landete als `createdAt` in der `Trade`-Tabelle, um den Zonenversatz
  //     verschoben. `/hebel` gruppiert seit dem 03.11. nach genau diesem Feld
  //     und nennt die Dimension "Eroeffnungsstunde (UTC)".
  //  2. Fehlte die Angabe, wurde JETZT erfunden.
  //
  // AUSGEFUEHRT, nicht am Wortlaut: die ECHTE `POST` laeuft gegen einen
  // gefaelschten `fetch` und einen Datenbank-SPION, aber mit dem ECHTEN
  // `brokerZeitNachUtc`. Geprueft wird, was im INSERT ANKOMMT.
  {
    const ccEcht = ladeTsModul("lib/capital-com/capital-com-client.ts", {
      "richtung/richtung": ladeTsModul("lib/richtung/richtung.ts").exports,
      "zeitmessung/zeitmessung": { zeitstempelMessen: () => {}, hatZone: () => false },
    });
    const NR = { json: (body, init) => ({ __body: body, status: init?.status ?? 200 }) };
    const geschrieben = [];
    const sj = ladeTsModul("app/api/capital-com/sync-journal/route.ts", {
      "next/server": { NextResponse: NR },
      "capital-com/capital-com-session": {
        isCapitalConnected: () => true,
        getCapitalSession: () => ({ apiKey: "k", cst: "c", securityToken: "s", balance: 2000 }),
      },
      "lib/prisma": {
        getPrisma: () => ({
          $queryRawUnsafe: async () => [],
          $executeRawUnsafe: async (sql, ...args) => { geschrieben.push({ sql, args }); return 1; },
        }),
      },
      // DAS ECHTE Modul — sonst messe ich einen Stellvertreter statt der
      // Zonen-Umrechnung. Genau diese Falle hat am 31.10. einen Pruefstand
      // wertlos gemacht.
      "capital-com/capital-com-client": ccEcht.exports,
      "capital-com/capital-trade-tracker": { notizenNachSync: () => "{}" },
    });
    if (sj.fehler || typeof sj.exports?.POST !== "function") {
      funde.push(`sync-journal-Route nicht ausfuehrbar: ${sj.fehler ?? "POST fehlt"}`);
      zusatz++;
    } else {
      const echtesFetch = global.fetch;
      const fahre = async (txListe) => {
        geschrieben.length = 0;
        global.fetch = async (url) => {
          const u = String(url);
          const leib = u.includes("/history/transactions")
            ? { transactions: txListe }
            : { positions: [] };
          return { ok: true, status: 200, json: async () => leib, text: async () => JSON.stringify(leib) };
        };
        try {
          const r = await sj.exports.POST({ json: async () => ({}) });
          return { antwort: r, zeilen: geschrieben.slice() };
        } finally { global.fetch = echtesFetch; }
      };
      const tx = (felder) => ({
        transactionType: "TRADE", dealId: "D1", instrumentName: "EURUSD",
        size: "12.50", ...felder,
      });
      // Der INSERT ist die Zeile mit `INSERT INTO "Trade"`.
      const insertVon = (zeilen) => zeilen.find((z) => /INSERT INTO "Trade"/.test(String(z.sql)));

      // SELBSTPRUEFUNG: legt der Pruefstand ueberhaupt eine Zeile an? Ohne das
      // waere jede Zusicherung darunter eine Null-Aussage.
      const gesund = await fahre([tx({ date: "2026-11-08T07:30:00" })]);
      const ins = insertVon(gesund.zeilen);
      torPruefung("der sync-journal-Pruefstand legt keine Zeile an — jede "
        + "Zusicherung darunter waere eine Null-Aussage",
        gesund.antwort?.__body?.ok === true && ins !== undefined
        && gesund.antwort.__body.neuAngelegt === 1,
        JSON.stringify(gesund.antwort?.__body ?? gesund.antwort).slice(0, 200));

      if (ins) {
        // 1. DIE ZONE. 07:30 Ortszeit (Winter, Europe/Zurich = UTC+1) muss als
        //    06:30 UTC ankommen. Roh durchgereicht waeren es 07:30 — genau der
        //    Fehler, und genau um diese EINE Stunde waere /hebel daneben.
        const datum = ins.args[ins.args.length - 1];
        torPruefung("die Broker-Zeit wird NICHT mehr an der Grenze umgerechnet "
          + "— `createdAt` traegt dann Ortszeit, und /hebel nennt sie UTC",
          String(datum) === "2026-11-08 06:30:00",
          `createdAt=${JSON.stringify(datum)} (erwartet 2026-11-08 06:30:00)`);
        // 2. Der Platzhalter muss dann auch benutzt werden.
        torPruefung("bei bekannter Zeit fehlt der Zeit-Platzhalter im INSERT",
          /\$5,\$6::timestamp,NOW\(\)\)/.test(String(ins.sql).replace(/\s+/g, "")),
          String(ins.sql).slice(-120));
      }

      // 3. SOMMERZEIT: dieselbe Ortszeit im Juli ist UTC+2 → 05:30 UTC. Ein
      //    FESTER Versatz von einer Stunde waere bis zum 29.03. unauffaellig —
      //    genau die Falle, die beim Broker-Zeitfix am 22.09. vermieden wurde.
      const sommer = await fahre([tx({ dealId: "D2", date: "2026-07-15T07:30:00" })]);
      const insS = insertVon(sommer.zeilen);
      torPruefung("die Umrechnung benutzt einen FESTEN Versatz statt der "
        + "Zeitzone — im Sommer ist sie dann eine Stunde daneben",
        insS !== undefined
        && String(insS.args[insS.args.length - 1]) === "2026-07-15 05:30:00",
        `Sommer createdAt=${JSON.stringify(insS?.args?.[insS.args.length - 1])} `
        + `(erwartet 2026-07-15 05:30:00)`);

      // 4. Eine Zeit MIT Zone wird nur normalisiert, nicht ein zweites Mal
      //    verschoben. Gegenprobe zur Umrechnung.
      const mitZone = await fahre([tx({ dealId: "D3", date: "2026-11-08T06:30:00Z" })]);
      const insZ = insertVon(mitZone.zeilen);
      torPruefung("eine Broker-Zeit MIT Zone wird ein zweites Mal verschoben",
        insZ !== undefined
        && String(insZ.args[insZ.args.length - 1]) === "2026-11-08 06:30:00",
        `createdAt=${JSON.stringify(insZ?.args?.[insZ.args.length - 1])}`);

      // 5. FEHLT die Zeit, darf KEINE erfunden werden: der INSERT nimmt dann
      //    `NOW()` und ein Argument WENIGER, und die Zahl wird gemeldet.
      const ohne = await fahre([tx({ dealId: "D4" })]);
      const insO = insertVon(ohne.zeilen);
      const sqlO = String(insO?.sql ?? "").replace(/\s+/g, "");
      torPruefung("eine fehlende Broker-Zeit wird wieder erfunden — die Zeile "
        + "saehe aus, als waere sie gerade eben eroeffnet worden",
        insO !== undefined && /\$5,NOW\(\),NOW\(\)\)/.test(sqlO)
        && insO.args.length === 5,
        `args=${insO?.args?.length} sql=${sqlO.slice(-60)}`);
      torPruefung("die fehlende Broker-Zeit wird nicht GEZAEHLT und nicht "
        + "gemeldet — ein stummer Ausfall saehe wie ein gesunder Lauf aus",
        ohne.antwort?.__body?.ohneBrokerZeit === 1
        && /OHNE Broker-Zeit/.test(String(ohne.antwort?.__body?.message ?? "")),
        JSON.stringify(ohne.antwort?.__body ?? {}).slice(0, 220));
      // 6. GEGENPROBE: bei BEKANNTER Zeit darf die Meldung NICHT anschlagen —
      //    sonst waere sie nur "immer rot" (Lehre vom 15.09.).
      torPruefung("die Meldung schlaegt auch bei bekannter Zeit an",
        gesund.antwort?.__body?.ohneBrokerZeit === 0
        && !/OHNE Broker-Zeit/.test(String(gesund.antwort?.__body?.message ?? "")),
        JSON.stringify(gesund.antwort?.__body?.message ?? "").slice(0, 160));
    }

    // Und strukturell: der Import der Grenze muss da sein, die Erfindung weg.
    const sjQ = read("frontend/app/api/capital-com/sync-journal/route.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("die sync-journal-Route holt die Broker-Zeit nicht mehr ueber "
      + "`brokerZeitNachUtc`, oder erfindet wieder eine",
      /import \{ brokerZeitNachUtc \}/.test(sjQ)
      && /brokerZeitNachUtc\(tx\.date \?\? tx\.dateUtc\)/.test(sjQ)
      && !/new Date\(\)\.toISOString\(\)\)\.slice\(0, 19\)/.test(sjQ),
      (sjQ.match(/const (utcIso|dateStr)[^\n]*/g) || ["(keine Zeile)"]).join(" | ").slice(0, 150));
  }

  // ══ DER IC-JOURNAL-SYNC ERFINDET AUCH KEINE SCHLUSSZEIT MEHR (08.11.) ═══
  //
  // `closeTime` ging als `notes.icClosedAt` in die DATENBANK. Ein Datensatz,
  // der eine Zeit behauptet, die es nicht gab, ist schlimmer als ein Log, der
  // es tut: Logs sind nach Tagen weg, Datensaetze liest man Monate spaeter.
  // Fehlt die Zeit, wird der SCHLUESSEL weggelassen — wie bei `dealId`.
  {
    const ijQ2 = read("frontend/lib/icmarkets/icmarkets-journal-sync.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("der IC-Journal-Sync erfindet wieder eine Schlusszeit",
      /closeTime: zeitOderNull\(d\.closeTime \?\? d\.closeTimestamp\)/.test(ijQ2)
      && /closeTime: string \| null;/.test(ijQ2)
      && !/closeTime[^\n]*new Date\(\)\.toISOString\(\)/.test(ijQ2),
      (ijQ2.match(/closeTime[^\n,;]*/g) || ["(keine Zeile)"]).slice(0, 3).join(" | "));
    torPruefung("bei fehlender Schlusszeit wird der Schluessel `icClosedAt` "
      + "trotzdem geschrieben — dann steht eine erfundene Zeit im Datensatz",
      /\.\.\.\(deal\.closeTime === null \? \{\} : \{ icClosedAt: deal\.closeTime \}\)/.test(ijQ2),
      (ijQ2.match(/icClosedAt[^\n,]*/g) || ["(keine Zeile)"]).join(" | "));
    // EINE Umsetzung, nicht zwei: `zeitOderNull` kommt aus dem Client.
    torPruefung("`zeitOderNull` ist zweimal umgesetzt statt einmal importiert",
      /import \{ icGetDeals, zeitOderNull \} from "\.\/icmarkets-client"/.test(ijQ2)
      && !/function zeitOderNull/.test(ijQ2),
      (ijQ2.match(/import \{[^\n]*icmarkets-client[^\n]*/) ?? ["(kein Import)"])[0]);
  }

  // ══ UND DIE UNERREICHBARE STELLE IM CAPITAL-CLIENT (08.11.) ═════════════
  //
  // `capitalGetClosedPositions` trug weiter `?? "BUY"`. Nachgezaehlt, nicht
  // vermutet: importiert in `capital-trade-tracker.ts`, aber im ganzen
  // Programm NIE aufgerufen. Ein nie gerufener Rumpf mit einer bekannt
  // falschen Zeile ist eine Falle fuer den Naechsten — und der `as`-Cast
  // schaltet genau die Warnung ab, die ihn aufhalten wuerde.
  {
    const ccQ3 = read("frontend/lib/capital-com/capital-com-client.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    torPruefung("`capitalGetClosedPositions` erfindet wieder eine Richtung",
      /direction: lesbareRichtung\(details\.direction\)/.test(ccQ3)
      && !/\(details\.direction as "BUY" \| "SELL"\) \?\? "BUY"/.test(ccQ3),
      (ccQ3.match(/direction: [^\n,]*details\.direction[^\n,]*/g) || ["(keine Zeile)"]).join(" | "));
    // ── AN DEN AUSGESCHNITTENEN RUMPF GEBUNDEN (08.11.) ────────────────
    //
    // Hier stand `/direction: "BUY" \| "SELL" \| null;/.test(ccQ3)` — also
    // "steht das IRGENDWO in der Datei". `OpenPosition.direction` ist seit
    // dem 07.11. GENAUSO deklariert: nimmt man die Dreiwertigkeit aus
    // `ClosedPositionRecord`, bleibt die andere stehen und der Ausdruck ist
    // zufrieden. Die Sabotage S35 blieb damit GRUEN — zum dritten Mal an
    // einem Tag "ein Treffer beweist nichts ueber die andere Stelle"
    // (25.10.), diesmal in meiner eigenen neuen Pruefung.
    //
    // `tsc` faengt den Rueckbau zwar (TS2322, genau wie beim Einbau) — aber
    // eine Pruefung, die etwas ueber DIESEN Typ behauptet, muss es halten.
    const rumpfVon = (quelle, name) => {
      const i = quelle.indexOf(`export interface ${name} {`);
      if (i < 0) return null;
      let tiefe = 0;
      for (let j = quelle.indexOf("{", i); j < quelle.length; j++) {
        if (quelle[j] === "{") tiefe++;
        else if (quelle[j] === "}") { tiefe--; if (tiefe === 0) return quelle.slice(i, j + 1); }
      }
      return null;
    };
    const rumpfClosed = rumpfVon(ccQ3, "ClosedPositionRecord");
    const rumpfOpen = rumpfVon(ccQ3, "OpenPosition");
    // SELBSTPRUEFUNG des Schnitts: jeder Rumpf muss sein EIGENES Feld
    // enthalten und das des anderen NICHT. Ohne das koennte der Schnitt
    // beide Rumpfe umfassen und die Zeile darunter bewiese wieder nichts.
    torPruefung("der Interface-Schnitt im Capital-Client trifft nicht die "
      + "richtigen Rumpfe — dann beweist die Dreiwertigkeits-Pruefung nichts",
      rumpfClosed !== null && rumpfOpen !== null
      && /closeLevel/.test(rumpfClosed) && !/stopLevel/.test(rumpfClosed)
      && /stopLevel/.test(rumpfOpen) && !/closeLevel/.test(rumpfOpen),
      `closed=${rumpfClosed ? rumpfClosed.length : "?"} open=${rumpfOpen ? rumpfOpen.length : "?"}`);
    torPruefung("`ClosedPositionRecord.direction` ist nicht mehr dreiwertig",
      rumpfClosed !== null && /direction: "BUY" \| "SELL" \| null;/.test(rumpfClosed),
      (rumpfClosed ?? "").match(/direction[^\n;]*;/)?.[0] ?? "(kein Rumpf)");
    // UND die Schwester, damit der Fix vom 07.11. nicht still zurueckgebaut
    // wird. GEZAEHLT ueber zwei getrennte Rumpfe statt einmal gefunden.
    torPruefung("`OpenPosition.direction` ist nicht mehr dreiwertig — der "
      + "Fix vom 07.11. waere damit still zurueckgebaut",
      rumpfOpen !== null && /direction: "BUY" \| "SELL" \| null;/.test(rumpfOpen),
      (rumpfOpen ?? "").match(/direction[^\n;]*;/)?.[0] ?? "(kein Rumpf)");
    // GEZAEHLT, nicht gefunden: im ganzen Client darf KEIN `?? "BUY"` mehr
    // stehen. Ein Treffer an einer Stelle bewiese nichts ueber die andere.
    torPruefung("irgendwo im Capital-Client steht wieder ein `?? \"BUY\"`",
      (ccQ3.match(/\?\?\s*"BUY"/g) || []).length === 0,
      `${(ccQ3.match(/\?\?\s*"BUY"/g) || []).length} Vorkommen`);
  }

  // ══ KEINE ERFUNDENE KONTONUMMER IM DASHBOARD (09.11.) ═══════════════════
  //
  // `simulateBrokerConnect` und der IC-Zweig von `/api/settings` erzeugten
  // eine ZUFALLSZAHL und speicherten sie als Kontonummer:
  //
  //   const fakeId = `${brokerKey.slice(0, 3)}-DEMO-${Math.random()…}`;
  //
  // Das Dashboard gab sie als "Account ID: CAP-DEMO-847301" aus — direkt
  // neben den ECHTEN Kontostaenden vom Broker. Eine erfundene Zahl, die sich
  // als Messung ausgibt: die Fehlerklasse von `market-health.ts`
  // ("TradingView verbunden, 20 ms") und der zwei falschen Killswitch-Texte
  // (27.09.).
  //
  // EHRLICH EINGEORDNET, gemessen statt vermutet: `connected: true` war KEINE
  // Luege. Die Oberflaeche ruft zuerst den ECHTEN Connect
  // (`/api/capital-com/connect` bzw. `/api/icmarkets/connect`) und `postAction`
  // nur bei `d.ok`. Und KEIN Handelspfad liest `settings.connections` — die
  // Schleifen benutzen `isCapitalConnected()` / `isICMarketsConnected()`
  // (nachgezaehlt: die einzigen Leser sind die Anzeige und der Store selbst).
  // Falsch war allein die NUMMER.
  //
  // Und die echte war DA: beide Routen geben `accountId` zurueck, die
  // Oberflaeche hatte sie in der Hand und gab sie nur nicht weiter.
  //
  // AUSGEFUEHRT, nicht am Wortlaut: `simulateBrokerConnect` wird mit und ohne
  // Nummer gerufen. Geprueft wird der RUECKGABEWERT — und das ist ehrlich
  // benannt: der Store ruft `updateBrokerConnection` INTERN, nicht ueber
  // `exports`, ein Spion dort waere also wirkungslos. Der Rueckgabewert und
  // der gespeicherte Wert stammen aus derselben Variablen (`echteId`), eine
  // Abweichung ist damit ausgeschlossen.
  {
    const st = ladeTsModul("lib/settings/settings-store.ts", {
      // GEMESSEN, nicht geraten: der Store laedt beides DYNAMISCH
      // (`await import("../../app/lib/prisma")`), und schreibt per
      // `$executeRawUnsafe`.
      "lib/prisma": {
        getPrisma: () => ({
          $queryRaw: async () => [],
          $executeRawUnsafe: async () => 1,
        }),
      },
      "telegram-notifications/telegram-sender": { sendTelegram: async () => true },
    });
    const sbc = st.exports?.simulateBrokerConnect;
    if (st.fehler || typeof sbc !== "function") {
      funde.push(`settings-store nicht ausfuehrbar: ${st.fehler ?? "simulateBrokerConnect fehlt"}`);
      zusatz++;
    } else {
      const mitNummer = await sbc("CAPITAL_COM", "12345678", "DEMO", "EX-4711-REAL");
      const ohneNummer = await sbc("CAPITAL_COM", "12345678", "DEMO", null);
      const leer = await sbc("CAPITAL_COM", "12345678", "DEMO", "   ");
      const ohneArgument = await sbc("CAPITAL_COM", "12345678", "DEMO");
      const kurzerKey = await sbc("CAPITAL_COM", "kurz", "DEMO", "EX-4711-REAL");

      // SELBSTPRUEFUNG: antwortet der Prüfstand ueberhaupt? Sonst saehe jedes
      // `null` unten wie ein greifender Riegel aus.
      torPruefung("der settings-store-Prüfstand antwortet nicht — jede "
        + "Zusicherung darunter waere eine Null-Aussage",
        mitNummer != null && typeof mitNummer.ok === "boolean",
        JSON.stringify(mitNummer));

      torPruefung("der Store erfindet wieder eine Kontonummer — eine "
        + "Zufallszahl stuende dann als `Account ID` neben echten Bestaenden",
        ohneNummer?.accountId === null && leer?.accountId === null
        && ohneArgument?.accountId === null,
        `ohne=${JSON.stringify(ohneNummer?.accountId)} `
        + `leer=${JSON.stringify(leer?.accountId)} `
        + `ohneArg=${JSON.stringify(ohneArgument?.accountId)}`);
      // GEGENPROBE: die ECHTE Nummer muss ankommen — ein Riegel, der alles
      // auf null zieht, loeschte die Anzeige und waere schlimmer als der Fund.
      torPruefung("die echte Kontonummer kommt nicht mehr an — dann zeigt das "
        + "Dashboard gar keine mehr",
        mitNummer?.accountId === "EX-4711-REAL" && mitNummer?.ok === true,
        JSON.stringify(mitNummer));
      // Und der bestehende Riegel bleibt: ein zu kurzer Schluessel verbindet
      // nicht, auch nicht mit einer Nummer.
      torPruefung("ein zu kurzer API-Schluessel verbindet trotzdem",
        kurzerKey?.ok === false && kurzerKey?.accountId === null,
        JSON.stringify(kurzerKey));
    }

    // Strukturell: nirgends mehr `Math.random` als Kontonummer, und die
    // Oberflaeche reicht die echte durch. GEZAEHLT, nicht gefunden (25.10.):
    // drei Stellen gehoeren zusammen, ein Treffer bewiese nichts.
    //
    // KOMMENTARBEREINIGT, weil die neuen Begruendungen die alte Zeile
    // ZITIEREN — ein Wort im Kommentar ist keine Verwendung. Genau daran ist
    // meine erste Zusicherung heute gescheitert.
    const ohneK = (t) => t.replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
    const stQ = ohneK(read("frontend/lib/settings/settings-store.ts"));
    const roQ = ohneK(read("frontend/app/api/settings/route.ts"));
    const uiQ = ohneK(read("frontend/components/SettingsDashboard.tsx"));
    const erfunden = [["settings-store", stQ], ["settings-route", roQ]]
      .filter(([, q]) => /fakeId|Math\.random/.test(q)).map(([n]) => n);
    torPruefung("eine der beiden Stellen erfindet wieder eine Kontonummer",
      erfunden.length === 0, erfunden.join(", ") || "beide sauber");
    // SELBSTPRUEFUNG der Bereinigung: sie darf den Code NICHT verschlucken
    // und den Kommentar NICHT stehenlassen.
    torPruefung("die Kommentar-Bereinigung arbeitet nicht richtig — dann "
      + "beweist die Zeile darueber nichts",
      !/fakeId/.test(ohneK('// const fakeId = "x";'))
      && /fakeId/.test(ohneK('const fakeId = "x";')),
      "Selbstpruefung der Bereinigung");
    torPruefung("die Oberflaeche reicht die ECHTE Kontonummer nicht durch — "
      + "dann bleibt das Feld leer, obwohl die Nummer vorliegt",
      (uiQ.match(/accountId: d\.accountId \?\? null/g) || []).length === 2,
      `${(uiQ.match(/accountId: d\.accountId \?\? null/g) || []).length} von 2 Zweigen`);
    torPruefung("die Route nimmt die Nummer nicht an, oder gibt sie nicht "
      + "weiter an den Store",
      /typeof body\.accountId === "string" \? body\.accountId\.trim\(\) : ""/.test(roQ)
      && /typeof body\.accountId === "string" \? body\.accountId : null/.test(roQ),
      (roQ.match(/body\.accountId[^\n]*/g) || ["(keine Zeile)"]).join(" | ").slice(0, 150));

    // ── UND DIE ERFUNDENE VERBINDUNGSZEIT (09.11.) ───────────────────────
    //
    // `instrumentation.ts` setzte bei einer aus REDIS wiederhergestellten
    // Sitzung `lastConnectedAt: … ?? new Date().toISOString()` — die Anzeige
    // behauptete damit "Connected: <jetzt>", also eine Verbindung, die gerade
    // eben entstanden sei, obwohl sie aus einem gespeicherten Zustand kommt.
    const insQ2 = ohneK(read("frontend/instrumentation.ts"));
    torPruefung("die Verbindungszeit wird wieder erfunden, wenn Redis keine "
      + "mitliefert — die Anzeige behauptet dann `gerade eben verbunden`",
      /lastConnectedAt: icSess\?\.connectedAt \?\? null,/.test(insQ2)
      && !/lastConnectedAt: icSess\?\.connectedAt \?\? new Date\(\)/.test(insQ2),
      (insQ2.match(/lastConnectedAt[^\n]*/g) || ["(keine Zeile)"]).join(" | ").slice(0, 120));
    // Und die Anzeige MUSS `null` vertragen — sonst stuende dort
    // "Invalid Date", der Fehler vom 28.10.
    torPruefung("die Anzeige prueft `lastConnectedAt` nicht mehr, bevor sie "
      + "ein Datum daraus baut — dann steht dort `Invalid Date` (28.10.)",
      /\{c\.lastConnectedAt && \(/.test(uiQ)
      && /new Date\(c\.lastConnectedAt\)\.toLocaleString\(\)/.test(uiQ),
      (uiQ.match(/c\.lastConnectedAt[^\n]*/g) || ["(keine Zeile)"]).slice(0, 2).join(" | "));

    // ── UND DIE KETTE END-TO-END DURCH DIE ECHTE ROUTE (10.11.) ──────────
    //
    // Alles bisher Gepruefte sagt: die Funktion rechnet richtig, und die
    // Feldnamen stehen auf beiden Seiten. Was es NICHT sagt: ob der Wert
    // durch `POST /api/settings` wirklich bis in die Einstellungen kommt.
    // Genau das ist die Fehlerklasse vom 30.09. — "eine gepruefte Funktion,
    // die nie echte Werte bekommt" bzw. "eine Prüfung, die eine Funktion
    // rechnet, beweist nichts ueber ihre Aufrufstelle".
    //
    // Deshalb laeuft hier die ECHTE `POST`-Funktion, und geprueft wird, was
    // `getSettings()` DANACH liefert — also der Wert, den das Dashboard
    // anzeigt. Eine Zusicherung auf den Rueckgabewert allein bewiese nichts
    // ueber den gespeicherten Zustand.
    //
    // GEMESSEN, nicht geraten: die Route importiert STATISCH aus
    // `"../../../lib/settings"` (Index: `export * from "./settings-store"`)
    // und DYNAMISCH aus `"@/lib/settings/settings-store"`. Beide Schluessel
    // muessen gestellt werden — mein erster Entwurf kannte nur den zweiten,
    // und der statische Import bekam den Stellvertreter, der beim Aufruf
    // wirft: zehn Zusicherungen rot, obwohl der Code stimmte.
    {
      const prismaErsatz = {
        getPrisma: () => ({ $queryRaw: async () => [], $executeRawUnsafe: async () => 1 }),
      };
      const tgErsatz = { sendTelegram: async () => true };
      const stM = ladeTsModul("lib/settings/settings-store.ts", {
        "lib/prisma": prismaErsatz,
        "telegram-notifications/telegram-sender": tgErsatz,
      });
      const roM = stM.fehler ? { fehler: stM.fehler } : ladeTsModul("app/api/settings/route.ts", {
        // Der Store wird ECHT hereingereicht — er ist Teil des Prueflings.
        "settings/settings-store": stM.exports,
        "lib/settings": stM.exports,
        "lib/prisma": prismaErsatz,
        "telegram-notifications/telegram-sender": tgErsatz,
        "cache/redis-cache": { cacheSet: async () => true, cacheDel: async () => true },
        "next/server": {
          NextResponse: { json: (k, i) => ({ koerper: k, status: (i && i.status) || 200 }) },
        },
      });
      if (roM.fehler || typeof roM.exports?.POST !== "function") {
        funde.push(`settings-Route nicht ausfuehrbar: ${roM.fehler ?? "POST fehlt"}`);
        zusatz++;
      } else {
        const verbinde = async (rumpf) => {
          const a = await roM.exports.POST({ json: async () => rumpf });
          const s = await stM.exports.getSettings();
          return {
            antwort: a.koerper,
            c: (s.connections || []).find((x) => x.brokerKey === rumpf.brokerKey),
          };
        };
        const e1 = await verbinde({ action: "broker_connect", brokerKey: "CAPITAL_COM",
          apiKey: "pruefstand-key", accountMode: "DEMO", accountId: "EX-4711-REAL" });
        // SELBSTPRUEFUNG: antwortet die Route ueberhaupt? Sonst saehe jedes
        // `null` unten wie ein greifender Riegel aus.
        torPruefung("die settings-Route antwortet nicht brauchbar — jede "
          + "Zusicherung darunter waere eine Null-Aussage",
          e1.antwort?.ok === true && e1.c != null,
          JSON.stringify(e1.antwort).slice(0, 140));
        torPruefung("die echte Kontonummer kommt NICHT bis in die "
          + "Einstellungen — das Dashboard zeigte dann keine",
          e1.antwort?.accountId === "EX-4711-REAL"
          && e1.c?.accountId === "EX-4711-REAL" && e1.c?.connected === true,
          `Antwort ${JSON.stringify(e1.antwort?.accountId)}, gespeichert ${JSON.stringify(e1.c?.accountId)}`);

        const e2 = await verbinde({ action: "broker_connect", brokerKey: "CAPITAL_COM",
          apiKey: "pruefstand-key", accountMode: "DEMO" });
        torPruefung("ohne Nummer wird eine erfunden statt `null` gespeichert",
          e2.antwort?.accountId === null && e2.c?.accountId === null,
          `Antwort ${JSON.stringify(e2.antwort?.accountId)}, gespeichert ${JSON.stringify(e2.c?.accountId)}`);

        const e3 = await verbinde({ action: "broker_connect", brokerKey: "CAPITAL_COM",
          apiKey: "pruefstand-key", accountMode: "DEMO", accountId: 4711 });
        torPruefung("eine ZAHL als Kontonummer wandert in die Einstellungen",
          e3.antwort?.accountId === null && e3.c?.accountId === null,
          `Antwort ${JSON.stringify(e3.antwort?.accountId)}, gespeichert ${JSON.stringify(e3.c?.accountId)}`);

        // Der IC-Zweig ist ein EIGENER Codepfad (er ruft
        // `updateBrokerConnection` direkt, nicht `simulateBrokerConnect`) —
        // ein Treffer dort bewiese nichts ueber ihn (25.10.).
        const e4 = await verbinde({ action: "broker_connect", brokerKey: "IC_MARKETS",
          accountId: "IC-REAL-99" });
        torPruefung("der IC-Zweig reicht die echte Nummer nicht durch",
          e4.antwort?.accountId === "IC-REAL-99" && e4.c?.accountId === "IC-REAL-99",
          `Antwort ${JSON.stringify(e4.antwort?.accountId)}, gespeichert ${JSON.stringify(e4.c?.accountId)}`);
        const e5 = await verbinde({ action: "broker_connect", brokerKey: "IC_MARKETS" });
        torPruefung("der IC-Zweig erfindet ohne Nummer wieder einen Wert",
          e5.antwort?.accountId === null && e5.c?.accountId === null,
          `Antwort ${JSON.stringify(e5.antwort?.accountId)}, gespeichert ${JSON.stringify(e5.c?.accountId)}`);

        // Der bestehende Riegel muss halten: ein zu kurzer Schluessel
        // verbindet nicht, auch nicht mit einer Nummer.
        const e6 = await verbinde({ action: "broker_connect", brokerKey: "CAPITAL_COM",
          apiKey: "kurz", accountMode: "DEMO", accountId: "EX-4711-REAL" });
        torPruefung("ein zu kurzer API-Schluessel verbindet ueber die Route",
          e6.antwort?.ok === false && e6.antwort?.accountId === null
          && e6.c?.connected === false,
          `${JSON.stringify(e6.antwort)} | ${JSON.stringify(e6.c)}`.slice(0, 160));

        // GEGENPROBE ueber ALLE Antworten: nirgends eine erfundene Nummer.
        const alleAntw = [e1, e2, e3, e4, e5, e6].map((x) => JSON.stringify(x.antwort)).join(" ");
        torPruefung("eine Antwort traegt wieder eine erfundene Kontonummer",
          !/"accountId":"[A-Z]{3}-DEMO-\d+"/.test(alleAntw)
          && !/"accountId":"IC-MCP"/.test(alleAntw),
          alleAntw.slice(0, 200));
      }
    }

    // ── UND DIE ERFUNDENE KONTONUMMER "IC-MCP" (09.11.) ──────────────────
    //
    // Gefunden, weil ich nach dem MUSTER weitergesucht habe statt den Fund
    // abzuschliessen: `instrumentation.ts` und der Telegram-Webhook setzten
    // `accountId: … ?? "IC-MCP"` bzw. `|| "IC-MCP"` — eine Konstante, die das
    // Dashboard als "Account ID: IC-MCP" ausgab. Dieselbe Klasse wie die
    // Zufallszahl oben, nur mit einem festen Wert.
    //
    // NACHGEZAEHLT vor der Aenderung: zwei Schreiber, NULL Leser — niemand
    // vergleicht gegen die Zeichenkette, ein Austausch konnte also keine
    // Logik brechen. Und `accountId` ist in `BrokerConnection` als
    // `string | null` deklariert; `null` ist der ehrliche Wert, nicht ein
    // Notbehelf.
    //
    // GEZAEHLT UEBER DAS GANZE PROGRAMM, nicht an einer Datei gefunden: es
    // waren ZWEI Stellen, und ein Treffer bewiese nichts ueber die andere
    // (25.10.). Kommt eine dritte dazu, wird der Prüfer rot.
    {
      const codeDateien = sourceFiles([".ts", ".tsx"])
        .filter((f) => f.startsWith("frontend/")
          && !f.includes("/node_modules/") && !f.includes("/.next/"));
      const stellen = [];
      for (const f of codeDateien) {
        if (/IC-MCP/.test(ohneK(read(f)))) stellen.push(f);
      }
      torPruefung("eine Kontonummer wird wieder als Konstante erfunden "
        + "(`IC-MCP`) — das Dashboard gaebe sie als `Account ID` aus",
        stellen.length === 0,
        stellen.join(", ") || `${codeDateien.length} Dateien, keine Stelle`);
      // SELBSTPRUEFUNG: der Scan muss ueberhaupt Dateien gesehen haben.
      // Null geprueft ist kein sauberes Ergebnis, sondern ein kaputtes
      // Werkzeug — die Lehre vom 22.10.
      torPruefung("der IC-MCP-Scan hat keine Dateien gelesen — jedes "
        + "`keine Stelle` waere eine Null-Aussage",
        codeDateien.length > 300, `${codeDateien.length} Dateien`);
      // Und die beiden Stellen muessen ihren EHRLICHEN Wert tragen. Ohne das
      // bliebe der Scan oben auch gruen, wenn dort ein ANDERER erfundener
      // Wert stuende.
      torPruefung("`instrumentation.ts` traegt nicht mehr `|| null` bei der "
        + "Kontonummer — dann wird dort wieder ein Wert behauptet",
        /accountId: icSess\?\.accountId \|\| null,/.test(insQ2),
        (insQ2.match(/accountId: icSess[^\n]*/g) || ["(keine Zeile)"]).join(" | "));
      const whQ = ohneK(read("frontend/app/api/telegram/webhook/route.ts"));
      torPruefung("der Telegram-Webhook traegt nicht mehr `|| null` bei der "
        + "Kontonummer",
        /accountId: sess\?\.accountId \|\| null,/.test(whQ),
        (whQ.match(/accountId: sess\?\.accountId[^\n]*/g) || ["(keine Zeile)"]).join(" | "));
    }
  }

  return {
    titel: `Sicherheitsnetze (${pruefungen.length + 23 + zusatz} Prüfungen)`,
    funde,
  };
};
