// ─────────────────────────────────────────────────────────────────────────────
// Prüfer 14: Order-Bestätigung und Mindest-Stop-Abstand
//
// ZWEI FUNDE VOM 13.08., beide in capitalPlaceOrder.
//
// A) EINE ORDER GALT ALS ERFOLGREICH, OHNE BESTÄTIGT ZU SEIN.
//    Capital.com verlangt nach dem Absenden einen Bestätigungsschritt
//    (/confirms/{ref}), der erst sagt, ob die Order angenommen wurde. Eine echte
//    Ablehnung wurde korrekt erkannt. Konnte die Bestätigung aber gar nicht
//    gelesen werden — Zeitfehler, HTTP-Fehler, Netzabbruch — fiel der Code
//    durch und meldete `status: "OPENED"`. Ein unbekannter Ausgang sah damit
//    exakt aus wie ein Erfolg, und das System hielt eine Position für offen,
//    über die es nichts wusste.
//
//    ok bleibt bewusst true: die Order KANN live sein, und sie als Fehlschlag
//    zu melden wäre gefährlicher — ein Aufrufer könnte sie erneut senden und
//    die Position verdoppeln. Gemeldet wird die Unsicherheit.
//
// B) DER MINDEST-STOP-ABSTAND DES BROKERS WURDE NIE GELESEN.
//    Capital.com liefert ihn bei jedem Marktabruf in
//    dealingRules.minStopOrProfitDistance mit; ausgewertet wurde nur
//    data.snapshot. Ein zu enger Stop führte zu einer Ablehnung mit einem
//    Fehlercode, den niemand einordnen konnte.
//
//    Die Umrechnung wird NUR für die Einheit PERCENTAGE gemacht, weil sie dort
//    eindeutig ist. Für POINTS hängt sie an der Punktgrösse des Instruments,
//    und die liesse sich hier nur raten — ein geratener Riegel würde gültige
//    Orders abweisen. Dieser Prüfer stellt sicher, dass genau das so bleibt.
// ─────────────────────────────────────────────────────────────────────────────

const { read, ladeTsModul } = require("./_lib");

/**
 * Entfernt NUR Kommentare, lässt Zeichenketten stehen (03.09.).
 *
 * Gebraucht, weil hier SQL-TEXTE geprüft werden — die schärfere Variante
 * (`ohneKommentareUndTexte`) würde sie mitlöschen. Kommentare müssen trotzdem
 * weg: sonst genügte ein erwähnendes Wort, und genau diese Fehlerklasse hat
 * 2026 mehrfach zugeschlagen (siehe CLAUDE.md).
 */
function ohneKommentare(text) {
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

module.exports = function pruefe() {
  const funde = [];
  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  const client = read("frontend/lib/capital-com/capital-com-client.ts");

  // ── A) Bestätigung ────────────────────────────────────────────────────────
  pruefe1("eine nicht lesbare Bestätigung gilt wieder als OPENED",
    /status: dealReference \? "UNBESTAETIGT" : "OPENED"/.test(client));
  pruefe1("der Bestätigungsfehler wird nicht erfasst",
    /let bestaetigungsFehler/.test(client)
    && /bestaetigungsFehler = e instanceof Error/.test(client));
  pruefe1("ein HTTP-Fehler beim Bestätigen wird nicht als solcher vermerkt",
    /bestaetigungsFehler = `HTTP \$\{confirmRes\.status\}`/.test(client));
  pruefe1("die Unsicherheit wird nicht nach aussen gemeldet (unbestaetigt)",
    /unbestaetigt\?: boolean/.test(client) && /unbestaetigt: dealReference \? true/.test(client));
  pruefe1("es wird nicht gewarnt, wenn eine Order unbestätigt bleibt",
    /NICHT bestaetigt/.test(client));
  // ok MUSS true bleiben — sonst droht die doppelte Position.
  //
  // GEAENDERT 19.08.: die Pruefung war am alten Wortlaut festgenagelt
  // (`dealId: String(data.dealId ?? dealReference)`). Genau diese Zeile war
  // aber selbst der Fehler — sie schrieb eine ORDER-Referenz in ein Feld
  // namens dealId, und die passt zu keiner Positions-ID. Geprueft wird jetzt
  // die EIGENSCHAFT statt des Textes, und zwar IM Rueckfall-Block: alles
  // hinter der Warnung "NICHT bestaetigt".
  const rueckfall = client.slice(client.indexOf("NICHT bestaetigt"));
  pruefe1("der Rückfall-Block ist nicht auffindbar", rueckfall.length > 0);
  pruefe1("eine unbestätigte Order wird als Fehlschlag gemeldet — das kann zur "
    + "doppelten Position führen",
    /return \{\s*\n?\s*ok: true,/.test(rueckfall) && !/ok: false/.test(rueckfall.slice(0, 600)));
  pruefe1("die Order-Referenz wird wieder als dealId ausgegeben — sie passt zu "
    + "keiner Positions-ID und macht den Eintrag dauerhaft unauffindbar",
    !/dealId:\s*String\(data\.dealId\s*\?\?\s*dealReference\)/.test(client)
    && !/String\(confirm\.dealId\s*\?\?\s*dealReference\)/.test(client));
  pruefe1("ohne Positions-ID wird die Order nicht als unbestätigt geführt",
    /status: dealId \? "OPENED" : "UNBESTAETIGT"/.test(client),
    "eine angenommene Order ohne dealId ist genauso wenig zuordenbar");
  // Eine echte Ablehnung muss weiterhin hart fehlschlagen.
  pruefe1("eine echte Ablehnung (REJECTED) führt nicht mehr zu ok:false",
    /status === "REJECTED" \|\| status === "DELETED"/.test(client)
    && /return \{ ok: false, error: reason \}/.test(client));

  // ── B) Mindest-Stop-Abstand: die echten Funktionen rechnen ────────────────
  const geladen = ladeTsModul("lib/capital-com/capital-com-client.ts");
  if (geladen.fehler) {
    funde.push(geladen.fehler);
    return { titel: "Order-Bestätigung (nicht ausführbar)", funde };
  }
  const { mindestAbstandAusRegel, stopAbstandGenug } = geladen.exports;

  if (typeof mindestAbstandAusRegel !== "function" || typeof stopAbstandGenug !== "function") {
    funde.push("mindestAbstandAusRegel / stopAbstandGenug werden nicht exportiert — "
      + "der Riegel bleibt ungeprüft");
  } else {
    // PERCENTAGE ist eindeutig und MUSS gerechnet werden.
    pruefe1("PERCENTAGE wird nicht korrekt umgerechnet",
      Math.abs(mindestAbstandAusRegel("PERCENTAGE", 0.1, 100) - 0.1) < 1e-12,
      String(mindestAbstandAusRegel("PERCENTAGE", 0.1, 100)));
    pruefe1("PERCENTAGE in Kleinschreibung wird nicht erkannt",
      Math.abs(mindestAbstandAusRegel("percentage", 2, 50) - 1) < 1e-12);
    // POINTS darf NICHT geraten werden.
    pruefe1("POINTS wird geraten statt übersprungen — ein geratener Riegel "
      + "würde gültige Orders abweisen",
      mindestAbstandAusRegel("POINTS", 5, 100) === null,
      String(mindestAbstandAusRegel("POINTS", 5, 100)));
    for (const [name, a] of [
      ["unbekannte Einheit", ["FOO", 5, 100]],
      ["Wert 0", ["PERCENTAGE", 0, 100]],
      ["Wert negativ", ["PERCENTAGE", -1, 100]],
      ["Wert Text", ["PERCENTAGE", "abc", 100]],
      ["Referenzkurs 0", ["PERCENTAGE", 1, 0]],
      ["alles null", [null, null, 100]],
    ]) {
      pruefe1(`${name} ergibt keinen brauchbaren Wert`,
        mindestAbstandAusRegel(...a) === null, String(mindestAbstandAusRegel(...a)));
    }

    // Der Abstand selbst.
    pruefe1("ein weiter Stop wird fälschlich abgewiesen",
      stopAbstandGenug(99.5, "BUY", 100, 0.1).ok === true);
    pruefe1("ein zu enger Stop wird NICHT abgewiesen",
      stopAbstandGenug(99.95, "BUY", 100, 0.1).ok === false);
    pruefe1("SELL-Richtung wird nicht geprüft",
      stopAbstandGenug(100.05, "SELL", 100, 0.1).ok === false);
    pruefe1("genau auf der Grenze wird abgewiesen (>= muss gelten)",
      stopAbstandGenug(99.9, "BUY", 100, 0.1).ok === true);
    pruefe1("eine Ablehnung nennt keinen Grund",
      (stopAbstandGenug(99.95, "BUY", 100, 0.1).grund || "").length > 10);
    // Ohne belegbare Regel darf NICHTS blockiert werden.
    for (const [name, a] of [
      ["keine Regel", [99.99, "BUY", 100, null]],
      ["Kurs 0", [99.99, "BUY", 0, 0.1]],
      ["Stop NaN", [NaN, "BUY", 100, 0.1]],
    ]) {
      pruefe1(`${name} blockiert die Order fälschlich`,
        stopAbstandGenug(...a).ok === true, JSON.stringify(stopAbstandGenug(...a)));
    }
  }

  // ── Verdrahtung: wird VOR dem Senden geprüft? ─────────────────────────────
  const posPruefung = client.indexOf("stopAbstandGenug(order.stopLevel");
  const posSenden = client.indexOf(`fetch(\`\${DEMO_BASE}/positions\``);
  pruefe1("die Abstandsprüfung fehlt im Bestellpfad", posPruefung > 0);
  pruefe1("die Abstandsprüfung steht NACH dem Absenden der Order",
    posPruefung > 0 && posSenden > 0 && posPruefung < posSenden,
    `Prüfung@${posPruefung} Senden@${posSenden}`);
  pruefe1("eine verletzte Regel verhindert die Order nicht",
    /if \(!urteil\.ok\) \{[\s\S]{0,300}?return \{ ok: false/.test(client));
  pruefe1("die Regel wird nicht beim Broker geholt",
    /capitalMarktRegeln\(apiKey, cst, securityToken, order\.epic\)/.test(client));
  // LESEN und SCHREIBEN einzeln prüfen, nicht nur ob der Name vorkommt.
  // Im Sabotage-Lauf liess sich der Lesezugriff ersetzen, während set() und
  // die Konstante stehen blieben — der Zwischenspeicher wäre dann tot gewesen
  // und jeder Zyklus hätte den Broker erneut gefragt. Dieselbe Schwäche wie
  // heute schon dreimal: geprüft wurde Vorhandensein statt Benutzung.
  pruefe1("aus dem Regel-Zwischenspeicher wird nicht gelesen — der "
    + "Positions-Monitor läuft alle zwei Minuten",
    /regelCache\.get\(epic\)/.test(client) && /zwischen\.bis > Date\.now\(\)/.test(client));
  pruefe1("in den Regel-Zwischenspeicher wird nicht geschrieben",
    /regelCache\.set\(epic,/.test(client) && /REGEL_TTL_MS/.test(client));
  pruefe1("eine nicht umrechenbare Einheit wird nicht sichtbar gemacht",
    /nicht umrechenbar/.test(client));

  // ── C) Wird die Unsicherheit auch VERWERTET? (17.08.) ────────────────────
  //
  // ANLASS: unbestaetigt wurde eingefuehrt, aber von NIEMANDEM gelesen —
  // exakt die Fehlerklasse, die beim AI Manager (aiReason) am selben Tag
  // behoben wurde. Ein Feld zu setzen, das niemand auswertet, sieht aus wie
  // Schutz und ist keiner.
  //
  // Die Folge war nachgewiesen: ein Trade-Eintrag entsteht bei ok:true, also
  // auch bei unbestaetigter Order. Gab es die Position nie, findet der Tracker
  // sie nicht, versucht fuenfmal den P&L zu holen und schliesst sie dann als
  // BREAKEVEN mit P&L 0 — ohne Ausstiegsgrund und damit ununterscheidbar von
  // einem echten Nulltrade. Genau die Statistik, aus der die Exit-Schwellen
  // ihre Antwort ziehen sollen.
  const exec = read("frontend/lib/capital-com/capital-com-execution.ts");
  const tracker = read("frontend/lib/capital-com/capital-trade-tracker.ts");
  const bericht = read("analysis-engine/services/periodic_report.py");

  pruefe1("ExecutionResult kennt unbestaetigt nicht",
    /unbestaetigt\?: boolean/.test(exec));
  pruefe1("executeCapitalDemoOrder reicht unbestaetigt nicht durch",
    /unbestaetigt: result\.unbestaetigt/.test(exec));
  pruefe1("TradeRecord kennt unbestaetigt nicht",
    /unbestaetigt\?: boolean/.test(tracker));
  pruefe1("die Notizen des Trades tragen unbestaetigt nicht",
    /trade\.unbestaetigt \? \{ unbestaetigt: true \}/.test(tracker));

  // Alle DREI Speicherstellen muessen es mitgeben — eine zu vergessen hiesse,
  // dass Phantom-Trades aus genau diesem Pfad unerkannt bleiben.
  let stellen = 0;
  for (const datei of [
    "frontend/app/api/auto-execute/route.ts",
    "frontend/app/api/capital-com/execute/route.ts",
    "frontend/lib/agents/orchestrator-agent.ts",
  ]) {
    if (/unbestaetigt: result\?\.unbestaetigt/.test(read(datei))) stellen++;
  }
  pruefe1("nicht alle drei Speicherstellen geben unbestaetigt mit",
    stellen === 3, `${stellen} von 3`);

  // Und der Tracker muss daraus wirklich etwas machen.
  pruefe1("der Tracker unterscheidet einen Phantom-Trade nicht",
    /m\.unbestaetigt === true/.test(tracker));
  // Auf die ZUWEISUNG pruefen, nicht auf das Wort: "NIE_BESTAETIGT" steht
  // auch im Kommentar und in beiden Logzeilen. Im Sabotage-Lauf liess sich die
  // Zuweisung deshalb streichen, ohne dass etwas rot wurde.
  pruefe1("der Phantom-Trade bekommt keinen eigenen Ausstiegsgrund",
    /m\.exitReason = phantom \? "NIE_BESTAETIGT" : "KEIN_PNL"/.test(tracker));
  // Das VOLLSTAENDIGE UPDATE pruefen: der Wiederholungs-Zweig darueber
  // enthaelt ebenfalls "notes" = $1 mit JSON.stringify(m) und liess das
  // urspruengliche Muster gruen bleiben, obwohl der Grund nie gespeichert wurde.
  pruefe1("der Ausstiegsgrund wird beim Schliessen nicht mitgeschrieben",
    /'BREAKEVEN', "profitLoss" = 0, "notes" = \$1/.test(tracker));
  pruefe1("ein Phantom-Trade wird nicht als solcher gemeldet",
    /PHANTOM/.test(tracker));
  // Auf die REIHENFOLGE-Liste pruefen: "NIE_BESTAETIGT" steht auch im
  // Kommentar und im Hinweistext darunter.
  pruefe1("der Wochenreport sortiert die neuen Gruppen nicht ein",
    /"NIE_BESTAETIGT",\s*"KEIN_PNL",\s*"UNBEKANNT"\]/.test(bericht));
  pruefe1("der Wochenreport erklaert NIE_BESTAETIGT nicht",
    /NIE_BESTAETIGT = die Order wurde abgeschickt/.test(bericht));

  // ── D) Ausstiegsgrund: wird er ueberall geschrieben? (17.08.) ────────────
  //
  // NACHGEWIESEN am Wochen-Report vom 16.08.: der Abschnitt "Nach
  // Ausstiegsgrund" fehlte GANZ, sieben Tage nach seinem Einbau — kein
  // einziger Trade hatte einen. Die Ursache war eine Kette:
  //   sync-journal setzte status CLOSED mit result 'CLOSED' (kein gueltiges
  //   Ergebnis), ohne P&L und ohne Grund. Damit war der Trade dem Tracker
  //   entzogen, denn der sieht nur status = 'OPEN'. Der P&L-Nachtrag holte
  //   Ergebnis und P&L spaeter nach — den Grund aber nie.
  const geladenT = ladeTsModul("lib/capital-com/capital-trade-tracker.ts");
  if (geladenT.fehler) {
    funde.push(geladenT.fehler);
  } else {
    const a = geladenT.exports.ausstiegsgrund;
    if (typeof a !== "function") {
      funde.push("ausstiegsgrund wird nicht exportiert — die Ableitung bleibt ungeprüft");
    } else {
      pruefe1("Schluss am Ziel wird nicht als ZIEL erkannt",
        a(119, 100, 120).exitReason === "ZIEL", JSON.stringify(a(119, 100, 120)));
      pruefe1("Schluss am Stop wird nicht als STOP erkannt",
        a(101, 100, 120).exitReason === "STOP");
      pruefe1("Schluss in der Mitte wird nicht als DAZWISCHEN erkannt",
        a(110, 100, 120).exitReason === "DAZWISCHEN");
      // SELL: das Ziel liegt UNTER dem Stop, die Spanne ist negativ.
      pruefe1("SELL-Richtung wird falsch eingeordnet",
        a(101, 120, 100).exitReason === "ZIEL", JSON.stringify(a(101, 120, 100)));
      pruefe1("ohne Schlusskurs wird nicht KEIN_SCHLUSSKURS gemeldet",
        a(null, 100, 120).exitReason === "KEIN_SCHLUSSKURS");
      // JENSEITS des Stops geschlossen — Schlupf oder Kursluecke. Erst hier
      // wird exitPosition NEGATIV, und erst hier faellt auf, wenn jemand den
      // Betrag nimmt: aus -0,25 wuerde +0,25 und aus STOP damit DAZWISCHEN.
      // Im Sabotage-Lauf (17.08.) rutschte genau das durch, weil alle meine
      // Faelle innerhalb der Spanne lagen.
      pruefe1("BUY jenseits des Stops wird nicht als STOP gewertet",
        a(95, 100, 120).exitReason === "STOP", JSON.stringify(a(95, 100, 120)));
      pruefe1("SELL jenseits des Stops wird nicht als STOP gewertet",
        a(125, 120, 100).exitReason === "STOP", JSON.stringify(a(125, 120, 100)));
      pruefe1("exitPosition wird jenseits des Stops nicht negativ",
        a(95, 100, 120).exitPosition < 0, String(a(95, 100, 120).exitPosition));
      // Und ueber dem Ziel hinaus muss es weiterhin ZIEL bleiben.
      pruefe1("BUY ueber dem Ziel wird nicht als ZIEL gewertet",
        a(130, 100, 120).exitReason === "ZIEL", JSON.stringify(a(130, 100, 120)));
      for (const [name, args] of [
        ["Stop = Ziel", [110, 100, 100]],
        ["Schlusskurs NaN", [NaN, 100, 120]],
        ["Spanne NaN", [110, NaN, 120]],
      ]) {
        const r = a(...args);
        pruefe1(`${name} ergibt keinen brauchbaren Grund`,
          r.exitReason === "UNBEKANNT" || r.exitReason === "KEIN_SCHLUSSKURS",
          JSON.stringify(r));
      }
      // Die Toleranz ist die einzige gewaehlte Zahl — sie muss stimmen.
      pruefe1("die 5%-Toleranz am Ziel greift nicht",
        a(119.0, 100, 120).exitReason === "ZIEL" && a(118.9, 100, 120).exitReason === "DAZWISCHEN");
    }
  }

  const tracker2 = read("frontend/lib/capital-com/capital-trade-tracker.ts");
  const sync = read("frontend/app/api/capital-com/sync-journal/route.ts");
  const syncC = ohneKommentare(sync);

  pruefe1("der Hauptpfad leitet den Grund nicht mehr ab",
    /const \{ exitPosition, exitReason \} = ausstiegsgrund\(/.test(tracker2));
  pruefe1("der P&L-Nachtrag schreibt den Ausstiegsgrund nicht mit",
    /notizen\.exitReason = grund\.exitReason/.test(tracker2));
  pruefe1("der Nachtrag speichert die Notizen nicht",
    /SET "result" = \$1, "profitLoss" = \$2, "notes" = \$3/.test(tracker2));
  pruefe1("der Nachtrag holt stopLoss und takeProfit nicht",
    /SELECT "id","market","entry","notes","stopLoss","takeProfit"/.test(tracker2));
  // ── EIGENSCHAFT statt WORTLAUT (02.09.) ─────────────────────────────────
  //
  // Hier stand `/if \(!notizen\.exitReason\)/` — der festgenagelte Wortlaut
  // EINER Zeile. Als der Nachtrag am 02.09. praeziser wurde, meldete diese
  // Pruefung die KORREKTUR als Regression. Genau die dritte Falle aus
  // CLAUDE.md: pruefe die Eigenschaft, nicht den Text.
  //
  // DER GRUNDSATZ IST UNVERAENDERT und wird jetzt RECHNEND belegt: ein echter
  // Grund aus dem Hauptpfad (ZIEL/STOP/DAZWISCHEN, aus dem Schlusskurs
  // abgeleitet) darf vom Nachtrag NIE ueberschrieben werden. Neu erlaubt ist
  // ausschliesslich das Ersetzen von "NIE_BESTAETIGT" und "KEIN_PNL" — beide
  // behaupten "kein Ergebnis bekannt", und ein gefundener echter P&L widerlegt
  // genau das.
  pruefe1("die Bedingung des Nachtrags fehlt — er ueberschriebe jeden Grund",
    /if \(!notizen\.exitReason \|\| etikettWiderlegt\(notizen\.exitReason\)\)/.test(tracker2));
  const wF = geladenT.exports && geladenT.exports.etikettWiderlegt;
  if (typeof wF !== "function") {
    funde.push("etikettWiderlegt wird nicht exportiert — welche Gruende "
      + "ueberschrieben werden duerfen, bleibt ungeprueft");
  } else {
    for (const echt of ["ZIEL", "STOP", "DAZWISCHEN", "UNBEKANNT", "KEIN_SCHLUSSKURS"]) {
      pruefe1(`ein echter Grund (${echt}) darf ueberschrieben werden`,
        wF(echt) === false);
    }
    for (const leer of ["NIE_BESTAETIGT", "KEIN_PNL"]) {
      pruefe1(`"${leer}" behauptet kein Ergebnis, bleibt aber stehen`,
        wF(leer) === true);
    }
    pruefe1("Schreibweise/Leerzeichen heben den Ersatz auf",
      wF(" nie_bestaetigt ") === true);
    pruefe1("ein leerer Grund gilt als echter Grund",
      wF("") === false && wF(null) === false && wF(undefined) === false);
    pruefe1("ein unbekanntes Etikett wird vorsichtshalber ueberschrieben",
      wF("IRGENDWAS") === false);
  }

  // DIE WURZEL: der Vermerk "Position beim Broker weg" darf NICHT abschliessen.
  //
  // Hier stand `!/SET "status" = 'CLOSED'/` — auf die ganze Datei und mit
  // festen Leerzeichen um das Gleichheitszeichen. Beides zu schwach: Schritt 3
  // schliesst sehr wohl Trades (mit echtem P&L, das ist gewollt), und ein
  // entferntes Leerzeichen haette den Riegel ausgehebelt. Geprueft wird jetzt
  // der BLOCK um `brokerPositionWeg` — dort und nur dort gilt: melden, nicht
  // entscheiden (17.08.).
  pruefe1("der Vermerk 'Position beim Broker weg' schreibt nicht nur die Notiz",
    /brokerPositionWeg[\s\S]{0,400}?UPDATE "Trade" SET "notes" = \$1, "updatedAt" = NOW\(\)/.test(sync),
    "der manuelle Abgleich soll melden, nicht entscheiden");
  pruefe1("zwischen dem Vermerk und seinem UPDATE steht wieder ein CLOSED",
    !/brokerPositionWeg[\s\S]{0,400}?SET "status"\s*=\s*'CLOSED'/.test(sync),
    "damit naehme der Knopf dem Tracker den Trade wieder aus der Hand");
  pruefe1("sync-journal vermerkt die verschwundene Position nicht",
    /brokerPositionWeg/.test(sync));

  // ── sync-journal: Zuordnung und Notizen (03.09.) ────────────────────────
  //
  // Befund 3 und 4 der Generalkontrolle, beide nachgeprueft und behoben:
  //
  //  4. Die Zuordnung war EINE Abfrage mit OR. Der Kommentar versprach
  //     "market+direction+CLOSED within 24h window" — geprueft wurde davon NUR
  //     `market`. Ohne `status`-Filter konnte sie die Zeile einer LAUFENDEN
  //     Position treffen und mit dem P&L eines fremden Trades schliessen. Und
  //     `ORDER BY id DESC` liess die juengere lockere Uebereinstimmung den
  //     exakten dealId-Treffer schlagen.
  //  3. Der UPDATE schrieb `notes` nicht mit. Ein widerlegtes Etikett
  //     (NIE_BESTAETIGT / KEIN_PNL) blieb damit FUER IMMER stehen: der
  //     Nachtrag im Tracker sieht nur `profitLoss = 0`, hier wird aber ein
  //     Wert ungleich null geschrieben.
  pruefe1("die lockere Zuordnung kann wieder eine OFFENE Zeile treffen",
    /AND "status" = 'CLOSED'/.test(sync),
    "ohne status-Filter schloesse der Abgleich eine laufende Position");
  pruefe1("die lockere Zuordnung hat kein Zeitfenster",
    /AND "updatedAt" >= NOW\(\) - INTERVAL '24 hours'/.test(sync));
  pruefe1("der exakte dealId-Treffer gewinnt nicht mehr strukturell",
    /WHERE notes::text LIKE \$1\s*\n\s*ORDER BY id DESC LIMIT 1/.test(sync),
    "mit OR entschied die hoehere id statt der exakten Uebereinstimmung");
  pruefe1("der Abschluss schreibt die Notizen nicht mit",
    /"notes" = \$3, "updatedAt" = NOW\(\) WHERE "id" = \$4/.test(sync)
    && /notizenNachSync\(/.test(syncC),
    "sonst bleibt ein widerlegtes Etikett dauerhaft stehen");
  pruefe1("der INSERT erfindet wieder eine Richtung",
    !/VALUES \(\$1,\s*'BUY'/.test(sync),
    "die Transaktion von Capital fuehrt keine Richtung mit");
  pruefe1("der INSERT schreibt wieder den Text UNKNOWN als Markt",
    !/\?\?\s*"UNKNOWN"/.test(sync),
    "der kaeme als Symbol der Laenge 7 durch den Lern-Filter");
  pruefe1("die Antwort meldet wieder eine Zahl ohne Bedeutung",
    !/\bskipped\b/.test(syncC),
    "`skipped` wurde nie hochgezaehlt, die Oberflaeche zeigte immer 0");
  for (const feld of ["markiert", "aktualisiert", "neuAngelegt", "uebersprungen"]) {
    pruefe1(`die Aufschluesselung fehlt: ${feld}`,
      new RegExp(`\\b${feld}\\+\\+`).test(syncC),
      "drei verschiedene Vorgaenge in einem Zaehler sind nicht deutbar");
  }

  // notizenNachSync() RECHNEND — der Wortlaut einer SQL-Zeile sagt nicht,
  // WELCHE Notizen entstehen.
  const nF = geladenT.exports && geladenT.exports.notizenNachSync;
  if (typeof nF !== "function") {
    funde.push("notizenNachSync wird nicht exportiert — was der manuelle "
      + "Abgleich in die Notizen schreibt, bleibt ungeprueft");
  } else {
    const Z = "2026-09-03T12:00:00.000Z";
    const a = nF(JSON.stringify({ dealId: "D1", tradingStyle: "SWING" }), Z);
    pruefe1("die Quelle des P&L wird nicht vermerkt", a.pnlQuelle === "tx-sync");
    pruefe1("der Zeitpunkt wird nicht vermerkt", a.syncedAt === Z);
    pruefe1("bestehende Felder gehen verloren",
      a.dealId === "D1" && a.tradingStyle === "SWING");
    pruefe1("ohne Etikett wird eines erfunden", a.exitReason === undefined);

    for (const leer of ["NIE_BESTAETIGT", "KEIN_PNL"]) {
      const r = nF(JSON.stringify({ exitReason: leer }), Z);
      pruefe1(`"${leer}" bleibt stehen, obwohl ein echter P&L es widerlegt`,
        r.exitReason === "UNBEKANNT", String(r.exitReason));
      pruefe1(`der alte Wert "${leer}" verschwindet still`,
        r.exitReasonVorher === leer, String(r.exitReasonVorher));
    }
    for (const echt of ["ZIEL", "STOP", "DAZWISCHEN"]) {
      const r = nF(JSON.stringify({ exitReason: echt }), Z);
      pruefe1(`ein echter Grund (${echt}) wird ueberschrieben`,
        r.exitReason === echt && r.exitReasonVorher === undefined);
    }
    for (const [name, roh] of [
      ["kaputt", "{nicht json"], ["null", "null"], ["Liste", "[1,2]"],
      ["Text", '"abc"'], ["fehlend", null], ["undefined", undefined],
    ]) {
      const r = nF(roh, Z);
      pruefe1(`unbrauchbare Notizen (${name}) stuerzen ab oder liefern Unsinn`,
        !!r && typeof r === "object" && r.pnlQuelle === "tx-sync" && r.syncedAt === Z,
        JSON.stringify(r));
      // Ohne diese Zeile rutscht eine fehlende Objekt-Pruefung durch: `[1,2]`
      // und `"abc"` lassen sich ausbreiten und ergeben {0:…,1:…}. Die Pruefung
      // oben waere gruen geblieben, die Notizen trugen aber Muell.
      pruefe1(`unbrauchbare Notizen (${name}) schleppen Muell mit`,
        Object.keys(r).sort().join(",") === "pnlQuelle,syncedAt",
        Object.keys(r).join(","));
    }
  }

  return { titel: `Order-Bestätigung + Stop-Abstand (${geprueft} Prüfungen)`, funde };
};
