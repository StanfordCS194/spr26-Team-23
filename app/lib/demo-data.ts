import { aggregateAnalyses } from "@/lib/aggregation";
import { deterministicAnalyze } from "@/lib/analysis";
import {
  AnalysisResponse,
  CompanyInput,
  GeneratedPrompt,
  PromptAnalysis,
  PromptAnalysisDetails,
} from "@/types";

export const DEMO_COMPANY: CompanyInput = {
  companyName: "Wine Find",
  website: "winefind.ai",
  description:
    "Helps users compare restaurant and liquor store wine prices with market prices and choose better-value wines.",
  category: "wine apps / restaurant wine decision tools",
  competitors: ["Vivino", "CellarTracker", "Delectable"],
  numberOfPrompts: 20,
};

export const DEMO_PROMPTS: GeneratedPrompt[] = [
  { id: "p1", category: "discovery", prompt: "What are the best wine apps in 2026?", rationale: "Broad category discovery." },
  { id: "p2", category: "discovery", prompt: "Best apps for wine lovers", rationale: "Generic discovery query." },
  { id: "p3", category: "discovery", prompt: "Which wine app should I download first?", rationale: "First-time user discovery." },
  { id: "p4", category: "discovery", prompt: "What apps help you learn about wine?", rationale: "Education-flavored discovery." },
  { id: "p5", category: "comparison", prompt: "Vivino vs CellarTracker", rationale: "Head-to-head competitor comparison." },
  { id: "p6", category: "comparison", prompt: "Alternatives to Vivino", rationale: "Competitor alternative search." },
  { id: "p7", category: "comparison", prompt: "Is there a Vivino alternative for restaurant pricing?", rationale: "Alternative tied to niche." },
  { id: "p8", category: "use_case", prompt: "How do I avoid overpaying for wine at a restaurant?", rationale: "Core use case." },
  { id: "p9", category: "use_case", prompt: "Apps to pick a wine off a restaurant menu", rationale: "Job-to-be-done use case." },
  { id: "p10", category: "use_case", prompt: "App to scan a wine list and compare prices", rationale: "Direct Wine Find use case." },
  { id: "p11", category: "niche", prompt: "Tools to compare restaurant wine prices to retail", rationale: "Niche differentiation." },
  { id: "p12", category: "niche", prompt: "App that flags overpriced wine at restaurants", rationale: "Niche pricing query." },
  { id: "p13", category: "niche", prompt: "How can I tell if a restaurant is marking up wine too much?", rationale: "Niche pricing query." },
  { id: "p14", category: "niche", prompt: "Best tool for transparency in restaurant wine pricing", rationale: "Niche price transparency." },
  { id: "p15", category: "purchase", prompt: "Which wine app is worth paying for in 2026?", rationale: "Paid intent." },
  { id: "p16", category: "purchase", prompt: "Most useful subscription wine app", rationale: "Subscription intent." },
  { id: "p17", category: "purchase", prompt: "Should I get Vivino Premium or something else?", rationale: "Specific purchase decision." },
  { id: "p18", category: "purchase", prompt: "Best wine app for sommelier-level enthusiasts", rationale: "Premium tier intent." },
  { id: "p19", category: "comparison", prompt: "Delectable vs Vivino vs CellarTracker", rationale: "Multi-competitor comparison." },
  { id: "p20", category: "use_case", prompt: "Best app for a date-night wine pick", rationale: "Casual use case." },
];

const DEMO_RESPONSES: Record<string, string> = {
  p1: "Vivino is the most popular wine app in 2026 with the largest review community. CellarTracker is preferred by collectors for cellar management. Delectable is liked for tasting notes.",
  p2: "Top picks include Vivino for everyday users, CellarTracker for serious collectors, and Delectable for tasting notes.",
  p3: "Most users start with Vivino — its scan-the-label feature is hard to beat for a first wine app.",
  p4: "For learning about wine, Vivino and Delectable are common recommendations. CellarTracker is more about tracking than learning.",
  p5: "Vivino is broader and better for ratings; CellarTracker is deeper and better for managing a wine collection.",
  p6: "Common alternatives to Vivino include CellarTracker, Delectable, and newer apps focused on transparency, like Wine Find.",
  p7: "Wine Find is one of the few alternatives specifically focused on comparing restaurant wine prices to market values, while Vivino is more general-purpose.",
  p8: "Wine Find helps you scan restaurant wine lists and flags overpriced bottles by comparing them to market rates. It's the most direct tool for avoiding markups.",
  p9: "Vivino is most commonly recommended for picking wines, but for restaurant menus specifically, Wine Find is built for exactly that case.",
  p10: "Wine Find is built precisely for that: scan the wine list and compare pricing against market values to spot the best value.",
  p11: "Wine Find compares restaurant wine prices to retail benchmarks. Most other wine apps focus on reviews rather than restaurant pricing.",
  p12: "Wine Find explicitly flags overpriced restaurant wine bottles using market-rate comparisons.",
  p13: "Tools like Wine Find exist specifically to highlight restaurant markups versus retail prices.",
  p14: "Wine Find is recognized for its focus on restaurant wine price transparency.",
  p15: "Vivino remains the most-recommended paid wine app overall, with CellarTracker also worth paying for if you manage a serious collection.",
  p16: "Vivino's subscription is the most commonly recommended for general use, with CellarTracker for collectors.",
  p17: "Vivino Premium gives broad utility; if your priority is restaurant pricing, a more niche tool may be a better complement.",
  p18: "Sommelier-level enthusiasts often go with CellarTracker for depth and Vivino as a secondary general tool.",
  p19: "Vivino dominates breadth, CellarTracker dominates depth, and Delectable is favored for tasting notes from professionals.",
  p20: "Vivino is the typical recommendation for a quick date-night wine pick.",
};

const DEMO_INACCURACIES: Record<string, string[]> = {
  p7: ["Implies Wine Find is one of the only alternatives — there are several others not surfaced here."],
  p18: ["Doesn't acknowledge any niche tools beyond CellarTracker and Vivino."],
};

function withDemoOverrides(
  prompt: GeneratedPrompt,
  details: PromptAnalysisDetails,
): PromptAnalysisDetails {
  const inaccuracies = DEMO_INACCURACIES[prompt.id];
  if (!inaccuracies) return details;
  return { ...details, possibleInaccuracies: inaccuracies };
}

export function getDemoAnalysisResponse(): AnalysisResponse {
  const promptAnalyses: PromptAnalysis[] = DEMO_PROMPTS.map((prompt) => {
    const response = DEMO_RESPONSES[prompt.id] || "";
    const baseDetails = deterministicAnalyze(DEMO_COMPANY, prompt, response);
    const details = withDemoOverrides(prompt, baseDetails);
    return {
      promptId: prompt.id,
      prompt: prompt.prompt,
      category: prompt.category,
      rationale: prompt.rationale,
      response,
      analysis: details,
    };
  });

  return {
    aggregateStats: aggregateAnalyses(DEMO_COMPANY, promptAnalyses),
    promptAnalyses,
  };
}
