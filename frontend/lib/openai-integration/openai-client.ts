// lib/openai-integration/openai-client.ts

import OpenAI from "openai";
import { OpenAIConfig } from "./openai-types";

export class OpenAIClient {
  private client: OpenAI;

  private config: OpenAIConfig;

  constructor(config?: Partial<OpenAIConfig>) {
    this.config = {
      enabled: true,
      model: "gpt-4o-mini",
      temperature: 0.2,
      maxTokens: 2000,
      ...config,
    };

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  getConfig() {
    return this.config;
  }

  isEnabled() {
    return this.config.enabled;
  }

  async generate(prompt: string): Promise<string> {
    if (!this.config.enabled) {
      throw new Error("OpenAI disabled");
    }

    const response = await this.client.responses.create({
      model: this.config.model,
      input: prompt,
    });

    return response.output_text;
  }
}

export const openAIClient = new OpenAIClient();