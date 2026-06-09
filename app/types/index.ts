export type PromptCategory =
  | "discovery"
  | "comparison"
  | "use_case"
  | "niche"
  | "purchase";

export type Sentiment = "positive" | "neutral" | "negative" | "not_mentioned";

export interface CompanyInput {
  companyName: string;
  website: string;
  description: string;
  category: string;
  competitors?: string[];
  numberOfPrompts: number;
  logoUrl?: string;
}

export interface GeneratedPrompt {
  id: string;
  category: PromptCategory;
  prompt: string;
  rationale: string;
}

export interface CacheMetadata {
  status: "hit" | "miss";
  key: string;
  version: string;
  createdAt: string;
  ttlSeconds: number;
}

export interface PromptGenerationResponse {
  prompts: GeneratedPrompt[];
  cache: CacheMetadata;
}

export interface PromptAnalysisDetails {
  targetMentioned: boolean;
  targetRank: number | null;
  mentionedCompetitors: string[];
  allMentionedCompanies: string[];
  sentiment: Sentiment;
  targetDescription: string;
  possibleInaccuracies: string[];
  competitorWon: boolean;
  explanation: string;
  usefulQuote: string;
}

export interface PromptAnalysis {
  promptId: string;
  prompt: string;
  category: PromptCategory;
  rationale: string;
  response: string;
  error?: string;
  analysis: PromptAnalysisDetails;
}

export interface CompetitorStats {
  competitor: string;
  mentions: number;
  share: number;
}

export interface CategoryVisibility {
  mentioned: number;
  total: number;
  percent: number;
}

export interface MissedOpportunity {
  promptId: string;
  prompt: string;
  category: PromptCategory;
  competitorMentions: string[];
  explanation: string;
  resultSummary: string;
  suggestedPageTitle: string;
  suggestedAction: string;
  strongestCompetitor: string;
}

export interface InaccuracyEntry {
  promptId: string;
  prompt: string;
  items: string[];
}

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export interface RecommendationEvidence {
  promptId: string;
  prompt: string;
  category: PromptCategory;
  resultSummary: string;
  competitorMentions: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  priority: RecommendationPriority;
  action: string;
  contentIdeas: string[];
  supportingPrompts: RecommendationEvidence[];
}

export interface AggregateStats {
  visibilityScore: number;
  visibilityCount: { mentioned: number; total: number };
  visibilityByCategory: Record<PromptCategory, CategoryVisibility>;
  averageRank: number | null;
  competitorMentionCounts: Record<string, number>;
  shareOfVoice: { target: number; competitors: CompetitorStats[] };
  topCompetitor: { name: string; mentions: number } | null;
  promptsWhereCompetitorWins: {
    promptId: string;
    prompt: string;
    winningCompetitor: string;
  }[];
  bestPerformingCategory: PromptCategory;
  weakestCategory: PromptCategory;
  extractedDescriptions: string[];
  topMissedOpportunities: MissedOpportunity[];
  possibleInaccuracies: InaccuracyEntry[];
  aiPositioningSummary: string;
  recommendations: Recommendation[];
}

export type AIModel = "gpt-4o" | "claude" | "gemini";

export interface ModelAnalysis {
  model: AIModel;
  promptAnalyses: PromptAnalysis[];
  aggregateStats: AggregateStats;
}

export interface AnalysisResponse {
  models?: ModelAnalysis[];
  aggregateStats: AggregateStats;
  promptAnalyses: PromptAnalysis[];
  cache?: CacheMetadata;
}
