"use client";

import { buildLlmsTxtMarkdown } from "@/lib/llms-txt-markdown";
import { AnalysisResponse, CompanyInput } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface LlmsTxtPanelProps {
  company: CompanyInput;
  data: AnalysisResponse;
}

interface WebsiteFetchMeta {
  ok: boolean;
  finalUrl?: string;
  status?: number;
  error?: string;
  htmlChars: number;
  htmlTruncated: boolean;
}

interface GenerateLlmsTxtResponse {
  markdown?: string;
  model?: string;
  websiteFetch?: WebsiteFetchMeta;
  pageMeta?: { title?: string; description?: string };
  usedFallback?: boolean;
  fallbackReason?: "missing_api_key" | "generation_failed";
  fallbackMessage?: string;
  error?: string;
}

interface CacheEntry {
  markdown: string;
  model: string;
  websiteFetch: WebsiteFetchMeta | null;
  pageMeta: { title?: string; description?: string } | null;
  fallbackNote: string | null;
}

function buildFallbackNoteFromBody(body: GenerateLlmsTxtResponse): string | null {
  if (!body.usedFallback) return null;
  if (body.fallbackReason === "missing_api_key") {
    return (
      body.fallbackMessage ||
      "GEMINI_API_KEY is not set on the server. Showing the report-based offline template."
    );
  }
  if (body.fallbackReason === "generation_failed") {
    return body.fallbackMessage
      ? `Gemini request failed: ${body.fallbackMessage}. Showing the report-based offline template.`
      : "Gemini request failed. Showing the report-based offline template.";
  }
  return "Showing the report-based offline template.";
}

function safeFilenamePart(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "company"
  );
}

export function LlmsTxtPanel({ company, data }: LlmsTxtPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [markdown, setMarkdown] = useState("");
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [websiteMeta, setWebsiteMeta] = useState<WebsiteFetchMeta | null>(null);
  const [pageMeta, setPageMeta] = useState<{ title?: string; description?: string } | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadToken, setLoadToken] = useState(0);

  const cacheKey = useMemo(
    () =>
      `${company.companyName}::${company.website}::${data.aggregateStats.visibilityScore}::${data.promptAnalyses.length}`,
    [company.companyName, company.website, data.aggregateStats.visibilityScore, data.promptAnalyses.length],
  );

  const cacheRef = useRef(new Map<string, CacheEntry>());

  const applyLocalTemplate = useCallback(
    (note: string) => {
      const md = buildLlmsTxtMarkdown(company, data);
      setMarkdown(md);
      setModelLabel("Offline template (no LLM)");
      setWebsiteMeta(null);
      setPageMeta(null);
      setFallbackNote(note);
      setStatus("ready");
      setErrorMessage(null);
    },
    [company, data],
  );

  useEffect(() => {
    if (!open) return;
    setCopied(false);

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setMarkdown(cached.markdown);
      setModelLabel(cached.model);
      setWebsiteMeta(cached.websiteFetch);
      setPageMeta(cached.pageMeta);
      setFallbackNote(cached.fallbackNote);
      setStatus("ready");
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setErrorMessage(null);
    setModelLabel(null);
    setWebsiteMeta(null);
    setPageMeta(null);
    setFallbackNote(null);
    setMarkdown("");

    (async () => {
      try {
        const res = await fetch("/api/generate-llms-txt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company, analysis: data }),
        });

        let body: GenerateLlmsTxtResponse = {};
        try {
          body = (await res.json()) as GenerateLlmsTxtResponse;
        } catch {
          body = {};
        }

        if (cancelled) return;

        if (res.status === 400) {
          setErrorMessage(body.error || "Invalid request");
          setStatus("error");
          return;
        }

        if (res.ok && body.markdown) {
          const note = buildFallbackNoteFromBody(body);
          const entry: CacheEntry = {
            markdown: body.markdown,
            model: body.model || "unknown",
            websiteFetch: body.websiteFetch ?? null,
            pageMeta: body.pageMeta ?? null,
            fallbackNote: note,
          };
          cacheRef.current.set(cacheKey, entry);
          setMarkdown(entry.markdown);
          setModelLabel(entry.model);
          setWebsiteMeta(entry.websiteFetch);
          setPageMeta(entry.pageMeta);
          setFallbackNote(entry.fallbackNote);
          setStatus("ready");
          return;
        }

        const serverHint =
          typeof body.error === "string" && body.error.length > 0
            ? body.error
            : `HTTP ${res.status}`;
        applyLocalTemplate(`Could not reach the server (${serverHint}). Showing the offline template.`);
      } catch (e) {
        if (cancelled) return;
        applyLocalTemplate(
          e instanceof Error
            ? `Network error (${e.message}). Showing the offline template.`
            : "Network error. Showing the offline template.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, cacheKey, loadToken, company, data, applyLocalTemplate]);

  const handleCopy = useCallback(async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [markdown]);

  const handleDownload = useCallback(() => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `llms-${safeFilenamePart(company.companyName)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [markdown, company.companyName]);

  const handleRegenerate = useCallback(() => {
    cacheRef.current.delete(cacheKey);
    setLoadToken((x) => x + 1);
  }, [cacheKey]);

  const handleUseTemplate = useCallback(() => {
    const md = buildLlmsTxtMarkdown(company, data);
    setMarkdown(md);
    setModelLabel("Offline template (no LLM)");
    setWebsiteMeta(null);
    setPageMeta(null);
    setFallbackNote("Using the offline template (chosen manually).");
    setStatus("ready");
    setErrorMessage(null);
  }, [company, data]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
      >
        AI visibility draft
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="llms-txt-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="llms-txt-title" className="text-lg font-semibold text-slate-950">
                  llms.txt-style draft
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  We fetch your homepage HTML (scripts/styles stripped) and send it with your Tunnel
                  report to <strong className="font-medium text-slate-800">Gemini 3 Flash (preview)</strong>{" "}
                  when an API key is configured. If Gemini is unavailable or the request fails, you
                  still get a report-based offline template automatically. Markdown fits the{" "}
                  <a
                    href="https://llmstxt.org/"
                    className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
                    target="_blank"
                    rel="noreferrer"
                  >
                    llms.txt
                  </a>{" "}
                  convention—review before publishing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {status === "loading" ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-100 bg-slate-50 py-16 text-center text-sm text-slate-600">
                  <span
                    className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600"
                    aria-hidden
                  />
                  <p>Fetching homepage HTML and generating markdown…</p>
                </div>
              ) : status === "error" ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  <p className="font-medium">Invalid request</p>
                  <p className="mt-2 text-rose-800">{errorMessage}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      className="rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={handleUseTemplate}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Use offline template
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {fallbackNote ? (
                    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      {fallbackNote}
                    </div>
                  ) : null}
                  <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 md:text-sm">
                    {markdown}
                  </pre>
                </>
              )}
            </div>

            {status === "ready" ? (
              <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">
                {modelLabel ? (
                  <>
                    <span className="font-medium text-slate-700">Model:</span> {modelLabel}
                    {websiteMeta ? (
                      <>
                        {" "}
                        · <span className="font-medium text-slate-700">Homepage HTML:</span>{" "}
                        {websiteMeta.ok
                          ? `loaded (${websiteMeta.htmlChars.toLocaleString()} chars${websiteMeta.htmlTruncated ? ", truncated" : ""} from ${websiteMeta.finalUrl || company.website})`
                          : `partial or failed${websiteMeta.error ? ` — ${websiteMeta.error}` : ""}`}
                      </>
                    ) : null}
                    {pageMeta?.title ? (
                      <>
                        {" "}
                        · <span className="font-medium text-slate-700">Page title:</span>{" "}
                        {pageMeta.title.length > 60
                          ? `${pageMeta.title.slice(0, 57)}…`
                          : pageMeta.title}
                      </>
                    ) : null}
                  </>
                ) : null}
              </p>
            ) : null}

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                disabled={status !== "ready" || !markdown}
                onClick={handleCopy}
                className="inline-flex cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy markdown"}
              </button>
              <button
                type="button"
                disabled={status !== "ready" || !markdown}
                onClick={handleDownload}
                className="inline-flex cursor-pointer items-center rounded-md border border-slate-200 bg-slate-950 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download .txt
              </button>
              {status === "ready" ? (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="ml-auto text-sm font-medium text-sky-700 hover:text-sky-900"
                >
                  Regenerate
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
