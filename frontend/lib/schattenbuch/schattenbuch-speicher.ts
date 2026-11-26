// ── SCHATTENBUCH: LESEN UND SCHREIBEN IN REDIS (25.11.) ────────────────────
//
// Ein Schluessel je UTC-Tag (`schatten:tag:<Datum>`), 45 Tage aufbewahrt.
// Geschrieben wird EINMAL je Handelszyklus, am Zyklusende, aus der
// Zyklus-Bilanz — ein Schreiber, wie bei der Tagessumme.
//
// EIN REDIS-AUSFALL SCHREIBT NICHTS (Regel 01.11.). `cacheSet` faellt bei einem
// Ausfall auf den prozesseigenen Speicher; ein Tag, der dort NEU angelegt
// wuerde, ueberschriebe beim naechsten gelungenen Schreiben den echten Tag in
// Redis mit einem Bruchstueck. Also: ohne Antwort von Redis wird der Zyklus
// NICHT verbucht — gedrosselt gemeldet, statt still verloren.
//
// Ein Fehler hier darf den Handelszyklus NIE stoeren: der Aufrufer faengt,
// und diese Funktion wirft selbst nicht.

import { cacheLesen, cacheSet } from "../cache/redis-cache";
import { lageMelden } from "../redis-lage/redis-lage";
import {
  SCHATTEN_SCHLUESSEL, SCHATTEN_TTL_SEKUNDEN, SCHATTEN_TAGE_MAX,
  eintraegeAufnehmen, zyklusEintraege,
  type SchattenEintrag, type SchattenTag,
} from "./schattenbuch";

/** Eigener Name fuer die Drossel — teilten sich zwei Stellen einen, verdeckte die eine die andere. */
export const SCHATTEN_STELLE = "Schattenbuch";

/** UTC-Datum aus Millisekunden — derselbe Tagesschnitt wie `handelstag()`. */
export function utcTag(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Die Eintraege eines Zyklus an seinen Tag anhaengen. Wirft nie. */
export async function schattenTagVerbuchen(
  b: Parameters<typeof zyklusEintraege>[0],
  datum: string,
): Promise<void> {
  try {
    const neue = zyklusEintraege(b);
    if (neue.length === 0) return;
    const alt = await cacheLesen<SchattenTag>(SCHATTEN_SCHLUESSEL(datum));
    if (alt.herkunft === "aus") {
      if (lageMelden(SCHATTEN_STELLE, "aus")) {
        console.warn(`[schatten] ⚠️ Redis antwortet nicht — ${neue.length} Signale dieses Zyklus `
          + `werden NICHT ins Schattenbuch geschrieben (sonst ueberschriebe ein Bruchstueck den Tag).`);
      }
      return;
    }
    await cacheSet(SCHATTEN_SCHLUESSEL(datum), eintraegeAufnehmen(alt.wert, datum, neue), SCHATTEN_TTL_SEKUNDEN);
    if (lageMelden(SCHATTEN_STELLE, "ok")) {
      console.log("[schatten] ✅ Schattenbuch wird wieder geschrieben");
    }
  } catch (e) {
    console.warn(`[schatten] ⚠️ Zyklus nicht verbucht: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Die Eintraege der letzten `tage` Tage (ohne Angabe: alle 45). Antwortet
 * Redis nicht, gibt es KEIN Ergebnis, sondern einen Grund — ein leeres
 * Schattenbuch wuerde sich sonst als „keine Signale" ausgeben.
 */
export async function schattenLesen(
  tage: number | null,
  jetztMs: number,
): Promise<{ eintraege: SchattenEintrag[]; tageGelesen: number; fehler: string | null }> {
  const n = Math.min(SCHATTEN_TAGE_MAX, tage === null ? SCHATTEN_TAGE_MAX : Math.ceil(tage) + 1);
  const eintraege: SchattenEintrag[] = [];
  for (let i = 0; i < n; i++) {
    const datum = utcTag(jetztMs - i * 86_400_000);
    const l = await cacheLesen<SchattenTag>(SCHATTEN_SCHLUESSEL(datum));
    if (l.herkunft === "aus") {
      return { eintraege: [], tageGelesen: i, fehler: `Redis antwortet nicht (Tag ${datum})` };
    }
    const tag = eintraegeAufnehmen(l.wert, datum, []);
    eintraege.push(...tag.eintraege);
  }
  return { eintraege, tageGelesen: n, fehler: null };
}
