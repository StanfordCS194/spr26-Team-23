import { describe, expect, it } from "vitest";
import { deterministicAnalyze } from "@/lib/analysis";
import { CompanyInput, GeneratedPrompt } from "@/types";

const company: CompanyInput = {
  companyName: "Acme Analytics",
  website: "https://acme.example",
  description: "Analytics for operations teams.",
  category: "analytics tools",
  competitors: ["Beta BI", "Gamma Metrics"],
  numberOfPrompts: 3,
};

const prompt: GeneratedPrompt = {
  id: "p1",
  category: "discovery",
  prompt: "What are the best analytics tools?",
  rationale: "Broad category discovery.",
};

describe("deterministicAnalyze", () => {
  it("detects mentioned companies case-insensitively and ranks them by first appearance", () => {
    const result = deterministicAnalyze(
      company,
      prompt,
      "Beta BI is popular. Acme Analytics is an excellent option. Gamma Metrics is broader.",
    );

    expect(result.targetMentioned).toBe(true);
    expect(result.targetRank).toBe(2);
    expect(result.allMentionedCompanies).toEqual([
      "Beta BI",
      "Acme Analytics",
      "Gamma Metrics",
    ]);
    expect(result.mentionedCompetitors).toEqual(["Beta BI", "Gamma Metrics"]);
    expect(result.sentiment).toBe("positive");
    expect(result.competitorWon).toBe(false);
  });

  it("marks a competitor win when competitors are mentioned and the target is absent", () => {
    const result = deterministicAnalyze(
      company,
      prompt,
      "For most operations teams, gamma metrics is recommended because it has strong dashboards.",
    );

    expect(result.targetMentioned).toBe(false);
    expect(result.targetRank).toBeNull();
    expect(result.allMentionedCompanies).toEqual(["Gamma Metrics"]);
    expect(result.mentionedCompetitors).toEqual(["Gamma Metrics"]);
    expect(result.sentiment).toBe("not_mentioned");
    expect(result.competitorWon).toBe(true);
  });
});
