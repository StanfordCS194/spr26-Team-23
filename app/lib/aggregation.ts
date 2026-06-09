import {
  AggregateStats,
  CategoryVisibility,
  CompanyInput,
  CompetitorStats,
  PromptAnalysis,
  PromptCategory,
  Recommendation,
  RecommendationEvidence,
  RecommendationPriority,
} from "@/types";

const CATEGORIES: PromptCategory[] = [
  "discovery",
  "comparison",
  "use_case",
  "niche",
  "purchase",
];

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  discovery: "discovery",
  comparison: "comparison",
  use_case: "use case",
  niche: "niche",
  purchase: "purchase intent",
};

const CATEGORY_PRIORITY: Record<PromptCategory, number> = {
  purchase: 0,
  comparison: 1,
  use_case: 2,
  discovery: 3,
  niche: 4,
};

const PRIORITY_WEIGHT: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, maxLength: number): string {
  const t = compactText(text);
  if (t.length <= maxLength) return t;
  return `${t.slice(0, maxLength - 1).trimEnd()}...`;
}

function titleCase(text: string): string {
  const smallWords = new Set(["a", "an", "and", "at", "for", "from", "in", "of", "or", "the", "to", "with"]);
  return compactText(text)
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (lower === "vs") return "vs";
      if (index > 0 && smallWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function promptToTitleBase(prompt: string): string {
  const withoutPunctuation = compactText(prompt).replace(/[?!.,;:]+$/g, "");
  const normalized = withoutPunctuation
    .replace(/^what are the best\s+/i, "Best ")
    .replace(/^what is the best\s+/i, "Best ")
    .replace(/^which\s+/i, "Which ")
    .replace(/^how do i\s+/i, "How to ")
    .replace(/^how can i\s+/i, "How to ")
    .replace(/^is there an?\s+/i, "")
    .replace(/^should i\s+/i, "Should You ");
  return titleCase(normalized || prompt);
}

function contentTitleForPrompt(
  company: CompanyInput,
  prompt: string,
  competitor?: string,
): string {
  if (competitor) {
    return `${company.companyName} vs ${competitor}: Feature, Pricing, and Best-Fit Guide`;
  }

  return `${promptToTitleBase(prompt)}: Where ${company.companyName} Fits`;
}

function resultSummaryForPrompt(promptAnalysis: PromptAnalysis): string {
  return (
    truncate(
      promptAnalysis.analysis.explanation ||
        promptAnalysis.analysis.usefulQuote ||
        promptAnalysis.response,
      220,
    ) || "No response summary was captured for this prompt."
  );
}

function evidenceForPrompt(promptAnalysis: PromptAnalysis): RecommendationEvidence {
  return {
    promptId: promptAnalysis.promptId,
    prompt: promptAnalysis.prompt,
    category: promptAnalysis.category,
    resultSummary: resultSummaryForPrompt(promptAnalysis),
    competitorMentions: promptAnalysis.analysis.mentionedCompetitors,
  };
}

function strongestCompetitorForPrompts(
  prompts: PromptAnalysis[],
  fallback: string | null = null,
): string | null {
  const counts = new Map<string, number>();
  for (const prompt of prompts) {
    for (const competitor of prompt.analysis.mentionedCompetitors) {
      counts.set(competitor, (counts.get(competitor) || 0) + 1);
    }
  }

  const strongest = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  return strongest?.[0] || fallback;
}

function missedPromptAnalyses(promptAnalyses: PromptAnalysis[]): PromptAnalysis[] {
  return promptAnalyses
    .filter(
      (p) =>
        p.analysis.competitorWon ||
        (!p.analysis.targetMentioned && p.analysis.mentionedCompetitors.length > 0),
    )
    .sort(
      (a, b) =>
        CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] ||
        b.analysis.mentionedCompetitors.length - a.analysis.mentionedCompetitors.length,
    );
}

function suggestedActionForPrompt(company: CompanyInput, promptAnalysis: PromptAnalysis): string {
  const competitor = strongestCompetitorForPrompts(
    [promptAnalysis],
    promptAnalysis.analysis.mentionedCompetitors[0] || null,
  );
  const pageTitle = contentTitleForPrompt(
    company,
    promptAnalysis.prompt,
    promptAnalysis.category === "comparison" ? competitor || undefined : undefined,
  );

  if (promptAnalysis.category === "comparison" && competitor) {
    return `Publish "${pageTitle}" and answer the exact comparison with criteria, best-fit users, pricing context, and where ${company.companyName} is different from ${competitor}.`;
  }

  return `Publish "${pageTitle}" and use the prompt wording as an H2, then give a direct answer that names ${company.companyName} as a relevant option.`;
}

function buildPositioningSummary(
  company: CompanyInput,
  promptAnalyses: PromptAnalysis[],
  visibilityByCategory: Record<PromptCategory, CategoryVisibility>,
): string {
  const mentionedDescriptions = promptAnalyses
    .filter((p) => p.analysis.targetMentioned && p.analysis.targetDescription)
    .map((p) => p.analysis.targetDescription)
    .slice(0, 3);

  const categoriesWithData = CATEGORIES.filter((c) => visibilityByCategory[c].total > 0);

  const strongest = categoriesWithData
    .map((cat) => ({ cat, percent: visibilityByCategory[cat].percent }))
    .filter((c) => c.percent > 0)
    .sort((a, b) => b.percent - a.percent)[0];

  const weakest = categoriesWithData
    .map((cat) => ({ cat, percent: visibilityByCategory[cat].percent }))
    .sort((a, b) => a.percent - b.percent)[0];

  if (mentionedDescriptions.length === 0) {
    return `AI assistants currently do not surface ${company.companyName} when asked about ${company.category}. Visibility is limited across the prompts tested.`;
  }

  const positioningHint = mentionedDescriptions[0];
  const strongHint = strongest
    ? `strongest in ${CATEGORY_LABEL[strongest.cat]} prompts`
    : "modest";
  const weakHint =
    weakest && weakest.cat !== strongest?.cat
      ? `weakest in ${CATEGORY_LABEL[weakest.cat]} prompts`
      : "";

  return (
    `AI assistants describe ${company.companyName} as: "${positioningHint}". ` +
    `Visibility is ${strongHint}${weakHint ? ", " + weakHint : ""}.`
  );
}

interface BaseStats {
  visibilityByCategory: Record<PromptCategory, CategoryVisibility>;
  shareOfVoice: { target: number; competitors: CompetitorStats[] };
  topCompetitor: { name: string; mentions: number } | null;
  topMissedOpportunities: AggregateStats["topMissedOpportunities"];
  possibleInaccuracies: AggregateStats["possibleInaccuracies"];
}

function buildRecommendations(
  company: CompanyInput,
  base: BaseStats,
  promptAnalyses: PromptAnalysis[],
): Recommendation[] {
  const recs: Recommendation[] = [];
  const targetName = company.companyName;
  const cat = base.visibilityByCategory;
  const missed = missedPromptAnalyses(promptAnalyses);
  const byPromptId = new Map(promptAnalyses.map((p) => [p.promptId, p]));
  const targetMissing = (category: PromptCategory) =>
    missed.filter((p) => p.category === category);
  const targetMentioned = (category: PromptCategory) =>
    promptAnalyses.filter((p) => p.category === category && p.analysis.targetMentioned);
  const promptEvidence = (items: PromptAnalysis[]) => items.slice(0, 3).map(evidenceForPrompt);
  const addRecommendation = (recommendation: Recommendation) => {
    if (recommendation.supportingPrompts.length > 0) {
      recs.push(recommendation);
    }
  };

  if (cat.discovery.total > 0 && cat.discovery.percent < 35) {
    const support = targetMissing("discovery");
    const primary = support[0];
    if (primary) {
      addRecommendation({
        id: "discovery-gap",
        title: "Win broad discovery prompts",
        priority: cat.discovery.percent === 0 ? "critical" : "high",
        action: `Start with "${contentTitleForPrompt(company, primary.prompt)}" so ${targetName} is present when assistants answer broad discovery questions.`,
        contentIdeas: support.slice(0, 3).map((p) => contentTitleForPrompt(company, p.prompt)),
        supportingPrompts: promptEvidence(support),
      });
    }
  }

  if (
    cat.comparison.total > 0 &&
    cat.comparison.percent < 50 &&
    (company.competitors || []).length > 0
  ) {
    const comparisonPrompts = promptAnalyses.filter((p) => p.category === "comparison");
    const comparisonMisses = targetMissing("comparison");
    const strongestComparisonCompetitor = strongestCompetitorForPrompts(
      comparisonPrompts,
      base.topCompetitor?.name || (company.competitors || [])[0] || null,
    );

    if (strongestComparisonCompetitor) {
      const support = comparisonMisses.length > 0 ? comparisonMisses : comparisonPrompts;
      addRecommendation({
        id: "comparison-gap",
        title: `Create the ${strongestComparisonCompetitor} comparison page`,
        priority: cat.comparison.percent === 0 ? "critical" : "high",
        action: `Publish "${contentTitleForPrompt(company, "", strongestComparisonCompetitor)}" because ${strongestComparisonCompetitor} is the strongest competitor in comparison prompts.`,
        contentIdeas: [
          `${targetName} vs ${strongestComparisonCompetitor}: Feature, Pricing, and Best-Fit Guide`,
          `Alternatives to ${strongestComparisonCompetitor}: Where ${targetName} Fits`,
          `${strongestComparisonCompetitor} vs ${targetName}: Which Users Should Choose Each`,
        ],
        supportingPrompts: promptEvidence(
          support.filter((p) =>
            p.analysis.mentionedCompetitors.includes(strongestComparisonCompetitor),
          ).length > 0
            ? support.filter((p) =>
                p.analysis.mentionedCompetitors.includes(strongestComparisonCompetitor),
              )
            : support,
        ),
      });
    }
  }

  if (cat.niche.percent >= 50) {
    const support = targetMentioned("niche");
    const primary = support[0];
    if (primary) {
      addRecommendation({
        id: "niche-strength",
        title: "Expand the niche pages that already work",
        priority: "low",
        action: `Use "${contentTitleForPrompt(company, primary.prompt)}" as a template for more focused pages that repeat the niche positioning assistants already understand.`,
        contentIdeas: support.slice(0, 3).map((p) => contentTitleForPrompt(company, p.prompt)),
        supportingPrompts: promptEvidence(support),
      });
    }
  }

  if (base.topMissedOpportunities.length > 0) {
    const support = base.topMissedOpportunities
      .map((m) => byPromptId.get(m.promptId))
      .filter((p): p is PromptAnalysis => Boolean(p));
    const primary = base.topMissedOpportunities[0];
    if (primary) {
      addRecommendation({
        id: "missed-opportunities",
        title: "Answer the highest-leverage missed prompts",
        priority: base.topMissedOpportunities.length >= 5 ? "critical" : "high",
        action: `Create content for "${primary.prompt}" first; competitors are present in the result and ${targetName} is missing.`,
        contentIdeas: base.topMissedOpportunities
          .slice(0, 3)
          .map((m) => m.suggestedPageTitle),
        supportingPrompts: promptEvidence(support),
      });
    }
  }

  if (base.possibleInaccuracies.length > 0) {
    const support = base.possibleInaccuracies
      .map((entry) => byPromptId.get(entry.promptId))
      .filter((p): p is PromptAnalysis => Boolean(p));
    const first = base.possibleInaccuracies[0];
    addRecommendation({
      id: "accuracy-clarifications",
      title: "Clarify facts assistants may be getting wrong",
      priority: base.possibleInaccuracies.length >= 3 ? "high" : "medium",
      action: `Add or update FAQ copy for "${first.prompt}" and explicitly state the correct facts flagged in the analysis.`,
      contentIdeas: base.possibleInaccuracies.slice(0, 3).map((entry) => {
        const topic = promptToTitleBase(entry.prompt);
        return `FAQ: ${topic}`;
      }),
      supportingPrompts: promptEvidence(support),
    });
  }

  if (
    base.shareOfVoice.target < 15 &&
    base.shareOfVoice.competitors.some((c) => c.share > base.shareOfVoice.target * 2)
  ) {
    const strongest = base.shareOfVoice.competitors
      .slice()
      .sort((a, b) => b.share - a.share || b.mentions - a.mentions)[0];
    const support = strongest
      ? promptAnalyses.filter((p) => p.analysis.mentionedCompetitors.includes(strongest.competitor))
      : missed;

    if (strongest) {
      addRecommendation({
        id: "share-of-voice",
        title: `Close the share-of-voice gap with ${strongest.competitor}`,
        priority: "high",
        action: `Prioritize pages and third-party mentions that place ${targetName} beside ${strongest.competitor}; ${strongest.competitor} holds ${strongest.share}% share of voice in this audit.`,
        contentIdeas: [
          `Alternatives to ${strongest.competitor}: Where ${targetName} Fits`,
          `${targetName} vs ${strongest.competitor}: Feature, Pricing, and Best-Fit Guide`,
          `Why ${targetName} Should Be Included in Evaluation Shortlists`,
        ],
        supportingPrompts: promptEvidence(support),
      });
    }
  }

  if (recs.length === 0 && promptAnalyses.length > 0) {
    const support = promptAnalyses
      .filter((p) => p.analysis.targetMentioned)
      .slice(0, 3);
    addRecommendation({
      id: "monitor-positioning",
      title: "Keep reinforcing the pages that are working",
      priority: "low",
      action: `Visibility looks healthy across the tested categories. Refresh the pages behind the strongest prompts and monitor how assistants describe ${targetName} over time.`,
      contentIdeas: support.map((p) => contentTitleForPrompt(company, p.prompt)),
      supportingPrompts: promptEvidence(support),
    });
  }

  return recs.sort(
    (a, b) =>
      PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] ||
      a.title.localeCompare(b.title),
  );
}

export function aggregateAnalyses(
  company: CompanyInput,
  promptAnalyses: PromptAnalysis[],
): AggregateStats {
  const total = promptAnalyses.length || 1;
  const mentioned = promptAnalyses.filter((p) => p.analysis.targetMentioned);
  const visibilityScore = Math.round((mentioned.length / total) * 100);

  const visibilityByCategory = CATEGORIES.reduce(
    (acc, category) => {
      const items = promptAnalyses.filter((p) => p.category === category);
      const hits = items.filter((p) => p.analysis.targetMentioned).length;
      acc[category] = {
        mentioned: hits,
        total: items.length,
        percent: items.length ? Math.round((hits / items.length) * 100) : 0,
      };
      return acc;
    },
    {} as Record<PromptCategory, CategoryVisibility>,
  );

  const ranks = mentioned
    .map((p) => p.analysis.targetRank)
    .filter((rank): rank is number => rank !== null);
  const averageRank =
    ranks.length > 0
      ? Number((ranks.reduce((s, v) => s + v, 0) / ranks.length).toFixed(2))
      : null;

  const competitorMentionCounts: Record<string, number> = {};
  (company.competitors || []).forEach((competitor) => {
    competitorMentionCounts[competitor] = promptAnalyses.filter((p) =>
      p.analysis.mentionedCompetitors.includes(competitor),
    ).length;
  });

  const totalMentions =
    mentioned.length +
    Object.values(competitorMentionCounts).reduce((s, v) => s + v, 0);

  const competitorShares: CompetitorStats[] = Object.entries(competitorMentionCounts).map(
    ([competitor, mentionsCount]) => ({
      competitor,
      mentions: mentionsCount,
      share: totalMentions ? Math.round((mentionsCount / totalMentions) * 100) : 0,
    }),
  );

  const targetShare = totalMentions
    ? Math.round((mentioned.length / totalMentions) * 100)
    : 0;

  const topCompetitorEntry = competitorShares
    .slice()
    .sort((a, b) => b.mentions - a.mentions)[0];
  const topCompetitor =
    topCompetitorEntry && topCompetitorEntry.mentions > 0
      ? { name: topCompetitorEntry.competitor, mentions: topCompetitorEntry.mentions }
      : null;

  const promptsWhereCompetitorWins = promptAnalyses
    .filter((p) => p.analysis.competitorWon)
    .map((p) => ({
      promptId: p.promptId,
      prompt: p.prompt,
      winningCompetitor:
        strongestCompetitorForPrompts([p], p.analysis.mentionedCompetitors[0] || null) || "",
    }));

  const sortedCategories = [...CATEGORIES].sort(
    (a, b) => visibilityByCategory[b].percent - visibilityByCategory[a].percent,
  );

  const extractedDescriptions = mentioned
    .map((p) => p.analysis.targetDescription || p.analysis.usefulQuote)
    .filter((q): q is string => Boolean(q))
    .filter((q, i, arr) => arr.indexOf(q) === i)
    .slice(0, 6);

  const topMissedOpportunities = promptAnalyses
    .filter((p) => p.analysis.competitorWon)
    .sort(
      (a, b) =>
        CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] ||
        b.analysis.mentionedCompetitors.length - a.analysis.mentionedCompetitors.length,
    )
    .slice(0, 8)
    .map((p) => {
      const strongestCompetitor =
        strongestCompetitorForPrompts([p], p.analysis.mentionedCompetitors[0] || null) || "";
      return {
        promptId: p.promptId,
        prompt: p.prompt,
        category: p.category,
        competitorMentions: p.analysis.mentionedCompetitors,
        explanation: p.analysis.explanation,
        resultSummary: resultSummaryForPrompt(p),
        suggestedPageTitle: contentTitleForPrompt(
          company,
          p.prompt,
          p.category === "comparison" ? strongestCompetitor || undefined : undefined,
        ),
        suggestedAction: suggestedActionForPrompt(company, p),
        strongestCompetitor,
      };
    });

  const possibleInaccuracies = promptAnalyses
    .filter((p) => p.analysis.possibleInaccuracies.length > 0)
    .map((p) => ({
      promptId: p.promptId,
      prompt: p.prompt,
      items: p.analysis.possibleInaccuracies,
    }));

  const baseStats: BaseStats = {
    visibilityByCategory,
    shareOfVoice: { target: targetShare, competitors: competitorShares },
    topCompetitor,
    topMissedOpportunities,
    possibleInaccuracies,
  };

  const aiPositioningSummary = buildPositioningSummary(
    company,
    promptAnalyses,
    visibilityByCategory,
  );
  const recommendations = buildRecommendations(company, baseStats, promptAnalyses);

  return {
    visibilityScore,
    visibilityCount: { mentioned: mentioned.length, total },
    visibilityByCategory,
    averageRank,
    competitorMentionCounts,
    shareOfVoice: { target: targetShare, competitors: competitorShares },
    topCompetitor,
    promptsWhereCompetitorWins,
    bestPerformingCategory: sortedCategories[0],
    weakestCategory: sortedCategories[sortedCategories.length - 1],
    extractedDescriptions,
    topMissedOpportunities,
    possibleInaccuracies,
    aiPositioningSummary,
    recommendations,
  };
}
