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

  pruefe1("der Hauptpfad leitet den Grund nicht mehr ab",
    /const \{ exitPosition, exitReason \} = ausstiegsgrund\(/.test(tracker2));
  pruefe1("der P&L-Nachtrag schreibt den Ausstiegsgrund nicht mit",
    /notizen\.exitReason = grund\.exitReason/.test(tracker2));
  pruefe1("der Nachtrag speichert die Notizen nicht",
    /SET "result" = \$1, "profitLoss" = \$2, "notes" = \$3/.test(tracker2));
  pruefe1("der Nachtrag holt stopLoss und takeProfit nicht",
    /SELECT "id","market","entry","notes","stopLoss","takeProfit"/.test(tracker2));
  pruefe1("ein bereits gesetzter Grund wird ueberschrieben",
    /if \(!notizen\.exitReason\)/.test(tracker2));

  // DIE WURZEL: sync-journal darf keinen Trade mehr abschliessen.
  pruefe1("sync-journal schliesst wieder Trades ab und entzieht sie dem Tracker",
    !/SET "status" = 'CLOSED'/.test(sync), "status CLOSED in sync-journal gefunden");
  pruefe1("sync-journal vermerkt die verschwundene Position nicht",
    /brokerPositionWeg/.test(sync));

  return { titel: `Order-Bestätigung + Stop-Abstand (${geprueft} Prüfungen)`, funde };
};
