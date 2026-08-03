export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Echter Erreichbarkeitstest der AI-Anbieter (03.08.).
 *
 * Anlass: die Einstellungs-Anzeige meldete "verbunden / OK", sobald die
 * Umgebungsvariable existierte und länger als 20 Zeichen war — ohne je einen
 * Aufruf gemacht zu haben. Ein gesperrter oder falscher Schlüssel sah damit
 * genauso aus wie ein funktionierender. Umgekehrt loggen die vier AI-Gates
 * (Orchestrator, Analysis, Execution, Risk) NUR im Fehlerfall. Zwischen
 * "antwortet sauber" und "fällt seit Wochen still auf approve zurück" war von
 * aussen kein Unterschied erkennbar.
 *
 * Diese Route ruft die Anbieter wirklich auf — mit EXAKT demselben Schlüssel
 * aus der Umgebung und demselben Modell, die auch die Agenten benutzen. Damit
 * ist der Zustand belegbar statt behauptet.
 *
 * Der Schlüssel selbst wird NIEMALS zurückgegeben, nur ob er vorhanden ist und
 * wie er sich verhält. Die Route liegt hinter dem Login (middleware.ts schützt
 * alles ausser PUBLIC_PATHS). Kosten pro Aufruf: wenige Token.
 */

// Dieselben Modelle wie in den Agenten — sonst prüft die Route etwas anderes,
// als im Betrieb tatsächlich läuft.
const AGENT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const AGENT_OPENAI_MODEL = "gpt-4o-mini";

/**
 * Entfernt Schlüssel aus Fehlertexten, bevor sie die Route verlassen.
 * Fehlermeldungen von Anbietern enthalten den Schlüssel normalerweise nicht —
 * "normalerweise" ist bei einem Geheimnis aber kein Massstab. Zusätzlich werden
 * schlüsselartige Zeichenketten allgemein maskiert, falls ein Anbieter seine
 * Fehlerform ändert.
 */
function entferneGeheimnisse(text: string): string {
  let sauber = text;
  for (const key of [process.env.ANTHROPIC_API_KEY, process.env.OPENAI_API_KEY]) {
    if (key && key.length > 8) sauber = sauber.split(key).join("[Schlüssel entfernt]");
  }
  return sauber
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[Schlüssel entfernt]")
    .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer [entfernt]");
}

interface ProviderResult {
  schluesselVorhanden: boolean;
  erreichbar: boolean;
  modell: string;
  dauerMs: number | null;
  antwort: string | null;
  fehler: string | null;
}

async function testeClaude(): Promise<ProviderResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  const basis: ProviderResult = {
    schluesselVorhanden: !!key,
    erreichbar: false,
    modell: AGENT_CLAUDE_MODEL,
    dauerMs: null,
    antwort: null,
    fehler: null,
  };
  if (!key) return { ...basis, fehler: "ANTHROPIC_API_KEY ist nicht gesetzt" };

  const start = Date.now();
  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: AGENT_CLAUDE_MODEL,
      max_tokens: 16,
      messages: [{ role: "user", content: "Antworte nur mit dem Wort: OK" }],
    });
    const block = msg.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    return { ...basis, erreichbar: true, dauerMs: Date.now() - start, antwort: text.slice(0, 40) };
  } catch (e) {
    return {
      ...basis,
      dauerMs: Date.now() - start,
      fehler: entferneGeheimnisse(e instanceof Error ? e.message : String(e)).slice(0, 300),
    };
  }
}

async function testeOpenAI(): Promise<ProviderResult> {
  const key = process.env.OPENAI_API_KEY;
  const basis: ProviderResult = {
    schluesselVorhanden: !!key,
    erreichbar: false,
    modell: AGENT_OPENAI_MODEL,
    dauerMs: null,
    antwort: null,
    fehler: null,
  };
  if (!key) return { ...basis, fehler: "OPENAI_API_KEY ist nicht gesetzt" };

  const start = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: AGENT_OPENAI_MODEL,
        max_tokens: 16,
        messages: [{ role: "user", content: "Antworte nur mit dem Wort: OK" }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ...basis, dauerMs: Date.now() - start, fehler: entferneGeheimnisse(`HTTP ${res.status} ${body}`).slice(0, 300) };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = String(data.choices?.[0]?.message?.content ?? "").trim();
    return { ...basis, erreichbar: true, dauerMs: Date.now() - start, antwort: text.slice(0, 40) };
  } catch (e) {
    return {
      ...basis,
      dauerMs: Date.now() - start,
      fehler: entferneGeheimnisse(e instanceof Error ? e.message : String(e)).slice(0, 300),
    };
  }
}

export async function GET() {
  const [claude, openai] = await Promise.all([testeClaude(), testeOpenAI()]);

  // Die AI-Gates fallen bei einem Fehler bewusst auf "durchlassen" zurück
  // (Entscheidung 28.07.). Diese Zeile macht sichtbar, ob dieser Rückfall
  // gerade der Dauerzustand ist.
  const gatesEcht = claude.erreichbar;
  console.log(
    `[ai-health] Claude ${claude.erreichbar ? "OK " + claude.dauerMs + "ms" : "FEHLER: " + claude.fehler} | ` +
    `OpenAI ${openai.erreichbar ? "OK " + openai.dauerMs + "ms" : "FEHLER: " + openai.fehler}`
  );

  return NextResponse.json({
    ok: claude.erreichbar && openai.erreichbar,
    geprueftAm: new Date().toISOString(),
    hinweis: gatesEcht
      ? "Claude antwortet — die AI-Sicherheitsgates entscheiden echt."
      : "Claude antwortet NICHT — alle AI-Gates laufen im Rückfall und lassen ungeprüft durch.",
    claude,
    openai,
  });
}
