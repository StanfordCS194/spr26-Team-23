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
