const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 500_000;
/** Cap HTML sent to the model (characters after stripping scripts/styles). */
const MAX_HTML_FOR_MODEL_CHARS = 200_000;

function isPrivateOrReservedIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const o = m.slice(1, 5).map((x) => Number(x));
  if (o.some((n) => n > 255)) return true;
  const [a, b] = o;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Basic SSRF guard for server-side URL fetch. */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    host === "0.0.0.0"
  ) {
    throw new Error("Host not allowed");
  }
  if (host === "metadata.google.internal" || host === "169.254.169.254") {
    throw new Error("Host not allowed");
  }
  if (isPrivateOrReservedIpv4(host)) {
    throw new Error("Host not allowed");
  }
  return url;
}

/** Remove executable/style blocks; keep markup so the model can use structure, headings, links, meta. */
export function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
}

export interface PageMetaFromHtml {
  title?: string;
  description?: string;
}

function readMetaContent(html: string, pattern: RegExp): string | undefined {
  const m = pattern.exec(html);
  if (!m?.[1]) return undefined;
  return m[1].replace(/\s+/g, " ").trim() || undefined;
}

/** Best-effort title and description from homepage HTML. */
export function extractPageMetaFromHtml(html: string): PageMetaFromHtml {
  const title =
    readMetaContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
    readMetaContent(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    readMetaContent(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);

  const description =
    readMetaContent(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    ) ??
    readMetaContent(
      html,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    ) ??
    readMetaContent(
      html,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    ) ??
    readMetaContent(
      html,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    );

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  };
}

export function htmlToPlainText(html: string, maxChars: number): string {
  const stripped = stripScriptsAndStyles(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, maxChars);
}

export interface FetchPageForModelResult {
  ok: boolean;
  finalUrl: string;
  status?: number;
  /** Sanitized, possibly truncated HTML passed to the LLM. */
  html: string;
  htmlTruncated: boolean;
  error?: string;
}

/**
 * Fetches public homepage/document HTML for the company URL.
 * Returns HTML (scripts/styles stripped, then truncated) suitable as model context.
 */
export async function fetchPublicPageHtmlForModel(
  urlString: string,
): Promise<FetchPageForModelResult> {
  const url = assertPublicHttpUrl(urlString);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "TunnelLlmsTxtFetcher/1.0",
      },
    });
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    const cleaned = stripScriptsAndStyles(raw).trim();
    const htmlTruncated = cleaned.length > MAX_HTML_FOR_MODEL_CHARS;
    const html = cleaned.slice(0, MAX_HTML_FOR_MODEL_CHARS);

    if (!res.ok) {
      return {
        ok: false,
        finalUrl: res.url,
        status: res.status,
        html,
        htmlTruncated,
        error: `HTTP ${res.status}`,
      };
    }
    return { ok: true, finalUrl: res.url, status: res.status, html, htmlTruncated };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch failed";
    return {
      ok: false,
      finalUrl: url.toString(),
      html: "",
      htmlTruncated: false,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}
