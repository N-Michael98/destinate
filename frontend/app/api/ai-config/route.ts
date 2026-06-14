export const dynamic = "force-dynamic";
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
    return NextResponse.json({ ok: true, settings: await getAISettings() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action: string = body.action ?? "";

    if (action === "update_openai") {
      await updateOpenAI(body.patch ?? {});
      return NextResponse.json({ ok: true, settings: await getAISettings() });
    }

    if (action === "update_anthropic") {
      await updateAnthropic(body.patch ?? {});
      return NextResponse.json({ ok: true, settings: await getAISettings() });
    }

    if (action === "save_openai_key") {
      await saveOpenAIKey(body.apiKey ?? "", body.model ?? "gpt-4o");
      return NextResponse.json({ ok: true, settings: await getAISettings() });
    }

    if (action === "save_anthropic_key") {
      await saveAnthropicKey(body.apiKey ?? "", body.model ?? "claude-sonnet-4-6");
      return NextResponse.json({ ok: true, settings: await getAISettings() });
    }

    if (action === "test_openai") {
      const result = await testOpenAIConnection(body.apiKey ?? "", body.model ?? "gpt-4o");
      return NextResponse.json({ ok: result.ok, error: result.error, settings: await getAISettings() });
    }

    if (action === "test_anthropic") {
      const result = await testAnthropicConnection(body.apiKey ?? "", body.model ?? "claude-sonnet-4-6");
      return NextResponse.json({ ok: result.ok, error: result.error, settings: await getAISettings() });
    }

    if (action === "save_telegram") {
      await saveTelegramConfig(body.botToken ?? "", body.channels ?? {});
      return NextResponse.json({ ok: true, settings: await getAISettings() });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
