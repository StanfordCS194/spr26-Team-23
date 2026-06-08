import { generateText } from "@/lib/gemini";
import { safeParseJson } from "@/lib/json-repair";
import {
  CompanyInput,
  GeneratedPrompt,
  ModelAnswer,
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
    targetDescription: targetMentioned ? extractFirstSentence(response) : "",
    possibleInaccuracies: [],
    competitorWon: !targetMentioned && mentionedCompetitors.length > 0,
    explanation: targetMentioned
      ? `${company.companyName} appears in the response in position ${targetIndex + 1}.`
      : `${company.companyName} is absent while ${mentionedCompetitors.length || 0} competitor(s) are discussed.`,
    usefulQuote: extractFirstSentence(response),
  };
}

const ANALYSIS_SYSTEM_INSTRUCTION = `You are Tunnel's response analysis engine.

You analyze how an AI assistant represented a target company in a response.

Given:
- target company
- competitors
- original prompt
- prompt category
- AI response

Return ONLY valid JSON with this shape:
{
  "targetMentioned": boolean,
  "targetRank": number | null,
  "mentionedCompetitors": string[],
  "allMentionedCompanies": string[],
  "sentiment": "positive" | "neutral" | "negative" | "not_mentioned",
  "targetDescription": string,
  "possibleInaccuracies": string[],
  "competitorWon": boolean,
  "explanation": string,
  "usefulQuote": string
}

Rules:
- If target is not mentioned, targetRank must be null and sentiment must be "not_mentioned".
- competitorWon must be true when target is not mentioned but >= 1 competitor is.
- usefulQuote must be a short verbatim snippet from the response if target is mentioned, else "".
- Do not invent facts that are not present in the response.
- Do not include markdown.
- Return only valid parseable JSON.`;

const VALID_SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative", "not_mentioned"];

function normalizeDetails(parsed: Partial<PromptAnalysisDetails>): PromptAnalysisDetails {
  const targetMentioned = !!parsed.targetMentioned;
  const sentiment: Sentiment = VALID_SENTIMENTS.includes(parsed.sentiment as Sentiment)
    ? (parsed.sentiment as Sentiment)
    : targetMentioned
      ? "neutral"
      : "not_mentioned";

  return {
    targetMentioned,
    targetRank: typeof parsed.targetRank === "number" ? parsed.targetRank : null,
    mentionedCompetitors: Array.isArray(parsed.mentionedCompetitors)
      ? parsed.mentionedCompetitors.filter((s): s is string => typeof s === "string")
      : [],
    allMentionedCompanies: Array.isArray(parsed.allMentionedCompanies)
      ? parsed.allMentionedCompanies.filter((s): s is string => typeof s === "string")
      : [],
    sentiment,
    targetDescription: typeof parsed.targetDescription === "string" ? parsed.targetDescription : "",
    possibleInaccuracies: Array.isArray(parsed.possibleInaccuracies)
      ? parsed.possibleInaccuracies.filter((s): s is string => typeof s === "string")
      : [],
    competitorWon: !!parsed.competitorWon,
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    usefulQuote: typeof parsed.usefulQuote === "string" ? parsed.usefulQuote : "",
  };
}

export async function llmAnalyze(
  company: CompanyInput,
  prompt: GeneratedPrompt,
  response: string,
): Promise<PromptAnalysisDetails | null> {
  if (!response.trim()) return null;

  try {
    const userPayload = JSON.stringify({
      target: company.companyName,
      competitors: company.competitors || [],
      prompt: prompt.prompt,
      category: prompt.category,
      response,
    });

    const raw = await generateText({
      systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
      prompt: userPayload,
      expectJson: true,
      maxOutputTokens: 600,
    });

    const parsed = safeParseJson<Partial<PromptAnalysisDetails>>(raw);
    if (!parsed) return null;

    return normalizeDetails(parsed);
  } catch {
    return null;
  }
}

export async function analyzeResponseStructured(
  company: CompanyInput,
  prompt: GeneratedPrompt,
  response: string,
): Promise<PromptAnalysisDetails> {
  const llm = await llmAnalyze(company, prompt, response);
  if (llm) return llm;
  return deterministicAnalyze(company, prompt, response);
}

export function buildPromptAnalysis(
  prompt: GeneratedPrompt,
  responseOrAnswer: string | ModelAnswer,
  details: PromptAnalysisDetails,
  error?: string,
): PromptAnalysis {
  const response = typeof responseOrAnswer === "string" ? responseOrAnswer : responseOrAnswer.response;
  const answer = typeof responseOrAnswer === "string" ? null : responseOrAnswer;

  return {
    promptId: prompt.id,
    prompt: prompt.prompt,
    category: prompt.category,
    rationale: prompt.rationale,
    response,
    ...(answer ? { sources: answer.sources, grounded: answer.grounded } : {}),
    error,
    analysis: details,
  };
}
