import { generateText } from "@/lib/gemini";
import { safeParseJson } from "@/lib/json-repair";
import {
  CompanyInput,
  GeneratedPrompt,
  PromptAnalysis,
  PromptAnalysisDetails,
  Sentiment,
} from "@/types";

const POSITIVE_WORDS = [
  "best",
  "excellent",
  "great",
  "strong",
  "recommended",
  "popular",
  "leading",
];
const NEGATIVE_WORDS = ["poor", "limited", "weak", "expensive", "not ideal", "lacking"];

function normalize(value: string): string {
  return value.toLowerCase();
}

function extractFirstSentence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s+/)[0];
  return sentence?.trim() || text.slice(0, 160);
}

function detectSentiment(response: string): Sentiment {
  const lower = normalize(response);
  const positive = POSITIVE_WORDS.filter((w) => lower.includes(w)).length;
  const negative = NEGATIVE_WORDS.filter((w) => lower.includes(w)).length;
  if (positive > negative) return "positive";
  if (negative > positive) return "negative";
  return "neutral";
}

function rankedMentions(response: string, companies: string[]): string[] {
  const lower = normalize(response);
  return companies
    .map((name) => ({ name, index: lower.indexOf(normalize(name)) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.name);
}

export function deterministicAnalyze(
  company: CompanyInput,
  prompt: GeneratedPrompt,
  response: string,
): PromptAnalysisDetails {
  const competitors = company.competitors || [];
  const ranked = rankedMentions(response, [company.companyName, ...competitors]);
  const targetIndex = ranked.findIndex(
    (name) => normalize(name) === normalize(company.companyName),
  );
  const targetMentioned = targetIndex >= 0;

  const mentionedCompetitors = competitors.filter((c) =>
    normalize(response).includes(normalize(c)),
  );

  const sentiment: Sentiment = targetMentioned ? detectSentiment(response) : "not_mentioned";

  return {
    targetMentioned,
    targetRank: targetMentioned ? targetIndex + 1 : null,
    mentionedCompetitors,
    allMentionedCompanies: ranked,
    sentiment,
    competitorWon: !targetMentioned && mentionedCompetitors.length > 0,
    usefulQuote: extractFirstSentence(response),
  };
}

// -------- LLM insights (batched, interpretation-only) --------

const INSIGHT_SYSTEM_INSTRUCTION = `You are Tunnel's response analysis engine.

You are given multiple prompts and AI assistant responses for a target company.

For each item, extract:
- targetDescription: short phrase describing how the company is positioned in this response
- explanation: 1–2 sentence interpretation of what this response suggests about the company's AI visibility
- possibleInaccuracies: brief list of specific statements that might be inaccurate or misleading (empty array if none)

Return ONLY valid JSON:
{
  "analyses": [
    {
      "promptId": "p1",
      "targetDescription": "...",
      "explanation": "...",
      "possibleInaccuracies": []
    }
  ]
}

Rules:
- Never change ranks or which companies are mentioned; only describe, interpret, or flag issues.
- Do not hallucinate facts not present in the response text.
- Keep targetDescription and explanation concise.
- possibleInaccuracies must be [] if you are unsure.
- Do not include markdown.`;

interface InsightRowInput {
  promptId: string;
  prompt: string;
  category: string;
  response: string;
}

interface BatchedInsightResponse {
  analyses?: Array<{
    promptId?: string;
    targetDescription?: string;
    explanation?: string;
    possibleInaccuracies?: string[];
  }>;
}

export type LlmInsightFields = Pick<
  PromptAnalysisDetails,
  "targetDescription" | "explanation" | "possibleInaccuracies"
>;

export async function batchLlmAnalyze(
  company: CompanyInput,
  rows: InsightRowInput[],
): Promise<Record<string, LlmInsightFields> | null> {
  if (!rows.length) return {};
  if (!process.env.GEMINI_API_KEY) return null;

  const payload = JSON.stringify({
    target: company.companyName,
    competitors: company.competitors || [],
    rows,
  });

  let raw = "";
  try {
    raw = await generateText({
      systemInstruction: INSIGHT_SYSTEM_INSTRUCTION,
      prompt: payload,
      expectJson: true,
      maxOutputTokens: 3000,
      temperature: 0.2,
    });
  } catch (err) {
    console.warn("[analysis] batchLlmAnalyze Gemini call failed, falling back to deterministic-only.", err);
    return null;
  }

  const parsed = safeParseJson<BatchedInsightResponse>(raw);
  if (!parsed?.analyses?.length) {
    console.warn(
      "[analysis] batchLlmAnalyze JSON parse failed or empty analyses. Raw (first 250 chars):",
      raw.slice(0, 250),
    );
    return null;
  }

  return parsed.analyses.reduce<Record<string, LlmInsightFields>>((acc, item) => {
    if (!item?.promptId) return acc;
    acc[item.promptId] = {
      targetDescription:
        typeof item.targetDescription === "string" && item.targetDescription.trim()
          ? item.targetDescription.trim()
          : undefined,
      explanation:
        typeof item.explanation === "string" && item.explanation.trim()
          ? item.explanation.trim()
          : undefined,
      possibleInaccuracies: Array.isArray(item.possibleInaccuracies)
        ? item.possibleInaccuracies
            .filter((s): s is string => typeof s === "string")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : undefined,
    };
    return acc;
  }, {});
}

export function buildPromptAnalysis(
  prompt: GeneratedPrompt,
  response: string,
  details: PromptAnalysisDetails,
  error?: string,
): PromptAnalysis {
  return {
    promptId: prompt.id,
    prompt: prompt.prompt,
    category: prompt.category,
    rationale: prompt.rationale,
    response,
    error,
    analysis: details,
  };
}
