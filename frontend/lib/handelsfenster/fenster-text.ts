/**
 * DIE ZUERICH-UEBERSETZUNG DES HANDELSFENSTERS — GERECHNET (01.11.)
 *
 * ANLASS. `/status` nannte das Fenster als `07:00 London bis 17:00 New
 * York = 08:00–23:00 Zürich`. Der erste Teil ist die Definition und immer
 * wahr. Der zweite Teil war an DREI Stellen **fest verdrahtet** — und er
 * haengt an den Zeitzonen.
 *
 * AUSGERECHNET mit der echten `isWithinTradingSession()` ueber jeden Tag
 * 2026 und 2027: an **35 Werktagen** schliesst das Fenster in Wirklichkeit
 * um **22:00** Zuerich, nicht um 23:00 — naemlich immer dann, wenn EU- und
 * US-Sommerzeit auseinanderlaufen (09.–27.03.2026, 26.–30.10.2026,
 * 15.–26.03.2027, …). Dann liegen London und New York 4 statt 5 Stunden
 * auseinander.
 *
 * EHRLICH ZUR REICHWEITE: der Text existiert erst seit dem 01.11. und ist
 * nie falsch ausgeliefert worden — der erste falsche Tag waere der
 * 15.03.2027. Es ist also ein Fund vor dem Schaden, kein Schaden.
 *
 * Es ist dieselbe Fehlerklasse wie die zwei falschen Killswitch-Texte
 * (27.09.) und `market-health.ts` („TradingView verbunden, 20 ms"): eine
 * Anzeige, die etwas behauptet, das der Code nicht tut. Und die
 * Verwandtschaft zum Broker-Zeitfix vom 22.09. ist woertlich: „eine
 * Zeitzone, keine feste Verschiebung".
 *
 * WARUM EINE EIGENE, REINE DATEI. Die Grenzen selbst bleiben in
 * `orchestrator-agent.ts` (Datei mit erhoehtem Risiko) und werden hier als
 * Argument HEREINGEREICHT — damit gibt es sie weiter genau einmal, und
 * diese Datei muss den Handelsgraphen nicht importieren. Dieselbe
 * Begruendung wie bei `htmlSicher` und `redisLageMelden`.
 */

/** Nur das, was fuer die Uebersetzung gebraucht wird. */
export type Fenstergrenzen = {
  readonly oeffnetLondon: number;
  readonly schliesstNewYork: number;
  readonly zoneLondon: string;
  readonly zoneNewYork: string;
};

/** Die Zone, in der der Nutzer sitzt und in der die Antwort gelesen wird. */
export const ANZEIGE_ZONE = "Europe/Zurich";

/** `hh:mm` in `zone` fuer diesen Zeitpunkt — oder `null`. */
function uhrzeitInZone(d: Date, zone: string): string | null {
  try {
    const teile = new Intl.DateTimeFormat("de-CH", {
      timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d);
    const h = teile.find((t) => t.type === "hour")?.value;
    const m = teile.find((t) => t.type === "minute")?.value;
    if (h === undefined || m === undefined) return null;
    // Mitternacht kommt je nach Umgebung als "24" zurueck.
    return `${String(Number(h) % 24).padStart(2, "0")}:${m}`;
  } catch { return null; }
}

/** Minuten seit Mitternacht in `zone` — oder `null`. */
function minutenInZone(d: Date, zone: string): number | null {
  const s = uhrzeitInZone(d, zone);
  if (s === null) return null;
  const [h, m] = s.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * Der Zeitpunkt am Tag von `jetzt`, an dem es in `zone` genau
 * `minuten` nach Mitternacht ist.
 *
 * Gesucht wird ueber die Differenz zur aktuellen Ortszeit und EINMAL
 * nachkorrigiert — das faengt den Fall ab, dass zwischen `jetzt` und dem
 * Ziel eine Zeitumstellung liegt. Ohne die Korrektur waere der Wert am
 * Umstellungstag selbst um eine Stunde daneben, und genau solche Tage
 * sind der Grund fuer diese Datei.
 */
function zeitpunktFuer(jetzt: Date, zone: string, minuten: number): Date | null {
  const istMin = minutenInZone(jetzt, zone);
  if (istMin === null) return null;
  let d = new Date(jetzt.getTime() + (minuten - istMin) * 60_000);
  const nachMin = minutenInZone(d, zone);
  if (nachMin === null) return null;
  if (nachMin !== minuten) {
    d = new Date(d.getTime() + (minuten - nachMin) * 60_000);
  }
  return d;
}

/**
 * „08:00–23:00 Zürich" fuer den Tag von `jetzt` — oder `null`, wenn sich
 * eine Zone nicht aufloesen laesst.
 *
 * `null` heisst **unbekannt**, nicht „es gibt kein Fenster". Der Aufrufer
 * laesst die Angabe dann weg, statt eine falsche zu zeigen — dieselbe
 * Dreiwertigkeit wie ueberall sonst.
 */
export function fensterInAnzeigeZone(
  grenzen: Fenstergrenzen,
  jetzt: Date = new Date(),
  zone: string = ANZEIGE_ZONE,
): string | null {
  const auf = zeitpunktFuer(jetzt, grenzen.zoneLondon, grenzen.oeffnetLondon);
  const zu = zeitpunktFuer(jetzt, grenzen.zoneNewYork, grenzen.schliesstNewYork);
  if (auf === null || zu === null) return null;
  const aufZ = uhrzeitInZone(auf, zone);
  const zuZ = uhrzeitInZone(zu, zone);
  if (aufZ === null || zuZ === null) return null;
  return `${aufZ}–${zuZ}`;
}
