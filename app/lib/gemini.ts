import { GoogleGenAI } from "@google/genai";

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
