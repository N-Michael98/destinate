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
}

/** Ein Tor, wie es die Zyklus-Bilanz zaehlt (`TorSumme` dort). */
export interface TorZahlen {
  ja?: number;
  nein?: number;
  fallback?: number;
  gruende?: Record<string, number>;
}

export interface HandelsLage {
  /** Was JETZT nachweislich blockt — leer heisst: kein Tor steht zu. */
  blocker: string[];
  /** Was nicht feststellbar war. Eine leere Liste ist eine Aussage. */
  unbekannt: string[];
  /** Die fertigen Zeilen fuer die Antwort. */
  zeilen: string[];
}

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
    blocker.push(`Modus ist ${e.modus}, nicht AUTO`);
    zeilen.push(`⛔ Modus: ${e.modus} — gehandelt wird nur bei AUTO`);
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
  if (e.inHandelszeit === true) {
    zeilen.push("✅ Handelszeit: offen (Mo–Fr 08–22 UTC)");
  } else if (e.inHandelszeit === false) {
    blocker.push("Ausserhalb der Handelszeit — ausserhalb Mo–Fr 08–22 UTC normal");
    zeilen.push("⛔ Handelszeit: ZU (Mo–Fr 08–22 UTC) — ausserhalb davon normal");
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
        zeilen.push(`   • ${grund}: ${n}`);
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
    zeilen.push(`   • ohne GPT-Antwort: `
      + `${ohneAntwort === null ? "unbekannt" : ohneAntwort}`
      + `${ohneAntwort !== null && ohneAntwort > 0 ? " (als WAIT gezählt, aber kein Urteil)" : ""}`);
    zeilen.push(`   • Richtungssignale (BUY/SELL): `
      + `${richt === null ? "unbekannt" : richt}`);
    for (const [name, n] of stufen) {
      if (n === null) { zeilen.push(`   • ${name}: unbekannt`); continue; }
      // Der Grund gehoert dazu: die Zahl allein sagt nicht, WELCHER Dienst
      // ausgefallen ist — genau die Frage, mit der man ins Log steigt.
      let zusatz = "";
      if (name.startsWith("ohne vollständige") && t.ohneVolleDatenGrund) {
        const g = Object.entries(t.ohneVolleDatenGrund)
          .filter(([, v]) => zahl(v) !== null && (zahl(v) as number) > 0)
          .map(([k, v]) => `${k} ${v}`).join(", ");
        if (g) zusatz = ` — ${g}`;
      }
      if (name.startsWith("unter der Confidence")) {
        const cMin = zahl(t.confMin); const cMax = zahl(t.confMax);
        if (cMin !== null && cMax !== null) zusatz = ` (${cMin}–${cMax})`;
      }
      zeilen.push(`   • ${name}: ${n}${zusatz}`);
      if (n > 0 && (groessteStufe === null || n > groessteStufe.n)) {
        groessteStufe = { name, n };
      }
    }
    const go = zahl(t.go);
    zeilen.push(`   • <b>GO: ${go === null ? "unbekannt" : go}</b>`);

    // ── WAS NACH DEM GO PASSIERT ──────────────────────────────────────
    //
    // Ein GO ist noch kein Trade: danach kommen Walk-Forward, die
    // Confidence-Schwelle, das Stil-Tageslimit und die Filterkette. Genau
    // dort starben am 30.10. beide freigegebenen Signale.
    const tore = t.tore;
    if (tore && Object.keys(tore).length > 0) {
      const abgelehnt: Array<[string, number]> = [];
      zeilen.push("   <b>Tore nach dem GO:</b>");
      for (const [name, s] of Object.entries(tore)) {
        const ja = zahl(s?.ja ?? null);
        const nein = zahl(s?.nein ?? null);
        const fb = zahl(s?.fallback ?? null);
        // Der haeufigste Grund gehoert dazu: die Zahl allein sagt nicht,
        // WARUM das Tor zu war — und genau das ist die Frage.
        const gruende = Object.entries(s?.gruende ?? {})
          .filter(([, n]) => zahl(n) !== null && (zahl(n) as number) > 0)
          .sort((x, y) => (zahl(y[1]) as number) - (zahl(x[1]) as number));
        const grund = gruende.length > 0 ? ` — ${gruende[0][0]} (${gruende[0][1]})` : "";
        zeilen.push(`      ${name}: ja ${ja === null ? "?" : ja} · `
          + `nein ${nein === null ? "?" : nein}`
          + `${fb !== null && fb > 0 ? ` · Rückfall ${fb}` : ""}${grund}`);
        if (nein !== null && nein > 0) abgelehnt.push([name, nein]);
      }
      abgelehnt.sort((x, y) => y[1] - x[1]);
      if (abgelehnt.length > 0) groesstesTor = { name: abgelehnt[0][0], n: abgelehnt[0][1] };
    }
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
    zeilen.push(`🟡 <b>Kein Vor-Tor blockt</b>, und ${zahl(t?.go ?? null)} Signal(e) `
      + "wurden freigegeben — aber sie sind an den Toren DANACH gescheitert. "
      + `Grösstes: <b>${tor.name}</b> (${tor.n}× nein).`);
  } else if (zahl(t?.go ?? null) !== null && (zahl(t?.go ?? null) as number) > 0) {
    zeilen.push(`🟢 <b>Kein Tor blockt</b>, und ${zahl(t?.go ?? null)} Signal(e) `
      + "wurden freigegeben, und kein Tor danach hat abgelehnt. Bleiben die "
      + "Trades trotzdem aus, liegt es an der Ausführung.");
  } else if (groessteStufe !== null) {
    const g: { name: string; n: number } = groessteStufe;
    zeilen.push("🟢 <b>Kein Tor blockt</b> — die Signale sterben im Trichter. "
      + `Grösste Stufe heute: <b>${g.name}</b> (${g.n}).`);
  } else {
    zeilen.push("🟢 <b>Kein Tor blockt.</b> Bleiben die Trades trotzdem aus, "
      + "stirbt das Signal im Trichter — die Zyklus-Tagesbilanz (22:05 UTC) "
      + "sagt an welcher Stufe.");
  }

  return { blocker, unbekannt, zeilen };
}
