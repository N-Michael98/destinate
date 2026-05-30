import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body.message;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        {
          error: "Message fehlt oder ist ungültig.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: "success",
      mode: "openai-ready",
      reply: `OpenAI API Route funktioniert. Deine Nachricht war: "${message}". Später wird hier die echte GPT-Antwort zurückgegeben.`,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Server konnte die Anfrage nicht verarbeiten.",
      },
      { status: 500 }
    );
  }
}