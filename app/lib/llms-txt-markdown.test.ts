import { describe, expect, it } from "vitest";
import { buildLlmsTxtMarkdown, normalizeWebsiteUrl } from "@/lib/llms-txt-markdown";
import { minimalAnalysisFixture, minimalCompanyFixture } from "@/lib/llms-txt-fixtures";

describe("normalizeWebsiteUrl", () => {
  it("prepends https when scheme is missing", () => {
    expect(normalizeWebsiteUrl("acme.example")).toBe("https://acme.example");
  });

  it("preserves explicit https URLs", () => {
    expect(normalizeWebsiteUrl("https://acme.example/path")).toBe(
      "https://acme.example/path",
    );
  });

  it("returns empty string for blank input", () => {
    expect(normalizeWebsiteUrl("  ")).toBe("");
  });
});

describe("buildLlmsTxtMarkdown", () => {
  it("includes company name, description, and visibility score", () => {
    const md = buildLlmsTxtMarkdown(minimalCompanyFixture(), minimalAnalysisFixture());
    expect(md).toContain("# Acme Widgets");
    expect(md).toContain("We build widgets for teams.");
    expect(md).toContain("40% overall visibility");
    expect(md).toContain("https://acme.example");
  });

  it("includes missed-opportunity prompts when present", () => {
    const md = buildLlmsTxtMarkdown(minimalCompanyFixture(), minimalAnalysisFixture());
    expect(md).toContain("best tools for widgets");
  });
});
