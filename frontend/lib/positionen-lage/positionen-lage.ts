/**
 * WAS IST MIT DEN OFFENEN POSITIONEN? — der Block für `/status` (07.11.)
 *
 * ── ANLASS ──────────────────────────────────────────────────────────────────
 *
 * `/status` vom 07.11. meldete **„Positionen: 1/6"** — und sonst nichts. Die
 * Position war zu dem Zeitpunkt rund **70 Stunden** alt (eröffnet am 04.11.,
 * über ein ganzes Wochenende gehalten). Ob das in Ordnung ist, hängt am
 * Handelsstil: SCALPING 4 h, DAYTRADING 24 h, SWING 168 h. Nur SWING
 * rechtfertigt 70 Stunden.
 *
 * **Aus `/status` war das nicht zu beantworten.** Kein Symbol, kein Alter,
 * kein Stil — die Zahl `1` allein. Das ist die Fehlerklasse „eine Diagnose
 * darf im interessanten Fall nicht schweigen", angewandt auf genau die Frage,
 * die man stellt, wenn eine Position lange offen steht.
 *
 * Und die Daten lagen die ganze Zeit da: `capitalGetPositions` liefert das
 * volle Array, der Webhook nahm `.length`. Dieselbe Form wie `confidence`
 * (02.11.) und `richtungenJa` (04.11.).
 *
 * ── WAS DER ZEIT-EXIT WIRKLICH TUT ──────────────────────────────────────────
 *
 * Nachgelesen in `risk-agent.ts`, nicht vermutet. Er greift **nicht** in zwei
 * benannten Lagen, und beide sind im Betrieb unsichtbar:
 *
 *   • **Keine Eröffnungszeit** vom Broker → `ageHours` ist `null`, die
 *     Position „läuft ohne Haltedauer-Grenze" (Regel vom 19.08.: unbekannt
 *     bleibt unbekannt, es wird NICHT auf einer erfundenen Zahl geschlossen).
 *   • **Geratener Handelsstil** (keine brauchbare Journal-Zeile) → „Zeit-Exit
 *     AUSGESETZT", weil 24 h auf einer Annahme eine SWING-Position 144 Stunden
 *     zu früh schlösse. Breakeven, Teilgewinn und Trailing laufen weiter.
 *
 * Beide schreiben **einmal je Position** eine Warnung ins Log
 * (`geratenerStilMelden`). Nach drei Tagen ist diese Zeile aus dem
 * Railway-Log gescrollt — und dann gibt es keine Stelle mehr, die es sagt.
 *
 * ── WAS ES NICHT TUT ────────────────────────────────────────────────────────
 *
 * Es entscheidet nichts, schliesst nichts und verändert keinen Wert, den der
 * Handel liest. Reine Ableitung aus Zahlen, die ohnehin schon abgerufen sind.
 * Keine Importe, keine Seiteneffekte — damit darf `/status` es benutzen, ohne
 * sich an den Modulgraphen von `risk-agent.ts` zu binden (Prisma, Bus,
 * Telegram, Broker-Client). Dieselbe Begründung wie bei `htmlSicher` (31.10.)
 * und `fensterInAnzeigeZone` (01.11.).
 */

/**
 * Die Haltedauern je Handelsstil, in Stunden.
 *
 * **Eine Kopie von `STYLE_MAX_HOURS` in `risk-agent.ts` — und das ist eine
 * bewusste Entscheidung.** Die Datei dort hat erhöhtes Risiko und zieht einen
 * schweren Modulgraphen nach; sie von `/status` zu importieren hiesse, dem
 * Befehl, den man benutzt wenn etwas kaputt ist, eine Laufzeit-Fehlerquelle
 * zu geben (die Lehre vom 27.10.).
 *
 * Damit die beiden nicht auseinanderlaufen, hält `safety-nets` sie
 * **gegeneinander**: die Tabelle wird per Klammerzähler aus `risk-agent.ts`
 * geschnitten und muss Schlüssel für Schlüssel gleich sein. Eine Zahl, die an
 * zwei Stellen steht, veraltet sonst an einer davon.
 */
export const STIL_GRENZEN_STUNDEN: Record<string, number> = {
  SCALPING: 4, DAYTRADING: 24, SWING: 168,
};

/** Eine offene Position, so wie `/status` sie zusammenträgt. */
export type OffenePositionEingabe = {
  symbol: string | null;
  direction: string | null;
  /** Broker-Zeit, bereits nach UTC umgerechnet. Leer = nicht geliefert. */
  createdDate: string | null;
  /**
   * Handelsstil aus der Journal-Zeile. `null` heisst: **keine brauchbare
   * Zeile** — genau die Lage, in der `risk-agent.ts` den Zeit-Exit aussetzt.
   */
  stil: string | null;
};

/** Was sich über eine offene Position sagen lässt — und was nicht. */
export type PositionsBefund = {
  symbol: string;
  richtung: string;
  /** Stunden seit Eröffnung. `null` = Broker lieferte keine Zeit. */
  alterStunden: number | null;
  stil: string | null;
  /** Haltedauer-Grenze des Stils. `null` = kein Stil, also keine Grenze. */
  grenzeStunden: number | null;
  /**
   * `aktiv` — der Zeit-Exit kann greifen.
   * `ohne-zeit` — der Broker lieferte keine Eröffnungszeit.
   * `ohne-stil` — keine brauchbare Journal-Zeile, Zeit-Exit AUSGESETZT.
   */
  zeitExit: "aktiv" | "ohne-zeit" | "ohne-stil";
  /** Nur wahr, wenn BEIDES bekannt ist und die Grenze überschritten wurde. */
  ueberfaellig: boolean;
};

/**
 * `dealId` → Handelsstil aus den Journal-Notizen.
 *
 * **Dieselbe Bedingung wie `stammdatenAusNotizen()` in `risk-agent.ts`** —
 * und das ist der Punkt: genau dann, wenn dort KEIN Eintrag entsteht, gilt
 * der Stil als *geraten* und der Zeit-Exit wird ausgesetzt. Eine lockerere
 * Regel hier zeigte „DAYTRADING" an, während der Code die Position in
 * Wirklichkeit ohne Haltedauer-Grenze laufen lässt — also genau die Lüge,
 * gegen die dieser Block gebaut ist.
 *
 * Verlangt werden deshalb alle drei: `dealId`, ein nicht-leerer
 * `tradingStyle` **und** eine endliche `confidence`. Besonders das letzte
 * ist leicht zu übersehen; `Number(null)` wäre 0 und ginge als Messung
 * durch (die Begründung steht so in `risk-agent.ts`).
 *
 * `safety-nets` führt **beide** Funktionen über dieselben Eingaben und
 * verlangt dasselbe Ergebnis — eine zweite Umsetzung ohne diesen Nachweis
 * liefe irgendwann auseinander.
 */
export function stilKarteAusNotizen(
  zeilen: ReadonlyArray<{ notes: string | null }> | null | undefined,
): Map<string, string> {
  const karte = new Map<string, string>();
  for (const z of zeilen ?? []) {
    if (!z?.notes) continue;
    try {
      const m = JSON.parse(z.notes) as {
        dealId?: string; tradingStyle?: string; confidence?: number;
      };
      const stil = text(m.tradingStyle);
      const conf = m.confidence;
      if (m.dealId && stil && typeof conf === "number" && Number.isFinite(conf)) {
        karte.set(String(m.dealId), stil);
      }
    } catch {
      // Eine kaputte Notiz darf die übrigen nicht mitnehmen.
    }
  }
  return karte;
}

/** Endliche Zahl oder `null` — ein `NaN` ist keine Messung. */
function zahl(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Das Alter in Stunden — oder `null`.
 *
 * Eine unlesbare oder fehlende Zeit wird **nicht** zu 0. Das hiesse „gerade
 * eben eröffnet", und genau diese stille Null war der Fehler, den
 * `risk-agent.ts` am 19.08. losgeworden ist (`?? Date.now()`).
 *
 * Eine Zeit in der ZUKUNFT ergibt ein negatives Alter. Sie wird **nicht**
 * auf 0 geklemmt: eine Klemme versteckte den Fehler, und die Regel vom
 * 22.09. verlangt das Gegenteil — bis zwei Minuten gilt sie als
 * Uhren-Versatz, darüber ist das Alter **unbekannt**.
 */
export function alterStunden(createdDate: string | null, jetzt: Date): number | null {
  const roh = text(createdDate);
  if (roh === "") return null;
  // ── OHNE ZONENANGABE WIRD NICHT GERECHNET (07.11.) ──────────────────────
  //
  // Capital.com schickt seine Zeitstempel **ohne Zone**, und genau das hat am
  // 22.09. zwei Monate lang das Kurs-Alter verfälscht: `new Date()` las die
  // Ortszeit als UTC und bekam zwei Stunden in die Zukunft.
  //
  // Der Broker-Client rechnet seit damals **an der Grenze** um
  // (`brokerZeitNachUtc`, `capital-com-client.ts:965`) und liefert entweder
  // `""` oder ein `toISOString()` — also immer mit `Z`. Diese Funktion darf
  // sich darauf aber nicht VERLASSEN: sie ist exportiert, und der nächste
  // Aufrufer reicht vielleicht eine rohe Zeit herein.
  //
  // Ohne Zone wäre das Alter still um den Zonenversatz daneben — in Zürich
  // ein bis zwei Stunden. Bei DAYTRADING (Grenze 24 h) entscheidet genau das
  // über „überfällig". Also: **unbekannt**, nicht geraten.
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(roh)) return null;
  const d = new Date(roh);
  if (Number.isNaN(d.getTime())) return null;
  const ms = jetzt.getTime() - d.getTime();
  if (!Number.isFinite(ms)) return null;
  const stunden = ms / 3_600_000;
  if (stunden < 0) {
    // Bis zwei Minuten Uhren-Versatz, darüber UNBEKANNT (Regel 22.09.).
    return stunden > -(2 / 60) ? 0 : null;
  }
  return Number(stunden.toFixed(1));
}

/**
 * Braucht diese Position Aufmerksamkeit?
 *
 * Wahr, wenn der Zeit-Exit **nicht greifen kann** (kein Stil, keine
 * Eröffnungszeit) oder die Haltedauer **überschritten** ist.
 */
export function brauchtAufmerksamkeit(b: PositionsBefund): boolean {
  return b.zeitExit !== "aktiv" || b.ueberfaellig;
}

/**
 * Was über die offenen Positionen zu sagen ist.
 *
 * ── DIE REIHENFOLGE IST EIN RIEGEL, KEINE KOSMETIK ──────────────────────────
 *
 * Sortiert wird **Auffälliges zuerst**, darin nach Alter absteigend.
 *
 * Der erste Entwurf sortierte nur nach Alter. Das sieht vernünftig aus und
 * hat ein Loch: eine Position **ohne Eröffnungszeit** hat `alterStunden ===
 * null` und landete damit ganz **unten** — und fiele als erste aus einem
 * Deckel heraus. Ausgerechnet der Fall, in dem der Zeit-Exit gar nicht
 * greifen kann, wäre also der erste, den die Anzeige verschweigt.
 *
 * Dieselbe Lehre wie bei der Tor-Liste (31.10.): eine Sortierung, die *da*
 * ist, aber falsch herum, lässt genau das wegfallen, wegen dem man hinsieht.
 */
export function positionenLage(
  positionen: ReadonlyArray<OffenePositionEingabe> | null | undefined,
  jetzt: Date,
): PositionsBefund[] {
  const aus: PositionsBefund[] = [];
  for (const p of positionen ?? []) {
    const alter = alterStunden(p?.createdDate ?? null, jetzt);
    const stil = text(p?.stil).toUpperCase() || null;
    const grenze = stil === null ? null : (zahl(STIL_GRENZEN_STUNDEN[stil]) ?? null);
    // DIE REIHENFOLGE DER ZWEIGE SPIEGELT `risk-agent.ts`: dort wird zuerst
    // das fehlende Alter geprüft, dann der geratene Stil. Ein unbekannter
    // Stil ohne Alter ist beides — gemeldet wird der Grund, der zuerst
    // greift, damit die Anzeige dieselbe Geschichte erzählt wie der Code.
    const zeitExit: PositionsBefund["zeitExit"] =
      alter === null ? "ohne-zeit" : stil === null ? "ohne-stil" : "aktiv";
    aus.push({
      symbol: text(p?.symbol) || "—",
      richtung: text(p?.direction).toUpperCase() || "—",
      alterStunden: alter,
      stil,
      grenzeStunden: grenze,
      zeitExit,
      // NUR wenn beides bekannt ist. Ein „überfällig" auf einer Annahme
      // wäre eine Behauptung statt einer Messung.
      ueberfaellig: zeitExit === "aktiv" && alter !== null && grenze !== null
        && alter >= grenze,
    });
  }
  aus.sort((a, b) => {
    const aa = brauchtAufmerksamkeit(a) ? 0 : 1;
    const bb = brauchtAufmerksamkeit(b) ? 0 : 1;
    if (aa !== bb) return aa - bb;
    if (a.alterStunden === null && b.alterStunden === null) return 0;
    if (a.alterStunden === null) return 1;
    if (b.alterStunden === null) return -1;
    return b.alterStunden - a.alterStunden;
  });
  return aus;
}
