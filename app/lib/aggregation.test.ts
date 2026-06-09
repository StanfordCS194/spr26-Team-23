import { describe, expect, it } from "vitest";
import { aggregateAnalyses } from "@/lib/aggregation";
import {
  CompanyInput,
  PromptAnalysis,
  PromptAnalysisDetails,
  PromptCategory,
} from "@/types";

const company: CompanyInput = {
  companyName: "Wine Find",
  website: "winefind.ai",
  description:
    "Helps users compare restaurant and liquor store wine prices with market prices.",
  category: "wine apps / restaurant wine decision tools",
  competitors: ["Vivino", "CellarTracker", "Delectable"],
  numberOfPrompts: 6,
};

function promptAnalysis(
  id: string,
  category: PromptCategory,
  prompt: string,
  mentionedCompetitors: string[],
  targetMentioned = false,
): PromptAnalysis {
  const response = targetMentioned
    ? `Wine Find is useful for this search.`
    : `${mentionedCompetitors.join(" and ")} are recommended for this search.`;
  const analysis: PromptAnalysisDetails = {
    targetMentioned,
    targetRank: targetMentioned ? 1 : null,
    mentionedCompetitors,
    allMentionedCompanies: targetMentioned
      ? [company.companyName, ...mentionedCompetitors]
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

describe("aggregateAnalyses recommendations", () => {
  it("builds evidence-backed recommendations with concrete page titles", () => {
    const stats = aggregateAnalyses(company, [
      promptAnalysis("d1", "discovery", "What are the best wine apps in 2026?", [
        "Vivino",
      ]),
      promptAnalysis("d2", "discovery", "Best apps for wine lovers", ["Vivino"]),
      promptAnalysis("d3", "discovery", "Which wine app should I download first?", [
        "Vivino",
      ]),
      promptAnalysis("c1", "comparison", "Wine Find vs CellarTracker", [
        "CellarTracker",
      ]),
      promptAnalysis("c2", "comparison", "Alternatives to CellarTracker", [
        "CellarTracker",
      ]),
      promptAnalysis("c3", "comparison", "Vivino vs CellarTracker", [
        "Vivino",
        "CellarTracker",
      ]),
      promptAnalysis(
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
    const stats = aggregateAnalyses(company, [
      promptAnalysis("c1", "comparison", "Alternatives to CellarTracker", [
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
    expect(stats.topMissedOpportunities[0].resultSummary).toContain("Wine Find is absent");
  });
});
