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
const { ladeTsModul, read } = require("./_lib");

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
    // ── Phase 4: SCHREIBEN (06.09.) ───────────────────────────────────────
    //
    // Zwei Fehler, beide am 06.09. gefunden und behoben — zusammen erklaeren
    // sie "ich hatte die Schwelle gesenkt und es hat nichts geaendert":
    //
    //  a) `updateBotSettings` nahm `get()` als Grundlage. Faellt die Datenbank
    //     beim LESEN aus, sind das die STANDARDWERTE (bewusst, siehe oben) —
    //     und `saveToDB` schreibt mit `ON CONFLICT DO UPDATE SET data = $1` die
    //     GANZE Zeile. Ein einziges Speichern waehrend eines Aussetzers haette
    //     Risiko, Tageslimit, Schwellen und Broker auf Standard zurueckgesetzt.
    //
    //  b) `saveToDB` verschluckte jeden Schreibfehler (`catch { }`), und
    //     `set()` legte den neuen Wert VORHER in den Speicher. Die Route gab
    //     danach `{ ok: true, settings }` mit dem neuen Wert zurueck. Die
    //     Anzeige stimmte, die Datenbank nicht — bis zum naechsten Neustart.
    delete global.__system_settings__;
    delete global.__settings_letzte_warnung__;

    let schreibVersuche = 0;
    let schreibenGeht = true;
    let letzterInhalt = null;
    const wStub = {
      $queryRaw: () => {
        leseVersuche++;
        if (!dbAntwortet) throw new Error("connect ECONNREFUSED (Prüfstand)");
        return Promise.resolve([{ data: ECHTE_EINSTELLUNGEN }]);
      },
      $executeRawUnsafe: async (_sql, data) => {
        schreibVersuche++;
        if (!schreibenGeht) throw new Error("write failed (Prüfstand)");
        letzterInhalt = data;
        return 1;
      },
    };
    const m3 = ladeTsModul("lib/settings/settings-store.ts", {
      prisma: { getPrisma: () => wStub },
      "telegram-sender": { sendTelegram: async () => {} },
    });
    if (m3.fehler) {
      funde.push(`Schreibpfad nicht ladbar: ${m3.fehler}`);
    } else if (typeof m3.exports.updateBotSettings !== "function") {
      funde.push("updateBotSettings wird nicht exportiert — der Schreibpfad "
        + "bleibt ungeprueft");
    } else {
      const { updateBotSettings, getSettings: g3 } = m3.exports;

      // (a) Datenbank beim LESEN weg → es darf gar NICHT geschrieben werden.
      dbAntwortet = false;
      schreibenGeht = true;
      schreibVersuche = 0;
      let warfA = false;
      try { await updateBotSettings({ autoApproveThreshold: 72 }); }
      catch { warfA = true; }
      pruefe1("bei DB-Ausfall wird trotzdem geschrieben — das setzt ALLE "
        + "uebrigen Einstellungen auf Standardwerte zurueck",
        warfA && schreibVersuche === 0,
        `warf=${warfA}, Schreibversuche=${schreibVersuche}`);

      // (b) Lesen geht, SCHREIBEN scheitert.
      delete global.__system_settings__;
      dbAntwortet = true;
      await g3();                       // einmal sauber laden und merken
      schreibenGeht = false;
      let warfB = false;
      try { await updateBotSettings({ autoApproveThreshold: 72 }); }
      catch { warfB = true; }
      pruefe1("ein fehlgeschlagenes Schreiben wird verschluckt — die "
        + "Oberflaeche meldet Erfolg", warfB);
      const nachB = await g3();
      pruefe1("nach fehlgeschlagenem Schreiben steht der NEUE Wert im Speicher "
        + "— die Anzeige luegt bis zum naechsten Neustart",
        nachB.botSettings.autoApproveThreshold !== 72,
        String(nachB.botSettings.autoApproveThreshold));

      // (c) Alles geht → Wert wird geschrieben, gemerkt, und der Rest bleibt.
      schreibenGeht = true;
      letzterInhalt = null;
      await updateBotSettings({ autoApproveThreshold: 72 });
      const nachC = await g3();
      pruefe1("ein erfolgreiches Schreiben kommt nicht im Speicher an",
        nachC.botSettings.autoApproveThreshold === 72,
        String(nachC.botSettings.autoApproveThreshold));
      pruefe1("der geschriebene Inhalt enthaelt den neuen Wert nicht",
        typeof letzterInhalt === "string"
        && letzterInhalt.includes('"autoApproveThreshold":72'));
      pruefe1("beim Speichern gehen andere Einstellungen verloren",
        nachC.botSettings.mode === "AUTO", String(nachC.botSettings.mode));
    }
  } finally {
    console.error = echtesError;
    delete global.__system_settings__;
    delete global.__settings_letzte_warnung__;
  }

  // ══ Teil 5: DIESELBE Fehlerklasse im AI-Konfigurationsspeicher (07.09.) ══
  //
  // `lib/ai-config/ai-config-store.ts` hatte alle vier Defekte, die oben fuer
  // die Einstellungen behoben sind — und die Folge trifft genau die Umstellung
  // vom 07.09. auf das konfigurierte Modell:
  //
  //   DEFAULT_AI_SETTINGS.openai.model    = "gpt-4o-mini"
  //   DEFAULT_AI_SETTINGS.anthropic.model = "claude-haiku-4-5-20251001"
  //
  // Ein einziger fehlgeschlagener Lesevorgang beim Start klemmte das Modell
  // fuer die GESAMTE Prozesslaufzeit auf die billige Variante. Und weil der
  // Scan dann `scanGptModel === ai.openai.model` sieht, meldet er die
  // BERUHIGENDE Zeile "nutzt die konfigurierten Modelle" — mit den billigen.
  // Der API-Schluessel faellt nicht weg (Railway-Variable), nur das Modell.
  {
    // console.error auch hier abfangen — sonst steht die Ausfall-Warnung
    // bei JEDEM Pruefer-Lauf in der Ausgabe und stumpft ab.
    const aiEchtesError = console.error;
    console.error = () => {};
    try {
    delete global.__ai_config_store__;
    delete global.__ai_config_letzte_warnung__;
    let aiLiest = false;
    let aiSchreibt = true;
    let aiSchreibVersuche = 0;
    const AI_ECHT = JSON.stringify({
      openai: { model: "gpt-4o", apiKey: "sk-x", connected: true },
      anthropic: { model: "claude-sonnet-4-6", apiKey: "sk-ant-x" },
      telegram: { botToken: "", channels: {} },
    });
    const aiStub = {
      $queryRaw: () => {
        if (!aiLiest) throw new Error("connect ECONNREFUSED (Prüfstand)");
        return Promise.resolve([{ data: AI_ECHT }]);
      },
      $executeRawUnsafe: async () => {
        aiSchreibVersuche++;
        if (!aiSchreibt) throw new Error("write failed (Prüfstand)");
        return 1;
      },
    };
    const mAI = ladeTsModul("lib/ai-config/ai-config-store.ts", {
      prisma: { getPrisma: () => aiStub },
      "telegram-sender": { sendTelegram: async () => {} },
    });
    if (mAI.fehler) {
      funde.push(`ai-config-store nicht ladbar: ${mAI.fehler}`);
    } else if (typeof mAI.exports.getAISettings !== "function"
      || typeof mAI.exports.updateOpenAI !== "function") {
      funde.push("getAISettings/updateOpenAI werden nicht exportiert — der "
        + "AI-Konfigurationsspeicher bleibt ungeprueft");
    } else {
      const { getAISettings, updateOpenAI } = mAI.exports;

      // (a) Lesefehler darf sich NICHT einbrennen.
      aiLiest = false;
      const a1 = await getAISettings();
      pruefe1("bei DB-Ausfall gilt nicht das Standardmodell",
        a1.openai.model === "gpt-4o-mini", a1.openai.model);
      aiLiest = true;
      const a2 = await getAISettings();
      pruefe1("der Ausfall brennt sich ein — das Modell bliebe bis zum Neustart "
        + "auf der billigen Variante",
        a2.openai.model === "gpt-4o", a2.openai.model);

      // (b) Waehrend eines Lesefehlers darf NICHT geschrieben werden.
      delete global.__ai_config_store__;
      aiLiest = false;
      aiSchreibVersuche = 0;
      let warfAI = false;
      try { await updateOpenAI({ model: "gpt-4o" }); } catch { warfAI = true; }
      pruefe1("bei DB-Ausfall wird die AI-Konfiguration trotzdem geschrieben — "
        + "das setzt Modelle und Telegram-Kanaele auf Standard zurueck",
        warfAI && aiSchreibVersuche === 0,
        `warf=${warfAI}, Schreibversuche=${aiSchreibVersuche}`);

      // (c) Schreibfehler muss durchschlagen, der Speicher darf ihn nicht
      //     vortaeuschen.
      delete global.__ai_config_store__;
      aiLiest = true;
      await getAISettings();
      aiSchreibt = false;
      let warfAI2 = false;
      try { await updateOpenAI({ model: "gpt-4o-mini" }); } catch { warfAI2 = true; }
      pruefe1("ein fehlgeschlagenes Schreiben der AI-Konfiguration wird verschluckt",
        warfAI2);
      const a3 = await getAISettings();
      pruefe1("nach fehlgeschlagenem Schreiben steht der neue Wert im Speicher",
        a3.openai.model === "gpt-4o", a3.openai.model);

      // (d) Erfolgsfall.
      aiSchreibt = true;
      await updateOpenAI({ temperature: 0.5 });
      const a4 = await getAISettings();
      pruefe1("ein erfolgreiches Schreiben kommt nicht im Speicher an",
        a4.openai.temperature === 0.5, String(a4.openai.temperature));
      pruefe1("beim Speichern geht das Modell verloren",
        a4.openai.model === "gpt-4o", a4.openai.model);
    }
    } finally {
      console.error = aiEchtesError;
      delete global.__ai_config_store__;
      delete global.__ai_config_letzte_warnung__;
    }
  }

  // ── Der Fehler muss bis zur OBERFLAECHE durchschlagen (06.09.) ──────────
  //
  // Die Rechnungen oben belegen, dass der Store wirft. Das nuetzt nichts, wenn
  // die Route daraus wieder ein `{ ok: true }` macht oder die Oberflaeche
  // `d.ok` nie liest — und genau das war der Zustand: `postAction` pruefte den
  // Erfolg NIE.
  const ohneKommentare = (x) => String(x)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  const routeQ = ohneKommentare(read("frontend/app/api/settings/route.ts"));
  // NICHT `/catch\s*\(/ && /ok: false/` — beides steht auch anderswo in der
  // Datei ("Unknown action"). Geprueft wird die konkrete Umklammerung.
  pruefe1("die Einstellungs-Route faengt einen Speicherfehler nicht ab",
    /return await bearbeite\(request\)/.test(routeQ) && /status: 503/.test(routeQ),
    "ohne das wird ein Fehlschlag zu einem nackten 500 oder verschwindet");
  pruefe1("die Route meldet einen Fehlschlag nicht als Fehlschlag",
    /Nicht gespeichert/.test(read("frontend/app/api/settings/route.ts")));

  const uiQ = ohneKommentare(read("frontend/components/SettingsDashboard.tsx"));
  pruefe1("die Oberflaeche prueft den Erfolg des Speicherns nicht",
    /d\.ok === false/.test(uiQ),
    "ein Fehlschlag sah bis zum 06.09. aus wie ein Erfolg");
  pruefe1("die Oberflaeche zeigt einen Speicherfehler nicht an",
    /speicherFehler/.test(uiQ) && /NICHT gespeichert/.test(
      read("frontend/components/SettingsDashboard.tsx")));
  // Auch der AI-Konfigurationspfad muss den Fehlschlag zeigen (07.09.) — bis
  // heute pruefte `postAI` den Erfolg nie, und einzelne Aufrufer meldeten ein
  // generisches "Fehler beim Speichern" ohne Grund.
  pruefe1("die Oberflaeche prueft den Erfolg beim Speichern der AI-Konfiguration nicht",
    /const postAI[\s\S]{0,900}?d\?\.ok === false/.test(uiQ),
    "ein Datenbank-Aussetzer bliebe ohne Begruendung");

  return {
    titel: `Einstellungen bei DB-Ausfall (${geprueft} Rechnungen, echte Funktion)`,
    funde,
  };
};
