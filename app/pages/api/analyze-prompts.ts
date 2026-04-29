import { aggregateAnalyses } from "@/lib/aggregation";
import {
  LlmInsightFields,
  batchLlmAnalyze,
  buildPromptAnalysis,
  deterministicAnalyze,
} from "@/lib/analysis";
import { generateText } from "@/lib/gemini";
import { safeParseJson } from "@/lib/json-repair";
import {
  AnalysisResponse,
  CompanyInput,
  GeneratedPrompt,
  PromptAnalysis,
  PromptAnalysisDetails,
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

interface BatchedAnswersResponse {
  answers?: Array<{ promptId: string; response: string }>;
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
  let insightsByPrompt: Record<string, LlmInsightFields> | null = null;

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
      const rows = body.prompts.map((p) => ({
        promptId: p.id,
        prompt: p.prompt,
        category: p.category,
        response: responsesByPrompt[p.id] || "",
      }));
      insightsByPrompt = await batchLlmAnalyze(body.company, rows);
      if (!insightsByPrompt) {
        console.warn("[analyze-prompts] No LLM insights available (batch failed or empty).");
      }
    } catch (err) {
      console.warn(
        "[analyze-prompts] Batched insight call failed; using deterministic-only analysis.",
        err,
      );
    }
  }

  const analyses: PromptAnalysis[] = body.prompts.map((prompt) => {
    const response = responsesByPrompt[prompt.id] || "";
    const base = deterministicAnalyze(body.company, prompt, response);
    const insight = insightsByPrompt?.[prompt.id];

    const merged: PromptAnalysisDetails = {
      ...base,
      targetDescription: insight?.targetDescription ?? base.targetDescription,
      explanation: insight?.explanation ?? base.explanation,
      possibleInaccuracies:
        insight?.possibleInaccuracies ?? base.possibleInaccuracies ?? [],
    };

    return buildPromptAnalysis(prompt, response, merged);
  });

  const fallbackAnalysisPrompts = body.prompts.filter((p) => !insightsByPrompt?.[p.id]);
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
