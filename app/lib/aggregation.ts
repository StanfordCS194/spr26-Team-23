import {
  AggregateStats,
  CategoryVisibility,
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

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  discovery: "discovery",
  comparison: "comparison",
  use_case: "use case",
  niche: "niche",
  purchase: "purchase intent",
};

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

function buildRecommendations(company: CompanyInput, base: BaseStats): string[] {
  const recs: string[] = [];
  const targetName = company.companyName;
  const cat = base.visibilityByCategory;

  if (cat.discovery.total > 0 && cat.discovery.percent < 35) {
    recs.push(
      `Create content around broad discovery terms in ${company.category} (e.g. "best ${company.category}") so ${targetName} starts surfacing in top-level recommendations.`,
    );
  }

  if (
    cat.comparison.total > 0 &&
    cat.comparison.percent < 50 &&
    (company.competitors || []).length > 0
  ) {
    const top = base.topCompetitor?.name || (company.competitors || [])[0];
    if (top) {
      recs.push(
        `Build dedicated comparison pages such as "${targetName} vs ${top}" — comparison prompts repeatedly cite alternatives.`,
      );
    }
  }

  if (cat.niche.percent >= 50) {
    recs.push(
      `Niche queries are working well for ${targetName}. Double down on niche positioning copy and keep producing differentiated content there.`,
    );
  }

  if (base.topMissedOpportunities.length > 0) {
    recs.push(
      `Address ${base.topMissedOpportunities.length} missed-opportunity prompts where competitors appear and ${targetName} is missing — these are high-leverage content opportunities.`,
    );
  }

  if (base.possibleInaccuracies.length > 0) {
    recs.push(
      `Possible inaccuracies were flagged in AI responses. Update public website copy and FAQs so models pick up the correct information.`,
    );
  }

  if (
    base.shareOfVoice.target < 15 &&
    base.shareOfVoice.competitors.some((c) => c.share > base.shareOfVoice.target * 2)
  ) {
    recs.push(
      `Share of voice is low. Increase external mentions: guides, listicles, and category content that name ${targetName} alongside competitors.`,
    );
  }

  if (recs.length === 0) {
    recs.push(
      `Visibility looks healthy across categories. Keep producing differentiated content and monitor how AI describes ${targetName} over time.`,
    );
  }

  return recs;
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
      winningCompetitor: p.analysis.mentionedCompetitors[0] || "",
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
    .slice(0, 8)
    .map((p) => ({
      promptId: p.promptId,
      prompt: p.prompt,
      category: p.category,
      competitorMentions: p.analysis.mentionedCompetitors,
      explanation: p.analysis.explanation ?? "",
    }));

  const possibleInaccuracies = promptAnalyses
    .filter((p) => (p.analysis.possibleInaccuracies ?? []).length > 0)
    .map((p) => ({
      promptId: p.promptId,
      prompt: p.prompt,
      items: p.analysis.possibleInaccuracies ?? [],
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
  const recommendations = buildRecommendations(company, baseStats);

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
