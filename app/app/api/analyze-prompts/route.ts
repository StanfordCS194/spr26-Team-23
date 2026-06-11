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
import { queryClaudeWithPrompt, queryClaudeWithWebPrompt } from "@/lib/anthropic";
import {
  GEMINI_MODEL,
  generateText,
  queryGeminiWithPrompt,
  queryGeminiWithWebPrompt,
} from "@/lib/gemini";
import { safeParseJson } from "@/lib/json-repair";
import { queryGPT4oWithPrompt, queryGPT4oWithWebPrompt } from "@/lib/openai";
import {
  AIModel,
  AnalysisMode,
  AnalysisBatchUsage,
  AnalysisProviderName,
  AnalysisProviderUsage,
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

interface ProviderRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface ProviderCallResult<T> {
  value: T;
  attempts: number;
  retries: number;
  timeouts: number;
}

interface ProviderResponseResult {
  responses: Record<string, string>;
  usage: AnalysisBatchUsage;
}

interface ProviderAnalysisResult {
  analyses: Record<string, PromptAnalysisDetails>;
  usage: AnalysisBatchUsage;
}

interface QueryModelResult {
  model: AIModel;
  answers: Record<string, ModelAnswer>;
  usage: AnalysisProviderUsage;
}

interface ModelAnalysisResult {
  analysis: ModelAnalysis;
  usage: AnalysisProviderUsage;
}

interface ProviderAnswerResult {
  answers: Record<string, ModelAnswer>;
  usage: AnalysisBatchUsage;
}

const ANSWER_BATCH_SIZE = 8;
const ANALYSIS_BATCH_SIZE = 5;
const BATCH_CONCURRENCY = 3;
const PER_PROMPT_CONCURRENCY = 5;
const GEMINI_PER_PROMPT_RECOVERY_LIMIT = ANSWER_BATCH_SIZE * 2;
const PROVIDER_TIMEOUT_MS = 20_000;
const PER_PROMPT_TIMEOUT_MS = 12_000;
const PROVIDER_MAX_ATTEMPTS = 2;
const PROVIDER_BACKOFF_MS = 600;

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

class ProviderTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "ProviderTimeoutError";
  }
}

class ProviderCallError extends Error {
  attempts: number;
  timeouts: number;
  cause: unknown;

  constructor(label: string, attempts: number, timeouts: number, cause: unknown) {
    super(`${label} failed after ${attempts} attempt(s)`);
    this.name = "ProviderCallError";
    this.attempts = attempts;
    this.timeouts = timeouts;
    this.cause = cause;
  }
}

function createBatchUsage(
  kind: AnalysisBatchUsage["kind"],
  provider: AnalysisProviderName,
): AnalysisBatchUsage {
  return {
    kind,
    provider,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    promptsSucceeded: 0,
    promptsFailed: 0,
    retries: 0,
    timeouts: 0,
  };
}

function mergeBatchUsage(target: AnalysisBatchUsage, source: AnalysisBatchUsage) {
  target.attempted += source.attempted;
  target.succeeded += source.succeeded;
  target.failed += source.failed;
  target.promptsSucceeded += source.promptsSucceeded;
  target.promptsFailed += source.promptsFailed;
  target.retries += source.retries;
  target.timeouts += source.timeouts;
}

function providerAvailable(model: AIModel): boolean {
  if (model === "gpt-4o") return Boolean(process.env.OPENAI_API_KEY);
  if (model === "claude") return Boolean(process.env.ANTHROPIC_API_KEY);
  return Boolean(process.env.GEMINI_API_KEY);
}

function createProviderUsage(model: AIModel, promptCount: number): AnalysisProviderUsage {
  const answerProvider: AIModel | "local-fallback" = providerAvailable(model)
    ? model
    : "local-fallback";

  return {
    model,
    promptCount,
    answerProvider,
    analyzerProvider: process.env.GEMINI_API_KEY ? "gemini" : "deterministic",
    answerBatches: createBatchUsage("answers", answerProvider),
    analysisBatches: createBatchUsage(
      "analysis",
      process.env.GEMINI_API_KEY ? "gemini" : "deterministic",
    ),
    responsesFromProvider: 0,
    responsesFromFallback: 0,
    analysesFromProvider: 0,
    analysesFromFallback: 0,
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function settledMapLimit<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  const limit = Math.max(1, concurrency);

  for (let i = 0; i < items.length; i += limit) {
    const slice = items.slice(i, i + limit);
    const settled = await Promise.allSettled(
      slice.map((item, offset) => worker(item, i + offset)),
    );
    results.push(...settled);
  }

  return results;
}

function isTimeoutLike(error: unknown): boolean {
  if (error instanceof ProviderTimeoutError) return true;
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { name?: unknown; message?: unknown };
  const name = typeof maybeError.name === "string" ? maybeError.name.toLowerCase() : "";
  const message =
    typeof maybeError.message === "string" ? maybeError.message.toLowerCase() : "";
  return (
    name.includes("timeout") ||
    name === "aborterror" ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

function retryStats(error: unknown): Pick<AnalysisBatchUsage, "retries" | "timeouts"> {
  if (error instanceof ProviderCallError) {
    return {
      retries: Math.max(0, error.attempts - 1),
      timeouts: error.timeouts,
    };
  }

  return { retries: 0, timeouts: isTimeoutLike(error) ? 1 : 0 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithTimeout<T>(
  label: string,
  timeoutMs: number,
  call: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeoutError = new ProviderTimeoutError(label, timeoutMs);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([call(controller.signal), timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function callProviderWithRetry<T>(
  label: string,
  call: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<ProviderCallResult<T>> {
  let attempts = 0;
  let timeouts = 0;
  let lastError: unknown = null;

  while (attempts < PROVIDER_MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const value = await callWithTimeout(label, timeoutMs, call);
      return { value, attempts, retries: attempts - 1, timeouts };
    } catch (error) {
      lastError = error;
      if (isTimeoutLike(error)) timeouts += 1;
      if (attempts >= PROVIDER_MAX_ATTEMPTS) break;
      await sleep(PROVIDER_BACKOFF_MS * 2 ** (attempts - 1));
    }
  }

  throw new ProviderCallError(label, attempts, timeouts, lastError);
}

function countPromptValues<T>(prompts: GeneratedPrompt[], values: Record<string, T>): number {
  return prompts.filter((prompt) => Boolean(values[prompt.id])).length;
}

function providerFingerprint(models: AIModel[], analysisMode: AnalysisMode): string {
  const answerProviders = models.length ? models.join(",") : "local-fallback";
  const analyzer = process.env.GEMINI_API_KEY ? `analysis:${GEMINI_MODEL}` : "analysis:local";
  return `mode:${analysisMode}|answers:${answerProviders}|${analyzer}|batch:v2:a${ANSWER_BATCH_SIZE}:n${ANALYSIS_BATCH_SIZE}:c${BATCH_CONCURRENCY}:r${PROVIDER_MAX_ATTEMPTS}:t${PROVIDER_TIMEOUT_MS}`;
}

function asModelAnswer(response: string): ModelAnswer {
  return {
    response,
    sources: [],
    grounded: false,
  };
}

function countPromptAnswers(
  prompts: GeneratedPrompt[],
  answers: Record<string, ModelAnswer>,
): number {
  return prompts.filter((prompt) => Boolean(answers[prompt.id]?.response)).length;
}

async function generateBatchedGeminiAnswers(
  company: CompanyInput,
  prompts: GeneratedPrompt[],
  options: ProviderRequestOptions = {},
): Promise<Record<string, string>> {
  const payload = JSON.stringify({
    companyName: company.companyName,
    category: company.category,
    prompts: prompts.map((p) => ({ promptId: p.id, prompt: p.prompt, category: p.category })),
  });

  const raw = await generateText({
    systemInstruction: ANSWER_SYSTEM_INSTRUCTION,
    prompt: payload,
    expectJson: true,
    maxOutputTokens: Math.min(3_000, Math.max(900, prompts.length * 220)),
    temperature: 0.7,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
  });

  const parsed = safeParseJson<BatchedAnswersResponse>(raw);
  if (!parsed?.answers?.length) {
    console.warn(
      "[analyze-prompts] Gemini answers batch JSON parse failed (or missing answers). Raw (first 250 chars):",
      raw.slice(0, 250),
    );
    throw new Error("Gemini answers batch JSON parse failed.");
  }

  return parsed.answers.reduce<Record<string, string>>((acc, item) => {
    if (item?.promptId && typeof item.response === "string") {
      acc[item.promptId] = item.response.trim();
    }
    return acc;
  }, {});
}

async function analyzeGeminiResponseBatch(
  company: CompanyInput,
  prompts: GeneratedPrompt[],
  responses: Record<string, string>,
  options: ProviderRequestOptions = {},
): Promise<Record<string, PromptAnalysisDetails>> {
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
    maxOutputTokens: Math.min(3_500, Math.max(1_200, prompts.length * 500)),
    temperature: 0.2,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
  });

  const parsed = safeParseJson<BatchedAnalysesResponse>(raw);
  if (!parsed?.analyses?.length) {
    console.warn(
      "[analyze-prompts] Gemini analysis batch JSON parse failed (or missing analyses). Raw (first 250 chars):",
      raw.slice(0, 250),
    );
    console.warn(
      "[analyze-prompts] Gemini analysis batch JSON parse failed. Raw length and tail:",
      { length: raw.length, tail: raw.slice(Math.max(0, raw.length - 250)) },
    );
    throw new Error("Gemini analysis batch JSON parse failed.");
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
): Promise<QueryModelResult> {
  const usage = createProviderUsage(model, prompts.length);

  if (!providerAvailable(model)) {
    usage.responsesFromFallback = prompts.length;
    usage.answerBatches.promptsFailed = prompts.length;
    return { model, answers: {}, usage };
  }

  let answers: Record<string, ModelAnswer> = {};

  if (analysisMode === "web") {
    const webAnswers = await queryProviderWebPromptAnswers(model, prompts);
    mergeBatchUsage(usage.answerBatches, webAnswers.usage);
    answers = webAnswers.answers;
  } else if (model === "gemini") {
    const batched = await queryGeminiAnswerBatches(company, prompts);
    mergeBatchUsage(usage.answerBatches, batched.usage);
    answers = Object.fromEntries(
      Object.entries(batched.responses).map(([promptId, response]) => [
        promptId,
        asModelAnswer(response),
      ]),
    );

    const missingPrompts = prompts.filter((prompt) => !answers[prompt.id]?.response);
    if (
      missingPrompts.length &&
      missingPrompts.length <= GEMINI_PER_PROMPT_RECOVERY_LIMIT
    ) {
      console.warn(
        `[analyze-prompts] Gemini answer batches missed ${missingPrompts.length} prompt(s); trying per-prompt recovery.`,
      );
      const recovered = await queryProviderPromptResponses(model, missingPrompts);
      mergeBatchUsage(usage.answerBatches, recovered.usage);
      answers = {
        ...answers,
        ...Object.fromEntries(
          Object.entries(recovered.responses).map(([promptId, response]) => [
            promptId,
            asModelAnswer(response),
          ]),
        ),
      };
    } else if (missingPrompts.length) {
      console.warn(
        `[analyze-prompts] Gemini answer batches missed ${missingPrompts.length} prompt(s); skipping per-prompt recovery to keep the report bounded.`,
      );
    }
  } else {
    const perPrompt = await queryProviderPromptResponses(model, prompts);
    mergeBatchUsage(usage.answerBatches, perPrompt.usage);
    answers = Object.fromEntries(
      Object.entries(perPrompt.responses).map(([promptId, response]) => [
        promptId,
        asModelAnswer(response),
      ]),
    );
  }

  usage.responsesFromProvider = countPromptAnswers(prompts, answers);
  usage.responsesFromFallback = prompts.length - usage.responsesFromProvider;
  return { model, answers, usage };
}

async function queryGeminiAnswerBatches(
  company: CompanyInput,
  prompts: GeneratedPrompt[],
): Promise<ProviderResponseResult> {
  const batches = chunkArray(prompts, ANSWER_BATCH_SIZE);
  const usage = createBatchUsage("answers", "gemini");
  usage.attempted = batches.length;

  const settled = await settledMapLimit(
    batches,
    BATCH_CONCURRENCY,
    async (batch, index) => {
      const call = await callProviderWithRetry(
        `gemini answer batch ${index + 1}/${batches.length}`,
        (signal) =>
          generateBatchedGeminiAnswers(company, batch, {
            signal,
            timeoutMs: PROVIDER_TIMEOUT_MS,
          }),
        PROVIDER_TIMEOUT_MS,
      );

      return {
        responses: call.value,
        retries: call.retries,
        timeouts: call.timeouts,
      };
    },
  );

  const responses: Record<string, string> = {};

  settled.forEach((result, index) => {
    const batch = batches[index] || [];
    if (result.status === "fulfilled") {
      const promptCount = countPromptValues(batch, result.value.responses);
      usage.succeeded += 1;
      usage.promptsSucceeded += promptCount;
      usage.promptsFailed += batch.length - promptCount;
      usage.retries += result.value.retries;
      usage.timeouts += result.value.timeouts;
      Object.assign(responses, result.value.responses);
      return;
    }

    const stats = retryStats(result.reason);
    usage.failed += 1;
    usage.promptsFailed += batch.length;
    usage.retries += stats.retries;
    usage.timeouts += stats.timeouts;
    console.warn(
      `[analyze-prompts] Gemini answer batch ${index + 1}/${batches.length} failed; ${batch.length} prompt(s) will use recovery or fallback.`,
      result.reason,
    );
  });

  return { responses, usage };
}

async function queryProviderPromptResponses(
  model: AIModel,
  prompts: GeneratedPrompt[],
): Promise<ProviderResponseResult> {
  const usage = createBatchUsage("answers", model);
  usage.attempted = prompts.length;
  const results: Record<string, string> = {};

  const settled = await settledMapLimit(
    prompts,
    PER_PROMPT_CONCURRENCY,
    async (prompt) => {
      const call = await callProviderWithRetry(
        `${model} answer prompt ${prompt.id}`,
        (signal) => queryPromptWithProvider(model, prompt.prompt, { signal }),
        PER_PROMPT_TIMEOUT_MS,
      );

      return {
        prompt,
        response: call.value.trim(),
        retries: call.retries,
        timeouts: call.timeouts,
      };
    },
  );

  settled.forEach((result, index) => {
    const prompt = prompts[index];
    if (result.status === "fulfilled") {
      usage.succeeded += 1;
      usage.retries += result.value.retries;
      usage.timeouts += result.value.timeouts;
      if (result.value.response) {
        results[result.value.prompt.id] = result.value.response;
        usage.promptsSucceeded += 1;
      } else {
        usage.promptsFailed += 1;
      }
      return;
    }

    const stats = retryStats(result.reason);
    usage.failed += 1;
    usage.promptsFailed += 1;
    usage.retries += stats.retries;
    usage.timeouts += stats.timeouts;
    console.warn(`[analyze-prompts] ${model} failed for prompt ${prompt?.id}:`, result.reason);
  });

  return { responses: results, usage };
}

async function queryProviderWebPromptAnswers(
  model: AIModel,
  prompts: GeneratedPrompt[],
): Promise<ProviderAnswerResult> {
  const usage = createBatchUsage("answers", model);
  usage.attempted = prompts.length;
  const results: Record<string, ModelAnswer> = {};

  const settled = await settledMapLimit(
    prompts,
    PER_PROMPT_CONCURRENCY,
    async (prompt) => {
      const call = await callProviderWithRetry(
        `${model} web answer prompt ${prompt.id}`,
        (signal) => queryPromptWithWebProvider(model, prompt.prompt, { signal }),
        PROVIDER_TIMEOUT_MS,
      );

      return {
        prompt,
        answer: call.value,
        retries: call.retries,
        timeouts: call.timeouts,
      };
    },
  );

  settled.forEach((result, index) => {
    const prompt = prompts[index];
    if (result.status === "fulfilled") {
      usage.succeeded += 1;
      usage.retries += result.value.retries;
      usage.timeouts += result.value.timeouts;
      if (result.value.answer.response) {
        results[result.value.prompt.id] = result.value.answer;
        usage.promptsSucceeded += 1;
      } else {
        usage.promptsFailed += 1;
      }
      return;
    }

    const stats = retryStats(result.reason);
    usage.failed += 1;
    usage.promptsFailed += 1;
    usage.retries += stats.retries;
    usage.timeouts += stats.timeouts;
    console.warn(`[analyze-prompts] ${model} web failed for prompt ${prompt?.id}:`, result.reason);
  });

  return { answers: results, usage };
}

async function queryPromptWithProvider(
  model: AIModel,
  prompt: string,
  options: ProviderRequestOptions,
): Promise<string> {
  if (model === "gpt-4o") {
    return queryGPT4oWithPrompt(prompt, {
      signal: options.signal,
      timeoutMs: PER_PROMPT_TIMEOUT_MS,
    });
  }
  if (model === "claude") {
    return queryClaudeWithPrompt(prompt, {
      signal: options.signal,
      timeoutMs: PER_PROMPT_TIMEOUT_MS,
    });
  }
  return queryGeminiWithPrompt(prompt, {
    signal: options.signal,
    timeoutMs: PER_PROMPT_TIMEOUT_MS,
  });
}

async function queryPromptWithWebProvider(
  model: AIModel,
  prompt: string,
  options: ProviderRequestOptions,
): Promise<ModelAnswer> {
  if (model === "gpt-4o") {
    return queryGPT4oWithWebPrompt(prompt, {
      signal: options.signal,
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });
  }
  if (model === "claude") {
    return queryClaudeWithWebPrompt(prompt, {
      signal: options.signal,
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });
  }
  return queryGeminiWithWebPrompt(prompt, {
    signal: options.signal,
    timeoutMs: PROVIDER_TIMEOUT_MS,
  });
}

async function analyzeResponseBatches(
  company: CompanyInput,
  prompts: GeneratedPrompt[],
  responses: Record<string, string>,
): Promise<ProviderAnalysisResult> {
  const usage = createBatchUsage(
    "analysis",
    process.env.GEMINI_API_KEY ? "gemini" : "deterministic",
  );

  if (!process.env.GEMINI_API_KEY) {
    usage.promptsFailed = prompts.length;
    return { analyses: {}, usage };
  }

  const batches = chunkArray(prompts, ANALYSIS_BATCH_SIZE);
  usage.attempted = batches.length;

  const settled = await settledMapLimit(
    batches,
    BATCH_CONCURRENCY,
    async (batch, index) => {
      const call = await callProviderWithRetry(
        `gemini analysis batch ${index + 1}/${batches.length}`,
        (signal) =>
          analyzeGeminiResponseBatch(company, batch, responses, {
            signal,
            timeoutMs: PROVIDER_TIMEOUT_MS,
          }),
        PROVIDER_TIMEOUT_MS,
      );

      return {
        analyses: call.value,
        retries: call.retries,
        timeouts: call.timeouts,
      };
    },
  );

  const analyses: Record<string, PromptAnalysisDetails> = {};

  settled.forEach((result, index) => {
    const batch = batches[index] || [];
    if (result.status === "fulfilled") {
      const promptCount = countPromptValues(batch, result.value.analyses);
      usage.succeeded += 1;
      usage.promptsSucceeded += promptCount;
      usage.promptsFailed += batch.length - promptCount;
      usage.retries += result.value.retries;
      usage.timeouts += result.value.timeouts;
      Object.assign(analyses, result.value.analyses);
      return;
    }

    const stats = retryStats(result.reason);
    usage.failed += 1;
    usage.promptsFailed += batch.length;
    usage.retries += stats.retries;
    usage.timeouts += stats.timeouts;
    console.warn(
      `[analyze-prompts] Gemini analysis batch ${index + 1}/${batches.length} failed; ${batch.length} prompt(s) will use deterministic analysis.`,
      result.reason,
    );
  });

  return { analyses, usage };
}

async function analyzeModelResponses(
  model: AIModel,
  company: CompanyInput,
  prompts: GeneratedPrompt[],
  answers: Record<string, ModelAnswer>,
  usage: AnalysisProviderUsage,
): Promise<ModelAnalysisResult> {
  const filled = { ...answers };
  let responseFallbacks = 0;
  for (const p of prompts) {
    if (!filled[p.id]?.response) {
      filled[p.id] = asModelAnswer(fallbackResponse(company, p));
      responseFallbacks += 1;
    }
  }

  usage.responsesFromFallback = responseFallbacks;
  usage.responsesFromProvider = prompts.length - responseFallbacks;

  const responses = Object.fromEntries(
    Object.entries(filled).map(([promptId, answer]) => [promptId, answer.response]),
  );

  const llmAnalysis = await analyzeResponseBatches(company, prompts, responses);
  usage.analysisBatches = llmAnalysis.usage;
  usage.analysesFromProvider = countPromptValues(prompts, llmAnalysis.analyses);
  usage.analysesFromFallback = prompts.length - usage.analysesFromProvider;
  usage.analyzerProvider = usage.analysesFromProvider > 0 ? "gemini" : "deterministic";

  const promptAnalyses: PromptAnalysis[] = prompts.map((p) => {
    const answer = filled[p.id] ?? asModelAnswer("");
    const response = answer.response;
    const details = llmAnalysis.analyses[p.id] ?? deterministicAnalyze(company, p, response);
    return buildPromptAnalysis(p, answer, details);
  });

  return {
    analysis: { model, promptAnalyses, aggregateStats: aggregateAnalyses(company, promptAnalyses) },
    usage,
  };
}

function fallbackModelAnalysis(
  model: AIModel,
  company: CompanyInput,
  prompts: GeneratedPrompt[],
  usage = createProviderUsage(model, prompts.length),
): ModelAnalysisResult {
  usage.answerProvider = "local-fallback";
  usage.analyzerProvider = "deterministic";
  usage.responsesFromProvider = 0;
  usage.responsesFromFallback = prompts.length;
  usage.analysesFromProvider = 0;
  usage.analysesFromFallback = prompts.length;
  usage.answerBatches = createBatchUsage("answers", "local-fallback");
  usage.answerBatches.promptsFailed = prompts.length;
  usage.analysisBatches = createBatchUsage("analysis", "deterministic");
  usage.analysisBatches.promptsFailed = prompts.length;

  const promptAnalyses = prompts.map((prompt) => {
    const response = fallbackResponse(company, prompt);
    return buildPromptAnalysis(
      prompt,
      response,
      deterministicAnalyze(company, prompt, response),
    );
  });

  return {
    analysis: { model, promptAnalyses, aggregateStats: aggregateAnalyses(company, promptAnalyses) },
    usage,
  };
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

  const analysisMode: AnalysisMode = body.analysisMode === "web" ? "web" : "standard";

  if (analysisMode === "web" && body.prompts.length > MAX_WEB_PROMPTS) {
    return invalidRequestResponse(
      request,
      "analyze-prompts",
      `Web mode supports up to ${MAX_WEB_PROMPTS} prompts. Reduce the prompt list and try again.`,
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
    return jsonResponse(cached.value, cached.metadata, authResult.rateLimitHeaders);
  }

  console.log(
    `[analyze-prompts] Starting analysis: company="${body.company.companyName}", prompts=${body.prompts.length}, mode=${analysisMode}, models=${modelsToQuery.join(", ")}, cacheKey=${cacheKey}`,
  );

  try {
    const responseSettled = await Promise.allSettled(
      modelsToQuery.map((model) =>
        queryModelForPrompts(model, body.company, body.prompts, analysisMode),
      ),
    );

    const responsesByModel: QueryModelResult[] = responseSettled.map((result, index) => {
      if (result.status === "fulfilled") return result.value;

      const model = modelsToQuery[index];
      console.warn(
        `[analyze-prompts] ${model} response stage failed; using deterministic response fallback.`,
        result.reason,
      );
      const usage = createProviderUsage(model, body.prompts.length);
      usage.answerProvider = "local-fallback";
      usage.answerBatches = createBatchUsage("answers", "local-fallback");
      usage.answerBatches.promptsFailed = body.prompts.length;
      usage.responsesFromFallback = body.prompts.length;
      return { model, answers: {}, usage };
    });

    const analysisSettled = await Promise.allSettled(
      responsesByModel.map(({ model, answers, usage }) =>
        analyzeModelResponses(model, body.company, body.prompts, answers, usage),
      ),
    );

    const analysisResults = analysisSettled.map((result, index) => {
      if (result.status === "fulfilled") return result.value;

      const { model, usage } = responsesByModel[index];
      console.warn(
        `[analyze-prompts] ${model} analysis stage failed; using deterministic analysis fallback.`,
        result.reason,
      );
      return fallbackModelAnalysis(model, body.company, body.prompts, usage);
    });

    const modelAnalyses = analysisResults.map((result) => result.analysis);
    const providerUsage = analysisResults.map((result) => result.usage);
    const primary = modelAnalyses[0];
    const response: AnalysisResponse = {
      analysisMode,
      models: modelAnalyses,
      aggregateStats: primary.aggregateStats,
      promptAnalyses: primary.promptAnalyses,
      providerUsage,
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
