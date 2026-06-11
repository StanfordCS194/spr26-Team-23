import { beforeEach, describe, expect, it, vi } from "vitest";
import { minimalAnalysisFixture, minimalCompanyFixture } from "@/lib/llms-txt-fixtures";
import { AnalysisResponse, CompanyInput, GeneratedPrompt } from "@/types";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createReport: vi.fn(),
  currentUser: vi.fn(),
  fetchExistingLlmsTxt: vi.fn(),
  fetchPublicPageHtmlForModel: vi.fn(),
  generateText: vi.fn(),
  isReportPayload: vi.fn(),
  listReportsForClerkUser: vi.fn(),
  prismaReportFindFirst: vi.fn(),
  prismaReportFindMany: vi.fn(),
  queryClaudeWithPrompt: vi.fn(),
  queryClaudeWithWebPrompt: vi.fn(),
  queryGPT4oWithPrompt: vi.fn(),
  queryGPT4oWithWebPrompt: vi.fn(),
  queryGeminiWithPrompt: vi.fn(),
  queryGeminiWithWebPrompt: vi.fn(),
  serializeReport: vi.fn(),
  upsertAppUser: vi.fn(),
}));

vi.mock("@/lib/gemini", () => ({
  GEMINI_MODEL: "gemini-test-model",
  generateText: mocks.generateText,
  queryGeminiWithPrompt: mocks.queryGeminiWithPrompt,
  queryGeminiWithWebPrompt: mocks.queryGeminiWithWebPrompt,
}));

vi.mock("@/lib/openai", () => ({
  queryGPT4oWithPrompt: mocks.queryGPT4oWithPrompt,
  queryGPT4oWithWebPrompt: mocks.queryGPT4oWithWebPrompt,
}));

vi.mock("@/lib/anthropic", () => ({
  queryClaudeWithPrompt: mocks.queryClaudeWithPrompt,
  queryClaudeWithWebPrompt: mocks.queryClaudeWithWebPrompt,
}));

vi.mock("@/lib/fetch-public-page-text", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fetch-public-page-text")>();
  return {
    ...actual,
    fetchPublicPageHtmlForModel: mocks.fetchPublicPageHtmlForModel,
  };
});

vi.mock("@/lib/fetch-existing-llms-txt", () => ({
  fetchExistingLlmsTxt: mocks.fetchExistingLlmsTxt,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}));

vi.mock("@/lib/auth-db", () => ({
  upsertAppUser: mocks.upsertAppUser,
}));

vi.mock("@/lib/reports", () => ({
  createReport: mocks.createReport,
  isReportPayload: mocks.isReportPayload,
  listReportsForClerkUser: mocks.listReportsForClerkUser,
  serializeReport: mocks.serializeReport,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    report: {
      findFirst: mocks.prismaReportFindFirst,
      findMany: mocks.prismaReportFindMany,
    },
  },
}));

const PROVIDER_ENV_KEYS = ["GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"] as const;

function clearProviderEnv() {
  for (const key of PROVIDER_ENV_KEYS) {
    delete process.env[key];
  }
}

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function companyFixture(overrides: Partial<CompanyInput> = {}): CompanyInput {
  return {
    companyName: "Acme Analytics",
    website: "https://acme.example",
    description: "Analytics for operations teams.",
    category: "analytics tools",
    competitors: ["Beta BI"],
    numberOfPrompts: 5,
    ...overrides,
  };
}

const prompts: GeneratedPrompt[] = [
  {
    id: "p1",
    category: "discovery",
    prompt: "What are the best analytics tools?",
    rationale: "Broad discovery.",
  },
  {
    id: "p2",
    category: "comparison",
    prompt: "Acme Analytics vs Beta BI",
    rationale: "Direct comparison.",
  },
];

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  clearProviderEnv();
  delete (globalThis as typeof globalThis & { __tunnelCache?: unknown }).__tunnelCache;
});

describe("POST /api/generate-prompts", () => {
  it("rejects invalid company input", async () => {
    const { POST } = await import("@/app/api/generate-prompts/route");

    const response = await POST(jsonRequest("/api/generate-prompts", { companyName: "Acme" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "invalid_request",
      error: "Missing required company fields: companyName, category, and description.",
    });
  });

  it("uses deterministic fallback prompts and emits cache metadata when the Gemini key is missing", async () => {
    const { POST } = await import("@/app/api/generate-prompts/route");
    const company = companyFixture();

    const firstResponse = await POST(jsonRequest("/api/generate-prompts", company));
    const firstBody = (await firstResponse.json()) as {
      prompts: GeneratedPrompt[];
      cache: { status: string; key: string; version: string };
    };
    const secondResponse = await POST(jsonRequest("/api/generate-prompts", company));
    const secondBody = (await secondResponse.json()) as {
      prompts: GeneratedPrompt[];
      cache: { status: string; key: string; version: string };
    };

    expect(firstResponse.status).toBe(200);
    expect(firstBody.prompts).toHaveLength(5);
    expect(firstBody.prompts[0]).toMatchObject({
      id: "p1",
      category: "discovery",
      prompt: "What are the best analytics tools options?",
    });
    expect(firstBody.cache.status).toBe("miss");
    expect(firstBody.cache.version).toBe("prompt-generation:v1");
    expect(firstResponse.headers.get("x-tunnel-cache")).toBe("miss");
    expect(secondBody.cache.status).toBe("hit");
    expect(secondResponse.headers.get("x-tunnel-cache")).toBe("hit");
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});

describe("POST /api/analyze-prompts", () => {
  it("rejects missing company or prompt input", async () => {
    const { POST } = await import("@/app/api/analyze-prompts/route");

    const response = await POST(
      jsonRequest("/api/analyze-prompts", { company: companyFixture(), prompts: [] }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "invalid_request",
      error: "prompts must be a non-empty array with at most 50 items.",
    });
  });

  it("uses local model fallback and cache metadata when no provider API keys are set", async () => {
    const { POST } = await import("@/app/api/analyze-prompts/route");

    const response = await POST(
      jsonRequest("/api/analyze-prompts", {
        company: companyFixture(),
        prompts,
      }),
    );
    const body = (await response.json()) as AnalysisResponse & {
      cache: { status: string; version: string };
    };

    expect(response.status).toBe(200);
    expect(body.models?.map((model) => model.model)).toEqual(["gemini"]);
    expect(body.promptAnalyses).toHaveLength(2);
    expect(body.promptAnalyses[0].response).toContain("Acme Analytics");
    expect(body.aggregateStats.visibilityCount.total).toBe(2);
    expect(body.cache.status).toBe("miss");
    expect(body.cache.version).toBe("analysis:v1");
    expect(response.headers.get("x-tunnel-cache")).toBe("miss");
    expect(mocks.queryGPT4oWithPrompt).not.toHaveBeenCalled();
    expect(mocks.queryClaudeWithPrompt).not.toHaveBeenCalled();
    expect(mocks.queryGeminiWithPrompt).not.toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("rejects web mode when more than 15 prompts are submitted", async () => {
    const { POST } = await import("@/app/api/analyze-prompts/route");
    const manyPrompts = Array.from({ length: 16 }, (_, index) => ({
      ...prompts[0],
      id: `p${index + 1}`,
      prompt: `Prompt ${index + 1}`,
    }));

    const response = await POST(
      jsonRequest("/api/analyze-prompts", {
        company: companyFixture({ numberOfPrompts: 16 }),
        prompts: manyPrompts,
        analysisMode: "web",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
      error: "Web mode supports up to 15 prompts. Reduce the prompt list and try again.",
    });
  });
});

describe("POST /api/generate-llms-txt", () => {
  it("rejects invalid report payloads", async () => {
    const { POST } = await import("@/app/api/generate-llms-txt/route");

    const response = await POST(jsonRequest("/api/generate-llms-txt", { company: null }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Expected { company: CompanyInput, analysis: AnalysisResponse }",
    });
  });

  it("returns offline markdown with fallback metadata when the Gemini key is missing", async () => {
    const company = minimalCompanyFixture();
    const analysis = minimalAnalysisFixture();
    mocks.fetchPublicPageHtmlForModel.mockResolvedValue({
      ok: true,
      finalUrl: "https://acme.example/",
      status: 200,
      html: "<h1>Acme Widgets</h1>",
      htmlTruncated: false,
    });
    mocks.fetchExistingLlmsTxt.mockResolvedValue({
      found: false,
      ok: true,
      url: "https://acme.example/llms.txt",
      status: 404,
      content: "",
      contentTruncated: false,
    });
    const { POST } = await import("@/app/api/generate-llms-txt/route");

    const response = await POST(
      jsonRequest("/api/generate-llms-txt", {
        company,
        analysis,
      }),
    );
    const body = (await response.json()) as {
      markdown: string;
      model: string;
      usedFallback: boolean;
      fallbackReason: string;
      websiteFetch: { ok: boolean; finalUrl?: string; htmlChars: number };
      existingLlmsTxt: { found: boolean; url: string; status?: number };
    };

    expect(response.status).toBe(200);
    expect(body.markdown).toContain("# Acme Widgets");
    expect(body.model).toBe("offline-template");
    expect(body.usedFallback).toBe(true);
    expect(body.fallbackReason).toBe("missing_api_key");
    expect(body.websiteFetch).toEqual({
      ok: true,
      finalUrl: "https://acme.example/",
      status: 200,
      htmlChars: "<h1>Acme Widgets</h1>".length,
      htmlTruncated: false,
    });
    expect(body.existingLlmsTxt).toMatchObject({
      found: false,
      url: "https://acme.example/llms.txt",
      status: 404,
    });
    expect(mocks.fetchPublicPageHtmlForModel).toHaveBeenCalledWith("https://acme.example");
    expect(mocks.fetchExistingLlmsTxt).toHaveBeenCalledWith("acme.example");
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});

describe("POST /api/reports", () => {
  it("returns unauthorized before validating or writing reports", async () => {
    mocks.currentUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/reports/route");

    const response = await POST(jsonRequest("/api/reports", {}));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.isReportPayload).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("rejects invalid report payloads for authenticated users", async () => {
    mocks.currentUser.mockResolvedValue({
      id: "user_123",
      primaryEmailAddress: { emailAddress: "user@example.com" },
      fullName: "Test User",
      imageUrl: "https://example.com/avatar.png",
    });
    mocks.isReportPayload.mockReturnValue(false);
    const { POST } = await import("@/app/api/reports/route");

    const response = await POST(jsonRequest("/api/reports", { company: {} }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid report payload." });
    expect(mocks.upsertAppUser).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });
});

describe("GET /api/reports", () => {
  it("returns unauthorized before listing reports", async () => {
    mocks.currentUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/route");

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.listReportsForClerkUser).not.toHaveBeenCalled();
  });

  it("returns serialized reports for authenticated users", async () => {
    mocks.currentUser.mockResolvedValue({
      id: "user_123",
      primaryEmailAddress: { emailAddress: "user@example.com" },
      fullName: "Test User",
      imageUrl: "https://example.com/avatar.png",
    });
    const company = minimalCompanyFixture();
    const analysis = minimalAnalysisFixture();
    mocks.listReportsForClerkUser.mockResolvedValue([
      {
        id: "report_1",
        createdAt: "2026-06-08T12:00:00.000Z",
        company,
        prompts: [],
        analysis,
      },
    ]);

    const { GET } = await import("@/app/api/reports/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reports: [
        {
          id: "report_1",
          createdAt: "2026-06-08T12:00:00.000Z",
          company,
          prompts: [],
          analysis,
        },
      ],
    });
    expect(mocks.listReportsForClerkUser).toHaveBeenCalledWith("user_123");
  });
});

describe("GET /api/reports/latest", () => {
  it("returns unauthorized before querying reports", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const { GET } = await import("@/app/api/reports/latest/route");

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.prismaReportFindFirst).not.toHaveBeenCalled();
  });
});
