export class ClaudeClient {
  async request(prompt: string) {
    console.log("Claude request:", prompt);

    return {
      success: true,
      response: "Claude simulation response"
    };
  }
}