import { CompanyInput, GeneratedPrompt, PromptAnalysis } from "@/types";

const POSITIVE_WORDS = ["best", "excellent", "great", "strong", "recommended"];
const NEGATIVE_WORDS = ["poor", "limited", "weak", "expensive", "not ideal"];

function normalize(value: string): string {
  return value.toLowerCase();
}

function extractFirstSentence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s+/)[0];
  return sentence?.trim() || text.slice(0, 160);
}

function detectSentiment(response: string): "positive" | "neutral" | "negative" {
  const lower = normalize(response);
  const positiveCount = POSITIVE_WORDS.filter((word) => lower.includes(word)).length;
  const negativeCount = NEGATIVE_WORDS.filter((word) => lower.includes(word)).length;

  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

function rankedMentions(response: string, companies: string[]): string[] {
  const lower = normalize(response);

  return companies
    .map((name) => ({ name, index: lower.indexOf(normalize(name)) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.name);
}

export function analyzeResponse(
  company: CompanyInput,
  prompt: GeneratedPrompt,
  response: string,
): PromptAnalysis {
  const competitors = company.competitors || [];
  const ranked = rankedMentions(response, [company.companyName, ...competitors]);
  const targetIndex = ranked.findIndex(
    (name) => normalize(name) === normalize(company.companyName),
  );
  const targetMentioned = targetIndex >= 0;

  const mentionedCompetitors = competitors.filter((name) =>
    normalize(response).includes(normalize(name)),
  );

  const sentiment = targetMentioned ? detectSentiment(response) : "not_mentioned";
  const usefulQuote = extractFirstSentence(response);

  return {
    promptId: prompt.id,
    prompt: prompt.prompt,
    category: prompt.category,
    response,
    analysis: {
      targetMentioned,
      targetRank: targetMentioned ? targetIndex + 1 : null,
      mentionedCompetitors,
      allMentionedCompanies: ranked,
      sentiment,
      explanation: targetMentioned
        ? `${company.companyName} is mentioned in this answer.`
        : `${company.companyName} is absent while other options are discussed.`,
      usefulQuote,
    },
  };
}
