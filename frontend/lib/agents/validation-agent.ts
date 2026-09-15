/**
 * ValidationAgent — Pre/Post Implementierungs-Prüfung
 *
 * Phase 1 (Pre-Check): Plan einreichen → Claude prüft auf Konflikte, fehlende Teile, Architektur-Probleme
 * Phase 2 (Post-Check): Git Diff einreichen → Claude prüft ob Implementierung zum Plan passt
 *
 * Nutzung: Vor und nach jeder Implementierung aufrufen via /api/validation-agent
 */

import Anthropic from "@anthropic-ai/sdk";
import { sendTelegram } from "@/lib/telegram-notifications/telegram-sender";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const AGENT_ID = "ValidationAgent";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface PreCheckRequest {
  plan: string;           // Was wir vorhaben (Beschreibung)
  filesToTouch?: string[]; // Welche Dateien wir anfassen wollen (relativ zu /frontend)
  feature?: string;       // Kurzer Name der Funktion/Feature
}

export interface PostCheckRequest {
  plan: string;  // Der originale Plan vom Pre-Check
  feature?: string;
}

export type ValidationVerdict = "PASS" | "WARN" | "FAIL";

export interface ValidationResult {
  verdict: ValidationVerdict;
  summary: string;
  issues: string[];
  suggestions: string[];
  checkedAt: string;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/**
 * Darf diese Datei-Angabe gelesen werden? (15.09.)
 *
 * DER FUND. Die Funktion hiess `readFilesSafe` und war es nicht. Sie rechnete:
 *
 *   path.resolve(base, f.replace(/^frontend\//, ""))
 *
 * mit `f` direkt aus dem Anfrage-Rumpf (`filesToTouch`). `path.resolve`
 * begrenzt nichts — nachgerechnet, nicht vermutet:
 *
 *   "lib/foo.ts"   -> /app/frontend/lib/foo.ts     (gewollt)
 *   "../.env"      -> /app/.env
 *   "/etc/passwd"  -> /etc/passwd                  (absolut schlaegt base)
 *   ".env.local"   -> /app/frontend/.env.local     (LIEGT IN base!)
 *
 * Der Inhalt ging anschliessend in den Prompt an Claude. CLAUDE.md sagt
 * woertlich: `.env`-Dateien niemals anzeigen. Genau das war hier moeglich —
 * und `.env.local` haette selbst eine reine Wurzel-Begrenzung durchgelassen,
 * weil sie INNERHALB des Projektordners liegt.
 *
 * EHRLICH EINGEORDNET. Der Proxy laesst diese Route nicht ohne gueltiges JWT
 * durch (`PUBLIC_PATHS` kennt sie nicht), und das Anmelde-Cookie ist
 * `httpOnly` + `secure` + `sameSite: "lax"` — ein fremder Seitenaufruf kann
 * den POST also nicht mitschicken. Es war kein offenes Tor ins Internet,
 * sondern ein fehlender Riegel eine Schicht dahinter. Er gehoert trotzdem
 * dorthin: die Funktion gibt mit ihrem Namen ein Versprechen, das sie nicht
 * gehalten hat.
 *
 * Reine Rechnung, kein Dateizugriff — damit ein Pruefer sie wirklich aufrufen
 * kann.
 */
export function dateiFreigegeben(
  basis: string,
  angabe: unknown,
): { erlaubt: boolean; pfad: string | null; grund: string } {
  if (typeof angabe !== "string" || angabe.trim() === "") {
    return { erlaubt: false, pfad: null, grund: "keine gültige Angabe" };
  }
  const roh = angabe.replace(/^frontend\//, "");

  // Absolute Angaben schlagen `basis` — sie muessen VOR dem Aufloesen raus.
  // Windows-Laufwerke und UNC-Pfade ausdruecklich mit: `path.posix.isAbsolute`
  // kennt "C:\…" nicht, und dieser Code laeuft lokal wie im Linux-Container.
  if (path.isAbsolute(roh) || /^[a-zA-Z]:[\\/]/.test(roh) || roh.startsWith("\\\\")) {
    return { erlaubt: false, pfad: null, grund: "absoluter Pfad" };
  }

  const aufgeloest = path.resolve(basis, roh);
  const wurzel = path.resolve(basis);
  // `wurzel + sep` als Praefix: sonst gilt "/app/frontend-geheim" als innerhalb
  // von "/app/frontend".
  if (aufgeloest !== wurzel && !aufgeloest.startsWith(wurzel + path.sep)) {
    return { erlaubt: false, pfad: null, grund: "liegt ausserhalb des Projekts" };
  }

  // Und INNERHALB des Projekts bleiben Geheimnisse trotzdem tabu. Der Name
  // wird auf jedem Pfadstueck geprueft, nicht nur am Ende — `config/.env`
  // zaehlt genauso.
  const stuecke = aufgeloest.split(/[\\/]/);
  if (stuecke.some((s) => /^\.env(\.|$)/i.test(s))) {
    return { erlaubt: false, pfad: null, grund: "Geheimnis-Datei (.env)" };
  }
  if (stuecke.some((s) => s === ".git" || s === "node_modules")) {
    return { erlaubt: false, pfad: null, grund: "Fremd- oder Versionsdaten" };
  }

  return { erlaubt: true, pfad: aufgeloest, grund: "ok" };
}

async function readFilesSafe(files: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const base = path.resolve(process.cwd()); // /frontend im Railway-Container

  for (const f of files.slice(0, 8)) { // max 8 Dateien um Prompt klein zu halten
    const urteil = dateiFreigegeben(base, f);
    if (!urteil.erlaubt || urteil.pfad === null) {
      // BENANNT abgelehnt, nicht still verschluckt: sonst sieht eine
      // abgewiesene Anfrage aus wie eine fehlende Datei, und niemand merkt
      // den Versuch.
      console.warn(`[validation-agent] 🚫 Datei abgelehnt (${urteil.grund}): ${String(f).slice(0, 120)}`);
      result[String(f)] = `[abgelehnt: ${urteil.grund}]`;
      continue;
    }
    try {
      const content = await fs.readFile(urteil.pfad, "utf-8");
      result[f] = content.slice(0, 3000); // max 3000 Zeichen pro Datei
    } catch {
      result[f] = "[Datei nicht lesbar oder existiert noch nicht]";
    }
  }
  return result;
}

async function getGitDiff(): Promise<string> {
  try {
    // Staged + unstaged changes
    const { stdout } = await execAsync("git diff HEAD", {
      cwd: path.resolve(process.cwd(), ".."),
      timeout: 10_000,
    });
    if (!stdout.trim()) {
      // Versuche staged
      const { stdout: staged } = await execAsync("git diff --cached", {
        cwd: path.resolve(process.cwd(), ".."),
        timeout: 10_000,
      });
      return staged.trim() || "[Kein Diff gefunden — evtl. bereits committed]";
    }
    return stdout.slice(0, 12_000); // max 12k Zeichen
  } catch {
    return "[Git diff nicht verfügbar]";
  }
}

async function callClaude(prompt: string): Promise<ValidationResult> {
  const client = getClient();

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Kein Text in Claude-Antwort");
  }

  const raw = textBlock.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(raw) as {
    verdict: ValidationVerdict;
    summary: string;
    issues: string[];
    suggestions: string[];
  };

  return {
    ...parsed,
    checkedAt: new Date().toISOString(),
  };
}

// ── Phase 1: Pre-Check ────────────────────────────────────────────────────────

export async function runPreCheck(req: PreCheckRequest): Promise<ValidationResult> {
  console.log(`[validation-agent] 🔍 Pre-Check: ${req.feature ?? "unbenannt"}`);

  let fileContext = "";
  if (req.filesToTouch && req.filesToTouch.length > 0) {
    const files = await readFilesSafe(req.filesToTouch);
    fileContext = "\n\nRELEVANTE DATEIEN (aktueller Stand):\n" +
      Object.entries(files)
        .map(([name, content]) => `--- ${name} ---\n${content}`)
        .join("\n\n");
  }

  const prompt = `Du bist ein Senior Software Engineer der ein AI Trading System überprüft.

Deine Aufgabe: Prüfe den folgenden Implementierungsplan BEVOR er umgesetzt wird.

SYSTEM-KONTEXT:
- Next.js 15 Frontend mit TypeScript
- Multi-Agent Architektur: OrchestratorAgent → AnalysisAgent → ExecutionAgent, RiskAgent, DiagnosticsAgent
- Agent-Kommunikation via AgentBus (Pub/Sub)
- Redis für Caching (cacheGet/cacheSet)
- Capital.com Demo API als Broker
- Railway Deployment (auto-deploy via git push)
- Telegram für Benachrichtigungen

PLAN:
${req.plan}
${fileContext}

Prüfe:
1. Gibt es Konflikte mit bestehendem Code?
2. Fehlt etwas Wichtiges im Plan (Imports, Types, Error Handling)?
3. Passt die Architektur zum bestehenden System?
4. Gibt es potentielle Bugs oder Race Conditions?

Antworte NUR mit diesem JSON:
{
  "verdict": "PASS" | "WARN" | "FAIL",
  "summary": "<ein Satz Zusammenfassung>",
  "issues": ["<Problem 1>", "<Problem 2>"],
  "suggestions": ["<Verbesserung 1>"]
}

PASS = Plan ist gut, keine Probleme
WARN = Plan OK aber es gibt Punkte zu beachten
FAIL = Plan hat kritische Probleme, nicht implementieren ohne Korrektur`;

  const result = await callClaude(prompt);

  // Telegram-Benachrichtigung
  const emoji = result.verdict === "PASS" ? "✅" : result.verdict === "WARN" ? "⚠️" : "❌";
  await sendTelegram(
`${emoji} <b>ValidationAgent — Pre-Check ${result.verdict}</b>
${req.feature ? `Feature: <b>${req.feature}</b>\n` : ""}
${result.summary}
${result.issues.length > 0 ? `\n⚠️ Probleme:\n${result.issues.map(i => `• ${i}`).join("\n")}` : ""}
${result.suggestions.length > 0 ? `\n💡 Hinweise:\n${result.suggestions.map(s => `• ${s}`).join("\n")}` : ""}
🕐 ${new Date().toLocaleString("de-CH")}`
  ).catch(() => {});

  console.log(`[validation-agent] Pre-Check Ergebnis: ${result.verdict} — ${result.summary}`);
  return result;
}

// ── Phase 2: Post-Check ───────────────────────────────────────────────────────

export async function runPostCheck(req: PostCheckRequest): Promise<ValidationResult> {
  console.log(`[validation-agent] 🔎 Post-Check: ${req.feature ?? "unbenannt"}`);

  const diff = await getGitDiff();

  const prompt = `Du bist ein Senior Software Engineer der ein AI Trading System überprüft.

Deine Aufgabe: Prüfe ob die Implementierung dem Plan entspricht.

ORIGINALER PLAN:
${req.plan}

GIT DIFF (was tatsächlich implementiert wurde):
${diff}

SYSTEM-KONTEXT:
- Next.js 15 Frontend mit TypeScript
- Multi-Agent Architektur mit AgentBus
- Railway Deployment, Redis Cache, Capital.com API

Prüfe:
1. Wurde alles aus dem Plan umgesetzt?
2. Gibt es TypeScript-Fehler oder fehlende Imports?
3. Gibt es Logik-Fehler im implementierten Code?
4. Wurde etwas implementiert das NICHT im Plan war und problematisch sein könnte?
5. Ist der Code konsistent mit dem Coding-Style des Systems?

Antworte NUR mit diesem JSON:
{
  "verdict": "PASS" | "WARN" | "FAIL",
  "summary": "<ein Satz Zusammenfassung>",
  "issues": ["<Problem 1>", "<Problem 2>"],
  "suggestions": ["<Verbesserung 1>"]
}

PASS = Implementierung entspricht dem Plan, kein Fehler
WARN = Implementierung OK aber kleinere Abweichungen oder Hinweise
FAIL = Kritische Fehler oder Plan nicht vollständig umgesetzt`;

  const result = await callClaude(prompt);

  const emoji = result.verdict === "PASS" ? "✅" : result.verdict === "WARN" ? "⚠️" : "❌";
  await sendTelegram(
`${emoji} <b>ValidationAgent — Post-Check ${result.verdict}</b>
${req.feature ? `Feature: <b>${req.feature}</b>\n` : ""}
${result.summary}
${result.issues.length > 0 ? `\n⚠️ Probleme:\n${result.issues.map(i => `• ${i}`).join("\n")}` : ""}
${result.suggestions.length > 0 ? `\n💡 Hinweise:\n${result.suggestions.map(s => `• ${s}`).join("\n")}` : ""}
🕐 ${new Date().toLocaleString("de-CH")}`
  ).catch(() => {});

  console.log(`[validation-agent] Post-Check Ergebnis: ${result.verdict} — ${result.summary}`);
  return result;
}
