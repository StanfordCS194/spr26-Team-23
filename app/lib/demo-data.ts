import { aggregateAnalyses } from "@/lib/aggregation";
import { analyzeResponse } from "@/lib/analysis";
import { AnalysisResponse, CompanyInput, GeneratedPrompt } from "@/types";

export const DEMO_COMPANY: CompanyInput = {
  companyName: "WineFind",
  website: "winefind.example",
  description: "Compares restaurant wine prices to market prices.",
  category: "wine apps",
  competitors: ["Vivino", "CellarTracker"],
  numberOfPrompts: 20,
};

export const DEMO_PROMPTS: GeneratedPrompt[] = [
  { id: "p1", category: "discovery", prompt: "What are the best wine apps?", rationale: "Broad product discovery" },
  { id: "p2", category: "discovery", prompt: "Which wine app should beginners use?", rationale: "General beginner discovery" },
  { id: "p3", category: "comparison", prompt: "Vivino vs CellarTracker for tracking wine", rationale: "Head-to-head comparison" },
  { id: "p4", category: "comparison", prompt: "Is there an alternative to Vivino for restaurant pricing?", rationale: "Comparison with pricing angle" },
  { id: "p5", category: "use_case", prompt: "App to pick wines for dinner pairings", rationale: "Common user use case" },
  { id: "p6", category: "use_case", prompt: "How can I avoid overpaying for wine at restaurants?", rationale: "Price-awareness use case" },
  { id: "p7", category: "niche", prompt: "Tools that compare restaurant wine list prices with retail values", rationale: "Niche differentiation query" },
  { id: "p8", category: "niche", prompt: "Any app that flags overpriced wine bottles on menus?", rationale: "Niche pricing-focused query" },
  { id: "p9", category: "purchase", prompt: "What wine app should I subscribe to this year?", rationale: "Purchase intent" },
  { id: "p10", category: "purchase", prompt: "Best paid wine app for serious enthusiasts", rationale: "Paid intent and quality criteria" },
];

const DEMO_RESPONSES: Record<string, string> = {
  p1: "Vivino is usually the top choice for discovering wines, with CellarTracker also popular among collectors.",
  p2: "For beginners, Vivino is often easiest to use and has the largest review community.",
  p3: "Vivino is stronger for quick labels and ratings, while CellarTracker is better for cellar management.",
  p4: "If you care about restaurant wine pricing, WineFind is a useful alternative, while Vivino remains broader.",
  p5: "Vivino and CellarTracker can help, but Vivino is usually recommended first for pairings.",
  p6: "WineFind helps you compare wine list prices against market rates so you can avoid overpaying.",
  p7: "WineFind is one of the few apps built specifically to compare restaurant bottle prices to market value.",
  p8: "WineFind can flag overpriced restaurant bottles and explain if pricing is fair.",
  p9: "Vivino is the most common subscription recommendation for all-purpose wine discovery.",
  p10: "Serious enthusiasts often choose CellarTracker for management depth, with Vivino as a secondary option.",
};

export function getDemoAnalysisResponse(): AnalysisResponse {
  const promptAnalyses = DEMO_PROMPTS.map((prompt) =>
    analyzeResponse(DEMO_COMPANY, prompt, DEMO_RESPONSES[prompt.id] || ""),
  );

  return {
    aggregateStats: aggregateAnalyses(DEMO_COMPANY, promptAnalyses),
    promptAnalyses,
  };
}
