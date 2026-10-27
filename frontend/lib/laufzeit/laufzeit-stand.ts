/**
 * Welcher Stand läuft gerade? (27.10.)
 *
 * ── DER ANLASS ──────────────────────────────────────────────────────────────
 *
 * Am 27.10. wurde `/edge 60` um 22:59:36 gepusht und um 23:01 ausprobiert —
 * anderthalb Minuten später. Railway war noch am Bauen, der Bot antwortete
 * „Unbekannter Befehl", und es gab **keine Möglichkeit, das festzustellen**
 * ausser Raten.
 *
 * `CLAUDE.md` benennt die Lücke seit dem 27.09.: *„Vorher prüfen, dass der
 * neue Deploy wirklich läuft — eine Deploy-Kennung ist **kein**
 * Commit-Hash."* Genau deshalb wird hier **nur** eine Variable als Commit
 * akzeptiert, die auch einen Commit enthält. Eine Deployment-ID als Commit
 * auszugeben wäre dieselbe Lüge, nur bequemer.
 *
 * Im Ernstfall ist das die Frage **vor** dem `/reset`: ist der Fix überhaupt
 * schon oben?
 *
 * ── WAS DIESE DATEI NICHT TUT ───────────────────────────────────────────────
 *
 * Sie formatiert **keine Zeit**. Der Zeitpunkt geht als Zahl zurück, und der
 * Aufrufer formatiert ihn mit `telegramZeit()` — ein nacktes `toLocaleString`
 * im Telegram-Weg war der Fehler vom 27.09. und wird von `safety-nets` rot.
 *
 * Sie rät auch nichts: fehlt die Variable, heisst das **unbekannt** mit
 * Grund, nicht „keine Änderung".
 */

/**
 * Variablen, die einen **Commit-Hash** tragen — in dieser Reihenfolge.
 * Bewusst NICHT dabei: `RAILWAY_DEPLOYMENT_ID`. Das ist eine Deploy-Kennung
 * und kein Commit; sie hier zu führen wäre genau der Fehler aus CLAUDE.md.
 */
export const COMMIT_QUELLEN = ["RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT_SHA"] as const;

/** Variablen, die den Branch tragen. */
export const BRANCH_QUELLEN = ["RAILWAY_GIT_BRANCH", "GIT_BRANCH"] as const;

/** Ein Commit-Hash ist hexadezimal und mindestens sieben Zeichen lang. */
const HASH = /^[0-9a-f]{7,40}$/i;

export type LaufzeitStand = {
  /** Die ersten sieben Zeichen, oder `null` wenn nicht feststellbar. */
  commit: string | null;
  /** Aus welcher Variablen er stammt — sonst `null`. */
  quelle: string | null;
  /** Warum kein Commit da ist. Leer, wenn einer da ist. */
  grund: string;
  branch: string | null;
  /** Zeitpunkt des Prozessstarts in ms, oder `null`. Der Aufrufer formatiert. */
  startMs: number | null;
  /** Wie lange der Prozess schon läuft, lesbar. */
  laufzeit: string;
};

/** „45 s", „7 min", „2 h 13 min" — oder „unbekannt". */
export function dauerText(sekunden: number): string {
  if (!Number.isFinite(sekunden) || sekunden < 0) return "unbekannt";
  const s = Math.floor(sekunden);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  if (h < 24) return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
  const t = Math.floor(h / 24);
  const hRest = h % 24;
  return hRest === 0 ? `${t} d` : `${t} d ${hRest} h`;
}

export function laufzeitStand(
  env: Record<string, string | undefined> | null | undefined,
  uptimeSekunden: number,
  jetztMs: number,
): LaufzeitStand {
  const e = env ?? {};
  const leer: LaufzeitStand = {
    commit: null, quelle: null, grund: "", branch: null,
    startMs: null, laufzeit: dauerText(uptimeSekunden),
  };

  if (Number.isFinite(uptimeSekunden) && uptimeSekunden >= 0
    && Number.isFinite(jetztMs) && jetztMs > 0) {
    leer.startMs = jetztMs - Math.floor(uptimeSekunden) * 1000;
  }

  const branchName = BRANCH_QUELLEN.map((k) => String(e[k] ?? "").trim())
    .find((v) => v.length > 0);
  leer.branch = branchName ?? null;

  // Die ERSTE gesetzte Variable entscheidet — auch wenn ihr Wert unbrauchbar
  // ist. Sonst würde ein Tippfehler in der ersten still von der zweiten
  // überdeckt, und man suchte an der falschen Stelle.
  const treffer = COMMIT_QUELLEN.map((k) => ({ k, v: String(e[k] ?? "").trim() }))
    .find((x) => x.v.length > 0);

  if (!treffer) {
    return {
      ...leer,
      grund: `keine der Variablen ${COMMIT_QUELLEN.join(" / ")} ist gesetzt`,
    };
  }
  if (!HASH.test(treffer.v)) {
    // Der WERT wird nicht ausgegeben — er könnte alles sein, und was in den
    // Chat geht, kommt nicht zurück (Regel vom 29.09.). Länge genügt.
    return {
      ...leer,
      quelle: treffer.k,
      grund: `${treffer.k} ist gesetzt, sieht aber nicht wie ein Commit-Hash `
        + `aus (${treffer.v.length} Zeichen)`,
    };
  }
  return { ...leer, commit: treffer.v.slice(0, 7).toLowerCase(), quelle: treffer.k };
}

/**
 * Die Zeilen für `/status`. Der Startzeitpunkt wird **vom Aufrufer**
 * formatiert und hier nur eingesetzt — siehe Kopf der Datei.
 */
export function laufzeitZeilen(s: LaufzeitStand, startText: string | null): string[] {
  const z: string[] = [];
  z.push(s.commit
    ? `Commit: <code>${s.commit}</code>${s.branch ? ` (${s.branch})` : ""}`
    : `Commit: <b>unbekannt</b> — ${s.grund}`);
  z.push(s.startMs !== null && startText
    ? `Läuft seit: <b>${s.laufzeit}</b> (Start ${startText})`
    : `Läuft seit: <b>${s.laufzeit}</b>`);
  return z;
}
