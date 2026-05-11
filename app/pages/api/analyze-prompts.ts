import { aggregateAnalyses } from "@/lib/aggregation";
import { buildPromptAnalysis, deterministicAnalyze } from "@/lib/analysis";
import { queryClaudeWithPrompt } from "@/lib/anthropic";
import { generateText, queryGeminiWithPrompt } from "@/lib/gemini";
import { safeParseJson } from "@/lib/json-repair";
import { queryGPT4oWithPrompt } from "@/lib/openai";
import {
  AIModel,
  AnalysisResponse,
  CompanyInput,
  GeneratedPrompt,
  ModelAnalysis,
  PromptAnalysis,
  PromptAnalysisDetails,
} from "@/types";
import type { NextApiRequest, NextApiResponse } from "next";

interface AnalyzeBody {
  company: CompanyInput;
  prompts: GeneratedPrompt[];
}

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
      competitors
        ? `${competitors} are commonly mentioned alternatives.`
        : "There are multiple alternatives in this category."
    }`;
  }
  return `${competitors ? `${competitors} are frequently recommended for this category. ` : ""}${company.companyName} can be relevant for certain users depending on needs.`;
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
    maxOutputTokens: 6500,
    temperature: 0.2,
  });

  const parsed = safeParseJson<BatchedAnalysesResponse>(raw);
  if (!parsed?.analyses?.length) {
    console.warn(
      "[analyze-prompts] Batched analyses JSON parse failed. Raw (first 250 chars):",
      raw.slice(0, 250),
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
      targetRank:
        typeof item.targetRank === "number" ? item.targetRank : deterministic.targetRank,
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
        typeof item.explanation === "string" ? item.explanation : deterministic.explanation,
      usefulQuote:
        typeof item.usefulQuote === "string" ? item.usefulQuote : deterministic.usefulQuote,
    };
    return acc;
  }, {});
}

async function queryModelForPrompts(
  model: AIModel,
  prompts: GeneratedPrompt[],
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    prompts.map(async (p) => {
      try {
        let response = "";
        if (model === "gpt-4o") response = await queryGPT4oWithPrompt(p.prompt);
        else if (model === "claude") response = await queryClaudeWithPrompt(p.prompt);
        else response = await queryGeminiWithPrompt(p.prompt);
        results[p.id] = response.trim();
      } catch (err) {
        console.warn(`[analyze-prompts] ${model} failed for prompt ${p.id}:`, err);
      }
    }),
  );
  return results;
}

async function analyzeModelResponses(
  model: AIModel,
  company: CompanyInput,
  prompts: GeneratedPrompt[],
  responses: Record<string, string>,
): Promise<ModelAnalysis> {
  const filled = { ...responses };
  for (const p of prompts) {
    if (!filled[p.id]) filled[p.id] = fallbackResponse(company, p);
  }

  let llmAnalyses: Record<string, PromptAnalysisDetails> | null = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      llmAnalyses = await analyzeBatchedResponses(company, prompts, filled);
    } catch (err) {
      console.warn(`[analyze-prompts] Gemini analysis failed for model ${model}:`, err);
    }
  }

  const promptAnalyses: PromptAnalysis[] = prompts.map((p) => {
    const response = filled[p.id] ?? "";
    const details = llmAnalyses?.[p.id] ?? deterministicAnalyze(company, p, response);
    return buildPromptAnalysis(p, response, details);
  });

  return { model, promptAnalyses, aggregateStats: aggregateAnalyses(company, promptAnalyses) };
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

  const modelsToQuery: AIModel[] = (
    [
      { model: "gpt-4o" as AIModel, key: process.env.OPENAI_API_KEY },
      { model: "claude" as AIModel, key: process.env.ANTHROPIC_API_KEY },
      { model: "gemini" as AIModel, key: process.env.GEMINI_API_KEY },
    ] as const
  )
    .filter((m) => Boolean(m.key))
    .map((m) => m.model);

  if (modelsToQuery.length === 0) {
    console.warn("[analyze-prompts] No API keys found; using deterministic fallback.");
    modelsToQuery.push("gemini");
  }

  console.log(`[analyze-prompts] Querying models: ${modelsToQuery.join(", ")}`);

  try {
    const responsesByModel = await Promise.all(
      modelsToQuery.map(async (model) => ({
        model,
        responses: await queryModelForPrompts(model, body.prompts),
      })),
    );

    const modelAnalyses = await Promise.all(
      responsesByModel.map(({ model, responses }) =>
        analyzeModelResponses(model, body.company, body.prompts, responses),
      ),
    );

    const primary = modelAnalyses[0];

    console.log(
      `[analyze-prompts] Completed. Models: ${modelAnalyses.map((m) => m.model).join(", ")}`,
    );

    return res.status(200).json({
      models: modelAnalyses,
      aggregateStats: primary.aggregateStats,
      promptAnalyses: primary.promptAnalyses,
    });
  } catch (err) {
    console.error("[analyze-prompts] Unexpected error:", err);
    return res.status(500).json({ error: "Analysis failed. Try demo mode." });
  }
}
