import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export type ApiEndpoint = "generate-prompts" | "analyze-prompts";

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

interface EndpointRateLimitConfig {
  user: RateLimitConfig;
  ip: RateLimitConfig;
  malformedIp: RateLimitConfig;
}

export const API_RATE_LIMITS: Record<ApiEndpoint, EndpointRateLimitConfig> = {
  "generate-prompts": {
    user: { limit: 30, windowMs: 60_000 },
    ip: { limit: 12, windowMs: 60_000 },
    malformedIp: { limit: 20, windowMs: 60_000 },
  },
  "analyze-prompts": {
    user: { limit: 12, windowMs: 60_000 },
    ip: { limit: 8, windowMs: 60_000 },
    malformedIp: { limit: 16, windowMs: 60_000 },
  },
};

type RateLimitScope = "user" | "ip" | "malformed-ip";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface AuthorizedApiRequest {
  ok: true;
  userId: string;
  rateLimitHeaders: HeadersInit;
}

interface BlockedApiRequest {
  ok: false;
  response: NextResponse;
}

const MAX_RATE_LIMIT_KEYS = 5_000;

const globalRateLimit = globalThis as typeof globalThis & {
  __tunnelRateLimitStore?: Map<string, RateLimitEntry>;
};

function getRateLimitStore(): Map<string, RateLimitEntry> {
  if (!globalRateLimit.__tunnelRateLimitStore) {
    globalRateLimit.__tunnelRateLimitStore = new Map();
  }

  return globalRateLimit.__tunnelRateLimitStore;
}

function pruneRateLimitStore(store: Map<string, RateLimitEntry>, now: number) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key);
  }

  while (store.size > MAX_RATE_LIMIT_KEYS) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}

function digestIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function rateLimitKey(endpoint: ApiEndpoint, scope: RateLimitScope, identifier: string): string {
  return `${endpoint}:${scope}:${digestIdentifier(identifier)}`;
}

export function resetRateLimitStoreForTests() {
  getRateLimitStore().clear();
}

export function consumeRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now(),
): RateLimitResult {
  const store = getRateLimitStore();
  pruneRateLimitStore(store, now);

  const existing = store.get(key);
  const entry =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + config.windowMs };

  entry.count += 1;
  store.set(key, entry);

  const remaining = Math.max(0, config.limit - entry.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

  return {
    allowed: entry.count <= config.limit,
    limit: config.limit,
    remaining,
    resetAt: entry.resetAt,
    retryAfterSeconds,
  };
}

function firstHeaderValue(value: string | null): string {
  return value?.split(",")[0]?.trim() || "";
}

export function clientIpFromRequest(request: Request): string {
  const headers = request.headers;
  const forwardedFor = firstHeaderValue(headers.get("x-forwarded-for"));
  if (forwardedFor) return forwardedFor;

  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-client-ip")?.trim() ||
    "unknown"
  );
}

export function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();
  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => headers.set(key, value));
  }

  return headers;
}

function rateLimitHeaders(
  result: RateLimitResult,
  scope: RateLimitScope,
  includeRetryAfter = false,
): HeadersInit {
  return {
    ...(includeRetryAfter ? { "Retry-After": String(result.retryAfterSeconds) } : {}),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "X-RateLimit-Scope": scope,
  };
}

export function apiErrorResponse(
  status: 400 | 401 | 429,
  code: "invalid_request" | "unauthorized" | "rate_limited",
  error: string,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json({ error, code }, { status, headers });
}

function rateLimitedResponse(result: RateLimitResult, scope: RateLimitScope): NextResponse {
  return apiErrorResponse(
    429,
    "rate_limited",
    "Too many requests. Please wait before trying again.",
    rateLimitHeaders(result, scope, true),
  );
}

function consumeEndpointLimit(
  endpoint: ApiEndpoint,
  scope: RateLimitScope,
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  return consumeRateLimit(rateLimitKey(endpoint, scope, identifier), config);
}

export async function authorizeApiRequest(
  request: Request,
  endpoint: ApiEndpoint,
): Promise<AuthorizedApiRequest | BlockedApiRequest> {
  let userId: string | null = null;

  try {
    const session = await auth();
    userId = typeof session.userId === "string" && session.userId ? session.userId : null;
  } catch (error) {
    console.warn(`[${endpoint}] Clerk auth lookup failed. Treating request as unauthenticated.`, error);
  }

  if (!userId) {
    const ipLimit = consumeEndpointLimit(
      endpoint,
      "ip",
      clientIpFromRequest(request),
      API_RATE_LIMITS[endpoint].ip,
    );

    if (!ipLimit.allowed) {
      return { ok: false, response: rateLimitedResponse(ipLimit, "ip") };
    }

    return {
      ok: false,
      response: apiErrorResponse(
        401,
        "unauthorized",
        "Authentication required. Sign in and retry this request.",
        rateLimitHeaders(ipLimit, "ip"),
      ),
    };
  }

  const userLimit = consumeEndpointLimit(
    endpoint,
    "user",
    userId,
    API_RATE_LIMITS[endpoint].user,
  );

  if (!userLimit.allowed) {
    return { ok: false, response: rateLimitedResponse(userLimit, "user") };
  }

  return {
    ok: true,
    userId,
    rateLimitHeaders: rateLimitHeaders(userLimit, "user"),
  };
}

export function invalidRequestResponse(
  request: Request,
  endpoint: ApiEndpoint,
  error: string,
  headers?: HeadersInit,
): NextResponse {
  const malformedLimit = consumeEndpointLimit(
    endpoint,
    "malformed-ip",
    clientIpFromRequest(request),
    API_RATE_LIMITS[endpoint].malformedIp,
  );

  if (!malformedLimit.allowed) {
    return rateLimitedResponse(malformedLimit, "malformed-ip");
  }

  return apiErrorResponse(400, "invalid_request", error, headers);
}
