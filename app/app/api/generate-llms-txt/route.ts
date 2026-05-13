import { fetchPublicPageHtmlForModel } from "@/lib/fetch-public-page-text";
import { GEMINI_MODEL, generateText } from "@/lib/gemini";
import {
  buildLlmsTxtMarkdown,
  normalizeWebsiteUrl,
  serializeTunnelReportForPrompt,
} from "@/lib/llms-txt-markdown";
import { AnalysisResponse, CompanyInput } from "@/types";
import { NextResponse } from "next/server";

interface GenerateLlmsTxtBody {
  company?: CompanyInput;
  analysis?: AnalysisResponse;
}

const SYSTEM_INSTRUCTION = `You are helping a company author an llms.txt-style markdown document for their public website.

You receive:
1) Raw HTML from their homepage URL (scripts and styles removed; may be truncated for length). Use tags and visible text: titles, headings, meta descriptions, nav, links, body copy.
2) A JSON object with user-provided company fields and a "Tunnel" AI visibility audit (scores, categories, missed prompts, recommendations, possible inaccuracies, how models describe them when mentioned).

Your job is to produce ONE markdown document suitable to publish at /llms.txt (or merge into an existing llms.txt), optimized so AI crawlers and assistants can learn accurate, useful facts about the company.

Rules:
- Ground factual claims in the homepage HTML / visible site content when possible. Where the HTML is silent, you may use the form "description" and "category" from the JSON, and visibility-report context—but do not invent specific product features, pricing, integrations, customers, or metrics not supported by the HTML or the JSON.
- Explicitly weave in the audit: overall visibility, category-level gaps, missed-opportunity prompts (as example user questions the brand should win), recommendations, and any "possible inaccuracies" as "clarifications to verify on the public site" (word carefully; these are audit flags, not proven falsehoods).
- Prefer neutral, factual tone. No hype, no medical/legal promises, no attacks on competitors.
- Use clear markdown headings (e.g. # title, ## sections). No YAML front matter unless clearly useful.
- Do NOT wrap the entire output in a markdown code fence.
- Output ONLY the markdown document (no preamble or postscript like "Here is your file").`;

function stripOuterCodeFence(text: string): string {
  const t = text.trim();
  if (!t.startsWith("```")) return t;
  const lines = t.split("\n");
  if (lines.length < 2) return t;
  lines.shift();
  const last = lines[lines.length - 1]?.trim();
  if (last === "```") lines.pop();
  return lines.join("\n").trim();
}

function isCompanyInput(x: unknown): x is CompanyInput {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.companyName === "string" &&
    typeof o.website === "string" &&
    typeof o.description === "string" &&
    typeof o.category === "string" &&
    typeof o.numberOfPrompts === "number"
  );
}

function isAnalysisResponse(x: unknown): x is AnalysisResponse {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.aggregateStats !== undefined &&
    typeof o.aggregateStats === "object" &&
    Array.isArray(o.promptAnalyses)
  );
}

export async function POST(req: Request) {
  let body: GenerateLlmsTxtBody;
  try {
    body = (await req.json()) as GenerateLlmsTxtBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isCompanyInput(body.company) || !isAnalysisResponse(body.analysis)) {
    return NextResponse.json(
      { error: "Expected { company: CompanyInput, analysis: AnalysisResponse }" },
      { status: 400 },
    );
  }

  const { company, analysis } = body;

  const pageUrl = normalizeWebsiteUrl(company.website);
  let websiteFetch: {
    ok: boolean;
    finalUrl?: string;
    status?: number;
    error?: string;
    htmlChars: number;
    htmlTruncated: boolean;
  } = { ok: false, htmlChars: 0, htmlTruncated: false };

  let homepageHtml = "";
  if (pageUrl) {
    const fetched = await fetchPublicPageHtmlForModel(pageUrl);
    homepageHtml = fetched.html;
    websiteFetch = {
      ok: fetched.ok,
      finalUrl: fetched.finalUrl,
      status: fetched.status,
      error: fetched.error,
      htmlChars: homepageHtml.length,
      htmlTruncated: fetched.htmlTruncated,
    };
    if (!fetched.ok && fetched.error) {
      homepageHtml = `<!-- Homepage fetch did not fully succeed (${fetched.error}). Rely on JSON company fields and audit below. -->`;
    }
  } else {
    homepageHtml = "<!-- No website URL provided. Use JSON company fields and audit only. -->";
  }

  const templateMarkdown = buildLlmsTxtMarkdown(company, analysis);

  const respondWithFallback = (
    reason: "missing_api_key" | "generation_failed",
    message?: string,
  ) =>
    NextResponse.json({
      markdown: templateMarkdown,
      model: "offline-template",
      websiteFetch,
      usedFallback: true,
      fallbackReason: reason,
      ...(message ? { fallbackMessage: message } : {}),
    });

  if (!process.env.GEMINI_API_KEY) {
    return respondWithFallback(
      "missing_api_key",
      "Set GEMINI_API_KEY in app/.env.local to enable Gemini drafts.",
    );
  }

  const reportJson = serializeTunnelReportForPrompt(company, analysis);

  const userPrompt = `## Homepage HTML (fetched from ${pageUrl || "n/a"})
Below is HTML from the live request (script and style tags were removed; content may be truncated for size). Parse structure and visible text.

${homepageHtml}

## Tunnel company + visibility audit (JSON)
${reportJson}

Produce the llms.txt-style markdown document now.`;

  try {
    const raw = await generateText({
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt: userPrompt,
      maxOutputTokens: 8192,
      temperature: 0.35,
    });
    const markdown = stripOuterCodeFence(raw);
    if (!markdown) {
      return respondWithFallback("generation_failed", "Model returned empty content");
    }
    return NextResponse.json({
      markdown,
      model: GEMINI_MODEL,
      websiteFetch,
      usedFallback: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return respondWithFallback("generation_failed", msg);
  }
}
