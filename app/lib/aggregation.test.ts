import { describe, expect, it } from "vitest";
import { aggregateAnalyses } from "@/lib/aggregation";
import {
  CompanyInput,
  PromptAnalysis,
  PromptAnalysisDetails,
  PromptCategory,
  Sentiment,
} from "@/types";

const acmeCompany: CompanyInput = {
  companyName: "Acme Analytics",
  website: "https://acme.example",
  description: "Analytics for operations teams.",
  category: "analytics tools",
  competitors: ["Beta BI", "Gamma Metrics"],
  numberOfPrompts: 5,
};

const wineCompany: CompanyInput = {
  companyName: "Wine Find",
  website: "winefind.ai",
  description:
    "Helps users compare restaurant and liquor store wine prices with market prices.",
  category: "wine apps / restaurant wine decision tools",
  competitors: ["Vivino", "CellarTracker", "Delectable"],
  numberOfPrompts: 6,
};

function acmeAnalysisDetails(
  overrides: Partial<PromptAnalysisDetails> = {},
): PromptAnalysisDetails {
  const targetMentioned = overrides.targetMentioned ?? true;
  const sentiment: Sentiment =
    overrides.sentiment ?? (targetMentioned ? "neutral" : "not_mentioned");

  return {
    targetMentioned,
    targetRank: targetMentioned ? 1 : null,
    mentionedCompetitors: [],
    allMentionedCompanies: targetMentioned ? [acmeCompany.companyName] : [],
    sentiment,
    targetDescription: targetMentioned
      ? "Acme Analytics is described as useful."
      : "",
    possibleInaccuracies: [],
    competitorWon: false,
    explanation: targetMentioned
      ? "Acme Analytics appears in the response."
      : "Acme Analytics is absent.",
    usefulQuote: targetMentioned ? "Acme Analytics is useful." : "",
    ...overrides,
  };
}

function acmePromptAnalysis(
  id: string,
  category: PromptCategory,
  overrides: Partial<PromptAnalysisDetails> = {},
): PromptAnalysis {
  return {
    promptId: id,
    prompt: `Prompt ${id}`,
    category,
    rationale: `Rationale ${id}`,
    response: `Response ${id}`,
    analysis: acmeAnalysisDetails(overrides),
  };
}

function winePromptAnalysis(
  id: string,
  category: PromptCategory,
  prompt: string,
  mentionedCompetitors: string[],
  targetMentioned = false,
): PromptAnalysis {
  const response = targetMentioned
    ? "Wine Find is useful for this search."
    : `${mentionedCompetitors.join(" and ")} are recommended for this search.`;
  const analysis: PromptAnalysisDetails = {
    targetMentioned,
    targetRank: targetMentioned ? 1 : null,
    mentionedCompetitors,
    allMentionedCompanies: targetMentioned
      ? [wineCompany.companyName, ...mentionedCompetitors]
      : mentionedCompetitors,
    sentiment: targetMentioned ? "positive" : "not_mentioned",
    targetDescription: targetMentioned
      ? "A tool for comparing wine prices at restaurants."
      : "",
    possibleInaccuracies: [],
    competitorWon: !targetMentioned && mentionedCompetitors.length > 0,
    explanation: targetMentioned
      ? "Wine Find appears in the answer."
      : `Wine Find is absent while ${mentionedCompetitors.join(" and ")} are discussed.`,
    usefulQuote: response,
  };

  return {
    promptId: id,
    prompt,
    category,
    rationale: "Test prompt",
    response,
    analysis,
  };
}

describe("aggregateAnalyses", () => {
  it("computes visibility, rank, competitor, and opportunity metrics", () => {
    const stats = aggregateAnalyses(acmeCompany, [
      acmePromptAnalysis("p1", "discovery", {
        targetRank: 1,
        sentiment: "positive",
        mentionedCompetitors: ["Beta BI"],
        allMentionedCompanies: ["Acme Analytics", "Beta BI"],
        targetDescription: "Acme Analytics is excellent for operations teams.",
      }),
      acmePromptAnalysis("p2", "comparison", {
        targetMentioned: false,
        targetRank: null,
        sentiment: "not_mentioned",
        mentionedCompetitors: ["Beta BI"],
        allMentionedCompanies: ["Beta BI"],
        competitorWon: true,
        explanation: "Beta BI appears while Acme Analytics is missing.",
      }),
      acmePromptAnalysis("p3", "use_case", {
        targetRank: 2,
        mentionedCompetitors: ["Gamma Metrics"],
        allMentionedCompanies: ["Gamma Metrics", "Acme Analytics"],
        targetDescription: "Acme Analytics handles operational reporting.",
      }),
      acmePromptAnalysis("p4", "niche", {
        targetRank: 1,
        targetDescription: "Acme Analytics helps niche operations teams.",
        possibleInaccuracies: ["Claims an unsupported pricing model."],
      }),
      acmePromptAnalysis("p5", "purchase", {
        targetMentioned: false,
        targetRank: null,
        sentiment: "not_mentioned",
      }),
    ]);

    expect(stats.visibilityScore).toBe(60);
    expect(stats.visibilityCount).toEqual({ mentioned: 3, total: 5 });
    expect(stats.averageRank).toBe(1.33);
    expect(stats.visibilityByCategory.discovery).toEqual({
      mentioned: 1,
      total: 1,
      percent: 100,
    });
    expect(stats.visibilityByCategory.comparison.percent).toBe(0);
    expect(stats.competitorMentionCounts).toEqual({
      "Beta BI": 2,
      "Gamma Metrics": 1,
    });
    expect(stats.shareOfVoice.target).toBe(50);
    expect(stats.shareOfVoice.competitors).toEqual([
      { competitor: "Beta BI", mentions: 2, share: 33 },
      { competitor: "Gamma Metrics", mentions: 1, share: 17 },
    ]);
    expect(stats.topCompetitor).toEqual({ name: "Beta BI", mentions: 2 });
    expect(stats.topMissedOpportunities).toHaveLength(1);
    expect(stats.topMissedOpportunities[0]).toMatchObject({
      promptId: "p2",
      prompt: "Prompt p2",
      category: "comparison",
      competitorMentions: ["Beta BI"],
      explanation: "Beta BI appears while Acme Analytics is missing.",
      strongestCompetitor: "Beta BI",
    });
    expect(stats.topMissedOpportunities[0].suggestedPageTitle).toBe(
      "Acme Analytics vs Beta BI: Feature, Pricing, and Best-Fit Guide",
    );
    expect(stats.possibleInaccuracies).toEqual([
      {
        promptId: "p4",
        prompt: "Prompt p4",
        items: ["Claims an unsupported pricing model."],
      },
    ]);
  });

  it("recommends actions from weak categories, missed opportunities, and inaccuracies", () => {
    const stats = aggregateAnalyses(acmeCompany, [
      acmePromptAnalysis("p1", "discovery", {
        targetMentioned: false,
        targetRank: null,
        sentiment: "not_mentioned",
        mentionedCompetitors: ["Beta BI"],
        allMentionedCompanies: ["Beta BI"],
        competitorWon: true,
        explanation: "Beta BI appears while Acme Analytics is missing.",
      }),
      acmePromptAnalysis("p2", "comparison", {
        targetMentioned: false,
        targetRank: null,
        sentiment: "not_mentioned",
        mentionedCompetitors: ["Beta BI"],
        allMentionedCompanies: ["Beta BI"],
        competitorWon: true,
        explanation: "Beta BI appears while Acme Analytics is missing.",
      }),
      acmePromptAnalysis("p3", "niche", {
        targetRank: 1,
        possibleInaccuracies: ["Mentions an unsupported integration."],
      }),
    ]);

    expect(stats.recommendations.every((r) => r.supportingPrompts.length > 0)).toBe(
      true,
    );

    const recommendationsById = new Map(
      stats.recommendations.map((recommendation) => [
        recommendation.id,
        recommendation,
      ]),
    );

    expect(recommendationsById.get("discovery-gap")).toMatchObject({
      title: "Win broad discovery prompts",
      priority: "critical",
    });
    expect(recommendationsById.get("discovery-gap")?.action).toContain(
      "Prompt P1: Where Acme Analytics Fits",
    );
    expect(recommendationsById.get("comparison-gap")?.action).toContain(
      "Beta BI",
    );
    expect(recommendationsById.get("niche-strength")?.action).toContain(
      "Acme Analytics",
    );
    expect(recommendationsById.get("missed-opportunities")?.contentIdeas).toContain(
      "Acme Analytics vs Beta BI: Feature, Pricing, and Best-Fit Guide",
    );
    expect(recommendationsById.get("accuracy-clarifications")?.contentIdeas).toContain(
      "FAQ: Prompt P3",
    );
  });
});

describe("aggregateAnalyses recommendations", () => {
  it("builds evidence-backed recommendations with concrete page titles", () => {
    const stats = aggregateAnalyses(wineCompany, [
      winePromptAnalysis("d1", "discovery", "What are the best wine apps in 2026?", [
        "Vivino",
      ]),
      winePromptAnalysis("d2", "discovery", "Best apps for wine lovers", [
        "Vivino",
      ]),
      winePromptAnalysis("d3", "discovery", "Which wine app should I download first?", [
        "Vivino",
      ]),
      winePromptAnalysis("c1", "comparison", "Wine Find vs CellarTracker", [
        "CellarTracker",
      ]),
      winePromptAnalysis("c2", "comparison", "Alternatives to CellarTracker", [
        "CellarTracker",
      ]),
      winePromptAnalysis("c3", "comparison", "Vivino vs CellarTracker", [
        "Vivino",
        "CellarTracker",
      ]),
      winePromptAnalysis(
        "n1",
        "niche",
        "Tools to compare restaurant wine prices to retail",
        [],
        true,
      ),
    ]);

    expect(stats.topCompetitor?.name).toBe("Vivino");
    expect(stats.recommendations.length).toBeGreaterThan(0);
    expect(stats.recommendations.every((r) => r.supportingPrompts.length > 0)).toBe(
      true,
    );
    expect(stats.recommendations.every((r) => r.priority)).toBe(true);

    const comparisonRecommendation = stats.recommendations.find(
      (r) => r.id === "comparison-gap",
    );
    expect(comparisonRecommendation?.title).toContain("CellarTracker");
    expect(comparisonRecommendation?.action).toContain("CellarTracker");
    expect(comparisonRecommendation?.contentIdeas[0]).toContain(
      "Wine Find vs CellarTracker",
    );
    expect(
      comparisonRecommendation?.supportingPrompts.every((p) =>
        p.competitorMentions.includes("CellarTracker"),
      ),
    ).toBe(true);

    const serialized = JSON.stringify(stats.recommendations);
    expect(serialized).not.toContain("best wine apps / restaurant wine decision tools");
  });

  it("adds concrete next actions to missed opportunities", () => {
    const stats = aggregateAnalyses(wineCompany, [
      winePromptAnalysis("c1", "comparison", "Alternatives to CellarTracker", [
        "CellarTracker",
      ]),
    ]);

    expect(stats.topMissedOpportunities[0]).toMatchObject({
      promptId: "c1",
      strongestCompetitor: "CellarTracker",
      suggestedPageTitle:
        "Wine Find vs CellarTracker: Feature, Pricing, and Best-Fit Guide",
    });
    expect(stats.topMissedOpportunities[0].suggestedAction).toContain(
      "answer the exact comparison",
    );
    expect(stats.topMissedOpportunities[0].resultSummary).toContain(
      "Wine Find is absent",
    );
  });
});
