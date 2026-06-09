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
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function generateText({
  systemInstruction,
  prompt,
  expectJson,
  maxOutputTokens,
  temperature,
  timeoutMs,
  signal,
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
      ...(timeoutMs ? { httpOptions: { timeout: timeoutMs } } : {}),
      ...(signal ? { abortSignal: signal } : {}),
    },
  });

  return response.text ?? "";
}

interface ProviderRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function queryGeminiWithPrompt(
  prompt: string,
  options: ProviderRequestOptions = {},
): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      maxOutputTokens: 300,
      temperature: 0.7,
      ...(options.timeoutMs ? { httpOptions: { timeout: options.timeoutMs } } : {}),
      ...(options.signal ? { abortSignal: options.signal } : {}),
    },
  });
  return response.text ?? "";
}
