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
import { normalizeAnswerSources } from "@/lib/source-utils";
import { ModelAnswer } from "@/types";

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

export async function queryGPT4oWithPrompt(prompt: string): Promise<string> {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: GPT4O_MODEL,
    input: prompt,
    max_output_tokens: 300,
    temperature: 0.7,
    store: false,
  });
  return response.output_text ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function extractOpenAIUrlCitations(response: unknown) {
  const citations: Array<{ url?: string; title?: string; citedText?: string }> = [];
  if (!isRecord(response) || !Array.isArray(response.output)) return citations;

  for (const outputItem of response.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) continue;
    for (const contentItem of outputItem.content) {
      if (!isRecord(contentItem) || !Array.isArray(contentItem.annotations)) continue;
      const text = typeof contentItem.text === "string" ? contentItem.text : "";
      for (const annotation of contentItem.annotations) {
        if (!isRecord(annotation)) continue;

        const directUrl =
          annotation.type === "url_citation" && typeof annotation.url === "string"
            ? annotation.url
            : null;
        const nested =
          isRecord(annotation.url_citation) && typeof annotation.url_citation.url === "string"
            ? annotation.url_citation
            : null;
        const url = directUrl ?? (nested?.url as string | undefined);
        if (!url) continue;

        const title =
          typeof annotation.title === "string"
            ? annotation.title
            : nested && typeof nested.title === "string"
              ? nested.title
              : undefined;

        const start =
          typeof annotation.start_index === "number"
            ? annotation.start_index
            : nested && typeof nested.start_index === "number"
              ? nested.start_index
              : null;
        const end =
          typeof annotation.end_index === "number"
            ? annotation.end_index
            : nested && typeof nested.end_index === "number"
              ? nested.end_index
              : null;

        citations.push({
          url,
          title,
          citedText: start !== null && end !== null ? text.slice(start, end) : undefined,
        });
      }
    }
  }

  return citations;
}

export function extractOpenAIWebSources(response: unknown) {
  return normalizeAnswerSources(
    extractOpenAIUrlCitations(response).map((source) => ({
      ...source,
      provider: "gpt-4o" as const,
    })),
  );
}

export async function queryGPT4oWithWebPrompt(prompt: string): Promise<ModelAnswer> {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: GPT4O_MODEL,
    input: prompt,
    tools: [{ type: "web_search", search_context_size: "low" }],
    max_output_tokens: 300,
    temperature: 0.7,
    store: false,
  });

  const sources = extractOpenAIWebSources(response);

  return {
    response: response.output_text ?? "",
    sources,
    grounded: sources.length > 0,
  };
}
