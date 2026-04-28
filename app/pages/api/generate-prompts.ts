import { getOpenAIClient } from "@/lib/openai";
import { CompanyInput, GeneratedPrompt, PromptCategory } from "@/types";
import type { NextApiRequest, NextApiResponse } from "next";

const categories: PromptCategory[] = [
  "discovery",
  "comparison",
  "use_case",
  "niche",
  "purchase",
];

function fallbackPrompts(input: CompanyInput): GeneratedPrompt[] {
  const competitors = input.competitors?.join(", ") || "relevant alternatives";
  const generated: Omit<GeneratedPrompt, "id">[] = [
    {
      category: "discovery",
      prompt: `What are the top ${input.category} products today?`,
      rationale: "Broad discovery query.",
    },
    {
      category: "comparison",
      prompt: `How does ${input.companyName} compare to ${competitors}?`,
      rationale: "Direct competitor comparison.",
    },
    {
      category: "use_case",
      prompt: `What product helps with ${input.description.toLowerCase()}?`,
      rationale: "Use-case oriented question.",
    },
    {
      category: "niche",
      prompt: `Which ${input.category} tools are best for specialized needs?`,
      rationale: "Niche differentiation.",
    },
    {
      category: "purchase",
      prompt: `Which ${input.category} product is worth paying for?`,
      rationale: "Purchase intent query.",
    },
  ];

  return Array.from({ length: input.numberOfPrompts }).map((_, index) => {
    const base = generated[index % generated.length];
    return {
      id: `prompt-${index + 1}`,
      category: base.category,
      prompt: base.prompt,
      rationale: base.rationale,
    };
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GeneratedPrompt[] | { error: string }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const input = req.body as CompanyInput;

  if (!input?.companyName || !input?.category || !input?.description) {
    return res.status(400).json({ error: "Missing required company fields" });
  }

  try {
    const client = getOpenAIClient();
    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are generating realistic prompts users would ask AI assistants when discovering, comparing, and evaluating products in a category. Include broad discovery queries, competitor comparisons, use-case queries, niche differentiation queries, and purchase intent queries. The goal is to test whether a specific company appears in AI responses.",
        },
        {
          role: "user",
          content: JSON.stringify({
            company: input,
            instructions:
              "Return strictly JSON: { prompts: Array<{ category, prompt, rationale }> } with categories in discovery|comparison|use_case|niche|purchase",
          }),
        },
      ],
    });

    const raw = completion.output_text;
    const parsed = JSON.parse(raw) as {
      prompts: Array<{ category: PromptCategory; prompt: string; rationale: string }>;
    };

    const prompts = (parsed.prompts || []).slice(0, input.numberOfPrompts).map((item, i) => ({
      id: `prompt-${i + 1}`,
      category: categories.includes(item.category) ? item.category : "discovery",
      prompt: item.prompt,
      rationale: item.rationale,
    }));

    return res.status(200).json(
      prompts.length > 0
        ? prompts
        : fallbackPrompts(input),
    );
  } catch {
    return res.status(200).json(fallbackPrompts(input));
  }
}
