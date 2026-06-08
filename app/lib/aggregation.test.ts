import { describe, expect, it } from "vitest";
import { aggregateAnalyses } from "@/lib/aggregation";
import {
  CompanyInput,
  PromptAnalysis,
  PromptAnalysisDetails,
  PromptCategory,
  Sentiment,
} from "@/types";

const company: CompanyInput = {
  companyName: "Acme Analytics",
  website: "https://acme.example",
  description: "Analytics for operations teams.",
  category: "analytics tools",
  competitors: ["Beta BI", "Gamma Metrics"],
  numberOfPrompts: 5,
};

function analysisDetails(
  overrides: Partial<PromptAnalysisDetails> = {},
): PromptAnalysisDetails {
  const targetMentioned = overrides.targetMentioned ?? true;
  const sentiment: Sentiment =
    overrides.sentiment ?? (targetMentioned ? "neutral" : "not_mentioned");

  return {
    targetMentioned,
    targetRank: targetMentioned ? 1 : null,
    mentionedCompetitors: [],
    allMentionedCompanies: targetMentioned ? [company.companyName] : [],
    sentiment,
    targetDescription: targetMentioned ? "Acme Analytics is described as useful." : "",
    possibleInaccuracies: [],
    competitorWon: false,
    explanation: targetMentioned
      ? "Acme Analytics appears in the response."
      : "Acme Analytics is absent.",
    usefulQuote: targetMentioned ? "Acme Analytics is useful." : "",
    ...overrides,
  };
}

function promptAnalysis(
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
    analysis: analysisDetails(overrides),
  };
}

describe("aggregateAnalyses", () => {
  it("computes visibility, rank, competitor, and opportunity metrics", () => {
    const stats = aggregateAnalyses(company, [
      promptAnalysis("p1", "discovery", {
        targetRank: 1,
        sentiment: "positive",
        mentionedCompetitors: ["Beta BI"],
        allMentionedCompanies: ["Acme Analytics", "Beta BI"],
        targetDescription: "Acme Analytics is excellent for operations teams.",
      }),
      promptAnalysis("p2", "comparison", {
        targetMentioned: false,
        targetRank: null,
        sentiment: "not_mentioned",
        mentionedCompetitors: ["Beta BI"],
        allMentionedCompanies: ["Beta BI"],
        competitorWon: true,
        explanation: "Beta BI appears while Acme Analytics is missing.",
      }),
      promptAnalysis("p3", "use_case", {
        targetRank: 2,
        mentionedCompetitors: ["Gamma Metrics"],
        allMentionedCompanies: ["Gamma Metrics", "Acme Analytics"],
        targetDescription: "Acme Analytics handles operational reporting.",
      }),
      promptAnalysis("p4", "niche", {
        targetRank: 1,
        targetDescription: "Acme Analytics helps niche operations teams.",
        possibleInaccuracies: ["Claims an unsupported pricing model."],
      }),
      promptAnalysis("p5", "purchase", {
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
    expect(stats.topMissedOpportunities).toEqual([
      {
        promptId: "p2",
        prompt: "Prompt p2",
        category: "comparison",
        competitorMentions: ["Beta BI"],
        explanation: "Beta BI appears while Acme Analytics is missing.",
      },
    ]);
    expect(stats.possibleInaccuracies).toEqual([
      {
        promptId: "p4",
        prompt: "Prompt p4",
        items: ["Claims an unsupported pricing model."],
      },
    ]);
  });

  it("recommends actions from weak categories, missed opportunities, and inaccuracies", () => {
    const stats = aggregateAnalyses(company, [
      promptAnalysis("p1", "discovery", {
        targetMentioned: false,
        targetRank: null,
        sentiment: "not_mentioned",
      }),
      promptAnalysis("p2", "comparison", {
        targetMentioned: false,
        targetRank: null,
        sentiment: "not_mentioned",
        mentionedCompetitors: ["Beta BI"],
        allMentionedCompanies: ["Beta BI"],
        competitorWon: true,
        explanation: "Beta BI appears while Acme Analytics is missing.",
      }),
      promptAnalysis("p3", "niche", {
        targetRank: 1,
        possibleInaccuracies: ["Mentions an unsupported integration."],
      }),
    ]);

    expect(stats.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Create content around broad discovery terms"),
        expect.stringContaining('"Acme Analytics vs Beta BI"'),
        expect.stringContaining("Niche queries are working well"),
        expect.stringContaining("1 missed-opportunity prompts"),
        expect.stringContaining("Possible inaccuracies were flagged"),
      ]),
    );
  });
});
