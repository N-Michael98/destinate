import type { SystemSettings, BrokerConnection, BotSettings, RiskSettings } from "../broker-config";

const DEFAULT_SETTINGS: SystemSettings = {
  version: "V17.0.0",
  botSettings: {
    mode: "MANUAL",
    maxTradesPerDay: 5,
    maxConcurrentPositions: 3,
    autoApproveThreshold: 80,
    pauseOnLoss: true,
    pauseOnLossPercent: 3,
    tradeLimitEnabled: true,
    tradeLimitBypassScore: 80,
    maxTradesPerDayByStyle: { DAYTRADING: 3, SCALPING: 5, SWING: 2 },
    // Pyramiding standardmässig AUS — bisheriges Verhalten (1 Position pro
    // Symbol) bleibt unverändert, bis der User es in den Einstellungen aktiviert.
    pyramidingEnabled: false,
    maxPositionsPerSymbol: 1,
    pyramidingMinConfidence: 0, // 0 = autoApproveThreshold verwenden
    // Kurs-Aktualität (02.08.): 30 Min ist bewusst grosszügig — ein aktiv
    // gehandelter Markt tickt im Sekundentakt (live gemessen: BTCUSD 1 Min).
    // Blockiert damit nur echte Fälle wie den Nikkei während europäischer
    // Handelszeit (Tokio geschlossen, Kurs Stunden alt). 0 = Prüfung aus.
    maxPriceAgeMinutes: 30,
    // Kosten-Guard bleibt standardmässig AN (false) — das ist exakt das
    // bisherige Verhalten. Es ändert sich nichts, bis der User umschaltet.
    useFullModelsForScan: false,
    // Standard AUS: die Walk-Forward-Ergebnisse werden angezeigt, sperren aber
    // nichts. Bisheriges Verhalten bleibt damit unverändert.
    blockOverfitMarkets: false,
    // Standard AUS: GPT behält das letzte Wort, bisheriges Verhalten unverändert.
    allowMeasuredConsensus: false,
  },
  riskSettings: {
    maxRiskPerTradePct: 1.0,
    maxDailyDrawdownPct: 3.0,
    maxTotalDrawdownPct: 10.0,
    maxExposurePct: 20.0,
    minConfidenceScore: 65,
    // 13.08.: bisher als Standardwert in der Funktionssignatur verdrahtet.
    // Der Wert bleibt 6.0 — es aendert sich nichts, er wird nur einstellbar.
    maxWeeklyLossPct: 6.0,
    // Standard AUS: die Schwellen zählen weiter in Kursprozent, bisheriges
    // Verhalten bleibt damit unverändert. Erst wenn der User umschaltet,
    // zählen sie in R (Vielfache des Stop-Abstands) — siehe RiskSettings.
    exitThresholdsRelativeToStop: false,
    // Verankert am Ziel, das der Code selbst setzt (takeProfit = 2 R):
    //   1,0 R  Breakeven — ab hier kann der Trade nicht mehr verlieren
    //   1,5 R  Teilgewinn — drei Viertel des Wegs zum Ziel
    //   1,0 R  Trailing beginnt, sobald die Position abgesichert ist
    // Das sind Ausgangswerte, keine optimierten. Ob sie stimmen, zeigen die
    // Ausstiegsgründe über einige Wochen (byExitReason im Wochenreport).
    breakevenAtR: 1.0,
    partialAtR: 1.5,
    trailAtR: 1.0,
  },
  connections: [
    { brokerKey: "CAPITAL_COM", connected: false, accountId: null, accountMode: "DEMO", lastConnectedAt: null, error: null },
    { brokerKey: "IC_MARKETS", connected: false, accountId: null, accountMode: "DEMO", lastConnectedAt: null, error: null },
  ],
  updatedAt: new Date().toISOString(),
};

async function getPrisma() {
  const { getPrisma: gp } = await import("../../app/lib/prisma");
  return gp();
}

// ── Warum hier zwischen ZWEI Fällen unterschieden wird (26.08.) ─────────────
//
// Hier stand ein einziges `catch { /* DB not ready yet → use defaults */ }`,
// und danach wurden die Standardwerte zurückgegeben. Damit war ein
// DATENBANKFEHLER nicht von "es gibt noch keinen Datensatz" zu unterscheiden —
// und beides endete in `DEFAULT_SETTINGS` mit `mode: "MANUAL"`.
//
// DIE FOLGE, und sie ist still und dauerhaft: `get()` legt das Ergebnis auf
// `global.__system_settings__` ab und liest danach NIE wieder nach. Ein
// einziger fehlgeschlagener Lesevorgang beim Start klemmt das System also für
// die gesamte Prozesslaufzeit auf MANUAL fest. Der Orchestrator meldet dann
// alle fünf Minuten "Modus nicht AUTO — Zyklus übersprungen", und sonst
// passiert nichts. Kein Fehler, kein Alarm, keine Erholung.
//
// Am 19.08. wurde genau diese Fehlerklasse für die Migrationen behoben
// (instrumentation.ts) — mit der Begründung "der Dienst stand auf Online, die
// Website lief, das Handelssystem tat nichts". Dort steht auch das
// Versprechen, das System finde "die Datenbank beim nächsten Zyklus von selbst
// wieder". Für die Einstellungen galt das NICHT, weil sie zwischengespeichert
// werden.
//
// Anlass damals: ein angekündigter Postgres-Sicherheitspatch bei Railway. Fällt
// die Datenbank für Sekunden weg, während dieser Dienst startet, greift genau
// dieser Pfad.
//
// Betroffen ist im Übrigen nicht nur `mode`: die GESAMTE Risikokonfiguration
// fiele auf Standardwerte zurück — Positionsgrössen, Stop-Abstände, Limits.
// Dass daraus MANUAL folgt und damit gar nicht gehandelt wird, ist der einzige
// Grund, warum das nie Geld gekostet hat.
type Ladeergebnis = {
  settings: SystemSettings;
  /** true = die Datenbank hat geantwortet (auch wenn es noch keinen Datensatz
   *  gibt). false = Lesefehler; das Ergebnis darf NICHT zwischengespeichert
   *  werden, sonst brennt sich der Ausfall dauerhaft ein. */
  ausDB: boolean;
  fehler?: string;
};

function standardwerte(): SystemSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

async function loadFromDB(): Promise<Ladeergebnis> {
  try {
    const db = await getPrisma();
    const row = await db.$queryRaw<{ data: string }[]>`
      SELECT data FROM "SystemSettings" WHERE id = 'singleton' LIMIT 1
    `;
    if (row && row.length > 0) {
      const parsed = JSON.parse(row[0].data) as SystemSettings;
      return {
        ausDB: true,
        settings: {
          ...DEFAULT_SETTINGS,
          ...parsed,
          botSettings: { ...DEFAULT_SETTINGS.botSettings, ...parsed.botSettings },
          riskSettings: { ...DEFAULT_SETTINGS.riskSettings, ...parsed.riskSettings },
          connections: DEFAULT_SETTINGS.connections.map((def) => {
            const saved = parsed.connections?.find((c) => c.brokerKey === def.brokerKey);
            return saved ? { ...saved, connected: false, accountId: null, error: null } : def;
          }),
        },
      };
    }
    // Die Datenbank hat geantwortet, es gibt nur noch keinen Datensatz.
    // Das ist der legitime Erstlauf — Standardwerte sind hier richtig.
    return { ausDB: true, settings: standardwerte() };
  } catch (err) {
    return {
      ausDB: false,
      settings: standardwerte(),
      fehler: err instanceof Error ? err.message : String(err),
    };
  }
}

async function saveToDB(s: SystemSettings): Promise<void> {
  try {
    const db = await getPrisma();
    const data = JSON.stringify(s);
    await db.$executeRawUnsafe(
      `INSERT INTO "SystemSettings" (id, data, "updatedAt") VALUES ('singleton', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, "updatedAt" = NOW()`,
      data
    );
  } catch { /* non-fatal */ }
}

// In-memory cache so we don't hit DB on every read within same process
declare global {
  var __system_settings__: SystemSettings | undefined;
  /** Zeitpunkt der letzten Warnung über einen Lesefehler — damit die Meldung
   *  bei anhaltendem Ausfall nicht jede Sekunde erscheint, aber auch nicht
   *  nur einmal und dann nie wieder. */
  var __settings_letzte_warnung__: number | undefined;
}

/** Wie oft darf gewarnt werden, solange die Datenbank nicht antwortet? */
const WARN_ABSTAND_MS = 5 * 60 * 1000;

async function get(): Promise<SystemSettings> {
  if (global.__system_settings__) return global.__system_settings__;

  const { settings, ausDB, fehler } = await loadFromDB();

  if (!ausDB) {
    // NICHT zwischenspeichern. Der nächste Aufruf versucht es erneut — damit
    // erholt sich das System von selbst, sobald die Datenbank wieder da ist.
    // Vorher blieb der Ausfall bis zum nächsten Deploy eingebrannt.
    const jetzt = Date.now();
    const letzte = global.__settings_letzte_warnung__ ?? 0;
    if (jetzt - letzte > WARN_ABSTAND_MS) {
      global.__settings_letzte_warnung__ = jetzt;
      console.error(
        "[settings] ⛔ EINSTELLUNGEN NICHT LESBAR — es gelten die Standardwerte, "
        + `und die bedeuten mode="MANUAL": es wird NICHT gehandelt. `
        + `Das ist der sichere Zustand, aber kein normaler. Grund: ${fehler}`
      );
      // Stiller Stillstand ist genau das Problem, das behoben wird — deshalb
      // geht die Meldung auch raus. Fehlschlag darf den Lesevorgang nicht
      // aufhalten, deshalb ohne await.
      import("../telegram-notifications/telegram-sender")
        .then(({ sendTelegram }) =>
          sendTelegram(
            "⛔ <b>Einstellungen nicht lesbar</b>\n\n"
            + "Die Datenbank antwortet nicht. Es gelten die Standardwerte — "
            + "und die bedeuten <b>MANUAL</b>: der Bot eröffnet keine Trades.\n\n"
            + "Sobald die Datenbank wieder antwortet, lädt das System die "
            + "Einstellungen von selbst nach.\n\n"
            + `Grund: ${fehler}`
          )
        )
        .catch(() => { /* non-fatal */ });
    }
    return settings;
  }

  global.__system_settings__ = settings;
  return settings;
}

/** Für Diagnose und Prüfer: konnten die Einstellungen aus der Datenbank
 *  gelesen werden, oder gelten gerade die Standardwerte? */
export function einstellungenAusDB(): boolean {
  return global.__system_settings__ !== undefined;
}

async function set(s: SystemSettings): Promise<void> {
  global.__system_settings__ = s;
  await saveToDB(s);
}

export async function getSettings(): Promise<SystemSettings> {
  return JSON.parse(JSON.stringify(await get()));
}

export async function updateBotSettings(patch: Partial<BotSettings>): Promise<void> {
  const s = await get();
  await set({ ...s, botSettings: { ...s.botSettings, ...patch }, updatedAt: new Date().toISOString() });
}

export async function updateRiskSettings(patch: Partial<RiskSettings>): Promise<void> {
  const s = await get();
  await set({ ...s, riskSettings: { ...s.riskSettings, ...patch }, updatedAt: new Date().toISOString() });
}

export async function updateBrokerConnection(patch: Partial<BrokerConnection> & { brokerKey: BrokerConnection["brokerKey"] }): Promise<void> {
  const s = await get();
  await set({ ...s, connections: s.connections.map((c) => c.brokerKey === patch.brokerKey ? { ...c, ...patch } : c), updatedAt: new Date().toISOString() });
}

export async function simulateBrokerConnect(
  brokerKey: BrokerConnection["brokerKey"],
  apiKey: string,
  accountMode: BrokerConnection["accountMode"]
): Promise<{ ok: boolean; accountId: string | null; error: string | null }> {
  if (!apiKey || apiKey.length < 8) {
    await updateBrokerConnection({ brokerKey, connected: false, error: "Invalid API key (minimum 8 characters)" });
    return { ok: false, accountId: null, error: "Invalid API key" };
  }
  const fakeId = `${brokerKey.slice(0, 3)}-DEMO-${Math.floor(Math.random() * 900000 + 100000)}`;
  await updateBrokerConnection({ brokerKey, connected: true, accountId: fakeId, accountMode, lastConnectedAt: new Date().toISOString(), error: null });
  return { ok: true, accountId: fakeId, error: null };
}

export async function simulateBrokerDisconnect(brokerKey: BrokerConnection["brokerKey"]): Promise<void> {
  await updateBrokerConnection({ brokerKey, connected: false, accountId: null, error: null });
}
