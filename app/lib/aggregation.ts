import {
  AggregateStats,
  CompanyInput,
  CompetitorStats,
  PromptAnalysis,
  PromptCategory,
} from "@/types";

const CATEGORIES: PromptCategory[] = [
  "discovery",
  "comparison",
  "use_case",
  "niche",
  "purchase",
];

export function aggregateAnalyses(
  company: CompanyInput,
  promptAnalyses: PromptAnalysis[],
): AggregateStats {
  const total = promptAnalyses.length || 1;
  const mentioned = promptAnalyses.filter((p) => p.analysis.targetMentioned);
  const visibilityScore = Math.round((mentioned.length / total) * 100);

  const visibilityByCategory = CATEGORIES.reduce(
    (acc, category) => {
      const categoryPrompts = promptAnalyses.filter((p) => p.category === category);
      const hits = categoryPrompts.filter((p) => p.analysis.targetMentioned).length;
      acc[category] = categoryPrompts.length
        ? Math.round((hits / categoryPrompts.length) * 100)
        : 0;
      return acc;
    },
    {} as Record<PromptCategory, number>,
  );

  const ranks = mentioned
    .map((p) => p.analysis.targetRank)
    .filter((rank): rank is number => rank !== null);

  const averageRank =
    ranks.length > 0
      ? Number((ranks.reduce((sum, value) => sum + value, 0) / ranks.length).toFixed(2))
      : null;

  const competitorMentionCounts: Record<string, number> = {};
  (company.competitors || []).forEach((competitor) => {
    competitorMentionCounts[competitor] = promptAnalyses.filter((p) =>
      p.analysis.mentionedCompetitors.includes(competitor),
    ).length;
  });

  const totalMentions =
    mentioned.length +
    Object.values(competitorMentionCounts).reduce((sum, count) => sum + count, 0);

  const competitorShares: CompetitorStats[] = Object.entries(competitorMentionCounts).map(
    ([competitor, mentions]) => ({
      competitor,
      mentions,
      share: totalMentions ? Math.round((mentions / totalMentions) * 100) : 0,
    }),
  );

  const targetShare = totalMentions ? Math.round((mentioned.length / totalMentions) * 100) : 0;

  const promptsWhereCompetitorWins = promptAnalyses
    .filter((p) => !p.analysis.targetMentioned && p.analysis.mentionedCompetitors.length > 0)
    .map((p) => ({
      promptId: p.promptId,
      prompt: p.prompt,
      winningCompetitor: p.analysis.mentionedCompetitors[0],
    }));

  const sortedCategories = [...CATEGORIES].sort(
    (a, b) => visibilityByCategory[b] - visibilityByCategory[a],
  );

  const extractedDescriptions = mentioned
    .map((p) => p.analysis.usefulQuote)
    .filter((quote, idx, arr) => quote && arr.indexOf(quote) === idx)
    .slice(0, 6);

  const topMissedOpportunities = promptAnalyses
    .filter((p) => !p.analysis.targetMentioned && p.analysis.mentionedCompetitors.length > 0)
    .slice(0, 6)
    .map((p) => ({
      promptId: p.promptId,
      prompt: p.prompt,
      category: p.category,
      competitorMentions: p.analysis.mentionedCompetitors,
    }));

  return {
    visibilityScore,
    visibilityByCategory,
    averageRank,
    competitorMentionCounts,
    shareOfVoice: {
      target: targetShare,
      competitors: competitorShares,
    },
    promptsWhereCompetitorWins,
    bestPerformingCategory: sortedCategories[0],
    weakestCategory: sortedCategories[sortedCategories.length - 1],
    extractedDescriptions,
    topMissedOpportunities,
  };
}
