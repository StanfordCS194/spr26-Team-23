import { aggregateAnalyses } from "@/lib/aggregation";
import {
  buildPromptAnalysis,
  deterministicAnalyze,
} from "@/lib/analysis";
import { generateText } from "@/lib/gemini";
import { safeParseJson } from "@/lib/json-repair";
import {
  AnalysisResponse,
  CompanyInput,
  GeneratedPrompt,
  PromptAnalysisDetails,
  PromptAnalysis,
} from "@/types";
import type { NextApiRequest, NextApiResponse } from "next";

interface AnalyzeBody {
  company: CompanyInput;
  prompts: GeneratedPrompt[];
}

const ANSWER_SYSTEM_INSTRUCTION = `You are simulating a normal AI assistant answering real user product discovery questions.

Answer each prompt naturally, neutrally, and helpfully.

Do not optimize for any specific company.
Do not force any particular brand into the answer.
Only mention companies/products that you would realistically mention based on the prompt.
If the prompt asks for recommendations, provide a concise ranked or grouped answer.
If you are uncertain, say so briefly.
Do not reveal that this is part of an evaluation.

Keep each answer concise, around 60 words maximum.

Return ONLY valid JSON in this shape:
{
  "answers": [
    { "promptId": "p1", "response": "..." }
  ]
}

Rules:
- Include exactly one answer per promptId provided.
- Keep each response short and direct.
- Return parseable JSON only (no markdown).`;

const ANALYSIS_SYSTEM_INSTRUCTION = `You are Tunnel's response analysis engine.

You analyze how an AI assistant represented a target company in responses.

Return ONLY valid JSON in this shape:
{
  "analyses": [
    {
      "promptId": "p1",
      "targetMentioned": true,
      "targetRank": 2,
      "mentionedCompetitors": ["Vivino"],
      "allMentionedCompanies": ["Vivino", "WineFind", "CellarTracker"],
      "sentiment": "positive",
      "targetDescription": "WineFind is described as ...",
      "possibleInaccuracies": [],
      "competitorWon": false,
      "explanation": "Short explanation.",
      "usefulQuote": "Short quote."
    }
  ]
}

Rules:
- If target is not mentioned, set targetRank to null and sentiment to "not_mentioned".
- Sentiment must be one of: positive, neutral, negative, not_mentioned.
- competitorWon is true when competitors appear and target does not.
- Do not invent facts not present in response.
- Return parseable JSON only.`;

interface BatchedAnswersResponse {
  answers?: Array<{ promptId: string; response: string }>;
}

interface BatchedAnalysesResponse {
  analyses?: Array<{ promptId: string } & Partial<PromptAnalysisDetails>>;
}

function fallbackResponse(company: CompanyInput, prompt: GeneratedPrompt): string {
  const competitors = (company.competitors || []).slice(0, 2).join(" and ");
  if (prompt.category === "niche" || prompt.category === "use_case") {
    return `${company.companyName} is a specialized option for ${company.description.toLowerCase()}.${
      competitors ? ` Alternatives like ${competitors} may be broader.` : ""
    }`;
  }
  if (prompt.category === "comparison") {
    return `${company.companyName} and other options depend on priorities. ${
      competitors ? `${competitors} are commonly mentioned alternatives.` : "There are multiple alternatives in this category."
    }`;
  }
  return `${competitors ? `${competitors} are frequently recommended for this category. ` : ""}${company.companyName} can be relevant for certain users depending on needs.`;
}

async function generateBatchedAnswers(
  company: CompanyInput,
  prompts: GeneratedPrompt[],
): Promise<Record<string, string> | null> {
  const payload = JSON.stringify({
    companyName: company.companyName,
    category: company.category,
    prompts: prompts.map((p) => ({ promptId: p.id, prompt: p.prompt, category: p.category })),
  });

  const raw = await generateText({
    systemInstruction: ANSWER_SYSTEM_INSTRUCTION,
    prompt: payload,
    expectJson: true,
    maxOutputTokens: 2600,
    temperature: 0.7,
  });

  const parsed = safeParseJson<BatchedAnswersResponse>(raw);
  if (!parsed?.answers?.length) {
    console.warn(
      "[analyze-prompts] Batched answers JSON parse failed (or missing answers). Raw (first 250 chars):",
      raw.slice(0, 250),
    );
    return null;
  }

  return parsed.answers.reduce<Record<string, string>>((acc, item) => {
    if (item?.promptId && typeof item.response === "string") {
      acc[item.promptId] = item.response.trim();
    }
    return acc;
  }, {});
}

async function analyzeBatchedResponses(
  company: CompanyInput,
  prompts: GeneratedPrompt[],
  responses: Record<string, string>,
): Promise<Record<string, PromptAnalysisDetails> | null> {
  const payload = JSON.stringify({
    target: company.companyName,
    competitors: company.competitors || [],
    rows: prompts.map((p) => ({
      promptId: p.id,
      prompt: p.prompt,
      category: p.category,
      response: responses[p.id] || "",
    })),
  });

  const raw = await generateText({
    systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
    prompt: payload,
    expectJson: true,
    // Batched analysis JSON can get large; if we hit an output cap we may end up with
    // truncated/invalid JSON and be forced into deterministic fallback.
    maxOutputTokens: 6500,
    temperature: 0.2,
  });

  const parsed = safeParseJson<BatchedAnalysesResponse>(raw);
  if (!parsed?.analyses?.length) {
    console.warn(
      "[analyze-prompts] Batched analyses JSON parse failed (or missing analyses). Raw (first 250 chars):",
      raw.slice(0, 250),
    );
    console.warn(
      "[analyze-prompts] Batched analyses JSON parse failed. Raw length and tail:",
      { length: raw.length, tail: raw.slice(Math.max(0, raw.length - 250)) },
    );
    return null;
  }

  return parsed.analyses.reduce<Record<string, PromptAnalysisDetails>>((acc, item) => {
    const matchingPrompt = prompts.find((p) => p.id === item.promptId);
    if (!matchingPrompt) return acc;
    const deterministic = deterministicAnalyze(
      company,
      matchingPrompt,
      responses[matchingPrompt.id] || "",
    );
    acc[item.promptId] = {
      ...deterministic,
      ...item,
      targetMentioned:
        typeof item.targetMentioned === "boolean"
          ? item.targetMentioned
          : deterministic.targetMentioned,
      targetRank: typeof item.targetRank === "number" ? item.targetRank : deterministic.targetRank,
      mentionedCompetitors: Array.isArray(item.mentionedCompetitors)
        ? item.mentionedCompetitors.filter((x): x is string => typeof x === "string")
        : deterministic.mentionedCompetitors,
      allMentionedCompanies: Array.isArray(item.allMentionedCompanies)
        ? item.allMentionedCompanies.filter((x): x is string => typeof x === "string")
        : deterministic.allMentionedCompanies,
      possibleInaccuracies: Array.isArray(item.possibleInaccuracies)
        ? item.possibleInaccuracies.filter((x): x is string => typeof x === "string")
        : deterministic.possibleInaccuracies,
      sentiment:
        item.sentiment === "positive" ||
        item.sentiment === "neutral" ||
        item.sentiment === "negative" ||
        item.sentiment === "not_mentioned"
          ? item.sentiment
          : deterministic.sentiment,
      targetDescription:
        typeof item.targetDescription === "string"
          ? item.targetDescription
          : deterministic.targetDescription,
      competitorWon:
        typeof item.competitorWon === "boolean"
          ? item.competitorWon
          : deterministic.competitorWon,
      explanation:
        typeof item.explanation === "string"
          ? item.explanation
          : deterministic.explanation,
      usefulQuote:
        typeof item.usefulQuote === "string" ? item.usefulQuote : deterministic.usefulQuote,
    };
    return acc;
  }, {});
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalysisResponse | { error: string }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as AnalyzeBody;
  if (!body?.company || !body?.prompts?.length) {
    return res.status(400).json({ error: "Missing company or prompts." });
  }

  console.log(
    `[analyze-prompts] Starting analysis: company="${body.company.companyName}", prompts=${body.prompts.length}`,
  );

  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  let responsesByPrompt: Record<string, string> = {};
  let batchedAnswers: Record<string, string> | null = null;
  let llmAnalysesByPrompt: Record<string, PromptAnalysisDetails> | null = null;

  if (!hasGeminiKey) {
    console.warn("[analyze-prompts] Missing GEMINI_API_KEY; using local fallback.");
  } else {
    try {
      batchedAnswers = await generateBatchedAnswers(body.company, body.prompts);
      if (batchedAnswers && Object.keys(batchedAnswers).length) {
        responsesByPrompt = batchedAnswers;
      } else {
        console.warn("[analyze-prompts] Failed to parse batched answers JSON.");
      }
    } catch (err) {
      console.warn("[analyze-prompts] Batched answer call failed; using fallback responses.", err);
    }
  }

  const fallbackAnswerPrompts = body.prompts.filter((p) => !responsesByPrompt[p.id]);
  for (const prompt of fallbackAnswerPrompts) {
    responsesByPrompt[prompt.id] = fallbackResponse(body.company, prompt);
  }
  console.warn(
    `[analyze-prompts] Answers: using Gemini for ${
      body.prompts.length - fallbackAnswerPrompts.length
    }/${body.prompts.length} prompts, fallback for ${fallbackAnswerPrompts.length}.`,
  );

  if (hasGeminiKey) {
    try {
      llmAnalysesByPrompt = await analyzeBatchedResponses(
        body.company,
        body.prompts,
        responsesByPrompt,
      );
      if (!llmAnalysesByPrompt) {
        console.warn("[analyze-prompts] Failed to parse batched analyses JSON.");
      }
    } catch (err) {
      console.warn("[analyze-prompts] Batched analysis call failed; using deterministic analysis.", err);
    }
  }

  const analyses: PromptAnalysis[] = body.prompts.map((prompt) => {
    const response = responsesByPrompt[prompt.id] || "";
    const details =
      llmAnalysesByPrompt?.[prompt.id] ||
      deterministicAnalyze(body.company, prompt, response);
    return buildPromptAnalysis(prompt, response, details);
  });

  const fallbackAnalysisPrompts = body.prompts.filter((p) => !llmAnalysesByPrompt?.[p.id]);
  console.warn(
    `[analyze-prompts] Analysis: using Gemini for ${
      body.prompts.length - fallbackAnalysisPrompts.length
    }/${body.prompts.length} prompts, deterministic fallback for ${fallbackAnalysisPrompts.length}.`,
  );

  console.log(`[analyze-prompts] Completed with ${analyses.length} prompt results.`);

  return res.status(200).json({
    aggregateStats: aggregateAnalyses(body.company, analyses),
    promptAnalyses: analyses,
  });
}
