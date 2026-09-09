import { createAnthropic } from "@ai-sdk/anthropic";

export function createAiProvider() {
  return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
