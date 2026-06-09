import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { POST as analyzePromptsPost } from "@/app/api/analyze-prompts/route";
import { POST as generatePromptsPost } from "@/app/api/generate-prompts/route";
import {
  API_RATE_LIMITS,
  authorizeApiRequest,
  resetRateLimitStoreForTests,
} from "@/lib/api-security";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

const authMock = vi.mocked(auth);

function mockAuthUser(userId: string | null) {
  authMock.mockResolvedValue({
    userId,
  } as Awaited<ReturnType<typeof auth>>);
}

function postRequest(path: string, body = "{}", ip = "203.0.113.10") {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body,
  });
}

describe("API route security", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
    authMock.mockReset();
  });

  it("returns a clear 401 for unauthenticated prompt generation requests", async () => {
    mockAuthUser(null);

    const response = await generatePromptsPost(postRequest("/api/generate-prompts"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      code: "unauthorized",
      error: expect.stringMatching(/authentication required/i),
    });
  });

  it("returns a clear 401 for unauthenticated analysis requests", async () => {
    mockAuthUser(null);

    const response = await analyzePromptsPost(postRequest("/api/analyze-prompts"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      code: "unauthorized",
      error: expect.stringMatching(/authentication required/i),
    });
  });

  it("rate limits unauthenticated requests by fallback IP", async () => {
    mockAuthUser(null);
    const limit = API_RATE_LIMITS["generate-prompts"].ip.limit;

    for (let i = 0; i < limit; i += 1) {
      const result = await authorizeApiRequest(
        postRequest("/api/generate-prompts"),
        "generate-prompts",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    }

    const limited = await authorizeApiRequest(
      postRequest("/api/generate-prompts"),
      "generate-prompts",
    );

    expect(limited.ok).toBe(false);
    if (!limited.ok) {
      const body = await limited.response.json();
      expect(limited.response.status).toBe(429);
      expect(body).toMatchObject({ code: "rate_limited" });
      expect(limited.response.headers.get("X-RateLimit-Scope")).toBe("ip");
    }
  });

  it("rate limits signed-in analysis requests by user", async () => {
    mockAuthUser("user_123");
    const limit = API_RATE_LIMITS["analyze-prompts"].user.limit;

    for (let i = 0; i < limit; i += 1) {
      const result = await authorizeApiRequest(
        postRequest("/api/analyze-prompts", "{}", "203.0.113.11"),
        "analyze-prompts",
      );
      expect(result.ok).toBe(true);
    }

    const limited = await authorizeApiRequest(
      postRequest("/api/analyze-prompts", "{}", "203.0.113.12"),
      "analyze-prompts",
    );

    expect(limited.ok).toBe(false);
    if (!limited.ok) {
      const body = await limited.response.json();
      expect(limited.response.status).toBe(429);
      expect(body).toMatchObject({ code: "rate_limited" });
      expect(limited.response.headers.get("X-RateLimit-Scope")).toBe("user");
    }
  });

  it("returns a clear 400 for malformed prompt generation JSON", async () => {
    mockAuthUser("user_123");

    const response = await generatePromptsPost(
      postRequest("/api/generate-prompts", "{not-json"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "invalid_request",
      error: "Invalid JSON body.",
    });
  });

  it("returns a clear 400 for malformed analysis JSON", async () => {
    mockAuthUser("user_123");

    const response = await analyzePromptsPost(postRequest("/api/analyze-prompts", "{not-json"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "invalid_request",
      error: "Invalid JSON body.",
    });
  });
});
