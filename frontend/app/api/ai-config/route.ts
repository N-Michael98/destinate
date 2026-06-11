import { NextResponse } from "next/server";
import {
  getAISettings,
  updateOpenAI,
  updateAnthropic,
  saveTelegramConfig,
  saveOpenAIKey,
  saveAnthropicKey,
  testOpenAIConnection,
  testAnthropicConnection,
} from "../../../lib/ai-config";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, settings: getAISettings() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action: string = body.action ?? "";

    if (action === "update_openai") {
      updateOpenAI(body.patch ?? {});
      return NextResponse.json({ ok: true, settings: getAISettings() });
    }

    if (action === "update_anthropic") {
      updateAnthropic(body.patch ?? {});
      return NextResponse.json({ ok: true, settings: getAISettings() });
    }

    if (action === "save_openai_key") {
      saveOpenAIKey(body.apiKey ?? "", body.model ?? "gpt-4o");
      return NextResponse.json({ ok: true, settings: getAISettings() });
    }

    if (action === "save_anthropic_key") {
      saveAnthropicKey(body.apiKey ?? "", body.model ?? "claude-sonnet-4-6");
      return NextResponse.json({ ok: true, settings: getAISettings() });
    }

    if (action === "test_openai") {
      const result = await testOpenAIConnection(body.apiKey ?? "", body.model ?? "gpt-4o");
      return NextResponse.json({ ok: result.ok, error: result.error, settings: getAISettings() });
    }

    if (action === "test_anthropic") {
      const result = await testAnthropicConnection(body.apiKey ?? "", body.model ?? "claude-sonnet-4-6");
      return NextResponse.json({ ok: result.ok, error: result.error, settings: getAISettings() });
    }

    if (action === "save_telegram") {
      saveTelegramConfig(body.botToken ?? "", body.channels ?? {});
      return NextResponse.json({ ok: true, settings: getAISettings() });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
