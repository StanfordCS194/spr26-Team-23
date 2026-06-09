/**
 * OpenAI client (currently inactive).
 *
 * The app uses Gemini exclusively for now (see `lib/gemini.ts`).
 * This file is intentionally kept so we can fall back to OpenAI or
 * support multiple providers later without re-adding boilerplate.
 *
 * Example usage if reactivating:
 *   import { getOpenAIClient } from "@/lib/openai";
 *   const completion = await getOpenAIClient().responses.create({ ... });
 */

import OpenAI from "openai";

export const GPT4O_MODEL = "gpt-4o";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
}

interface ProviderRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function queryGPT4oWithPrompt(
  prompt: string,
  options: ProviderRequestOptions = {},
): Promise<string> {
  const openai = getOpenAIClient();
  const response = await openai.responses.create(
    {
      model: GPT4O_MODEL,
      input: prompt,
      max_output_tokens: 300,
      temperature: 0.7,
      store: false,
    },
    {
      ...(options.timeoutMs ? { timeout: options.timeoutMs } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  return response.output_text ?? "";
}
