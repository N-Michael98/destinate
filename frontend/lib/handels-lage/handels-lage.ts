import { htmlSicher, entschaerftGekuerzt } from "../html-sicher/html-sicher";
// NUR der Typ — `import type` wird beim Übersetzen gelöscht und erzeugt
// keine Laufzeit-Abhängigkeit. Dieses Modul bleibt damit so importfrei wie
// bisher; gerechnet wird in `positionen-lage.ts`, hier wird nur gezeigt.
import type { PositionsBefund } from "../positionen-lage/positionen-lage";

/**
 * WARUM KEIN TRADE? (29.10.)
 *
 * ── DER ANLASS ──────────────────────────────────────────────────────────────
 *
 * Seit dem 23.10. wurde keine Position mehr eroeffnet. `/status` antwortete
 * dabei durchgehend `System: ONLINE 🟢` — und diese Zeile misst
 * ausschliesslich `ks.systemLocked`, also den Killswitch. Ueber Broker-
 * Sitzung, Modus, offene Positionen, Tageslimit, Drawdown-Sperre oder den
 * Scan sagt sie NICHTS.
 *
 * Der Handelszyklus hat drei Ausgaenge, die ihn mit EINER Logzeile und OHNE
 * Telegram-Meldung beenden (`orchestrator-agent.ts`):
 *
 *   if (!isCapitalConnected())                 return "Capital nicht verbunden";
 *   if (settings.botSettings.mode !== "AUTO")  return "Modus nicht AUTO";
 *   if (openCount >= maxConcurrent)            return "Max. Positionen erreicht";
 *
 * Sieben Tage Schweigen sehen bei allen dreien identisch aus — und identisch
 * zu "die KI wollte nicht". Das ist die Fehlerklasse "eine Diagnose darf im
 * interessanten Fall nicht schweigen" (30.09.), angewandt auf die Frage, die
 * man im Ernstfall VOR dem `/reset` stellt.
 *
 * ── WARUM EINE EIGENE, REINE FUNKTION ───────────────────────────────────────
 *
 * Damit `safety-nets` sie AUSFUEHREN kann. Eine Ternaer-Kette im Antworttext
 * waere strukturell pruefbar, aber nicht rechnerisch — genau daran ist die
 * Broker-Lage am 28.10. gescheitert (der Ausdruck stand zweimal da, eine
 * Sabotage am einen Zweig blieb gruen).
 *
 * ── DREIWERTIG, OHNE AUSNAHME ───────────────────────────────────────────────
 *
 * Jede Eingabe darf `null` sein und heisst dann UNBEKANNT — nie "in Ordnung"
 * und nie "blockiert". Eine stille Null macht aus "nicht abrufbar" eine
 * Messung; das war der Fehler vom 22.09. (Kurs-Alter) und vom 30.09.
 * (Integrationen). Gerade hier waere er fatal: die Antwort wird gelesen,
 * WEIL etwas kaputt ist, also sind fehlende Werte der Normalfall.
 *
 * REINE FUNKTION: keine Importe, keine Netzaufrufe, keine Zeitzone. Der
 * Aufrufer sammelt die Fakten und faengt jeden Ausfall einzeln ab.
 */

export interface HandelsLageEingaben {
  /** `isCapitalConnected()` — `null`, wenn nicht feststellbar. */
  brokerVerbunden: boolean | null;
  /** `settings.botSettings.mode` — gehandelt wird nur bei `"AUTO"`. */
  modus: string | null;
  /** Anzahl offener Positionen beim Broker. */
  offenePositionen: number | null;
  /**
   * Was über die einzelnen offenen Positionen zu sagen ist (07.11.).
   *
   * `null` = nicht abrufbar. Eine LEERE Liste ist eine Aussage („keine
   * offen"), kein Nichtwissen — deshalb die zwei verschiedenen Werte.
   */
  positionen?: ReadonlyArray<PositionsBefund> | null;
  /** `settings.botSettings.maxConcurrentPositions`. */
  maxGleichzeitig: number | null;
  /** `global.__daily_trades__.count`. */
  tagesZaehler: number | null;
  /** `settings.botSettings.maxTradesPerDay`. */
  tagesLimit: number | null;
  /** `settings.botSettings.tradeLimitEnabled` — ist das Limit ueberhaupt an? */
  tagesLimitAktiv: boolean | null;
  /** Kontostand aus der Broker-Sitzung. */
  kontostand: number | null;
  /** Gespeicherter Hoechststand aus Redis (`peak_balance`). */
  hoechststand: number | null;
  /** `riskSettings.maxTotalDrawdownPct` — 0 oder leer heisst: Grenze aus. */
  maxDrawdownProzent: number | null;
  /** `isWithinTradingSession()`. */
  inHandelszeit: boolean | null;
  /**
   * Das Fenster in Ortszeit, z.B. `08:00–23:00` — GERECHNET (01.11.).
   *
   * Hier stand der Text dreimal als Literal `08:00–23:00 Zürich`.
   * Ausgerechnet mit der echten `isWithinTradingSession()` ueber
   * 2026+2027: an **35 Werktagen** schliesst das Fenster in
   * Wirklichkeit um **22:00** Zuerich — immer dann, wenn EU- und
   * US-Sommerzeit auseinanderlaufen und London/New York 4 statt 5
   * Stunden auseinander liegen. Erster falscher Tag waere der
   * 15.03.2027 gewesen; der Text ist erst seit dem 01.11. da und
   * damit nie falsch ausgeliefert worden.
   *
   * `null` heisst **unbekannt**: dann wird die Ortszeit-Angabe
   * WEGGELASSEN statt geraten. Die Definition (07:00 London bis
   * 17:00 New York) bleibt stehen — die ist immer wahr.
   */
  fensterOrtszeit: string | null;
  /** Zyklen heute (aus `zyklus:tag:<UTC-Datum>`). */
  zyklenHeute: number | null;
  /** Ausgaenge heute mit Anzahl (aus derselben Tagessumme). */
  ausgaenge: Record<string, number> | null;
  /** Die Stufen des Trichters — aus derselben Tagessumme. */
  trichter: TrichterZahlen | null;
}

/**
 * JEDE STUFE BRAUCHT EINE EIGENE ZAHL (Regel vom 22.09.).
 *
 * Sonst ist ein Datenausfall von einem Urteil nicht zu unterscheiden: ein
 * Abend mit totem Python-Backend meldet dasselbe wie ein Abend, an dem die
 * KI nichts mochte. Die Felder entsprechen `Tagessumme`
 * (`lib/zyklus-bilanz/zyklus-bilanz.ts`) — sie werden dort gezaehlt, hier
 * nur gelesen.
 *
 * `null` heisst auch hier UNBEKANNT, nicht 0.
 */
export interface TrichterZahlen {
  /** Zyklen MIT Analyse. Ohne Scan gibt es keinen Trichter. */
  scans: number | null;
  maerkte: number | null;
  /** BUY + SELL: die Signale, die ueberhaupt eine Richtung hatten. */
  richtungen: number | null;
  /**
   * Maerkte, fuer die GPT GAR NICHT geantwortet hat (30.10.).
   *
   * Sie wurden bis dahin als WAIT gezaehlt — „GPT lehnt ab" und „GPT
   * schweigt" sahen damit identisch aus. Bei 0 Richtungen aus 3210
   * Analysen ist das die Frage, mit der man ins Log steigt.
   */
  ohneGptAntwort: number | null;
  /** WARUM (23.11.) — `Tagessumme.ohneGptJeLage`, `.gptAusfallGruende`,
   *  `.gptLageGeprueft`. Fehlend heisst UNBEKANNT; optional, weil eine
   *  Tagessumme von vor dem Deploy die Felder nicht kennt. */
  ohneGptJeLage?: Record<string, number> | null;
  gptAusfallGruende?: Record<string, number> | null;
  gptLageGeprueft?: number | null;
  /** Siehe Tagessumme.gptZahlUnbrauchbar (15.11.): GPT hat geantwortet,
   *  aber mit einer Zahl, die keine ist. `null` heisst UNBEKANNT. */
  gptZahlUnbrauchbar: number | null;
  /** Siehe Tagessumme.konsensRichtungen … mehrfachGezaehlt (19.11.):
   *  Richtungen ausserhalb von GPT und die Summenprobe des Trichters.
   *  `null` heisst UNBEKANNT — eine Summe von vor dem 19.11. kennt sie
   *  nicht, und dann darf hier nichts als „geprueft" erscheinen. */
  konsensRichtungen: number | null;
  taErsatzRichtungen: number | null;
  trichterGeprueft: number | null;
  restOhneAnalyse: number | null;
  restOhneStop: number | null;
  restUngeklaert: number | null;
  mehrfachGezaehlt: number | null;
  vetos: number | null;
  stilVerworfen: number | null;
  ohneVolleDaten: number | null;
  ohneVolleDatenGrund: Record<string, number> | null;
  unterGrenze: number | null;
  confMin: number | null;
  confMax: number | null;
  rrAbgelehnt: number | null;
  ohneStopZiel: number | null;
  go: number | null;
  /**
   * Die Tore NACH dem GO (`Tagessumme.tore`): Walk-Forward, Confidence-
   * Schwelle, Stil-Limit, Meta-KI … Jedes meldet `ja`/`nein` und den
   * Grund.
   *
   * WOZU. Am 30.10. standen im Bericht `GO: 2` und als Ausgang „Keine
   * Kandidaten nach Filter: 2". Welches der drei Tore das war, lag
   * laengst in derselben Tagessumme — und wurde nicht gezeigt.
   */
  tore: Record<string, TorZahlen> | null;
  /**
   * DIE LETZTE STUFE (23.11.): was nach ALLEN Toren beim Broker scheiterte —
   * `Tagessumme.fehlgeschlagen` und `.fehlgeschlagenGruende`. (Die eroeffneten
   * Trades zeigt schon der Tageslimit-Zaehler.)
   *
   * WOZU. Am 23.11. stand in `/status` „Filterkette: ja 2" und als Ausgang
   * „Alle Kandidaten gescheitert: 1" — zwei Signale kamen durch jedes Tor
   * und scheiterten beim Broker. Den Grund trug dieselbe Tagessumme
   * (`fehlgeschlagenGruende`, seit 20.09.), gezeigt wurde er nur in der
   * Tagesbilanz um 22:05 UTC. Und das Urteil nannte als „Grösstes" ein Tor
   * VOR der Ausfuehrung. „Ein Verweis ist keine Antwort" (29.10.).
   *
   * `null`/fehlend heisst UNBEKANNT, nicht 0. Optional, weil ein Aufrufer
   * von vor dem Einbau sie nicht kennt.
   */
  brokerFehler?: number | null;
  brokerFehlerGruende?: Record<string, number> | null;
}

/**
 * Wie viele Zeichen eines Broker-Grundes `/status` zeigt (23.11.) — gemessen
 * NACH dem Entschaerfen. Der Grund ist fremder Text (die Antwort von
 * Capital.com), seine Laenge ist nicht unsere, und ein `&` wird beim
 * Entschaerfen fuenf Zeichen lang. Eine Grenze VOR dem Entschaerfen haette
 * die Laenge also nicht begrenzt. Exportiert fuer den Laengen-Riegel.
 */
export const BROKER_GRUND_MAX_STATUS = 60;

/** Dasselbe fuer den Grund, warum GPT-Antworten fehlten (23.11.) — er traegt
 *  OpenAIs Antwortkoerper, also fremden Text. Exportiert fuer den Laengen-Riegel. */
export const GPT_GRUND_MAX_STATUS = 35;
/** Wie viele Lagen die Zeile „ohne GPT-Antwort" in /status zeigt (23.11.). */
export const GPT_LAGEN_MAX_STATUS = 3;

// `entschaerftGekuerzt` liegt seit dem 23.11. abends in `html-sicher.ts` —
// /status UND die Tagesbilanz benutzen dieselbe Fassung. Hier nur
// weitergereicht, damit bestehende Aufrufer und Pruefer sie weiter finden.
export { entschaerftGekuerzt };

/** Ein Tor, wie es die Zyklus-Bilanz zaehlt (`TorSumme` dort). */
export interface TorZahlen {
  ja?: number;
  nein?: number;
  fallback?: number;
  gruende?: Record<string, number>;
  /** Spanne der Confidence je Ablehnungsgrund (02.11.) — siehe
   *  `TorSumme` in zyklus-bilanz.ts. `undefined` heisst: die
   *  Tagessumme stammt von vor dem Einbau, NICHT "Spanne 0". */
  confSpanne?: Record<string, { min: number; max: number }>;
  /** Abgelehnte Richtungen je Tor (02.11.) — siehe `TorSumme`. */
  richtungen?: Record<string, number>;
  /** Siehe `TorSumme.richtungenJa` in `zyklus-bilanz.ts` (04.11.): die
   *  ZUGESTIMMTEN Richtungen. Ohne sie war die Frage "wirft ein Tor eine
   *  Seite bevorzugt weg?" nicht entscheidbar, weil die Aufteilung der GO
   *  nirgends stand. Optional — eine Summe von gestern kennt das Feld nicht. */
  richtungenJa?: Record<string, number>;
}

export interface HandelsLage {
  /** Was JETZT nachweislich blockt — leer heisst: kein Tor steht zu. */
  blocker: string[];
  /** Was nicht feststellbar war. Eine leere Liste ist eine Aussage. */
  unbekannt: string[];
  /** Die fertigen Zeilen fuer die Antwort. */
  zeilen: string[];
}

/**
 * Wie viele Tore `/status` zeigt — der Rest wird GEZÄHLT (07.11.).
 *
 * EXPORTIERT, damit der Prüfer die Zahl nicht selbst führen muss. Am 02.11.
 * ist genau das passiert: ein Prüfstand hielt `MAX_TORE_JE_ZYKLUS` als
 * Literal fest und wurde zu Recht rot, als sich der Wert änderte. Eine Zahl,
 * die an zwei Stellen steht, veraltet an einer davon.
 *
 * Sechs wie in der Tagesbilanz. Gemessen am 07.11.: elf Tore kosten 1871
 * Zeichen, ein Tor im Schnitt 170 — ohne Deckel blieben 84 Zeichen Luft.
 *
 * FUENF seit dem 23.11. Die Stufe NACH den Toren (beim Broker gescheitert,
 * mit Grund) kam dazu, und GEMESSEN lag der Haertefall damit bei 4106 +
 * Rest — ueber der Grenze. Das Tor mit den WENIGSTEN Ablehnungen tritt
 * seinen Platz ab; es wird weiter gezaehlt („N weitere Tore, M
 * Ablehnungen"), und das Urteil sieht weiter ALLE Tore.
 */
export const TORE_MAX_STATUS = 5;

/**
 * Wie viele offene Positionen `/status` einzeln zeigt (07.11.).
 *
 * `maxConcurrentPositions` ist eine EINSTELLUNG — im Standard 3, live 6,
 * nach oben offen. Ohne Deckel wäre die Länge der Antwort von einer
 * Einstellung abhängig, und ab irgendeiner Zahl käme `/status` gar nicht
 * mehr an. Die Liste ist **auffälliges zuerst** sortiert, der Deckel
 * schneidet also die unauffälligen weg — und zählt sie.
 */
export const POSITIONEN_MAX_STATUS = 6;

/** Endliche Zahl oder `null` — ein `NaN` ist keine Messung. */
function zahl(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function handelsLage(e: HandelsLageEingaben): HandelsLage {
  const blocker: string[] = [];
  const unbekannt: string[] = [];
  const zeilen: string[] = [];

  // ── 1. Broker-Sitzung ────────────────────────────────────────────────────
  if (e.brokerVerbunden === true) {
    zeilen.push("✅ Broker: Capital.com verbunden");
  } else if (e.brokerVerbunden === false) {
    blocker.push("Keine Broker-Sitzung — der Zyklus endet sofort");
    zeilen.push("⛔ Broker: KEINE Sitzung — jeder Zyklus endet bei "
      + "„Capital nicht verbunden“");
  } else {
    unbekannt.push("Broker-Sitzung");
    zeilen.push("❔ Broker: unbekannt (nicht abrufbar)");
  }

  // ── 2. Modus ─────────────────────────────────────────────────────────────
  //
  // `DEFAULT_SETTINGS` steht auf `mode: "MANUAL"` (`settings-store.ts:6`).
  // Faellt der Datenbank-Lesepfad aus, gilt also MANUAL — und jeder Zyklus
  // endet bei „Modus nicht AUTO", ohne dass jemand etwas umgestellt haette.
  if (e.modus === null || e.modus === undefined || e.modus === "") {
    unbekannt.push("Modus");
    zeilen.push("❔ Modus: unbekannt (Einstellungen nicht lesbar)");
  } else if (e.modus === "AUTO") {
    zeilen.push("✅ Modus: AUTO");
  } else {
    blocker.push(`Modus ist ${htmlSicher(String(e.modus))}, nicht AUTO`);
    zeilen.push(`⛔ Modus: ${htmlSicher(String(e.modus))} — gehandelt `
      + "wird nur bei AUTO");
  }

  // ── 3. Offene Positionen gegen das Limit ─────────────────────────────────
  const offen = zahl(e.offenePositionen);
  const maxOffen = zahl(e.maxGleichzeitig);
  if (offen === null || maxOffen === null) {
    unbekannt.push("Offene Positionen");
    zeilen.push(`❔ Positionen: ${offen === null ? "unbekannt" : offen} von `
      + `${maxOffen === null ? "unbekannt" : maxOffen} — nicht vergleichbar`);
  } else if (offen >= maxOffen) {
    blocker.push(`${offen} von ${maxOffen} Positionen offen — Limit erreicht`);
    zeilen.push(`⛔ Positionen: ${offen}/${maxOffen} — Limit erreicht, kein neuer Trade`);
  } else {
    zeilen.push(`✅ Positionen: ${offen}/${maxOffen}`);
  }

  // ── 3b. WAS IST MIT DIESEN POSITIONEN? (07.11.) ──────────────────────────
  //
  // `/status` vom 07.11. meldete „Positionen: 1/6" — und die Position war
  // 70 Stunden alt, über ein Wochenende gehalten. Ob das in Ordnung ist,
  // hängt am Handelsstil (4 / 24 / 168 h), und der stand nirgends.
  //
  // Die beiden Lagen, in denen der Zeit-Exit AUSGESETZT ist, schreiben je
  // Position EINE Logzeile — nach drei Tagen aus dem Railway-Log gescrollt.
  // Dann gibt es keine Stelle mehr, die es sagt. Hier steht es.
  const posListe = e.positionen;
  if (posListe && posListe.length > 0) {
    zeilen.push("   <b>Offene Positionen:</b>");
    // DECKEL (07.11.): `maxConcurrentPositions` ist frei einstellbar — im
    // Standard 3, live 6, nach oben offen. Ohne Deckel waere die Laenge der
    // Antwort eine Einstellung, und /status kaeme ab irgendeiner Zahl gar
    // nicht mehr an. Die Liste kommt bereits AUFFAELLIGES ZUERST sortiert,
    // der Deckel schneidet also die unauffaelligen weg.
    for (const p of posListe.slice(0, POSITIONEN_MAX_STATUS)) {
      const alter = p.alterStunden === null
        ? "Alter unbekannt" : `${p.alterStunden.toFixed(1)} h`;
      // Der Stil UND seine Grenze — die Zahl allein beantwortet die Frage
      // nicht, und eine Grenze im Kopf des Lesers ist eine Regel zu viel.
      const stil = p.stil === null
        ? "Stil unbekannt"
        : `${htmlSicher(p.stil)}${p.grenzeStunden === null
            ? " (keine Grenze hinterlegt)" : ` (Grenze ${p.grenzeStunden} h)`}`;
      const exit = p.zeitExit === "aktiv"
        ? (p.ueberfaellig ? " · ⚠️ ÜBER der Haltedauer" : " · Zeit-Exit aktiv")
        : p.zeitExit === "ohne-zeit"
          ? " · ⚠️ Zeit-Exit kann NICHT greifen (Broker lieferte keine Eröffnungszeit)"
          : " · ⚠️ Zeit-Exit AUSGESETZT (kein Handelsstil im Journal)";
      zeilen.push(`      ${htmlSicher(p.symbol)} ${htmlSicher(p.richtung)} · `
        + `${alter} · ${stil}${exit}`);
    }
    // ── WARUM HIER NICHTS IN `blocker` ODER `unbekannt` WANDERT ────────
    //
    // Mein erster Entwurf schob jede auffällige Position nach `unbekannt`.
    // Der Prüfer hat es gefangen, und zwar zu Recht: `unbekannt` KURZ-
    // SCHLIESST das Urteil („🟡 Kein Tor blockt nachweislich — aber N
    // Angabe(n) nicht feststellbar"). Eine Position ohne Journal-Zeile
    // hätte damit die ganze Tor-Diagnose verdrängt — also genau die
    // Antwort auf „warum kein Trade?", wegen der man `/status` aufruft.
    //
    // Und es wäre auch inhaltlich falsch: ein ausgesetzter Zeit-Exit ist
    // eine MESSUNG, kein Nichtwissen, und er blockt keinen neuen Trade.
    // Er gehört in die Zeile — dort steht er, mit ⚠️, drei Zeilen über
    // dem Urteil.
    // Was fehlt, wird GEZÄHLT — und es wird gesagt, dass die Übrigen
    // unauffällig sind. Sonst läse sich die Kürzung wie ein Verschweigen.
    const restPos = posListe.length - POSITIONEN_MAX_STATUS;
    if (restPos > 0) {
      zeilen.push(`      (${restPos} weitere ohne Auffälligkeit)`);
    }
  } else if (posListe === null && offen !== null && offen > 0) {
    // Positionen sind offen, aber die Einzelheiten kamen nicht an — gesagt,
    // nicht verschwiegen. Ebenfalls NICHT in `unbekannt`: die Frage „warum
    // kein Trade?" hängt nicht daran, und das Urteil gehört ihr.
    zeilen.push("   ❔ Einzelheiten der offenen Positionen nicht abrufbar");
  }

  // ── 4. Tageslimit ────────────────────────────────────────────────────────
  const heute = zahl(e.tagesZaehler);
  const limit = zahl(e.tagesLimit);
  if (e.tagesLimitAktiv === false) {
    zeilen.push(`✅ Tageslimit: ausgeschaltet (heute ${heute === null ? "?" : heute} Trades)`);
  } else if (heute === null || limit === null || e.tagesLimitAktiv === null) {
    unbekannt.push("Tageslimit");
    zeilen.push("❔ Tageslimit: unbekannt");
  } else if (heute >= limit) {
    blocker.push(`Tageslimit erreicht (${heute}/${limit})`);
    zeilen.push(`⛔ Tageslimit: ${heute}/${limit} erreicht`);
  } else {
    zeilen.push(`✅ Tageslimit: ${heute}/${limit}`);
  }

  // ── 5. Gesamt-Drawdown ───────────────────────────────────────────────────
  //
  // Die Sperre, die sich NICHT selbst heilt: ein fester Redis-Schluessel mit
  // einem Jahr Haltbarkeit (29.09.). Ihr Telegram-Alarm feuert EINMAL je
  // Hoechststand — danach blockt sie jeden Zyklus stumm weiter. Genau deshalb
  // gehoert sie hierher.
  const peak = zahl(e.hoechststand);
  const stand = zahl(e.kontostand);
  const grenze = zahl(e.maxDrawdownProzent);
  // DREIWERTIG, wie jedes andere Feld hier (31.10.). Vorher stand hier
  // `grenze === null || grenze <= 0` in EINEM Zweig — damit meldete ein
  // fehlgeschlagener Einstellungs-Lesepfad "✅ keine Grenze gesetzt": ein
  // gruenes Haekchen fuer einen Wert, den niemand lesen konnte, und der
  // Eintrag fehlte in `unbekannt`. Genau die stille Null aus der Regel vom
  // 22.09., und besonders teuer hier: diese Antwort wird gelesen, WEIL
  // etwas kaputt ist — fehlende Werte sind der Normalfall.
  if (grenze === null) {
    unbekannt.push("Drawdown-Grenze");
    zeilen.push("❔ Gesamt-Drawdown: Grenze unbekannt (Einstellungen nicht "
      + "lesbar) — die Sperre kann aktiv sein und stumm blocken");
  } else if (grenze <= 0) {
    zeilen.push("✅ Gesamt-Drawdown: keine Grenze gesetzt");
  } else if (peak === null || stand === null || peak <= 0) {
    unbekannt.push("Gesamt-Drawdown");
    zeilen.push(`❔ Gesamt-Drawdown: nicht berechenbar (Höchststand `
      + `${peak === null ? "unbekannt" : peak.toFixed(2)}, Stand `
      + `${stand === null ? "unbekannt" : stand.toFixed(2)})`);
  } else {
    const ddPct = ((peak - stand) / peak) * 100;
    const txt = `${ddPct >= 0 ? "-" : "+"}${Math.abs(ddPct).toFixed(2)} % `
      + `(Grenze -${grenze} %, Höchststand ${peak.toFixed(2)}, Stand ${stand.toFixed(2)})`;
    if (ddPct >= grenze) {
      blocker.push(`Gesamt-Drawdown ${txt} — /peakreset hebt den Bezugspunkt auf`);
      zeilen.push(`⛔ Gesamt-Drawdown: ${txt}`);
    } else {
      zeilen.push(`✅ Gesamt-Drawdown: ${txt}`);
    }
  }

  // ── 6. Handelszeit ───────────────────────────────────────────────────────
  // Die Ortszeit-Angabe faellt WEG, wenn sie nicht berechenbar ist —
  // eine geratene waere genau die Luege, die dieser Block behebt.
  // Nicht nur `=== null`: ein leerer String ergaebe ` =  Zürich` und
  // ein durchgerutschtes `undefined` sogar ` = undefined Zürich`. Was
  // nicht wie eine Uhrzeit aussieht, wird WEGGELASSEN.
  const ortszeit = e.fensterOrtszeit && e.fensterOrtszeit.trim() !== ""
    ? ` = ${htmlSicher(e.fensterOrtszeit)} Zürich` : "";
  if (e.inHandelszeit === true) {
    zeilen.push("✅ Handelszeit: offen (Mo–Fr, 07:00 London bis 17:00 "
      + `New York${ortszeit})`);
  } else if (e.inHandelszeit === false) {
    blocker.push("Ausserhalb der Handelszeit — ausserhalb Mo–Fr, "
      + `07:00 London bis 17:00 New York${ortszeit}, normal`);
    zeilen.push("⛔ Handelszeit: ZU (Mo–Fr, 07:00 London bis 17:00 New York"
      + `${ortszeit}) — ausserhalb davon normal`);
  } else {
    unbekannt.push("Handelszeit");
    zeilen.push("❔ Handelszeit: unbekannt");
  }

  // ── 7. Laufen ueberhaupt Zyklen? ─────────────────────────────────────────
  const zyklen = zahl(e.zyklenHeute);
  if (zyklen === null) {
    unbekannt.push("Zyklen heute");
    zeilen.push("❔ Zyklen heute: unbekannt (Tagessumme nicht lesbar)");
  } else if (zyklen === 0) {
    blocker.push("Heute lief KEIN einziger Zyklus");
    zeilen.push("⛔ Zyklen heute: 0 — die Schleife läuft nicht");
  } else {
    zeilen.push(`✅ Zyklen heute: ${zyklen}`);
  }

  // ── 8. Wo enden die Zyklen? ──────────────────────────────────────────────
  //
  // Die Zahl, die alles beantwortet, liegt laengst in `zyklus:tag:<Datum>` —
  // sie ging bisher nur einmal am Tag um 22:05 UTC raus.
  const a = e.ausgaenge;
  if (a === null || a === undefined) {
    unbekannt.push("Ausgänge");
    zeilen.push("❔ Ausgänge heute: unbekannt");
  } else {
    const sortiert = Object.entries(a)
      .filter(([, n]) => zahl(n) !== null && (zahl(n) as number) > 0)
      .sort((x, y) => (zahl(y[1]) as number) - (zahl(x[1]) as number));
    if (sortiert.length === 0) {
      zeilen.push("❔ Ausgänge heute: noch keiner verbucht");
    } else {
      zeilen.push("📤 Ausgänge heute:");
      for (const [grund, n] of sortiert.slice(0, 5)) {
        zeilen.push(`   • ${htmlSicher(grund)}: ${n}`);
      }
      const rest = sortiert.length - 5;
      if (rest > 0) zeilen.push(`   • (${rest} weitere)`);
    }
  }

  // ── 9. Der Trichter — wo das Signal stirbt, wenn kein Tor blockt ─────────
  //
  // Vorher verwies das Urteil auf die Zyklus-Tagesbilanz (22:05 UTC). Ein
  // Verweis ist keine Antwort: dieselben Zahlen liegen in derselben
  // Tagessumme, die oben schon gelesen wird.
  let groessteStufe: { name: string; n: number } | null = null;
  let groesstesTor: { name: string; n: number } | null = null;
  /** Orders, die nach ALLEN Toren beim Broker scheiterten (23.11.). */
  let brokerGescheitert = 0;
  const t = e.trichter;
  const scans = zahl(t?.scans ?? null);
  if (t && scans !== null && scans > 0) {
    const stufen: Array<[string, number | null]> = [
      ["KI-Veto", zahl(t.vetos)],
      ["Stil verworfen", zahl(t.stilVerworfen)],
      ["ohne vollständige Daten", zahl(t.ohneVolleDaten)],
      ["unter der Confidence-Grenze", zahl(t.unterGrenze)],
      ["an der Risiko-Freigabe gescheitert", zahl(t.rrAbgelehnt)],
      ["ohne Stop/Ziel von GPT", zahl(t.ohneStopZiel)],
    ];
    zeilen.push("");
    const richt = zahl(t.richtungen);
    const maerkte = zahl(t.maerkte);
    zeilen.push(`🔻 <b>Trichter heute</b> (${scans} Analysen`
      + `${maerkte === null ? "" : `, ${maerkte} Marktanalysen`}):`);
    const ohneAntwort = zahl(t.ohneGptAntwort);
    // UND WARUM (23.11.): ganzer Zyklus ohne Antwort (gescheitert /
    // abgeschnitten / unlesbar) oder einzelne Maerkte ausgelassen. Der alte
    // Zusatz „(als WAIT gezählt, aber kein Urteil)" weicht dafuer — /status
    // hatte im Haertefall 138 Zeichen Luft. Gilt nur fuer den GEMESSENEN Teil.
    let warum = "";
    if (ohneAntwort !== null && ohneAntwort > 0) {
      const gepr = zahl(t.gptLageGeprueft ?? null);
      if (gepr === null || gepr === 0) {
        warum = " — nicht aufgeschlüsselt (vor dem 23.11.)";
      } else {
        // GEMESSEN, nicht geschaetzt: mit allen vier Lagen vierstellig und
        // einem Grund aus lauter `&` lag /status bei 4076 von 4096. Deshalb
        // hoechstens drei Lagen (der Rest wird GEZAEHLT), und der Grund ohne
        // die Lage am Anfang — die steht schon in der Zaehlung.
        const alleLagen = Object.entries(t.ohneGptJeLage ?? {})
          .filter(([, v]) => zahl(v) !== null && (zahl(v) as number) > 0)
          .sort((a, b) => (zahl(b[1]) as number) - (zahl(a[1]) as number));
        const lagen = alleLagen.slice(0, GPT_LAGEN_MAX_STATUS).map(([k, v]) => `${htmlSicher(k)} ${v}`);
        const mehrLagen = alleLagen.length - lagen.length;
        const gr = Object.entries(t.gptAusfallGruende ?? {})
          .filter(([, v]) => zahl(v) !== null && (zahl(v) as number) > 0)
          .sort((a, b) => (zahl(b[1]) as number) - (zahl(a[1]) as number));
        warum = ` — ${lagen.length > 0 ? lagen.join(" · ") : "keine Lage verbucht"}`
          + `${mehrLagen > 0 ? ` +${mehrLagen}` : ""} (${gepr}/${scans} gemessen)`
          + (gr.length > 0
            ? ` — ${entschaerftGekuerzt(String(gr[0][0]).replace(/^[a-z-]{2,20}: /, ""),
              GPT_GRUND_MAX_STATUS)} (${gr[0][1]})`
              + (gr.length > 1 ? ` +${gr.length - 1} Gründe` : "")
            : "");
      }
    }
    zeilen.push(`   • ohne GPT-Antwort: `
      + `${ohneAntwort === null ? "unbekannt" : ohneAntwort}${warum}`);
    // Dreiwertig wie alles hier: `null` heisst unbekannt, nicht 0
    // (15.11.). Eine stille 0 waere die Luege vom 22.09.
    const unbrauchbar = zahl(t.gptZahlUnbrauchbar);
    zeilen.push(`   • GPT-Zahl unbrauchbar: `
      + `${unbrauchbar === null ? "unbekannt" : unbrauchbar}`
      + `${unbrauchbar !== null && unbrauchbar > 0 ? " (Text/Objekt/Infinity — kein Urteil)" : ""}`);
    // 19.11.: Richtungen, die NICHT von GPT kommen, aber durch alle Stufen
    // laufen — ohne sie kann keine Summe aufgehen. Nur bei > 0, und IN
    // derselben Zeile: gemessen kostete eine eigene Zeile im schlimmsten
    // Fall so viel, dass /status ueber 4096 Zeichen kam.
    const kons = zahl(t.konsensRichtungen);
    const taErsatz = zahl(t.taErsatzRichtungen);
    zeilen.push(`   • Richtungssignale (BUY/SELL): `
      + `${richt === null ? "unbekannt" : richt}`
      + `${kons !== null && kons > 0 ? ` + Konsens ${kons}` : ""}`
      + `${taErsatz !== null && taErsatz > 0 ? ` + TA-Ersatz ${taErsatz}` : ""}`);
    for (const [name, n] of stufen) {
      if (n === null) { zeilen.push(`   • ${htmlSicher(name)}: unbekannt`); continue; }
      // Der Grund gehoert dazu: die Zahl allein sagt nicht, WELCHER Dienst
      // ausgefallen ist — genau die Frage, mit der man ins Log steigt.
      let zusatz = "";
      if (name.startsWith("ohne vollständige") && t.ohneVolleDatenGrund) {
        const g = Object.entries(t.ohneVolleDatenGrund)
          .filter(([, v]) => zahl(v) !== null && (zahl(v) as number) > 0)
          .map(([k, v]) => `${htmlSicher(k)} ${v}`).join(", ");
        if (g) zusatz = ` — ${g}`;
      }
      if (name.startsWith("unter der Confidence")) {
        const cMin = zahl(t.confMin); const cMax = zahl(t.confMax);
        if (cMin !== null && cMax !== null) zusatz = ` (${cMin}–${cMax})`;
      }
      zeilen.push(`   • ${htmlSicher(name)}: ${n}${zusatz}`);
      if (n > 0 && (groessteStufe === null || n > groessteStufe.n)) {
        groessteStufe = { name, n };
      }
    }
    const go = zahl(t.go);
    zeilen.push(`   • <b>GO: ${go === null ? "unbekannt" : go}</b>`);
    // ── DIE SUMMENPROBE DES TRICHTERS (19.11.) ──────────────────────────
    //
    // Jedes Signal muss an GENAU EINER Stufe gezaehlt sein. Null Stufen ist
    // eine Luecke, zwei ist doppelt gezaehlt (`trichterZuordnung()` in der
    // Engine). Sie gilt nur fuer die Analysen, die sie gemacht haben — eine
    // Summe von vor dem Deploy darf nicht als geprueft erscheinen.
    const gepr = zahl(t.trichterGeprueft);
    const restTeile: string[] = [];
    const rA = zahl(t.restOhneAnalyse); const rS = zahl(t.restOhneStop);
    const rU = zahl(t.restUngeklaert); const rM = zahl(t.mehrfachGezaehlt);
    if (rA !== null && rA > 0) restTeile.push(`ohne echte Analyse ${rA}`);
    if (rS !== null && rS > 0) restTeile.push(`unter Grenze ohne Stop ${rS}`);
    if (rU !== null && rU > 0) restTeile.push(`ungeklärt ${rU}`);
    if (rM !== null && rM > 0) restTeile.push(`doppelt gezählt ${rM}`);
    zeilen.push(`   • Summenprobe`
      + (gepr === null || gepr === 0
        ? ": nicht gemessen (Analysen vor dem 19.11.)"
        : ` (${gepr}/${scans} Analysen): `
          + (restTeile.length > 0 ? `⚠️ ${restTeile.join(", ")}` : "jedes Signal genau einer Stufe zugeordnet")));

    // ── WAS NACH DEM GO PASSIERT ──────────────────────────────────────
    //
    // Ein GO ist noch kein Trade: danach kommen Walk-Forward, die
    // Confidence-Schwelle, das Stil-Tageslimit und die Filterkette. Genau
    // dort starben am 30.10. beide freigegebenen Signale.
    const tore = t.tore;
    if (tore && Object.keys(tore).length > 0) {
      const abgelehnt: Array<[string, number]> = [];
      const alleTore = Object.entries(tore);
      // ── DECKEL (07.11.) ─────────────────────────────────────────────
      //
      // GEMESSEN: der Tor-Block ist mit elf Toren 1871 Zeichen — 47 % der
      // ganzen Lage, ein Tor kostet im Schnitt 170. Zusammen mit dem Rest
      // der Antwort waren es 4012 von 4096, also 84 Zeichen Luft. Ein
      // zwoelftes Tor in der `GateName`-Union haette die Grenze gerissen,
      // und dann kommt `/status` GAR NICHT an — ausgerechnet der Befehl,
      // den man benutzt, wenn etwas kaputt ist.
      //
      // Dieselbe Loesung wie in der Tagesbilanz (31.10.): nach
      // ABLEHNUNGEN sortieren, damit nicht die Reihenfolge des Eintreffens
      // entscheidet, welches Tor wegfaellt — und was fehlt, wird GEZAEHLT.
      const sortiert = [...alleTore].sort(
        (a, b) => (zahl(b[1]?.nein ?? null) ?? -1) - (zahl(a[1]?.nein ?? null) ?? -1));
      const gezeigt = sortiert.slice(0, TORE_MAX_STATUS);
      zeilen.push("   <b>Tore nach dem GO:</b>");
      for (const [name, s] of gezeigt) {
        const ja = zahl(s?.ja ?? null);
        const nein = zahl(s?.nein ?? null);
        const fb = zahl(s?.fallback ?? null);
        // Der haeufigste Grund gehoert dazu: die Zahl allein sagt nicht,
        // WARUM das Tor zu war — und genau das ist die Frage.
        const gruende = Object.entries(s?.gruende ?? {})
          .filter(([, n]) => zahl(n) !== null && (zahl(n) as number) > 0)
          .sort((x, y) => (zahl(y[1]) as number) - (zahl(x[1]) as number));
        // DER BELEGTE FALL (31.10.): `orchestrator-agent.ts:1002` sendet
        // `Confidence 66 < Schwelle 70`. Ohne Escaping bricht das die
        // ganze Nachricht, und /status kommt NICHT an.
        // DIE ZAHL, DIE BIS HEUTE FEHLTE (02.11.): `grundSchluessel()`
        // maskiert jede Zahl mit `#`, richtig fuers Zaehlen. Am 02.11.
        // stand deshalb `Confidence # < Schwelle # (38)` — und genau
        // diese Schwelle war der groesste Blocker des Tages.
        const sp = gruende.length > 0
          ? s?.confSpanne?.[String(gruende[0][0])] : undefined;
        const conf = sp && Number.isFinite(sp.min) && Number.isFinite(sp.max)
          ? (sp.min === sp.max
              ? ` · Confidence ${sp.min}`
              : ` · Confidence ${sp.min}\u2013${sp.max}`)
          : "";
        const grund = gruende.length > 0
          ? ` — ${htmlSicher(String(gruende[0][0]))} (${gruende[0][1]})${conf}` : "";
        // Welche SEITE das Tor wegwirft — und seit dem 04.11. auch, welche
        // es DURCHLAESST. EIN Helfer fuer beide Seiten: zwei Ausdruecke
        // koennten auseinanderlaufen, und dann hiesse dieselbe Zahl an zwei
        // Stellen verschieden.
        //
        // Die Aufteilung steht DIREKT hinter ihrer Seite, nicht hinten an
        // der Zeile. Bis zum 04.11. stand dort `ja 64 · nein 16 · 12
        // SELL/4 BUY`, und das las sich, als beschriebe die Aufteilung alle
        // 80 — sie beschrieb nur die 16.
        // `anzahl` ist die Zahl der Seite: deckt die Aufteilung sie nicht ab,
        // wird gesagt, wie viele sie beschreibt. AUSGEFUEHRT BELEGT am
        // Deploy-Uebergang vom 04.11. — `ja` zaehlt den ganzen Tag aus Redis,
        // die Aufteilung erst ab dem Deploy, und `67 ja (2 SELL/1 BUY)` las
        // sich wie alle 67. Siehe `richtungText` in `zyklus-bilanz.ts`.
        const seite = (r: Record<string, number> | undefined,
          anzahl: number | null) => {
          const e = Object.entries(r ?? {})
            .filter(([, n]) => zahl(n) !== null && (zahl(n) as number) > 0)
            .sort((x, y) => (zahl(y[1]) as number) - (zahl(x[1]) as number));
          if (e.length === 0) return "";
          const kern = e.map(([d, n]) => `${n} ${htmlSicher(d)}`).join("/");
          const summe = e.reduce((su, [, n]) => su + (zahl(n) as number), 0);
          return anzahl !== null && summe < anzahl
            ? ` (davon ${summe} mit Richtung: ${kern})` : ` (${kern})`;
        };
        zeilen.push(`      ${htmlSicher(name)}: ja ${ja === null ? "?" : ja}`
          + `${seite(s?.richtungenJa, ja)} · nein ${nein === null ? "?" : nein}`
          + `${seite(s?.richtungen, nein)}`
          + `${fb !== null && fb > 0 ? ` · Rückfall ${fb}` : ""}${grund}`);
      }
      // Was fehlt, wird GEZAEHLT — eine verschwiegene Zeile waere
      // schlimmer als eine fehlende (31.10.).
      const restTore = sortiert.length - gezeigt.length;
      if (restTore > 0) {
        const restNein = sortiert.slice(TORE_MAX_STATUS)
          .reduce((su, [, s]) => su + (zahl(s?.nein ?? null) ?? 0), 0);
        zeilen.push(`      (${restTore} weitere Tore, ${restNein} Ablehnungen)`);
      }
      // ── DAS URTEIL SIEHT ALLE TORE, NICHT NUR DIE GEZEIGTEN ──────────
      //
      // Bis zum Deckel entstand `abgelehnt` IN der Anzeige-Schleife. Bliebe
      // es dabei, entschiede der Deckel mit, welches Tor als groesster
      // Blocker gilt — eine Anzeige-Grenze wuerde die DIAGNOSE aendern.
      // Heute faellt es nicht auf (sortiert wird nach genau dieser Zahl),
      // aber es waere nur zufaellig richtig, und eine andere Sortierung
      // spaeter machte daraus stillschweigend einen Fehler.
      for (const [name, s] of alleTore) {
        const n = zahl(s?.nein ?? null);
        if (n !== null && n > 0) abgelehnt.push([name, n]);
      }
      abgelehnt.sort((x, y) => y[1] - x[1]);
      if (abgelehnt.length > 0) groesstesTor = { name: abgelehnt[0][0], n: abgelehnt[0][1] };
    }

    // ── DIE AUSFUEHRUNG — DIE STUFE NACH DEM LETZTEN TOR (23.11.) ──────
    //
    // „Jede Stufe, an der ein Signal sterben kann, braucht eine eigene
    // Zahl" (22.09.). Der Broker war die letzte ohne Zahl in /status.
    // Dreiwertig: fehlt die Zahl, steht „unbekannt" da, nicht 0.
    //
    // Die Zahl der ERÖFFNETEN Trades steht nicht hier: sie steht oben als
    // Tageslimit-Zaehler. Zweimal dieselbe Zahl kostet Platz, und /status
    // ist an der Grenze.
    const bf = zahl(t.brokerFehler ?? null);
    const bfGruende = Object.entries(t.brokerFehlerGruende ?? {})
      .filter(([, n]) => zahl(n) !== null && (zahl(n) as number) > 0)
      .sort((x, y) => (zahl(y[1]) as number) - (zahl(x[1]) as number));
    let bfText = "";
    if (bf !== null && bf > 0) {
      // Der Schluessel lautet `SYMBOL: Broker: <Fehler>` (orchestrator-agent.ts,
      // `brokerGrund`). In einer Zeile, die schon „beim Broker" heisst, ist das
      // zweite „Broker:" nur Platz, der dem Fehlertext fehlt.
      bfText = bfGruende.length > 0
        ? ` — ${entschaerftGekuerzt(String(bfGruende[0][0]).replace(/^([^:]{1,24}): Broker: /, "$1: "),
          BROKER_GRUND_MAX_STATUS)} (${bfGruende[0][1]})`
          + (bfGruende.length > 1 ? ` +${bfGruende.length - 1} Gründe` : "")
        : " — Grund unbekannt";
      brokerGescheitert = bf;
    }
    zeilen.push(`   • beim Broker gescheitert: ${bf === null ? "unbekannt" : bf}${bfText}`);
  } else if (t && scans === 0) {
    zeilen.push("");
    zeilen.push("🔻 Trichter heute: kein einziger Zyklus kam bis zur Analyse");
  }

  // ── 10. Das Urteil — und es behauptet nicht mehr, als es weiss ───────────
  zeilen.push("");
  if (blocker.length > 0) {
    zeilen.push(`🛑 <b>Blockiert von ${blocker.length}:</b>`);
    for (const b of blocker) zeilen.push(`   • ${b}`);
  } else if (unbekannt.length > 0) {
    zeilen.push("🟡 <b>Kein Tor blockt nachweislich</b> — aber "
      + `${unbekannt.length} Angabe(n) nicht feststellbar: ${unbekannt.join(", ")}`);
  } else if (zahl(t?.go ?? null) !== null && (zahl(t?.go ?? null) as number) > 0
    && groesstesTor !== null) {
    // AM 30.10. ZEIGTE DIESES URTEIL AUF DIE FALSCHE STELLE. Es sagte
    // „liegt es an der Ausführung", waehrend im selben Bericht „Keine
    // Kandidaten nach Filter: 2" stand. Die Tore NACH dem GO sind nicht
    // die Ausfuehrung — und sie melden sich namentlich.
    const tor: { name: string; n: number } = groesstesTor;
    // 23.11.: wer ALLE Tore passierte und beim Broker scheiterte, ist an
    // keinem Tor gescheitert — sonst nennt das Urteil nur die Stelle davor.
    // Kuerzer gefasst (23.11.): die Broker-Zahl brauchte Platz, und
    // /status lag im Haertefall bei 4094 von 4096. Keine Aussage faellt weg.
    zeilen.push(`🟡 <b>Kein Vor-Tor blockt</b>: ${zahl(t?.go ?? null)} GO, `
      + "an den Toren DANACH"
      + (brokerGescheitert > 0 ? ` und beim Broker (<b>${brokerGescheitert}</b>)` : "")
      + " gescheitert. "
      + `Grösstes: <b>${htmlSicher(tor.name)}</b> (${tor.n}× nein).`);
  } else if (zahl(t?.go ?? null) !== null && (zahl(t?.go ?? null) as number) > 0) {
    zeilen.push(`🟢 <b>Kein Tor blockt</b>, und ${zahl(t?.go ?? null)} Signal(e) `
      + "wurden freigegeben, und kein Tor danach hat abgelehnt. "
      + (brokerGescheitert > 0
        ? `An der Ausführung gescheitert: <b>${brokerGescheitert}</b> beim Broker — Grund oben.`
        : "Bleiben die Trades trotzdem aus, liegt es an der Ausführung."));
  } else if (groessteStufe !== null) {
    const g: { name: string; n: number } = groessteStufe;
    zeilen.push("🟢 <b>Kein Tor blockt</b> — die Signale sterben im Trichter. "
      + `Grösste Stufe heute: <b>${htmlSicher(g.name)}</b> (${g.n}).`);
  } else {
    zeilen.push("🟢 <b>Kein Tor blockt.</b> Bleiben die Trades trotzdem aus, "
      + "stirbt das Signal im Trichter — die Zyklus-Tagesbilanz (22:05 UTC) "
      + "sagt an welcher Stufe.");
  }

  return { blocker, unbekannt, zeilen };
}
