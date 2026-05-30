export async function askOpenAI(message: string) {
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

    const data = await response.json();

    return data.reply;
  } catch (error) {
    console.error(error);

    return "Fehler bei der Verbindung zur AI API.";
  }
}