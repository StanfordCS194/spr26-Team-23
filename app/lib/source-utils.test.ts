import { describe, expect, it } from "vitest";
import { domainFromUrl, normalizeAnswerSources } from "@/lib/source-utils";

describe("domainFromUrl", () => {
  it("normalizes valid URLs to a display domain", () => {
    expect(domainFromUrl("https://www.example.com/path")).toBe("example.com");
  });

  it("returns an empty string for invalid URLs", () => {
    expect(domainFromUrl("not a url")).toBe("");
  });
});

describe("normalizeAnswerSources", () => {
  it("keeps valid unique sources and trims optional metadata", () => {
    const sources = normalizeAnswerSources([
      {
        url: "https://www.example.com/a",
        title: " Example page ",
        citedText: " cited text ",
        provider: "gemini",
      },
      {
        url: "https://www.example.com/a",
        title: "Duplicate",
        provider: "gemini",
      },
      {
        url: "bad url",
        title: "Bad",
        provider: "gemini",
      },
    ]);

    expect(sources).toEqual([
      {
        url: "https://www.example.com/a",
        title: "Example page",
        domain: "example.com",
        provider: "gemini",
        citedText: "cited text",
      },
    ]);
  });
});
