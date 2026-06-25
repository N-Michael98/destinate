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

async function readFilesSafe(files: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const base = path.resolve(process.cwd()); // /frontend im Railway-Container

  for (const f of files.slice(0, 8)) { // max 8 Dateien um Prompt klein zu halten
    try {
      const fullPath = path.resolve(base, f.replace(/^frontend\//, ""));
      const content = await fs.readFile(fullPath, "utf-8");
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
    model: "claude-opus-4-8",
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
