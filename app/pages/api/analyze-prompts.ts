import { aggregateAnalyses } from "@/lib/aggregation";
import { analyzeResponse } from "@/lib/analysis";
import { getOpenAIClient } from "@/lib/openai";
import { AnalysisResponse, CompanyInput, GeneratedPrompt, PromptAnalysis } from "@/types";
import type { NextApiRequest, NextApiResponse } from "next";

interface AnalyzeBody {
  company: CompanyInput;
  prompts: GeneratedPrompt[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalysisResponse | { error: string }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as AnalyzeBody;

  if (!body?.company || !body?.prompts?.length) {
    return res.status(400).json({ error: "Missing company or prompts" });
  }

  try {
    const client = getOpenAIClient();
    const analyses: PromptAnalysis[] = [];

    for (const prompt of body.prompts) {
      const completion = await client.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are an AI assistant answering users naturally. Return a concise but realistic response with product/company recommendations where relevant.",
          },
          {
            role: "user",
            content: prompt.prompt,
          },
        ],
      });

      const response = completion.output_text || "";
      analyses.push(analyzeResponse(body.company, prompt, response));
    }

    const payload: AnalysisResponse = {
      aggregateStats: aggregateAnalyses(body.company, analyses),
      promptAnalyses: analyses,
    };

    return res.status(200).json(payload);
  } catch {
    return res.status(500).json({ error: "Analysis failed. Try demo mode." });
  }
}
