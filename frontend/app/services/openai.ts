export type AIResponse = {
  success: boolean;
  reply: string;
  source: "local-api" | "openai";
};

export async function askOpenAI(
  message: string
): Promise<string> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `API Fehler: ${response.status}`
      );
    }

    const data: AIResponse = await response.json();

    return data.reply;
  } catch (error) {
    console.error("OpenAI Service Fehler:", error);

    return "Fehler bei der Verbindung zur AI API.";
  }
}