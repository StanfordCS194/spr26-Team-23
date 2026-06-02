import { assertPublicHttpUrl } from "@/lib/fetch-public-page-text";
import { normalizeWebsiteUrl } from "@/lib/llms-txt-markdown";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 120_000;
/** Cap text sent to the model when merging with an existing file. */
const MAX_CONTENT_CHARS = 16_000;

export interface ExistingLlmsTxtResult {
  found: boolean;
  ok: boolean;
  url: string;
  status?: number;
  content: string;
  contentTruncated: boolean;
  error?: string;
}

export function existingLlmsTxtUrlForWebsite(website: string): string | null {
  const base = normalizeWebsiteUrl(website);
  if (!base) return null;
  try {
    const origin = new URL(base).origin;
    return `${origin}/llms.txt`;
  } catch {
    return null;
  }
}

/**
 * Fetches /llms.txt from the company's public origin when present.
 */
export async function fetchExistingLlmsTxt(website: string): Promise<ExistingLlmsTxtResult> {
  const urlString = existingLlmsTxtUrlForWebsite(website);
  if (!urlString) {
    return {
      found: false,
      ok: false,
      url: "",
      content: "",
      contentTruncated: false,
      error: "No website URL",
    };
  }

  let url: URL;
  try {
    url = assertPublicHttpUrl(urlString);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid URL";
    return {
      found: false,
      ok: false,
      url: urlString,
      content: "",
      contentTruncated: false,
      error: message,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/plain,text/markdown,text/*;q=0.9,*/*;q=0.5",
        "User-Agent": "TunnelLlmsTxtFetcher/1.0",
      },
    });

    if (res.status === 404) {
      return {
        found: false,
        ok: true,
        url: res.url,
        status: 404,
        content: "",
        contentTruncated: false,
      };
    }

    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(slice).trim();
    const contentTruncated = raw.length > MAX_CONTENT_CHARS;
    const content = raw.slice(0, MAX_CONTENT_CHARS);

    if (!res.ok) {
      return {
        found: false,
        ok: false,
        url: res.url,
        status: res.status,
        content,
        contentTruncated,
        error: `HTTP ${res.status}`,
      };
    }

    if (!content) {
      return {
        found: false,
        ok: true,
        url: res.url,
        status: res.status,
        content: "",
        contentTruncated: false,
      };
    }

    return {
      found: true,
      ok: true,
      url: res.url,
      status: res.status,
      content,
      contentTruncated,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch failed";
    return {
      found: false,
      ok: false,
      url: url.toString(),
      content: "",
      contentTruncated: false,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}
