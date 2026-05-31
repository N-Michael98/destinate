import OpenAI from "openai";
import { NextResponse } from "next/server";

const openaiApiKey = process.env.OPENAI_API_KEY;

const openai = openaiApiKey
  ? new OpenAI({
      apiKey: openaiApiKey,
    })
  : null;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body.message;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        {
          success: false,
          source: "local-api",
          reply: "",
          error: "Message fehlt oder ist ungültig.",
        },
        { status: 400 }
      );
    }

    if (!openai) {
      return NextResponse.json({
        success: true,
        source: "local-api",
        reply: `OpenAI API Route funktioniert. Es ist aber noch kein OPENAI_API_KEY gesetzt. Deine Nachricht war: "${message}".`,
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: message,
    });

    return NextResponse.json({
      success: true,
      source: "openai",
      reply: response.output_text,
    });
  } catch (error) {
    console.error("Chat API Fehler:", error);

    return NextResponse.json(
      {
        success: false,
        source: "local-api",
        reply: "Server konnte die Anfrage nicht verarbeiten.",
        error: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}