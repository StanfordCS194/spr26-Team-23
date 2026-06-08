import { createHash } from "node:crypto";
import type { CacheMetadata, CompanyInput, GeneratedPrompt } from "@/types";

export const PROMPT_GENERATION_CACHE_VERSION = "prompt-generation:v1";
export const ANALYSIS_CACHE_VERSION = "analysis:v1";

const MAX_ENTRIES_PER_BUCKET = 100;
const PROMPT_GENERATION_TTL_MS = 1000 * 60 * 60;
const ANALYSIS_TTL_MS = 1000 * 60 * 60;

export type CacheBucketName = "promptGeneration" | "analysis";
export type CacheStatus = "hit" | "miss";

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
}

interface CacheStore {
  promptGeneration: Map<string, CacheEntry<unknown>>;
  analysis: Map<string, CacheEntry<unknown>>;
}

const globalCache = globalThis as typeof globalThis & {
  __tunnelCache?: CacheStore;
};

function getStore(): CacheStore {
  if (!globalCache.__tunnelCache) {
    globalCache.__tunnelCache = {
      promptGeneration: new Map(),
      analysis: new Map(),
    };
  }

  return globalCache.__tunnelCache;
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function normalizeKeyText(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeWebsite(value: unknown): string {
  const text = normalizeText(value).toLowerCase();
  if (!text) return "";

  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return text
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
  }
}

function normalizeCompetitors(competitors: CompanyInput["competitors"]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const competitor of competitors || []) {
    const value = normalizeKeyText(competitor);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized.sort();
}

export function normalizeCompanyForCache(company: CompanyInput) {
  return {
    companyName: normalizeKeyText(company.companyName),
    website: normalizeWebsite(company.website),
    description: normalizeKeyText(company.description),
    category: normalizeKeyText(company.category),
    competitors: normalizeCompetitors(company.competitors),
    numberOfPrompts: Number(company.numberOfPrompts) || 0,
  };
}

export function normalizePromptsForCache(prompts: GeneratedPrompt[]) {
  return prompts.map((prompt) => ({
    id: normalizeText(prompt.id),
    category: prompt.category,
    prompt: normalizeKeyText(prompt.prompt),
    rationale: normalizeKeyText(prompt.rationale),
  }));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 24);
}

export function createPromptGenerationCacheKey(
  company: CompanyInput,
  providerFingerprint: string,
): string {
  return digest({
    version: PROMPT_GENERATION_CACHE_VERSION,
    providerFingerprint,
    company: normalizeCompanyForCache(company),
  });
}

export function createAnalysisCacheKey(
  company: CompanyInput,
  prompts: GeneratedPrompt[],
  providerFingerprint: string,
): string {
  return digest({
    version: ANALYSIS_CACHE_VERSION,
    providerFingerprint,
    company: normalizeCompanyForCache(company),
    prompts: normalizePromptsForCache(prompts),
  });
}

function ttlForBucket(bucketName: CacheBucketName): number {
  return bucketName === "promptGeneration" ? PROMPT_GENERATION_TTL_MS : ANALYSIS_TTL_MS;
}

function versionForBucket(bucketName: CacheBucketName): string {
  return bucketName === "promptGeneration"
    ? PROMPT_GENERATION_CACHE_VERSION
    : ANALYSIS_CACHE_VERSION;
}

function pruneBucket(bucket: Map<string, CacheEntry<unknown>>, now: number) {
  for (const [key, entry] of bucket.entries()) {
    if (entry.expiresAt <= now) bucket.delete(key);
  }

  while (bucket.size > MAX_ENTRIES_PER_BUCKET) {
    const oldestKey = bucket.keys().next().value as string | undefined;
    if (!oldestKey) break;
    bucket.delete(oldestKey);
  }
}

function cacheMetadata(
  bucketName: CacheBucketName,
  key: string,
  status: CacheStatus,
  createdAt: number,
): CacheMetadata {
  return {
    status,
    key,
    version: versionForBucket(bucketName),
    createdAt: new Date(createdAt).toISOString(),
    ttlSeconds: Math.floor(ttlForBucket(bucketName) / 1000),
  };
}

export function readCache<T>(
  bucketName: CacheBucketName,
  key: string,
): { value: T; metadata: CacheMetadata } | null {
  const bucket = getStore()[bucketName];
  const now = Date.now();
  const entry = bucket.get(key);

  if (!entry || entry.expiresAt <= now) {
    if (entry) bucket.delete(key);
    return null;
  }

  bucket.delete(key);
  bucket.set(key, entry);

  return {
    value: structuredClone(entry.value) as T,
    metadata: cacheMetadata(bucketName, key, "hit", entry.createdAt),
  };
}

export function writeCache<T>(
  bucketName: CacheBucketName,
  key: string,
  value: T,
): CacheMetadata {
  const bucket = getStore()[bucketName];
  const now = Date.now();
  pruneBucket(bucket, now);

  bucket.set(key, {
    value: structuredClone(value),
    createdAt: now,
    expiresAt: now + ttlForBucket(bucketName),
  });

  return cacheMetadata(bucketName, key, "miss", now);
}

export function cacheHeaders(metadata: CacheMetadata): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "X-Tunnel-Cache": metadata.status,
    "X-Tunnel-Cache-Key": metadata.key,
    "X-Tunnel-Cache-Version": metadata.version,
  };
}
