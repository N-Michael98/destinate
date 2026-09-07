import type { AISettings, AIProviderConfig, TelegramSettingsConfig } from "./ai-config-types";

const DEFAULT_AI_SETTINGS: AISettings = {
  openai: {
    provider: "OPENAI",
    apiKey: "",
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    connected: false,
    lastTestedAt: null,
    testStatus: "UNTESTED",
    testError: null,
  },
  anthropic: {
    provider: "ANTHROPIC",
    apiKey: "",
    model: "claude-haiku-4-5-20251001",
    temperature: 0.3,
    maxTokens: 2048,
    connected: false,
    lastTestedAt: null,
    testStatus: "UNTESTED",
    testError: null,
  },
  telegram: {
    botToken: "",
    configured: false,
    channels: {
      TRADES: { chatId: "", enabled: false },
      SECURITY: { chatId: "", enabled: false },
      AI_ANALYSIS: { chatId: "", enabled: false },
      SYSTEM_HEALTH: { chatId: "", enabled: false },
    },
  },
  updatedAt: new Date().toISOString(),
};

async function getPrisma() {
  const { getPrisma: gp } = await import("../../app/lib/prisma");
  return gp();
}

// ── Lesefehler ist NICHT dasselbe wie "noch kein Datensatz" (07.09.) ────────
//
// Hier stand ein einziges `catch { /* DB not ready → use defaults */ }`, und
// `getStore()` legte das Ergebnis BEDINGUNGSLOS auf `global.__ai_config_store__`.
// Exakt die Fehlerklasse, die am 26.08. im Einstellungs-Speicher behoben wurde
// — hier war sie noch offen.
//
// WAS DAS KOSTET, und es trifft genau die heutige Umstellung: die
// Standardwerte tragen `model: "gpt-4o-mini"` und
// `"claude-haiku-4-5-20251001"`. Ein einziger fehlgeschlagener Lesevorgang
// beim Prozessstart klemmt das Modell also fuer die GESAMTE Laufzeit auf die
// billige Variante — und weil der Scan dann `scanGptModel === ai.openai.model`
// sieht, meldet er die BERUHIGENDE Zeile:
//
//   [ai-engine] 🎯 Scan nutzt die konfigurierten Modelle: gpt-4o-mini / …
//
// Man sieht das Haekchen und denkt, es laeuft. Der API-Schluessel faellt dabei
// NICHT weg (er kommt aus der Railway-Variable, siehe unten) — nur das Modell.
type AILadeergebnis = {
  settings: AISettings;
  /** true = die Datenbank hat geantwortet (auch ohne Datensatz).
   *  false = Lesefehler; NICHT zwischenspeichern. */
  ausDB: boolean;
  fehler?: string;
};

async function loadFromDB(): Promise<AILadeergebnis> {
  let settings: AISettings = JSON.parse(JSON.stringify(DEFAULT_AI_SETTINGS));
  let ausDB = true;
  let fehler: string | undefined;
  try {
    const db = await getPrisma();
    const row = await db.$queryRaw<{ data: string }[]>`
      SELECT data FROM "AIConfig" WHERE id = 'singleton' LIMIT 1
    `;
    if (row && row.length > 0) {
      const parsed = JSON.parse(row[0].data) as AISettings;
      settings = {
        ...DEFAULT_AI_SETTINGS,
        ...parsed,
        openai: { ...DEFAULT_AI_SETTINGS.openai, ...parsed.openai },
        anthropic: { ...DEFAULT_AI_SETTINGS.anthropic, ...parsed.anthropic },
        telegram: {
          ...DEFAULT_AI_SETTINGS.telegram,
          ...parsed.telegram,
          channels: { ...DEFAULT_AI_SETTINGS.telegram.channels, ...parsed.telegram?.channels },
        },
      };
    }
  } catch (err) {
    ausDB = false;
    fehler = err instanceof Error ? err.message : String(err);
  }

  // Railway Variables override DB — env vars take precedence
  //
  // KORREKTUR 03.08.: hier stand testStatus "OK", sobald die Variable existiert
  // und länger als 20 Zeichen ist. Das war eine Behauptung, kein Ergebnis — es
  // wurde nie ein Aufruf gemacht. Ein gesperrter, abgelaufener oder schlicht
  // falscher Schlüssel wurde damit als "OK" angezeigt, und weil die Agenten
  // umgekehrt NUR bei Fehlern etwas loggen, war von aussen nicht zu erkennen,
  // ob die AI-Gates antworten oder seit Wochen still zurückfallen.
  // "UNTESTED" ist bereits ein gültiger Wert und wird von der UI angezeigt.
  // Echten Status liefert /api/ai-health — der ruft die Anbieter wirklich auf.
  // `connected` bleibt bewusst true: davon hängt ab, ob überhaupt eine echte
  // Analyse versucht wird (isRealAnalysis). Ein Schlüssel IST hinterlegt —
  // ob er trägt, ist eine andere Frage und genau die, die getrennt gehört.
  const envOpenAI = process.env.OPENAI_API_KEY;
  const envAnthropic = process.env.ANTHROPIC_API_KEY;
  const envTelegram = process.env.TELEGRAM_BOT_TOKEN;
  if (envOpenAI && envOpenAI.length > 20) {
    settings.openai = { ...settings.openai, apiKey: envOpenAI, connected: true, testStatus: "UNTESTED" };
  }
  if (envAnthropic && envAnthropic.length > 20) {
    settings.anthropic = { ...settings.anthropic, apiKey: envAnthropic, connected: true, testStatus: "UNTESTED" };
  }
  if (envTelegram && envTelegram.length > 10) {
    settings.telegram = { ...settings.telegram, botToken: envTelegram, configured: true };
  }

  return { settings, ausDB, fehler };
}

/** Schreibt — und WIRFT bei einem Fehlschlag (07.09.). Vorher stand hier
 *  `catch { /* non-fatal *\/ }`: die Oberflaeche meldete Erfolg, die Datenbank
 *  behielt den alten Wert, und beim naechsten Neustart war die Aenderung weg. */
async function saveToDB(settings: AISettings): Promise<void> {
  const db = await getPrisma();
  const data = JSON.stringify(settings);
  await db.$executeRawUnsafe(
    `INSERT INTO "AIConfig" (id, data, "updatedAt") VALUES ('singleton', $1, NOW())
     ON CONFLICT (id) DO UPDATE SET data = $1, "updatedAt" = NOW()`,
    data
  );
}

declare global {
  var __ai_config_store__: AISettings | undefined;
  /** Zeitpunkt der letzten Warnung — damit die Meldung bei anhaltendem Ausfall
   *  nicht jede Sekunde erscheint, aber auch nicht nur einmal. */
  var __ai_config_letzte_warnung__: number | undefined;
}

const AI_WARN_ABSTAND_MS = 5 * 60 * 1000;

async function getStore(): Promise<AISettings> {
  if (global.__ai_config_store__) return global.__ai_config_store__;

  const { settings, ausDB, fehler } = await loadFromDB();

  if (!ausDB) {
    // NICHT zwischenspeichern — der naechste Aufruf versucht es erneut, damit
    // sich das System von selbst erholt, sobald die Datenbank wieder da ist.
    const jetzt = Date.now();
    if (jetzt - (global.__ai_config_letzte_warnung__ ?? 0) > AI_WARN_ABSTAND_MS) {
      global.__ai_config_letzte_warnung__ = jetzt;
      console.error(
        "[ai-config] ⛔ AI-KONFIGURATION NICHT LESBAR — es gelten die "
        + `Standardwerte, und die bedeuten Modell "${DEFAULT_AI_SETTINGS.openai.model}" `
        + `/ "${DEFAULT_AI_SETTINGS.anthropic.model}". Der Scan meldet dann `
        + `"nutzt die konfigurierten Modelle" und meint die billigen. `
        + `Grund: ${fehler}`
      );
      import("../telegram-notifications/telegram-sender")
        .then(({ sendTelegram }) =>
          sendTelegram(
            "⛔ <b>AI-Konfiguration nicht lesbar</b>\n\n"
            + "Die Datenbank antwortet nicht. Es gelten die Standardwerte — "
            + `das Modell faellt auf <b>${DEFAULT_AI_SETTINGS.openai.model}</b> zurueck.\n\n`
            + `Grund: ${fehler}`
          )
        )
        .catch(() => { /* non-fatal */ });
    }
    return settings;
  }

  global.__ai_config_store__ = settings;
  return settings;
}

/** Fuer Diagnose und Pruefer: kam die Konfiguration aus der Datenbank? */
export function aiKonfigAusDB(): boolean {
  return global.__ai_config_store__ !== undefined;
}

/** ZUERST schreiben, DANN merken (07.09.) — umgekehrt stand der neue Wert im
 *  Speicher, auch wenn die Datenbank ihn nie bekam. */
async function setStore(s: AISettings): Promise<void> {
  await saveToDB(s);
  global.__ai_config_store__ = s;
}

/**
 * Grundlage fuer eine Aenderung — mit Riegel gegen das Ueberschreiben mit
 * Standardwerten (07.09.).
 *
 * `getStore()` liefert bei einem Lesefehler die STANDARDWERTE. Wuerde man die
 * als Grundlage nehmen, schriebe `saveToDB` mit `ON CONFLICT DO UPDATE SET
 * data = $1` die GANZE Zeile — Modelle, Temperaturen und die Telegram-Kanaele
 * fielen auf Standard zurueck.
 */
async function basisFuerAenderung(): Promise<AISettings> {
  const s = await getStore();
  if (!aiKonfigAusDB()) {
    throw new Error(
      "AI-Konfiguration ist gerade nicht lesbar — es gelten die Standardwerte. "
      + "Gespeichert wird NICHT: das wuerde Modelle und Telegram-Kanaele auf "
      + "Standard zuruecksetzen."
    );
  }
  return s;
}

export async function getAISettings(): Promise<AISettings> {
  return JSON.parse(JSON.stringify(await getStore()));
}

/**
 * Status-Vermerk eines Verbindungstests (07.09.).
 *
 * Die Aenderungsfunktionen werfen jetzt bei einem Speicherfehler — richtig,
 * wenn der Nutzer bewusst speichert. Ein Verbindungstest ist etwas anderes:
 * sein ERGEBNIS ist die Antwort, der Status-Vermerk nur Beiwerk. Scheitert das
 * Schreiben, wird es gemeldet, aber der Test liefert weiter sein Urteil.
 */
async function vermerke(was: () => Promise<void>): Promise<void> {
  try {
    await was();
  } catch (e) {
    console.warn("[ai-config] Status des Verbindungstests nicht gespeichert:",
      e instanceof Error ? e.message : String(e));
  }
}

export async function updateOpenAI(patch: Partial<AIProviderConfig>): Promise<void> {
  const s = await basisFuerAenderung();
  await setStore({ ...s, openai: { ...s.openai, ...patch }, updatedAt: new Date().toISOString() });
}

export async function updateAnthropic(patch: Partial<AIProviderConfig>): Promise<void> {
  const s = await basisFuerAenderung();
  await setStore({ ...s, anthropic: { ...s.anthropic, ...patch }, updatedAt: new Date().toISOString() });
}

export async function updateTelegram(patch: Partial<TelegramSettingsConfig>): Promise<void> {
  const s = await basisFuerAenderung();
  await setStore({ ...s, telegram: { ...s.telegram, ...patch }, updatedAt: new Date().toISOString() });
}

export async function saveOpenAIKey(apiKey: string, model: string): Promise<void> {
  await updateOpenAI({ apiKey, model, testStatus: "UNTESTED", connected: false, testError: null });
}

export async function saveAnthropicKey(apiKey: string, model: string): Promise<void> {
  await updateAnthropic({ apiKey, model, testStatus: "UNTESTED", connected: false, testError: null });
}

export async function testOpenAIConnection(apiKey: string, model: string): Promise<{ ok: boolean; error: string | null }> {
  if (!apiKey || apiKey.length < 20 || !apiKey.startsWith("sk-")) {
    await vermerke(() => updateOpenAI({ testStatus: "FAILED", testError: "Key muss mit sk- beginnen", connected: false, lastTestedAt: new Date().toISOString() }));
    return { ok: false, error: "Key muss mit sk- beginnen (z.B. sk-proj-...)" };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401) {
      await vermerke(() => updateOpenAI({ testStatus: "FAILED", testError: "Ungültiger API Key", connected: false, lastTestedAt: new Date().toISOString() }));
      return { ok: false, error: "Ungültiger API Key (401 Unauthorized)" };
    }
    if (!res.ok) {
      const err = `HTTP ${res.status}`;
      await vermerke(() => updateOpenAI({ testStatus: "FAILED", testError: err, connected: false, lastTestedAt: new Date().toISOString() }));
      return { ok: false, error: err };
    }
    await vermerke(() => updateOpenAI({ testStatus: "OK", testError: null, connected: true, apiKey, model, lastTestedAt: new Date().toISOString() }));
    return { ok: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Netzwerkfehler";
    await vermerke(() => updateOpenAI({ testStatus: "FAILED", testError: msg, connected: false, lastTestedAt: new Date().toISOString() }));
    return { ok: false, error: msg };
  }
}

export async function testAnthropicConnection(apiKey: string, model: string): Promise<{ ok: boolean; error: string | null }> {
  if (!apiKey || apiKey.length < 20 || !apiKey.startsWith("sk-ant-")) {
    await vermerke(() => updateAnthropic({ testStatus: "FAILED", testError: "Key muss mit sk-ant- beginnen", connected: false, lastTestedAt: new Date().toISOString() }));
    return { ok: false, error: "Key muss mit sk-ant- beginnen" };
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: "user", content: "ping" }] }),
    });
    if (res.status === 401) {
      await vermerke(() => updateAnthropic({ testStatus: "FAILED", testError: "Ungültiger API Key", connected: false, lastTestedAt: new Date().toISOString() }));
      return { ok: false, error: "Ungültiger API Key (401 Unauthorized)" };
    }
    if (!res.ok && res.status !== 400) {
      const err = `HTTP ${res.status}`;
      await vermerke(() => updateAnthropic({ testStatus: "FAILED", testError: err, connected: false, lastTestedAt: new Date().toISOString() }));
      return { ok: false, error: err };
    }
    await vermerke(() => updateAnthropic({ testStatus: "OK", testError: null, connected: true, apiKey, model, lastTestedAt: new Date().toISOString() }));
    return { ok: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Netzwerkfehler";
    await vermerke(() => updateAnthropic({ testStatus: "FAILED", testError: msg, connected: false, lastTestedAt: new Date().toISOString() }));
    return { ok: false, error: msg };
  }
}

export async function saveTelegramConfig(botToken: string, channels: TelegramSettingsConfig["channels"]): Promise<void> {
  await updateTelegram({ botToken, channels, configured: !!botToken && botToken.length > 10 });
}
