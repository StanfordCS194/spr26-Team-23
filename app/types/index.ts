export type PromptCategory =
  | "discovery"
  | "comparison"
  | "use_case"
  | "niche"
  | "purchase";

export interface CompanyInput {
  companyName: string;
  website: string;
  description: string;
  category: string;
  competitors?: string[];
  numberOfPrompts: number;
}

export interface GeneratedPrompt {
  id: string;
  category: PromptCategory;
  prompt: string;
  rationale: string;
}

export interface PromptAnalysis {
  promptId: string;
  prompt: string;
  category: PromptCategory;
  response: string;
  analysis: {
    targetMentioned: boolean;
    targetRank: number | null;
    mentionedCompetitors: string[];
    allMentionedCompanies: string[];
    sentiment: "positive" | "neutral" | "negative" | "not_mentioned";
    explanation: string;
    usefulQuote: string;
  };
}

export interface CompetitorStats {
  competitor: string;
  mentions: number;
  share: number;
}

export interface AggregateStats {
  visibilityScore: number;
  visibilityByCategory: Record<PromptCategory, number>;
  averageRank: number | null;
  competitorMentionCounts: Record<string, number>;
  shareOfVoice: {
    target: number;
    competitors: CompetitorStats[];
  };
  promptsWhereCompetitorWins: {
    promptId: string;
    prompt: string;
    winningCompetitor: string;
  }[];
  bestPerformingCategory: PromptCategory;
  weakestCategory: PromptCategory;
  extractedDescriptions: string[];
  topMissedOpportunities: {
    promptId: string;
    prompt: string;
    category: PromptCategory;
    competitorMentions: string[];
  }[];
}

export interface AnalysisResponse {
  aggregateStats: AggregateStats;
  promptAnalyses: PromptAnalysis[];
}
