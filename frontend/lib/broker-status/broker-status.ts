// ── Broker-Zustand: ABGELEITET, nicht behauptet (03.09.) ─────────────────────
//
// WAS HIER VORHER STAND — nämlich in `components/BrokerCenterPanel.tsx`, fest
// verdrahtet auf Modulebene und ohne einen einzigen `fetch`:
//
//   { label: "Connected",                  value: "10" }
//   { label: "Broker Modules",             value: "12" }
//   { label: "Routing Tickets",            value: "11" }
//   { label: "Connected Broker Tickets",   value: "10" }
//   { label: "Healthy Sync Tickets",       value: "10" }
//   …insgesamt fünfzehn solcher Zeilen.
//
// Es gibt ZWEI Broker in diesem Programm. "Connected: 10" war keine veraltete
// Zahl, sondern eine erfundene — und sie sah aus wie ein Live-Zustand. Dieselbe
// Fehlerklasse wie die festen Zeilen in `market-health.ts` (26.08.) und wie
// "Status: Prepared" bei einer Ansicht, die es nie gab.
//
// Hier wird NICHTS gezählt, was nicht wirklich da ist. Beide Broker halten ihre
// Sitzung auf `global` (`__capital_session__`, `__icmarkets_session__`) — von
// dort kommen Verbindungszustand, Konto, Saldo und Verbindungszeitpunkt. Ist
// ein Broker nicht verbunden, stehen die Werte auf `null` und NICHT auf 0:
// "kein Saldo bekannt" und "Saldo ist null" sind zwei verschiedene Aussagen.
//
// Bewusst NICHT enthalten: offene Positionen. Die lägen nur über einen
// Broker-Abruf vor, und diese Ansicht wird beim Öffnen des Dashboards geladen —
// eine Anfrage je Aufruf wäre Last ohne Not. Was fehlt, wird benannt statt
// geschätzt (`nichtGemessen` unten).

/** Was das Programm über eine Capital.com-Sitzung weiß. */
export interface CapitalSitzung {
  accountId?: string | null;
  accountType?: string | null;
  connectedAt?: string | null;
  balance?: number | null;
  currency?: string | null;
}

/** Was das Programm über eine IC-Markets-Sitzung weiß. */
export interface ICSitzung {
  accountId?: string | null;
  connectedAt?: string | null;
  balance?: number | null;
  equity?: number | null;
  currency?: string | null;
  leverage?: number | null;
}

export interface BrokerZeile {
  broker: "CAPITAL_COM" | "IC_MARKETS";
  name: string;
  /** Was dieser Broker in diesem Programm TUT — keine Werbung, eine Aussage. */
  rolle: string;
  verbunden: boolean;
  kontoId: string | null;
  kontoArt: string | null;
  saldo: number | null;
  eigenkapital: number | null;
  waehrung: string | null;
  verbundenSeit: string | null;
  /** Stunden seit dem Verbindungsaufbau, oder null bei unlesbarem Zeitstempel. */
  stundenVerbunden: number | null;
  hinweis: string;
}

export interface BrokerZustand {
  broker: BrokerZeile[];
  verbunden: number;
  gesamt: number;
  /** Was diese Ansicht ausdrücklich NICHT misst — damit das Fehlen erklärt ist
   *  statt unbemerkt zu bleiben. */
  nichtGemessen: string[];
  updatedAt: string;
}

/** Eine Zahl gilt nur als Zahl, wenn sie eine ist. `Number(null)` ist 0 — das
 *  würde "unbekannt" in "null Franken" verwandeln. */
function zahl(wert: unknown): number | null {
  const n = Number(wert);
  return typeof wert === "number" || (typeof wert === "string" && wert.trim() !== "")
    ? (Number.isFinite(n) ? n : null)
    : null;
}

function text(wert: unknown): string | null {
  const s = String(wert ?? "").trim();
  return s === "" ? null : s;
}

/** Stunden seit einem ISO-Zeitstempel. Unlesbar → null, NICHT 0. */
function stundenSeit(zeitpunkt: unknown, jetzt: number): number | null {
  const roh = text(zeitpunkt);
  if (!roh) return null;
  const ms = Date.parse(roh);
  if (!Number.isFinite(ms)) return null;
  const stunden = (jetzt - ms) / 3_600_000;
  return Number.isFinite(stunden) ? Number(stunden.toFixed(1)) : null;
}

/**
 * Leitet den Broker-Zustand aus den beiden Sitzungen ab.
 *
 * Als eigene Funktion und NICHT als Schleife in der Route: eingebettet ließe
 * sie sich nicht aufrufen und damit nicht beweisen — derselbe Grund, aus dem
 * `nachzuregistrieren()`, `positionenOhneStammdaten()` und
 * `zuordnungAusPositionen()` als Funktionen dastehen.
 */
export function brokerZustand(
  capital: CapitalSitzung | null | undefined,
  icMarkets: ICSitzung | null | undefined,
  jetzt: number = Date.now(),
): BrokerZustand {
  const capitalDa = !!capital;
  const icDa = !!icMarkets;

  const zeilen: BrokerZeile[] = [
    {
      broker: "CAPITAL_COM",
      name: "Capital.com",
      // Beleg: der Orchestrator holt hier die Kurse (`fetchMarkets`), und alle
      // Orders laufen über `capital-com-execution.ts`.
      rolle: "Live-Broker — Orders und Kurse",
      verbunden: capitalDa,
      kontoId: capitalDa ? text(capital?.accountId) : null,
      kontoArt: capitalDa ? text(capital?.accountType) : null,
      saldo: capitalDa ? zahl(capital?.balance) : null,
      eigenkapital: null, // Capital liefert in der Sitzung kein Equity
      waehrung: capitalDa ? text(capital?.currency) : null,
      verbundenSeit: capitalDa ? text(capital?.connectedAt) : null,
      stundenVerbunden: capitalDa ? stundenSeit(capital?.connectedAt, jetzt) : null,
      hinweis: capitalDa
        ? "Sitzung aktiv"
        : "keine Sitzung — ohne sie überspringt der Handelszyklus jeden Durchlauf",
    },
    {
      broker: "IC_MARKETS",
      name: "IC Markets",
      // Beleg: `market-health.ts` führt IC_MARKETS ausdrücklich unter den
      // Quellen OHNE Kurse — angebunden für Orders, nicht als Kursquelle.
      rolle: "zweiter Broker — Orders, keine Kursquelle",
      verbunden: icDa,
      kontoId: icDa ? text(icMarkets?.accountId) : null,
      kontoArt: null, // die IC-Sitzung führt keine Kontoart
      saldo: icDa ? zahl(icMarkets?.balance) : null,
      eigenkapital: icDa ? zahl(icMarkets?.equity) : null,
      waehrung: icDa ? text(icMarkets?.currency) : null,
      verbundenSeit: icDa ? text(icMarkets?.connectedAt) : null,
      stundenVerbunden: icDa ? stundenSeit(icMarkets?.connectedAt, jetzt) : null,
      hinweis: icDa ? "Sitzung aktiv" : "keine Sitzung",
    },
  ];

  return {
    broker: zeilen,
    verbunden: zeilen.filter((z) => z.verbunden).length,
    gesamt: zeilen.length,
    nichtGemessen: [
      "offene Positionen je Broker — bräuchte je Aufruf eine Broker-Anfrage",
      "Ausführungsqualität, Latenz und Slippage — hier wird nichts davon gemessen",
    ],
    updatedAt: new Date(jetzt).toISOString(),
  };
}
