import {
  AnalysisResponse,
  CompanyInput,
  PromptCategory,
  CategoryVisibility,
  Recommendation,
} from "@/types";

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  discovery: "Discovery",
  comparison: "Comparison",
  use_case: "Use case",
  niche: "Niche",
  purchase: "Purchase intent",
};

const CATEGORY_QUERY_HINTS: Record<PromptCategory, string> = {
  discovery: 'broad discovery and "what should I use" questions',
  comparison: 'head-to-head comparisons and "alternatives to X" searches',
  use_case: 'task-oriented and "how do I…" workflows',
  niche: "specialized and category-specific queries",
  purchase: "pricing, subscriptions, and purchase-intent questions",
};

const WEAK_VISIBILITY_THRESHOLD = 50;

export function normalizeWebsiteUrl(website: string): string {
  const t = website.trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t}`;
}

function weakCategories(
  visibilityByCategory: Record<PromptCategory, CategoryVisibility>,
): PromptCategory[] {
  return (Object.entries(visibilityByCategory) as [PromptCategory, CategoryVisibility][])
    .filter(([, v]) => v.total > 0 && v.percent < WEAK_VISIBILITY_THRESHOLD)
    .map(([c]) => c);
}

function suggestedAnswerForMissedOpportunity(
  company: CompanyInput,
  competitors: string[],
): string {
  const comp = competitors.filter(Boolean).slice(0, 2);
  const compPhrase =
    comp.length > 0
      ? ` When users compare options such as ${comp.join(" and ")}, ${company.companyName} should be listed as a relevant choice in ${company.category}.`
      : "";
  return `${company.description.trim()}${compPhrase} Official site: ${normalizeWebsiteUrl(company.website)}.`;
}

function isRecommendation(value: unknown): value is Recommendation {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as Recommendation).title === "string" &&
      typeof (value as Recommendation).action === "string" &&
      typeof (value as Recommendation).priority === "string",
  );
}

function recommendationLines(value: Recommendation | string): string[] {
  if (typeof value === "string") return [`- ${value}`];
  if (!isRecommendation(value)) return [];

  const priority = value.priority.toUpperCase();
  const lines = [`- **${priority} - ${value.title}:** ${value.action}`];
  if (value.contentIdeas.length > 0) {
    lines.push(`  - Content ideas: ${value.contentIdeas.slice(0, 3).join("; ")}`);
  }
  if (value.supportingPrompts.length > 0) {
    lines.push(
      `  - Evidence prompts: ${value.supportingPrompts
        .slice(0, 3)
        .map((p) => `"${p.prompt}"`)
        .join("; ")}`,
    );
  }
  return lines;
}

export function buildLlmsTxtMarkdown(company: CompanyInput, data: AnalysisResponse): string {
  const stats = data.aggregateStats;
  const url = normalizeWebsiteUrl(company.website);
  const weak = weakCategories(stats.visibilityByCategory);
  const lines: string[] = [];

  lines.push(`# ${company.companyName}`);
  lines.push("");
  lines.push(`> ${company.description.trim()}`);
  lines.push("");
  if (url) {
    lines.push(`Primary website: ${url}`);
    lines.push("");
  }

  lines.push("## Summary for AI assistants");
  lines.push("");
  lines.push(stats.aiPositioningSummary);
  lines.push("");
  lines.push(
    `In a recent audit across ${stats.visibilityCount.total} representative prompts, ${company.companyName} appeared in ${stats.visibilityCount.mentioned} (${stats.visibilityScore}% overall visibility).`,
  );
  lines.push("");

  lines.push("## Canonical facts");
  lines.push("");
  lines.push(`- **Legal / brand name:** ${company.companyName}`);
  if (url) lines.push(`- **Website:** ${url}`);
  lines.push(`- **Category / market:** ${company.category}`);
  lines.push(`- **What we do:** ${company.description.trim()}`);
  if (company.competitors?.length) {
    lines.push(
      `- **Often compared with:** ${company.competitors.join(", ")} (inclusion does not imply endorsement)`,
    );
  }
  lines.push("");

  if (weak.length > 0) {
    lines.push("## Topics where we want clearer representation");
    lines.push("");
    lines.push(
      `The following prompt categories had lower mention rates in AI responses. Publishing clear, factual copy (FAQs, comparison pages, use-case guides) that mirrors real user questions helps crawlers and assistants surface ${company.companyName} fairly.`,
    );
    lines.push("");
    for (const cat of weak) {
      const v = stats.visibilityByCategory[cat];
      lines.push(
        `### ${CATEGORY_LABEL[cat]} (${v.mentioned}/${v.total} prompts, ${v.percent}% visibility)`,
      );
      lines.push("");
      lines.push(
        `Users asking ${CATEGORY_QUERY_HINTS[cat]} in **${company.category}** should be able to find **${company.companyName}** as a credible option. ${company.description.trim()}`,
      );
      lines.push("");
    }
  }

  if (stats.topMissedOpportunities.length > 0) {
    lines.push("## Example user questions where we should appear");
    lines.push("");
    lines.push(
      "Below are real-style queries where competitors were mentioned but our brand was not. Short answers are suggested on-site copy you can adapt (not medical, legal, or regulated claims—verify accuracy before publishing).",
    );
    lines.push("");
    for (const m of stats.topMissedOpportunities.slice(0, 8)) {
      lines.push(`**Question:** ${m.prompt}`);
      lines.push("");
      lines.push(
        `**Suggested factual positioning:** ${suggestedAnswerForMissedOpportunity(company, m.competitorMentions)}`,
      );
      lines.push("");
    }
  }

  if (stats.extractedDescriptions.length > 0) {
    lines.push("## How assistants currently describe us (when mentioned)");
    lines.push("");
    for (const d of stats.extractedDescriptions) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }

  if (stats.possibleInaccuracies.length > 0) {
    lines.push("## Factual clarifications to reinforce on the public site");
    lines.push("");
    lines.push(
      "These items were flagged as possible inaccuracies in model outputs. Clear, consistent wording on your website and docs reduces the chance assistants learn the wrong facts.",
    );
    lines.push("");
    for (const entry of stats.possibleInaccuracies.slice(0, 10)) {
      lines.push(`- Regarding "${entry.prompt}": ${entry.items.join(" ")}`);
    }
    lines.push("");
  }

  if (stats.recommendations.length > 0) {
    lines.push("## Recommended content priorities (from visibility audit)");
    lines.push("");
    for (const r of stats.recommendations as (Recommendation | string)[]) {
      lines.push(...recommendationLines(r));
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    "_This draft was produced from a Tunnel competitive AI visibility report. Review for accuracy, then publish as `/llms.txt` on your domain or merge the sections into your existing llms.txt file._",
  );

  return lines.join("\n");
}

/** Compact JSON for Gemini: company + aggregate report (no full raw prompt list). */
export function serializeTunnelReportForPrompt(company: CompanyInput, data: AnalysisResponse): string {
  const s = data.aggregateStats;
  return JSON.stringify(
    {
      company: {
        companyName: company.companyName,
        website: company.website,
        description: company.description,
        category: company.category,
        competitors: company.competitors ?? [],
      },
      aggregate: {
        visibilityScore: s.visibilityScore,
        visibilityCount: s.visibilityCount,
        visibilityByCategory: s.visibilityByCategory,
        averageRank: s.averageRank,
        aiPositioningSummary: s.aiPositioningSummary,
        recommendations: s.recommendations,
        bestPerformingCategory: s.bestPerformingCategory,
        weakestCategory: s.weakestCategory,
        shareOfVoice: s.shareOfVoice,
        topCompetitor: s.topCompetitor,
        topMissedOpportunities: s.topMissedOpportunities,
        possibleInaccuracies: s.possibleInaccuracies,
        extractedDescriptions: s.extractedDescriptions,
        promptsWhereCompetitorWins: s.promptsWhereCompetitorWins.slice(0, 15),
      },
    },
    null,
    2,
  );
}
