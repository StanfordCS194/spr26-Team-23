import Anthropic from "@anthropic-ai/sdk";
import { normalizeAnswerSources } from "@/lib/source-utils";
import { ModelAnswer } from "@/types";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function queryClaudeWithPrompt(prompt: string): Promise<string> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

interface ClaudeTextBlockForSources {
  type: "text";
  text: string;
  citations?: Array<{
    type: string;
    url?: string;
    title?: string | null;
    cited_text?: string;
  }>;
}

interface ClaudeMessageForSources {
  content: Array<ClaudeTextBlockForSources | { type: string }>;
  usage?: {
    server_tool_use?: {
      web_search_requests?: number;
    } | null;
  };
}

export function extractClaudeWebAnswer(message: ClaudeMessageForSources): ModelAnswer {
  const textBlocks = message.content.filter(
    (block): block is ClaudeTextBlockForSources => block.type === "text",
  );
  const response = textBlocks.map((block) => block.text).join("\n\n");
  const sources = normalizeAnswerSources(
    textBlocks.flatMap((block) =>
      (block.citations ?? [])
        .filter((citation) => citation.type === "web_search_result_location")
        .map((citation) => ({
          url: citation.url,
          title: citation.title,
          citedText: citation.cited_text,
          provider: "claude" as const,
        })),
    ),
  );

  return {
    response,
    sources,
    grounded: sources.length > 0 || Boolean(message.usage?.server_tool_use?.web_search_requests),
  };
}

export async function queryClaudeWithWebPrompt(prompt: string): Promise<ModelAnswer> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 300,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
    messages: [{ role: "user", content: prompt }],
  });

  return extractClaudeWebAnswer(message);
}
