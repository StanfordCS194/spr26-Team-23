import { NextRequest, NextResponse } from "next/server";

type RequestBody = {
  company: string;
  category: string;
  competitors: string[];
  customPrompts?: string[];
  providers: Array<"openai" | "anthropic" | "together">;
};

type ProviderResult = {
  prompt: string;
  response: string;
  companyMentioned: boolean;
  competitorMentions: string[];
  position: number | null;
  source: "live" | "mock";
  providerError?: string;
};

type QueryResult = {
  text: string;
  error?: string;
};

type ProviderDiagnostics = {
  provider: "openai" | "anthropic" | "together";
  liveResponses: number;
  mockResponses: number;
  errors: string[];
};

type TogetherModel = {
  id?: string;
  type?: string;
  display_type?: string;
};

let cachedTogetherServerlessModels: string[] | null = null;
let cachedAtMs = 0;
const TOGETHER_MODEL_CACHE_MS = 5 * 60 * 1000;

const EXAMPLE_PROMPTS: Record<string, string[]> = {
  cursor: [
    "Best AI coding assistants",
    "Top AI tools for developers",
    "Cursor vs Copilot",
    "Best AI tools for debugging code",
    "AI coding tools for productivity",
  ],
  "wine find": [
    "What are the best wine apps right now?",
    "Vivino vs other wine apps — what are the alternatives?",
    "Best tools for wine price transparency",
  ],
  guava: [
    "Best AI voice platforms for developers",
    "ElevenLabs alternatives",
    "What happened to Gridspace?",
  ],
};

function normalizePromptSet(input: RequestBody): string[] {
  const byCompany = EXAMPLE_PROMPTS[input.company.toLowerCase()];
  const fromUser = (input.customPrompts ?? []).filter(Boolean);
  if (fromUser.length > 0) return fromUser;
  if (byCompany && byCompany.length > 0) return byCompany;
  return [
    `Best ${input.category} products`,
    `${input.company} alternatives`,
    `Compare ${input.category} tools for startups`,
    `Top tools for ${input.category}`,
    `What is best for ${input.category} use cases?`,
  ];
}

function extractRankedMentions(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter(Boolean);
  return lines;
}

function getMentionPosition(response: string, company: string): number | null {
  const mentions = extractRankedMentions(response);
  const idx = mentions.findIndex((line) =>
    line.toLowerCase().includes(company.toLowerCase()),
  );
  return idx >= 0 ? idx + 1 : null;
}

function mockModelResponse(prompt: string, company: string, competitors: string[]): string {
  const base = [
    company,
    ...competitors.slice(0, 2),
    "Other notable tools",
  ];
  const score = [...prompt].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 3;
  if (score === 0) {
    return `1. ${base[1] ?? "Competitor A"}\n2. ${base[0]}\n3. ${base[2] ?? "Competitor B"}\n${company} is strong for focused use cases but appears less often in broad discovery prompts.`;
  }
  if (score === 1) {
    return `1. ${base[0]}\n2. ${base[1] ?? "Competitor A"}\n3. ${base[2] ?? "Competitor B"}\n${company} is commonly recommended with positive sentiment for reliability and developer productivity.`;
  }
  return `1. ${base[1] ?? "Competitor A"}\n2. ${base[2] ?? "Competitor B"}\n3. ${base[3] ?? "Other tool"}\n${company} is rarely mentioned unless the user asks for a specific niche feature.`;
}

async function queryOpenAI(prompt: string): Promise<QueryResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { text: "", error: "OPENAI_API_KEY is missing" };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: `Return a short ranked list and explanation.\nPrompt: ${prompt}`,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { text: "", error: `OpenAI API ${res.status}: ${body}` };
  }
  const json = (await res.json()) as {
    output_text?: string;
  };
  return { text: json.output_text ?? "" };
}

async function queryAnthropic(prompt: string): Promise<QueryResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { text: "", error: "ANTHROPIC_API_KEY is missing" };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 240,
      messages: [{ role: "user", content: `Return a short ranked list and explanation.\nPrompt: ${prompt}` }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { text: "", error: `Anthropic API ${res.status}: ${body}` };
  }
  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return { text: json.content?.find((c) => c.type === "text")?.text ?? "" };
}

async function queryTogether(prompt: string): Promise<QueryResult> {
  const key = process.env.TOGETHER_API_KEY;
  if (!key) return { text: "", error: "TOGETHER_API_KEY is missing" };
  const requestedModel = process.env.TOGETHER_MODEL?.trim();
  const discoveredModels = await getTogetherServerlessModels(key);
  const staticFallback = ["meta-llama/Llama-3.3-70B-Instruct-Turbo-Free"];
  const modelCandidates = requestedModel
    ? [
        requestedModel,
        ...discoveredModels.filter((m) => m !== requestedModel),
        ...staticFallback.filter((m) => m !== requestedModel),
      ]
    : [...discoveredModels, ...staticFallback];
  let lastError = "";
  for (const model of modelCandidates) {
    const res = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 240,
        messages: [
          {
            role: "user",
            content: `Return a short ranked list and explanation.\nPrompt: ${prompt}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      lastError = `Together model ${model} failed (${res.status}): ${body}`;
      continue;
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    if (text) return { text };
    lastError = `Together model ${model} returned empty content`;
  }
  return {
    text: "",
    error:
      lastError ||
      "Together request failed for all candidate models.",
  };
}

async function getTogetherServerlessModels(key: string): Promise<string[]> {
  const now = Date.now();
  if (
    cachedTogetherServerlessModels &&
    now - cachedAtMs < TOGETHER_MODEL_CACHE_MS
  ) {
    return cachedTogetherServerlessModels;
  }
  const res = await fetch("https://api.together.xyz/v1/models", {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as TogetherModel[];
  const models = json
    .filter((model) => {
      const type = (model.type || model.display_type || "").toLowerCase();
      return type.includes("serverless");
    })
    .map((model) => model.id)
    .filter((id): id is string => Boolean(id));
  cachedTogetherServerlessModels = models;
  cachedAtMs = now;
  return models;
}

async function runProvider(
  provider: "openai" | "anthropic" | "together",
  prompts: string[],
  company: string,
  competitors: string[],
): Promise<{ rows: ProviderResult[]; diagnostics: ProviderDiagnostics }> {
  const rows: ProviderResult[] = [];
  const errors = new Set<string>();
  let liveResponses = 0;
  let mockResponses = 0;
  for (const prompt of prompts) {
    let result: QueryResult = { text: "" };
    if (provider === "openai") result = await queryOpenAI(prompt);
    if (provider === "anthropic") result = await queryAnthropic(prompt);
    if (provider === "together") result = await queryTogether(prompt);

    let response = result.text;
    let source: "live" | "mock" = "live";
    if (!response) {
      source = "mock";
      mockResponses += 1;
      response = mockModelResponse(prompt, company, competitors);
    } else {
      liveResponses += 1;
    }
    if (result.error) {
      errors.add(result.error);
    }

    const companyMentioned = response.toLowerCase().includes(company.toLowerCase());
    const competitorMentions = competitors.filter((c) =>
      response.toLowerCase().includes(c.toLowerCase()),
    );
    rows.push({
      prompt,
      response,
      companyMentioned,
      competitorMentions,
      position: getMentionPosition(response, company),
      source,
      providerError: result.error,
    });
  }
  return {
    rows,
    diagnostics: {
      provider,
      liveResponses,
      mockResponses,
      errors: [...errors],
    },
  };
}

function summarize(
  company: string,
  prompts: string[],
  providers: Record<string, ProviderResult[]>,
  providerDiagnostics: ProviderDiagnostics[],
) {
  const all = Object.values(providers).flat();
  const mentions = all.filter((r) => r.companyMentioned);
  const positions = mentions.map((r) => r.position).filter((p): p is number => p !== null);
  const competitorCounts: Record<string, number> = {};
  for (const result of all) {
    for (const name of result.competitorMentions) {
      competitorCounts[name] = (competitorCounts[name] ?? 0) + 1;
    }
  }
  const topCompetitors = Object.entries(competitorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const visibilityRate = all.length
    ? Math.round((mentions.length / all.length) * 100)
    : 0;
  const avgPosition = positions.length
    ? Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(2))
    : null;

  const strengths = [
    visibilityRate >= 60
      ? `${company} appears in a majority of tested prompts.`
      : `${company} performs best in narrow prompt categories.`,
    avgPosition && avgPosition <= 2
      ? `${company} usually appears near the top of ranked mentions.`
      : `${company} often appears below top slots when mentioned.`,
  ];
  const gaps = [
    visibilityRate < 50
      ? "Low overall visibility in broad discovery prompts."
      : "Visibility is acceptable but inconsistent across providers.",
    topCompetitors[0]
      ? `${topCompetitors[0].name} is frequently mentioned alongside or above the company.`
      : "No stable competitor pattern found.",
  ];
  const recommendations = [
    "Publish comparison pages targeting high-volume prompt themes.",
    "Create content that reinforces your differentiator in niche prompts.",
    "Track rebrand/alias terms explicitly if company naming changed.",
  ];

  return {
    company,
    prompts,
    providers,
    providerDiagnostics,
    insightSummary: {
      visibilityRate,
      avgPosition,
      topCompetitors,
      strengths,
      gaps,
      recommendations,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const company = body.company?.trim();
    if (!company) {
      return NextResponse.json({ error: "Company is required." }, { status: 400 });
    }
    const category = body.category?.trim() || "software";
    const competitors = body.competitors ?? [];
    const allowedProviders = ["openai", "anthropic", "together"] as const;
    const providers = (body.providers ?? []).filter(
      (provider): provider is (typeof allowedProviders)[number] =>
        allowedProviders.includes(
          provider as (typeof allowedProviders)[number],
        ),
    );
    const selectedProviders: Array<(typeof allowedProviders)[number]> =
      providers.length ? providers : ["openai"];
    const prompts = normalizePromptSet({ ...body, category, company });

    const results = await Promise.all(
      selectedProviders.map(async (provider) => {
        const result = await runProvider(provider, prompts, company, competitors);
        return [provider, result] as const;
      }),
    );
    const providersMap: Record<string, ProviderResult[]> = {};
    const providerDiagnostics: ProviderDiagnostics[] = [];
    for (const [provider, result] of results) {
      providersMap[provider] = result.rows;
      providerDiagnostics.push(result.diagnostics);
    }
    return NextResponse.json(
      summarize(company, prompts, providersMap, providerDiagnostics),
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to run analysis." },
      { status: 500 },
    );
  }
}
