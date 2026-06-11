import { describe, expect, it } from "vitest";
import { extractClaudeWebAnswer } from "@/lib/anthropic";
import { extractGeminiWebAnswer } from "@/lib/gemini";
import { extractOpenAIWebSources } from "@/lib/openai";

describe("provider web citation extraction", () => {
  it("extracts OpenAI URL citation annotations", () => {
    const sources = extractOpenAIWebSources({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Wine apps are discussed here.",
              annotations: [
                {
                  type: "url_citation",
                  start_index: 0,
                  end_index: 9,
                  url: "https://example.com/wine",
                  title: "Wine apps",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(sources).toEqual([
      {
        url: "https://example.com/wine",
        title: "Wine apps",
        domain: "example.com",
        provider: "gpt-4o",
        citedText: "Wine apps",
      },
    ]);
  });

  it("extracts Claude web search citations", () => {
    const answer = extractClaudeWebAnswer({
      content: [
        {
          type: "text",
          text: "Vivino is a common wine app.",
          citations: [
            {
              type: "web_search_result_location",
              url: "https://vivino.com",
              title: "Vivino",
              cited_text: "Vivino wine app",
            },
          ],
        },
      ],
      usage: { server_tool_use: { web_search_requests: 1 } },
    });

    expect(answer.response).toBe("Vivino is a common wine app.");
    expect(answer.grounded).toBe(true);
    expect(answer.sources).toEqual([
      {
        url: "https://vivino.com",
        title: "Vivino",
        domain: "vivino.com",
        provider: "claude",
        citedText: "Vivino wine app",
      },
    ]);
  });

  it("extracts Gemini grounding chunks and support text", () => {
    const answer = extractGeminiWebAnswer({
      text: "CellarTracker appears in wine app results.",
      candidates: [
        {
          groundingMetadata: {
            webSearchQueries: ["wine app results"],
            groundingChunks: [
              { web: { uri: "https://cellartracker.com", title: "CellarTracker" } },
            ],
            groundingSupports: [
              {
                segment: { text: "CellarTracker appears in wine app results." },
                groundingChunkIndices: [0],
              },
            ],
          },
        },
      ],
    });

    expect(answer.grounded).toBe(true);
    expect(answer.sources).toEqual([
      {
        url: "https://cellartracker.com",
        title: "CellarTracker",
        domain: "cellartracker.com",
        provider: "gemini",
        citedText: "CellarTracker appears in wine app results.",
      },
    ]);
  });
});
