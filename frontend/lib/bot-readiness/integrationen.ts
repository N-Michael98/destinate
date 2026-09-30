/**
 * Welche Integrationen gibt es WIRKLICH — abgeleitet statt behauptet (30.09.)
 *
 * ── DER ANLASS ──────────────────────────────────────────────────────────────
 *
 * `app/trading-journal/page.tsx` hielt DREIZEHN fest verdrahtete Aussagen, und
 * jede einzelne widersprach dem laufenden System:
 *
 *   Broker Integration        LOCKED, "V6.0"        → Capital.com IST der
 *                                                      Live-Broker
 *   GPT / OpenAI Integration  LOCKED, "Coming Soon" → macht den Marktscan
 *   Claude Integration        LOCKED, "Coming Soon" → Meta-Analyse + Risiko
 *   Auto Execution            LOCKED, "Final Stage" → läuft
 *   6 "Future Connections"    alle "Coming Soon"    → vier davon laufen
 *   "V6.0 Broker Integration Layer vorbereiten"     → gibt es
 *   "V6.1 OpenAI/Claude Signal Review anbinden"     → gibt es
 *   "V6.2 Paper Trading Execution Engine bauen"     → gibt es (9 Module)
 *
 * Die Seite ist im Dashboard verlinkt (Menüeintrag + Render-Zeile in
 * `page.tsx`), also keine tote Ecke. Dieselbe Fehlerklasse wie „Live Prep /
 * Status: Prepared" (26.08.) und wie `market-health.ts` („TradingView
 * verbunden, 20 ms") — nur in die andere Richtung: etwas als „kommt noch"
 * anzeigen, das längst läuft.
 *
 * NICHT KOSMETISCH: wer im Ernstfall hier nachsieht, liest „Broker nicht
 * verbunden, Auto Execution noch nicht aktiv" — und entscheidet danach über
 * den Killswitch.
 *
 * ── WAS DIESE DATEI TUT, UND WAS NICHT ──────────────────────────────────────
 *
 * Sie ERFINDET nichts. Der Verbindungszustand kommt aus `/api/broker-status`
 * (leitet aus den echten Sitzungen ab) und `/api/settings`. Schlägt eine
 * Abfrage fehl, ist der Wert `null` — und dann heisst es „Unbekannt", NICHT
 * „nicht verbunden". Eine stille Null wäre genau die Lüge, die dieses Projekt
 * am 22.09. zwei Monate lang getragen hat.
 *
 * Die Einträge ohne Laufzeitmessung sind CODE-Aussagen, keine
 * Verbindungsmeldungen: sie sagen „gebaut und im Handelszyklus verdrahtet",
 * und der Hinweis nennt die Stelle. Ob der API-Schlüssel in diesem Moment
 * trägt, ist eine andere Frage — die beantwortet das KI-Tor-Alarmsystem
 * (`ai-gate-alert.ts`), nicht diese Anzeige.
 *
 * Als Funktionen in einem eigenen Modul, nicht als Konstanten in der Seite:
 * nur so kann ein Prüfer sie AUSFÜHREN. Genau daran ist die alte Fassung
 * gescheitert — dreizehn Literale, die kein Prüfer je gegen die Wirklichkeit
 * gehalten hat.
 */

export type IntegrationsEingabe = {
  /** `null` = Abfrage fehlgeschlagen. Das ist NICHT dasselbe wie `false`. */
  capitalVerbunden: boolean | null;
  icVerbunden: boolean | null;
  /**
   * `icMarketsExecutionEnabled` aus den Einstellungen (Standard: false).
   * `null` = Abfrage fehlgeschlagen. Ein fest angenommenes `false` wäre
   * dieselbe Lüge wie vorher, nur in die andere Richtung: schaltet jemand
   * die Ausführung ein, stünde hier weiter „abgeschaltet".
   */
  icAusfuehrung: boolean | null;
};

export type ChecklistenStatus = "READY" | "BUILDING" | "LOCKED";
export type VerbindungsStatus = "Ready" | "Coming Soon" | "Locked" | "Unbekannt";

export type IntegrationsStand = {
  checkliste: Array<{ label: string; status: ChecklistenStatus; value: string }>;
  verbindungen: Array<{ name: string; status: VerbindungsStatus; hinweis: string }>;
};

/** Nur ein echtes `true`/`false` gilt; alles andere ist unbekannt. */
function dreiwertig(v: unknown): boolean | null {
  return v === true ? true : v === false ? false : null;
}

export function integrationsStand(eingabe: IntegrationsEingabe): IntegrationsStand {
  const e = eingabe && typeof eingabe === "object" ? eingabe : ({} as IntegrationsEingabe);
  const capital = dreiwertig(e.capitalVerbunden);
  const ic = dreiwertig(e.icVerbunden);
  const icAus = dreiwertig(e.icAusfuehrung);

  const brokerZeile = capital === null
    ? { status: "BUILDING" as const, value: "Capital.com — Status nicht abrufbar" }
    : capital
      ? { status: "READY" as const, value: "Capital.com — Live-Broker, Sitzung aktiv" }
      : { status: "BUILDING" as const, value: "Capital.com — keine Sitzung" };

  return {
    checkliste: [
      { label: "Broker Integration", ...brokerZeile },
      { label: "GPT / OpenAI Integration", status: "READY", value: "Marktscan aktiv" },
      { label: "Claude Integration", status: "READY", value: "Meta-Analyse + Risiko-Agent" },
      {
        // Auto Execution hängt an der Broker-Sitzung: ohne sie wird nichts
        // ausgeführt, egal wie fertig der Code ist. Deshalb dieselbe Quelle.
        label: "Auto Execution",
        status: capital === true ? "READY" : "BUILDING",
        value: capital === true
          ? "aktiv — Orders über capital-com-execution"
          : capital === null
            ? "gebaut — Broker-Status nicht abrufbar"
            : "gebaut — wartet auf Broker-Sitzung",
      },
    ],
    verbindungen: [
      {
        name: "Capital.com",
        status: capital === null ? "Unbekannt" : capital ? "Ready" : "Locked",
        hinweis: capital === null
          ? "Status nicht abrufbar"
          : capital
            ? "Live-Broker — Orders und Kurse"
            : "keine Sitzung — der Handelszyklus überspringt jeden Durchlauf",
      },
      {
        name: "IC Markets",
        // Verbunden OHNE Ausführung ist nicht „Ready": dort wird nicht
        // gehandelt. `icMarketsExecutionEnabled` steht seit 15.09. auf false.
        // Und ein unbekannter Schalter darf nicht als „aus" durchgehen.
        status: icAus === null ? "Unbekannt"
          : !icAus ? "Locked"
            : ic === null ? "Unbekannt" : ic ? "Ready" : "Locked",
        hinweis: icAus === null
          ? "Einstellung nicht abrufbar"
          : !icAus
            ? "Ausführung in den Einstellungen abgeschaltet"
            : ic === null
              ? "Status nicht abrufbar"
              : ic ? "verbunden, Ausführung freigegeben" : "keine Sitzung",
      },
      { name: "OpenAI GPT", status: "Ready", hinweis: "Marktscan — Richtung, Stop und Ziel" },
      { name: "Claude", status: "Ready", hinweis: "Meta-Analyse, Risiko-Agent, Exit-Beratung" },
      { name: "MetaTrader 5", status: "Coming Soon", hinweis: "nicht gebaut" },
      {
        // KEINE Kursquelle. `market-health.ts` behauptete hier bis zum 26.08.
        // „verbunden, 20 ms" — gemessen wurde nie etwas.
        name: "TradingView",
        status: "Locked",
        hinweis: "nur Chart-Widget — liefert keine Kurse",
      },
    ],
  };
}

/**
 * Was ist WIRKLICH noch offen? (30.09.)
 *
 * Hier standen „V6.0 Broker Integration Layer vorbereiten", „V6.1
 * OpenAI/Claude Signal Review anbinden" und „V6.2 Paper Trading Execution
 * Engine bauen" — alle drei beschreiben Dinge, die es gibt. Nachgezählt:
 * `lib/paper-trading/` hat NEUN Module.
 *
 * Diese drei sind belegt, nicht ausgedacht:
 *  - MetaTrader 5 kommt im ganzen Programm nicht vor (gesucht in `lib`,
 *    `app/api` und `backend/services`).
 *  - `icMarketsExecutionEnabled` steht auf `false` (`settings-store.ts:19`,
 *    im Snapshot gesichert).
 *  - `getLearningAdjustmentFactor()` wird NUR von
 *    `strategy-evolution/evolution-engine.ts:56` gelesen, und das läuft in
 *    keiner Schleife. Die Fundstelle in `instrumentation.ts:835` ist ein
 *    KOMMENTAR — „ein Wort im Kommentar ist keine Verwendung".
 *
 * Bewusst statisch: es sind Aussagen über den Bauzustand, keine Messwerte.
 * Ändert sich einer, ändert sich diese Liste — und der Prüfer hält sie an
 * den Beleg, damit sie nicht wieder jahrelang danebensteht.
 */
export function offeneSchritte(): Array<{ titel: string; text: string }> {
  return [
    {
      titel: "IC Markets",
      text: "Ausführung steht auf AUS. Die Anbindung ist gebaut, aber von "
        + "keiner Risikogrenze erfasst — erst verdrahten, dann freigeben.",
    },
    {
      titel: "Lernpfad",
      text: "Gelernt wird aus echten Trades, aber der Weg vom Gelernten zum "
        + "Handel ist bewusst nicht verdrahtet. Er gehört erst gegangen, wenn "
        + "gemessen ist, dass das Lernsignal etwas taugt.",
    },
    {
      titel: "MetaTrader 5",
      text: "Nicht gebaut. Kommt im Programm an keiner Stelle vor.",
    },
  ];
}
