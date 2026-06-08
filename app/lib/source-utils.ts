import { AIModel, AnswerSource } from "@/types";

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizeAnswerSources(
  sources: Array<{
    url?: string | null;
    title?: string | null;
    provider: AIModel;
    citedText?: string | null;
  }>,
): AnswerSource[] {
  const seen = new Set<string>();
  const normalized: AnswerSource[] = [];

  for (const source of sources) {
    const url = source.url?.trim();
    if (!url || seen.has(url)) continue;

    const domain = domainFromUrl(url);
    if (!domain) continue;

    seen.add(url);
    normalized.push({
      url,
      domain,
      provider: source.provider,
      ...(source.title?.trim() ? { title: source.title.trim() } : {}),
      ...(source.citedText?.trim() ? { citedText: source.citedText.trim() } : {}),
    });
  }

  return normalized;
}
