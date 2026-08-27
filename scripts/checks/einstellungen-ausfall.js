// PRÜFT: Was passiert mit den Einstellungen, wenn die Datenbank wegfällt —
// durch AUSFÜHREN der echten Funktion, mit einer steuerbaren Datenbank.
//
// WARUM (26.08.). `loadFromDB()` hatte ein einziges
// `catch { /* DB not ready yet → use defaults */ }`. Damit war ein
// DATENBANKFEHLER nicht von "es gibt noch keinen Datensatz" zu unterscheiden,
// und beides endete in DEFAULT_SETTINGS mit `mode: "MANUAL"`.
//
// Das allein wäre fail-safe. Der Fehler lag eine Ebene höher: `get()` legt das
// Ergebnis auf `global.__system_settings__` ab und liest danach NIE wieder
// nach. Ein einziger fehlgeschlagener Lesevorgang beim Prozessstart klemmte
// das System also für die gesamte Laufzeit auf MANUAL — der Orchestrator
// meldete alle fünf Minuten "Modus nicht AUTO — Zyklus übersprungen", und
// sonst passierte nichts. Kein Fehler, kein Alarm, keine Erholung.
//
// Nachgewiesen am alten Stand: 1 Lesevorgang, 0 Warnungen, und nach Rückkehr
// der Datenbank weiterhin MANUAL.
//
// Am 19.08. wurde dieselbe Fehlerklasse für die Migrationen behoben
// (instrumentation.ts) — dort steht das Versprechen, das System finde "die
// Datenbank beim nächsten Zyklus von selbst wieder". Für die Einstellungen
// galt das nicht.
//
// WARUM RECHNEND. Eine Struktur-Prüfung sieht "es gibt ein catch" und ist
// zufrieden. Ob der Ausfall zwischengespeichert wird und ob sich das System
// erholt, zeigt nur ein Durchlauf.
const { ladeTsModul } = require("./_lib");

const ECHTE_EINSTELLUNGEN = JSON.stringify({
  version: "V17.0.0",
  botSettings: { mode: "AUTO", maxTradesPerDay: 5, maxConcurrentPositions: 3 },
  riskSettings: {},
  connections: [],
});

module.exports = async function pruefe() {
  const funde = [];
  let geprueft = 0;
  const pruefe1 = (name, bedingung, zusatz) => {
    geprueft++;
    if (!bedingung) funde.push(`${name}${zusatz ? ` — ${zusatz}` : ""}`);
  };

  let dbAntwortet = false;
  let leseVersuche = 0;
  let telegramMeldungen = 0;

  const dbStub = {
    // wird als Tagged Template gerufen: db.$queryRaw`SELECT …`
    $queryRaw: () => {
      leseVersuche++;
      if (!dbAntwortet) throw new Error("connect ECONNREFUSED (Prüfstand)");
      return Promise.resolve([{ data: ECHTE_EINSTELLUNGEN }]);
    },
    $executeRawUnsafe: async () => 1,
  };

  const modul = ladeTsModul("lib/settings/settings-store.ts", {
    prisma: { getPrisma: () => dbStub },
    "telegram-sender": { sendTelegram: async () => { telegramMeldungen++; } },
  });
  if (modul.fehler) {
    return { titel: "Einstellungen bei DB-Ausfall", funde: [modul.fehler] };
  }
  const { getSettings } = modul.exports;
  if (typeof getSettings !== "function") {
    return {
      titel: "Einstellungen bei DB-Ausfall",
      funde: ["getSettings wird nicht exportiert — Umbenennung?"],
    };
  }

  // Der Zustand liegt auf global — vor und nach dem Lauf aufräumen, damit
  // andere Prüfer im selben Prozess nicht beeinflusst werden.
  delete global.__system_settings__;
  delete global.__settings_letzte_warnung__;

  // console.error wird MITGESCHNITTEN, nicht nur unterdrückt.
  //
  // Im Sabotage-Lauf vom 26.08. rutschte "Warnung entfernt" zuerst durch: der
  // Prüfer zählte ausschliesslich Telegram-Meldungen. In Railway ist aber das
  // Log das primäre Signal — Telegram kann fehlen oder stummgeschaltet sein.
  // Wer nur den zweiten Kanal prüft, lässt den ersten still verschwinden.
  const echtesError = console.error;
  const logZeilen = [];
  console.error = (...a) => { logZeilen.push(a.map(String).join(" ")); };
  try {
    // ── Phase 1: Datenbank ist WEG ──────────────────────────────────────
    dbAntwortet = false;
    const a = await getSettings();
    pruefe1("bei DB-Ausfall gilt nicht MANUAL — es wuerde weitergehandelt "
      + "mit Standardwerten, die niemand gesetzt hat",
      a && a.botSettings && a.botSettings.mode === "MANUAL",
      a && a.botSettings && a.botSettings.mode);

    const b = await getSettings();
    pruefe1("zweiter Aufruf im Ausfall liefert nicht MANUAL",
      b && b.botSettings.mode === "MANUAL");

    pruefe1("der Ausfall wird ZWISCHENGESPEICHERT — es wird kein zweites Mal "
      + "versucht, damit bleibt der Stillstand bis zum naechsten Deploy",
      leseVersuche === 2, `${leseVersuche} Lesevorgang/-vorgaenge statt 2`);

    pruefe1("der Ausfall wird nicht per Telegram gemeldet — genau dieser "
      + "stille Stillstand ist der Fehler", telegramMeldungen >= 1,
      `${telegramMeldungen} Meldungen`);

    // Das LOG ist der primäre Kanal — Telegram kann fehlen.
    pruefe1("der Ausfall steht nicht im Log", logZeilen.length >= 1,
      `${logZeilen.length} Zeilen`);
    pruefe1("die Logzeile nennt den Grund des Stillstands nicht (MANUAL / "
      + "wird nicht gehandelt) — dann sucht man beim naechsten Mal wieder "
      + "eine Stunde",
      logZeilen.some((z) => /MANUAL/.test(z) && /settings/i.test(z)),
      logZeilen[0] ? logZeilen[0].slice(0, 90) : "keine Zeile");

    // Nicht spammen: der Orchestrator liest jede 5 Minuten, die Routen oefter.
    for (let i = 0; i < 5; i++) await getSettings();
    pruefe1("es wird bei jedem Aufruf erneut gemeldet (Log- und Telegram-Flut)",
      telegramMeldungen === 1, `${telegramMeldungen} Meldungen nach 7 Aufrufen`);

    // ── Phase 2: Datenbank ist ZURUECK ──────────────────────────────────
    dbAntwortet = true;
    const c = await getSettings();
    pruefe1("das System erholt sich NICHT, wenn die Datenbank zurueckkommt — "
      + "es bliebe bis zum Neustart auf MANUAL stehen",
      c && c.botSettings.mode === "AUTO",
      c && c.botSettings.mode);

    const vorher = leseVersuche;
    const d = await getSettings();
    pruefe1("nach erfolgreichem Laden wird weiterhin die Datenbank befragt",
      leseVersuche === vorher, `${leseVersuche - vorher} zusaetzliche Abfrage(n)`);
    pruefe1("der zwischengespeicherte Wert stimmt nicht",
      d && d.botSettings.mode === "AUTO");

    // ── Phase 3: kein Datensatz ist KEIN Fehler ─────────────────────────
    //
    // Erstlauf auf einer leeren Datenbank: Standardwerte sind richtig, und es
    // darf NICHT gewarnt werden. Sonst wäre die Warnung wertlos, weil sie auch
    // im Normalfall käme.
    delete global.__system_settings__;
    delete global.__settings_letzte_warnung__;
    telegramMeldungen = 0;
    const leer = { ...dbStub, $queryRaw: () => Promise.resolve([]) };
    const m2 = ladeTsModul("lib/settings/settings-store.ts", {
      prisma: { getPrisma: () => leer },
      "telegram-sender": { sendTelegram: async () => { telegramMeldungen++; } },
    });
    if (!m2.fehler) {
      const e = await m2.exports.getSettings();
      pruefe1("Erstlauf ohne Datensatz liefert keine Standardwerte",
        e && e.botSettings.mode === "MANUAL");
      pruefe1("Erstlauf ohne Datensatz wird faelschlich als Ausfall gemeldet — "
        + "damit waere die Warnung wertlos", telegramMeldungen === 0,
        `${telegramMeldungen} Meldungen`);
      pruefe1("Erstlauf ohne Datensatz wird nicht zwischengespeichert",
        global.__system_settings__ !== undefined);
    }
  } finally {
    console.error = echtesError;
    delete global.__system_settings__;
    delete global.__settings_letzte_warnung__;
  }

  return {
    titel: `Einstellungen bei DB-Ausfall (${geprueft} Rechnungen, echte Funktion)`,
    funde,
  };
};
