import { generateText } from "@/lib/gemini";
import { safeParseJson } from "@/lib/json-repair";
import { CompanyInput, GeneratedPrompt, PromptCategory } from "@/types";
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

interface ParsedPrompt {
  id?: string;
  category: PromptCategory;
  prompt: string;
  rationale: string;
}

interface ParsedResponse {
  prompts?: ParsedPrompt[];
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const input = await readJson<CompanyInput>(request);

  if (!input?.companyName || !input?.category || !input?.description) {
    return NextResponse.json(
      { error: "Missing required company fields." },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(fallbackPrompts(input));
  }

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
      return NextResponse.json(fallbackPrompts(input));
    }

    const prompts: GeneratedPrompt[] = parsed.prompts
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

    return NextResponse.json(prompts.length ? prompts : fallbackPrompts(input));
  } catch {
    return NextResponse.json(fallbackPrompts(input));
  }
}
