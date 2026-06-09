import {
  authorizeApiRequest,
  invalidRequestResponse,
  mergeHeaders,
} from "@/lib/api-security";
import {
  cacheHeaders,
  createAnalysisCacheKey,
  readCache,
  writeCache,
} from "@/lib/cache";
import { aggregateAnalyses } from "@/lib/aggregation";
import {
  buildPromptAnalysis,
  deterministicAnalyze,
} from "@/lib/analysis";
import { queryClaudeWithPrompt } from "@/lib/anthropic";
import { GEMINI_MODEL, generateText, queryGeminiWithPrompt } from "@/lib/gemini";
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
import { NextResponse } from "next/server";

interface AnalyzeBody {
  company: CompanyInput;
  prompts: GeneratedPrompt[];
}

const VALID_CATEGORIES = new Set<GeneratedPrompt["category"]>([
  "discovery",
  "comparison",
  "use_case",
  "niche",
  "purchase",
]);

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
      competitors
        ? `${competitors} are commonly mentioned alternatives.`
        : "There are multiple alternatives in this category."
    }`;
  }
  return `${competitors ? `${competitors} are frequently recommended for this category. ` : ""}${company.companyName} can be relevant for certain users depending on needs.`;
}

function providerFingerprint(models: AIModel[]): string {
  const answerProviders = models.length ? models.join(",") : "local-fallback";
  const analyzer = process.env.GEMINI_API_KEY ? `analysis:${GEMINI_MODEL}` : "analysis:local";
  return `answers:${answerProviders}|${analyzer}`;
}

async function generateBatchedGeminiAnswers(
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
      "[analyze-prompts] Batched Gemini answers JSON parse failed (or missing answers). Raw (first 250 chars):",
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
  const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
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
    const matchingPrompt = promptById.get(item.promptId);
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
        typeof item.explanation === "string" ? item.explanation : deterministic.explanation,
      usefulQuote:
        typeof item.usefulQuote === "string" ? item.usefulQuote : deterministic.usefulQuote,
    };
    return acc;
  }, {});
}

async function queryModelForPrompts(
  model: AIModel,
  company: CompanyInput,
  prompts: GeneratedPrompt[],
): Promise<Record<string, string>> {
  if (model === "gemini" && process.env.GEMINI_API_KEY) {
    try {
      const batchedAnswers = await generateBatchedGeminiAnswers(company, prompts);
      if (batchedAnswers && Object.keys(batchedAnswers).length) return batchedAnswers;
    } catch (err) {
      console.warn("[analyze-prompts] Batched Gemini answer call failed; trying per-prompt.", err);
    }
  }

  const results: Record<string, string> = {};
  await Promise.all(
    prompts.map(async (p) => {
      try {
        let response = "";
        if (model === "gpt-4o") response = await queryGPT4oWithPrompt(p.prompt);
        else if (model === "claude") response = await queryClaudeWithPrompt(p.prompt);
        else if (process.env.GEMINI_API_KEY) response = await queryGeminiWithPrompt(p.prompt);
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

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function jsonResponse(
  response: AnalysisResponse,
  metadata: NonNullable<AnalysisResponse["cache"]>,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { ...response, cache: metadata },
    { headers: mergeHeaders(cacheHeaders(metadata), headers) },
  );
}

export async function POST(request: Request) {
  const authResult = await authorizeApiRequest(request, "analyze-prompts");
  if (!authResult.ok) return authResult.response;

  const body = await readJson<AnalyzeBody>(request);

  if (!body) {
    return invalidRequestResponse(
      request,
      "analyze-prompts",
      "Invalid JSON body.",
      authResult.rateLimitHeaders,
    );
  }

  if (!body.company) {
    return invalidRequestResponse(
      request,
      "analyze-prompts",
      "Missing company.",
      authResult.rateLimitHeaders,
    );
  }

  if (
    !body.company.companyName ||
    !body.company.category ||
    !body.company.description ||
    !Number.isInteger(body.company.numberOfPrompts) ||
    body.company.numberOfPrompts < 5 ||
    body.company.numberOfPrompts > 50
  ) {
    return invalidRequestResponse(
      request,
      "analyze-prompts",
      "Company must include companyName, category, description, and numberOfPrompts between 5 and 50.",
      authResult.rateLimitHeaders,
    );
  }

  if (!Array.isArray(body.prompts) || body.prompts.length === 0 || body.prompts.length > 50) {
    return invalidRequestResponse(
      request,
      "analyze-prompts",
      "prompts must be a non-empty array with at most 50 items.",
      authResult.rateLimitHeaders,
    );
  }

  const hasInvalidPrompt = body.prompts.some(
    (prompt) =>
      !prompt ||
      typeof prompt.id !== "string" ||
      typeof prompt.prompt !== "string" ||
      typeof prompt.rationale !== "string" ||
      !VALID_CATEGORIES.has(prompt.category),
  );

  if (hasInvalidPrompt) {
    return invalidRequestResponse(
      request,
      "analyze-prompts",
      "Each prompt must include id, prompt, rationale, and a valid category.",
      authResult.rateLimitHeaders,
    );
  }

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

  const cacheKey = createAnalysisCacheKey(body.company, body.prompts, providerFingerprint(modelsToQuery));
  const cached = readCache<AnalysisResponse>("analysis", cacheKey);

  if (cached) {
    console.info(
      `[analyze-prompts] cache hit key=${cached.metadata.key} version=${cached.metadata.version}`,
    );
    return jsonResponse(cached.value, cached.metadata, authResult.rateLimitHeaders);
  }

  console.log(
    `[analyze-prompts] Starting analysis: company="${body.company.companyName}", prompts=${body.prompts.length}, models=${modelsToQuery.join(", ")}, cacheKey=${cacheKey}`,
  );

  try {
    const responsesByModel = await Promise.all(
      modelsToQuery.map(async (model) => ({
        model,
        responses: await queryModelForPrompts(model, body.company, body.prompts),
      })),
    );

    const modelAnalyses = await Promise.all(
      responsesByModel.map(({ model, responses }) =>
        analyzeModelResponses(model, body.company, body.prompts, responses),
      ),
    );

    const primary = modelAnalyses[0];
    const response: AnalysisResponse = {
      models: modelAnalyses,
      aggregateStats: primary.aggregateStats,
      promptAnalyses: primary.promptAnalyses,
    };
    const metadata = writeCache("analysis", cacheKey, response);

    console.log(
      `[analyze-prompts] Completed. Models: ${modelAnalyses.map((m) => m.model).join(", ")}. cache miss stored key=${metadata.key} version=${metadata.version}`,
    );

    return jsonResponse(response, metadata, authResult.rateLimitHeaders);
  } catch (err) {
    console.error("[analyze-prompts] Unexpected error:", err);
    return NextResponse.json(
      { error: "Analysis failed. Try demo mode." },
      { status: 500 },
    );
  }
}
