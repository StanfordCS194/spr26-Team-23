import { GoogleGenAI } from "@google/genai";
import { normalizeAnswerSources } from "@/lib/source-utils";
import { ModelAnswer } from "@/types";

export const GEMINI_MODEL = "gemini-3-flash-preview";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to app/.env.local or use Demo Mode.",
    );
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  return client;
}

interface GenerateOptions {
  systemInstruction: string;
  prompt: string;
  expectJson?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
}

export async function generateText({
  systemInstruction,
  prompt,
  expectJson,
  maxOutputTokens,
  temperature,
}: GenerateOptions): Promise<string> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      ...(expectJson ? { responseMimeType: "application/json" } : {}),
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
      ...(typeof temperature === "number" ? { temperature } : {}),
    },
  });

  return response.text ?? "";
}

export async function queryGeminiWithPrompt(prompt: string): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { maxOutputTokens: 300, temperature: 0.7 },
  });
  return response.text ?? "";
}

interface GeminiGroundingResponse {
  text?: string;
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      groundingSupports?: Array<{
        segment?: { text?: string };
        groundingChunkIndices?: number[];
      }>;
      webSearchQueries?: string[];
    };
  }>;
}

export function extractGeminiWebAnswer(response: GeminiGroundingResponse): ModelAnswer {
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  const chunks = groundingMetadata?.groundingChunks ?? [];
  const supports = groundingMetadata?.groundingSupports ?? [];
  const citedTextByChunk = new Map<number, string>();

  for (const support of supports) {
    const segmentText = support.segment?.text;
    if (!segmentText || !support.groundingChunkIndices?.length) continue;
    for (const index of support.groundingChunkIndices) {
      if (!citedTextByChunk.has(index)) citedTextByChunk.set(index, segmentText);
    }
  }

  const sources = normalizeAnswerSources(
    chunks.map((chunk, index) => ({
      url: chunk.web?.uri,
      title: chunk.web?.title,
      citedText: citedTextByChunk.get(index),
      provider: "gemini" as const,
    })),
  );

  return {
    response: response.text ?? "",
    sources,
    grounded: sources.length > 0 || Boolean(groundingMetadata?.webSearchQueries?.length),
  };
}

export async function queryGeminiWithWebPrompt(prompt: string): Promise<ModelAnswer> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      maxOutputTokens: 300,
      temperature: 0.7,
      tools: [{ googleSearch: {} }],
    },
  });

  return extractGeminiWebAnswer(response);
}
