// PRÜFT: Jeder Menüeintrag des Dashboards hat eine Ansicht — und umgekehrt.
//
// WARUM (26.08.). Das Dashboard ist kein Satz von Seiten, sondern EINE Seite
// mit einem Ansichtsumschalter: `navGroups` listet die Einträge, und weiter
// unten entscheidet eine Kette `if (activeView === "…") return <X />;`, was
// gerendert wird. Beide Listen stehen in derselben Datei, aber 3500 Zeilen
// auseinander — und sie waren auseinandergelaufen.
//
// "Live Prep" stand im Menü, ohne Render-Zeile: als einziger von 29. Der Klick
// fiel deshalb auf den Durchfall-Platzhalter und zeigte dort "Status:
// Prepared" in Grün und "Diese Ansicht ist bewusst aus dem Hauptdashboard
// ausgelagert". Beides unwahr — die Ansicht war nicht ausgelagert, es gab sie
// nicht. Im ganzen Programm existierte keine Live-Prep-Komponente.
//
// Das ist die Fehlerklasse, die dieses Repository am häufigsten getroffen hat:
// etwas sieht fertig aus, weil daneben ein grünes Wort steht.
//
// Die Gegenrichtung wird mitgeprüft: eine gerenderte Ansicht ohne Menüeintrag
// ist Code, den niemand erreichen kann.
const { read } = require("./_lib");

const SEITE = "frontend/app/page.tsx";

module.exports = function pruefe() {
  const funde = [];
  const roh = read(SEITE);

  // Kommentare raus, BEVOR gezählt wird. Ein Eintrag in einer Erklärung ist
  // kein Menüeintrag — und genau in diesem Prüfer steht der entfernte
  // "live-prep" jetzt als Kommentar direkt neben der Liste.
  const quelle = roh
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  // ── Menü ────────────────────────────────────────────────────────────────
  const start = quelle.indexOf("const navGroups");
  if (start < 0) {
    return { titel: "Menü ↔ Ansichten", funde: ["navGroups nicht gefunden — umbenannt?"] };
  }
  // Bis zum Zeilenende-Semikolon des Arrays: `\n];`
  const ende = quelle.indexOf("\n];", start);
  if (ende < 0) {
    return { titel: "Menü ↔ Ansichten", funde: ["Ende von navGroups nicht gefunden"] };
  }
  const menuBlock = quelle.slice(start, ende);

  const menue = [...menuBlock.matchAll(/view:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  const menueSet = new Set(menue);

  if (menue.length === 0) {
    return { titel: "Menü ↔ Ansichten", funde: ["kein einziger Menüeintrag gelesen — Muster passt nicht mehr"] };
  }

  // Doppelte Einträge: zwei Knöpfe, dieselbe Ansicht — meist ein Kopierfehler.
  const doppelt = menue.filter((v, i) => menue.indexOf(v) !== i);
  for (const d of new Set(doppelt)) {
    funde.push(`Menüeintrag "${d}" kommt mehrfach vor`);
  }

  // Jeder Eintrag braucht eine Beschriftung — ein Knopf ohne Text ist unklickbar.
  const eintraege = [...menuBlock.matchAll(/\{\s*label:\s*"([^"]+)"[^}]*view:\s*"([a-z0-9-]+)"\s*\}/g)];
  if (eintraege.length !== menue.length) {
    funde.push(
      `${menue.length} Ansichten im Menü, aber nur ${eintraege.length} mit Beschriftung — `
      + `ein Eintrag ist unvollständig`
    );
  }

  // ── Gerenderte Ansichten ────────────────────────────────────────────────
  const gerendert = new Set(
    [...quelle.matchAll(/activeView\s*===\s*"([a-z0-9-]+)"/g)].map((m) => m[1])
  );

  // Die Startansicht wird gesetzt, nicht verglichen — sie muss trotzdem im
  // Menü stehen, sonst startet das Dashboard auf einem Eintrag, den niemand
  // wieder anwählen kann.
  const start_ = quelle.match(/useState\(\s*"([a-z0-9-]+)"\s*\)[\s\S]{0,80}?activeView|activeView[^=]*=\s*useState\(\s*"([a-z0-9-]+)"/);
  const startAnsicht = start_ ? (start_[1] || start_[2]) : null;
  if (startAnsicht && !menueSet.has(startAnsicht)) {
    funde.push(
      `Startansicht "${startAnsicht}" steht nicht im Menü — sie lässt sich nach `
      + `einem Wechsel nicht wieder anwählen`
    );
  }

  // ── Der eigentliche Abgleich ────────────────────────────────────────────
  //
  // "dashboard" ist der Sonderfall: die Startansicht wird nicht über eine
  // if-Kette gerendert, sondern ist der Normalfall der Seite. Sie MUSS im Menü
  // stehen (oben geprüft), braucht aber keine Vergleichszeile.
  const ohneAnsicht = menue.filter((v) => !gerendert.has(v) && v !== startAnsicht);
  for (const v of ohneAnsicht) {
    funde.push(
      `Menüeintrag "${v}" wird NICHT gerendert — der Klick fällt auf den `
      + `Platzhalter durch und sieht aus wie eine fertige Ansicht`
    );
  }

  const ohneMenue = [...gerendert].filter((v) => !menueSet.has(v));
  for (const v of ohneMenue) {
    funde.push(`Ansicht "${v}" wird gerendert, steht aber in KEINEM Menü — nicht erreichbar`);
  }

  // ── Der Durchfall-Platzhalter darf nichts Grünes behaupten ──────────────
  //
  // Er erscheint ausschliesslich dann, wenn nichts gebaut ist. Stand dort
  // wieder "Prepared", wäre der Fund vom 26.08. zurück — nur an anderer
  // Stelle, weil der Abgleich oben ihn dann nicht mehr sieht.
  const platzhalter = quelle.slice(quelle.indexOf("function CenterPlaceholder"));
  const kopf = platzhalter.slice(0, 2000);
  if (/Center Status[\s\S]{0,200}?(text-green-\d00[\s\S]{0,120}?)?>\s*Prepared\s*</.test(kopf)) {
    funde.push(
      `CenterPlaceholder meldet wieder "Prepared" — diese Kachel erscheint NUR, `
      + `wenn eine Ansicht gar nicht gebaut ist`
    );
  }

  return {
    titel: `Menü ↔ Ansichten (${menue.length} Einträge, ${gerendert.size} gerendert)`,
    funde,
  };
};
