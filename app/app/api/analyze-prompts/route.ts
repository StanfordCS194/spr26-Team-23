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
import { queryClaudeWithPrompt, queryClaudeWithWebPrompt } from "@/lib/anthropic";
import { GEMINI_MODEL, generateText, queryGeminiWithPrompt, queryGeminiWithWebPrompt } from "@/lib/gemini";
import { safeParseJson } from "@/lib/json-repair";
import { queryGPT4oWithPrompt, queryGPT4oWithWebPrompt } from "@/lib/openai";
import {
  AIModel,
  AnalysisMode,
  AnalysisResponse,
  CompanyInput,
  GeneratedPrompt,
  ModelAnswer,
  ModelAnalysis,
  PromptAnalysis,
  PromptAnalysisDetails,
} from "@/types";
import { NextResponse } from "next/server";

const MAX_WEB_PROMPTS = 15;

interface AnalyzeBody {
  company: CompanyInput;
  prompts: GeneratedPrompt[];
  analysisMode?: AnalysisMode;
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
      competitors
        ? `${competitors} are commonly mentioned alternatives.`
        : "There are multiple alternatives in this category."
    }`;
  }
  return `${competitors ? `${competitors} are frequently recommended for this category. ` : ""}${company.companyName} can be relevant for certain users depending on needs.`;
}

function providerFingerprint(models: AIModel[], analysisMode: AnalysisMode): string {
  const answerProviders = models.length ? models.join(",") : "local-fallback";
  const analyzer = process.env.GEMINI_API_KEY ? `analysis:${GEMINI_MODEL}` : "analysis:local";
  return `mode:${analysisMode}|answers:${answerProviders}|${analyzer}`;
}

function asModelAnswer(response: string): ModelAnswer {
  return {
    response,
    sources: [],
    grounded: false,
  };
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
  analysisMode: AnalysisMode,
): Promise<Record<string, ModelAnswer>> {
  if (analysisMode === "standard" && model === "gemini" && process.env.GEMINI_API_KEY) {
    try {
      const batchedAnswers = await generateBatchedGeminiAnswers(company, prompts);
      if (batchedAnswers && Object.keys(batchedAnswers).length) {
        return Object.fromEntries(
          Object.entries(batchedAnswers).map(([id, response]) => [id, asModelAnswer(response)]),
        );
      }
    } catch (err) {
      console.warn("[analyze-prompts] Batched Gemini answer call failed; trying per-prompt.", err);
    }
  }

  const results: Record<string, ModelAnswer> = {};
  await Promise.all(
    prompts.map(async (p) => {
      try {
        if (analysisMode === "web") {
          if (model === "gpt-4o") results[p.id] = await queryGPT4oWithWebPrompt(p.prompt);
          else if (model === "claude") results[p.id] = await queryClaudeWithWebPrompt(p.prompt);
          else if (process.env.GEMINI_API_KEY) results[p.id] = await queryGeminiWithWebPrompt(p.prompt);
          return;
        }

        let response = "";
        if (model === "gpt-4o") response = await queryGPT4oWithPrompt(p.prompt);
        else if (model === "claude") response = await queryClaudeWithPrompt(p.prompt);
        else if (process.env.GEMINI_API_KEY) response = await queryGeminiWithPrompt(p.prompt);
        results[p.id] = asModelAnswer(response.trim());
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
  answers: Record<string, ModelAnswer>,
  analysisMode: AnalysisMode,
): Promise<ModelAnalysis> {
  const filled = { ...answers };
  for (const p of prompts) {
    if (!filled[p.id]) filled[p.id] = asModelAnswer(fallbackResponse(company, p));
  }

  const responses = Object.fromEntries(
    Object.entries(filled).map(([promptId, answer]) => [promptId, answer.response]),
  );

  let llmAnalyses: Record<string, PromptAnalysisDetails> | null = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      llmAnalyses = await analyzeBatchedResponses(company, prompts, responses);
    } catch (err) {
      console.warn(`[analyze-prompts] Gemini analysis failed for model ${model}:`, err);
    }
  }

  const promptAnalyses: PromptAnalysis[] = prompts.map((p) => {
    const answer = filled[p.id] ?? asModelAnswer("");
    const details = llmAnalyses?.[p.id] ?? deterministicAnalyze(company, p, answer.response);
    return buildPromptAnalysis(p, analysisMode === "web" ? answer : answer.response, details);
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

function jsonResponse(response: AnalysisResponse, metadata: NonNullable<AnalysisResponse["cache"]>) {
  return NextResponse.json(
    { ...response, cache: metadata },
    { headers: cacheHeaders(metadata) },
  );
}

export async function POST(request: Request) {
  const body = await readJson<AnalyzeBody>(request);
  if (!body?.company || !body?.prompts?.length) {
    return NextResponse.json(
      { error: "Missing company or prompts." },
      { status: 400 },
    );
  }
  const analysisMode: AnalysisMode = body.analysisMode === "web" ? "web" : "standard";

  if (analysisMode === "web" && body.prompts.length > MAX_WEB_PROMPTS) {
    return NextResponse.json(
      { error: `Web mode supports up to ${MAX_WEB_PROMPTS} prompts. Reduce the prompt list and try again.` },
      { status: 400 },
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

  const cacheKey = createAnalysisCacheKey(
    body.company,
    body.prompts,
    providerFingerprint(modelsToQuery, analysisMode),
  );
  const cached = readCache<AnalysisResponse>("analysis", cacheKey);

  if (cached) {
    console.info(
      `[analyze-prompts] cache hit key=${cached.metadata.key} version=${cached.metadata.version}`,
    );
    return jsonResponse(cached.value, cached.metadata);
  }

  console.log(
    `[analyze-prompts] Starting analysis: company="${body.company.companyName}", prompts=${body.prompts.length}, mode=${analysisMode}, models=${modelsToQuery.join(", ")}, cacheKey=${cacheKey}`,
  );

  try {
    const answersByModel = await Promise.all(
      modelsToQuery.map(async (model) => ({
        model,
        answers: await queryModelForPrompts(model, body.company, body.prompts, analysisMode),
      })),
    );

    const modelAnalyses = await Promise.all(
      answersByModel.map(({ model, answers }) =>
        analyzeModelResponses(model, body.company, body.prompts, answers, analysisMode),
      ),
    );

    const primary = modelAnalyses[0];
    const response: AnalysisResponse = {
      analysisMode,
      models: modelAnalyses,
      aggregateStats: primary.aggregateStats,
      promptAnalyses: primary.promptAnalyses,
    };
    const metadata = writeCache("analysis", cacheKey, response);

    console.log(
      `[analyze-prompts] Completed. Models: ${modelAnalyses.map((m) => m.model).join(", ")}. cache miss stored key=${metadata.key} version=${metadata.version}`,
    );

    return jsonResponse(response, metadata);
  } catch (err) {
    console.error("[analyze-prompts] Unexpected error:", err);
    return NextResponse.json(
      { error: "Analysis failed. Try demo mode." },
      { status: 500 },
    );
  }
}
