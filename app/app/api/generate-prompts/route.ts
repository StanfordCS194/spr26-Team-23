import {
  authorizeApiRequest,
  invalidRequestResponse,
  mergeHeaders,
} from "@/lib/api-security";
import {
  cacheHeaders,
  createPromptGenerationCacheKey,
  readCache,
  writeCache,
} from "@/lib/cache";
import { GEMINI_MODEL, generateText } from "@/lib/gemini";
import { safeParseJson } from "@/lib/json-repair";
import {
  CompanyInput,
  GeneratedPrompt,
  PromptCategory,
  PromptGenerationResponse,
} from "@/types";
import { NextResponse } from "next/server";

const VALID_CATEGORIES: PromptCategory[] = [
  "discovery",
  "comparison",
  "use_case",
  "niche",
  "purchase",
];

const SYSTEM_INSTRUCTION = `You are Tunnel's prompt generation engine.

Tunnel helps companies understand how AI assistants represent, recommend, and compare them.

Given a company name, website, product description, category/industry, competitors, and desired number of prompts, generate realistic prompts that potential customers might ask an AI assistant when discovering or evaluating products in this category.

Your goal is NOT to flatter the company. Your goal is to create prompts that fairly test whether the company appears in relevant AI-generated answers.

Generate prompts across these categories:
1. Discovery: broad "best tools/apps/products for X" prompts
2. Comparison: alternatives, competitors, "X vs Y" prompts
3. Use case: prompts based on specific customer jobs-to-be-done
4. Niche: prompts where the company's differentiation should matter
5. Purchase intent: prompts from users close to choosing a product

Each prompt should sound natural and user-like, not like market research.

Return ONLY valid JSON in this format:
{
  "prompts": [
    {
      "id": "p1",
      "category": "discovery",
      "prompt": "...",
      "rationale": "Why this prompt is useful for testing AI visibility."
    }
  ]
}

Rules:
- Generate exactly the requested number of prompts.
- Include a balanced mix of categories.
- Include competitor-focused prompts when competitors are provided.
- Include niche prompts based on the product description.
- Do not assume the target company is well-known.
- Do not mention Tunnel.
- Do not include markdown.
- Return valid parseable JSON only.`;

interface RequestBody extends CompanyInput {
  autoGenerateCompetitors?: boolean;
  targetCompetitorCount?: number;
}

interface ParsedPrompt {
  id?: string;
  category: PromptCategory;
  prompt: string;
  rationale: string;
}

interface ParsedResponse {
  prompts?: ParsedPrompt[];
}

function fallbackPrompts(input: CompanyInput): GeneratedPrompt[] {
  const competitors = input.competitors?.join(", ") || "relevant alternatives";
  const templates: Omit<GeneratedPrompt, "id">[] = [
    {
      category: "discovery",
      prompt: `What are the best ${input.category} options?`,
      rationale: "Broad category discovery.",
    },
    {
      category: "comparison",
      prompt: `${input.companyName} vs ${competitors}`,
      rationale: "Direct competitor comparison.",
    },
    {
      category: "use_case",
      prompt: `What product helps with ${input.description.toLowerCase()}?`,
      rationale: "Use-case oriented question.",
    },
    {
      category: "niche",
      prompt: `Best ${input.category} tools for specialized needs`,
      rationale: "Niche differentiation.",
    },
    {
      category: "purchase",
      prompt: `Which ${input.category} product is worth paying for?`,
      rationale: "Purchase intent query.",
    },
  ];

  return Array.from({ length: input.numberOfPrompts }).map((_, i) => {
    const base = templates[i % templates.length];
    return {
      id: `p${i + 1}`,
      category: base.category,
      prompt: base.prompt,
      rationale: base.rationale,
    };
  });
}

function providerFingerprint(): string {
  return process.env.GEMINI_API_KEY ? `gemini:${GEMINI_MODEL}` : "local-fallback";
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function jsonResponse(
  prompts: GeneratedPrompt[],
  metadata: PromptGenerationResponse["cache"],
  headers?: HeadersInit,
) {
  const body: PromptGenerationResponse = { prompts, cache: metadata };
  return NextResponse.json(body, { headers: mergeHeaders(cacheHeaders(metadata), headers) });
}

async function generateCompetitors(name: string, category: string, count: number): Promise<string[]> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 6000),
    );
    const raw = await Promise.race([
      generateText({
        systemInstruction: `Return ONLY a JSON array of up to ${count} direct competitor company names. No explanation. Example: ["Adyen","Braintree","Square"]`,
        prompt: `Company: ${name}${category ? `\nIndustry: ${category}` : ""}`,
        expectJson: true,
        maxOutputTokens: 128,
        temperature: 0.1,
      }),
      timeout,
    ]);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string").slice(0, count)
      : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const authResult = await authorizeApiRequest(request, "generate-prompts");
  if (!authResult.ok) return authResult.response;

  const body = await readJson<RequestBody>(request);
  const input = body as CompanyInput | null;

  if (!input) {
    return invalidRequestResponse(
      request,
      "generate-prompts",
      "Invalid JSON body.",
      authResult.rateLimitHeaders,
    );
  }

  if (!input.companyName || !input.category || !input.description) {
    return invalidRequestResponse(
      request,
      "generate-prompts",
      "Missing required company fields: companyName, category, and description.",
      authResult.rateLimitHeaders,
    );
  }

  if (
    !Number.isInteger(input.numberOfPrompts) ||
    input.numberOfPrompts < 5 ||
    input.numberOfPrompts > 50
  ) {
    return invalidRequestResponse(
      request,
      "generate-prompts",
      "numberOfPrompts must be an integer between 5 and 50.",
      authResult.rateLimitHeaders,
    );
  }

  // Auto-generate competitors to fill up to target count
  const autoGenerate = body?.autoGenerateCompetitors ?? true;
  const targetCount = body?.targetCompetitorCount ?? 3;
  const existing = input.competitors ?? [];
  if (autoGenerate && existing.length < targetCount && process.env.GEMINI_API_KEY) {
    const needed = targetCount - existing.length;
    const generated = await generateCompetitors(input.companyName, input.category, needed);
    input.competitors = [...existing, ...generated];
  }

  const cacheKey = createPromptGenerationCacheKey(input, providerFingerprint());
  const cached = readCache<GeneratedPrompt[]>("promptGeneration", cacheKey);

  if (cached) {
    console.info(
      `[generate-prompts] cache hit key=${cached.metadata.key} version=${cached.metadata.version}`,
    );
    return jsonResponse(cached.value, cached.metadata, authResult.rateLimitHeaders);
  }

  let prompts: GeneratedPrompt[];

  if (!process.env.GEMINI_API_KEY) {
    prompts = fallbackPrompts(input);
  } else {
    try {
      const userPayload = JSON.stringify({
        companyName: input.companyName,
        website: input.website,
        description: input.description,
        category: input.category,
        competitors: input.competitors || [],
        numberOfPrompts: input.numberOfPrompts,
      });

      const raw = await generateText({
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt: userPayload,
        expectJson: true,
        maxOutputTokens: 1600,
        temperature: 0.7,
      });

      const parsed = safeParseJson<ParsedResponse>(raw);
      if (!parsed?.prompts?.length) {
        prompts = fallbackPrompts(input);
      } else {
        prompts = parsed.prompts
          .slice(0, input.numberOfPrompts)
          .map((item, i) => {
            const category = VALID_CATEGORIES.includes(item.category)
              ? item.category
              : VALID_CATEGORIES[i % VALID_CATEGORIES.length];
            return {
              id: typeof item.id === "string" && item.id.trim() ? item.id : `p${i + 1}`,
              category,
              prompt: typeof item.prompt === "string" ? item.prompt : "",
              rationale: typeof item.rationale === "string" ? item.rationale : "",
            };
          })
          .filter((p) => p.prompt.length > 0);
      }
    } catch {
      prompts = fallbackPrompts(input);
    }
  }

  if (!prompts.length) prompts = fallbackPrompts(input);

  const metadata = writeCache("promptGeneration", cacheKey, prompts);
  console.info(
    `[generate-prompts] cache miss stored key=${metadata.key} version=${metadata.version} prompts=${prompts.length}`,
  );

  return jsonResponse(prompts, metadata, authResult.rateLimitHeaders);
}
