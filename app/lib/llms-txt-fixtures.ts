import { AnalysisResponse, CompanyInput } from "@/types";

/** Minimal Tunnel report for unit tests. */
export function minimalAnalysisFixture(): AnalysisResponse {
  const emptyCategory = { mentioned: 0, total: 0, percent: 0 };
  return {
    aggregateStats: {
      visibilityScore: 40,
      visibilityCount: { mentioned: 2, total: 5 },
      visibilityByCategory: {
        discovery: { mentioned: 1, total: 2, percent: 50 },
        comparison: emptyCategory,
        use_case: emptyCategory,
        niche: emptyCategory,
        purchase: { mentioned: 1, total: 3, percent: 33 },
      },
      averageRank: 2,
      competitorMentionCounts: { RivalCo: 3 },
      shareOfVoice: { target: 40, competitors: [] },
      topCompetitor: { name: "RivalCo", mentions: 3 },
      promptsWhereCompetitorWins: [],
      bestPerformingCategory: "discovery",
      weakestCategory: "purchase",
      extractedDescriptions: ["A sample AI description of Acme."],
      topMissedOpportunities: [
        {
          promptId: "p1",
          prompt: "best tools for widgets",
          category: "discovery",
          competitorMentions: ["RivalCo"],
          explanation: "Target not listed",
        },
      ],
      possibleInaccuracies: [],
      aiPositioningSummary: "Acme is mentioned occasionally in widget discussions.",
      recommendations: ["Add a comparison page"],
    },
    promptAnalyses: [],
  };
}

export function minimalCompanyFixture(): CompanyInput {
  return {
    companyName: "Acme Widgets",
    website: "acme.example",
    description: "We build widgets for teams.",
    category: "B2B SaaS",
    competitors: ["RivalCo"],
    numberOfPrompts: 5,
  };
}
