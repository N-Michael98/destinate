// ─────────────────────────────────────────────────────────────────────────────
// Prüfer 14: Order-Bestätigung und Mindest-Stop-Abstand
//
// ZWEI FUNDE VOM 10.08., beide in capitalPlaceOrder.
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
  pruefe1("eine unbestätigte Order wird als Fehlschlag gemeldet — das kann zur "
    + "doppelten Position führen",
    /ok: true,\s*\n\s*dealReference,\s*\n\s*dealId: String\(data\.dealId/.test(client));
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

  return { titel: `Order-Bestätigung + Stop-Abstand (${geprueft} Prüfungen)`, funde };
};
